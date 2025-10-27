import React, { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { PaginationDialog } from './components/PaginationDialog'; // New import
import { Header } from './components/Header';
import { StylePalette } from './components/StylePalette';
import { EditorCanvas, EditorApi } from './components/EditorCanvas';
import { TabbedPanel, Tab } from './components/TabbedPanel';
import { ExportPanel } from './components/ExportPanel';
import { MetadataPanel } from './components/MetadataPanel';
import { CssPanel } from './components/CssPanel'; // New import for the container panel
import { TocPanel } from './components/TocPanel';
import { StructurePanel } from './components/StructurePanel';
import { SearchPanel } from './components/SearchPanel';
import { DocumentTypeSelection } from './components/DocumentTypeSelection';
import { StyleManager } from './components/StyleManager';
import { STYLES as INITIAL_STYLES } from './constants';
import { VersionHistoryPanel } from './components/VersionHistoryPanel'; // New import for VersionHistoryPanel
import { LoremIpsumDialog } from './components/LoremIpsumDialog'; // New import
import type { DocumentBlock, StyleKey, DocumentType, Metadata, Style, VisualEditorSettings, DocumentVersion, EditorLayoutSettings } from './types';
import { GoogleGenAI, Type } from "@google/genai";
import { LoadingOverlay } from './components/LoadingOverlay';

const journalTemplate: DocumentBlock[] = [
  { id: 2, style: 'abstract_heading', content: 'Resumé', level: 0 },
  { id: 3, style: 'abstract', content: 'Skriv et kort resumé af din artikel her.', level: 0 },
  { id: 4, style: 'section_heading_1', content: '1. Introduktion', level: 0 },
  { id: 5, style: 'body', content: 'Dette er det første afsnit i din artikel.', level: 0 },
];

const bookTemplate: DocumentBlock[] = [
    { id: 3, style: 'del', content: 'Del I: Den Første Tid', level: 0 },
    { id: 4, style: 'kapitel', content: 'Kapitel 1: Begyndelsen', level: 0 },
    { id: 5, style: 'body', content: 'Begynd at skrive det første kapitel af din bog her', level: 0 },
];

const defaultPdfCss = `/* 
  Brug denne editor til at style din PDF-eksport.
  Regler her vil tilsidesætte standardindstillingerne fra fanen "Eksport".
  Brug 'pt' for skriftstørrelser.

  Eksempel:
*/

[data-style="title"] {
  font-size: 28pt;
  font-weight: bold;
  color: #000000;
  text-align: center;
  margin-bottom: 24pt;
}

[data-style="body"] {
  font-size: 11pt;
  color: #333333;
  margin-bottom: 5pt;
}

[data-style="section_heading_1"] {
  font-size: 18pt;
  font-weight: bold;
  color: #1E40AF;
  margin-top: 10pt;
  margin-bottom: 8pt;
}
`;

const defaultEditorLayout: EditorLayoutSettings = {
  paperWidth: '210mm',
  paperHeight: '297mm',
  marginTop: '2cm',
  marginRight: '2cm',
  marginBottom: '2cm',
  marginLeft: '2cm',
};

const convertCssUnitToPx = (value: string, dimension: 'width' | 'height' = 'width'): number => {
    if (typeof document === 'undefined') return 0;
    const temp = document.createElement("div");
    temp.style.position = "absolute";
    temp.style.visibility = "hidden";
    
    const unitMatch = value.match(/[a-zA-Z%]+$/);
    const unit = unitMatch ? unitMatch[0] : 'px';
    const number = parseFloat(value) || 0;

    temp.style.width = `1000${unit}`;
    temp.style.height = `1000${unit}`;

    document.body.appendChild(temp);
    let px = 0;
    try {
        const rect = temp.getBoundingClientRect();
        px = (dimension === 'width' ? rect.width : rect.height) / 1000 * number;
    } catch (e) {
        console.error("Failed to convert CSS unit:", e);
    } finally {
        document.body.removeChild(temp);
    }
    return px;
};


const App: React.FC = () => {
  const [documentType, setDocumentType] = useState<DocumentType | null>(null);
  const [blocks, setBlocks] = useState<DocumentBlock[] | null>(null);
  const [metadata, setMetadata] = useState<Metadata | null>(null);
  
  const editorApiRef = useRef<EditorApi>(null);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);

  const [styles, setStyles] = useState<Record<StyleKey, Style>>(() => {
    try {
      const savedStyles = localStorage.getItem('customStyles');
      const parsedStyles = savedStyles ? JSON.parse(savedStyles) : INITIAL_STYLES;
      return parsedStyles;
    } catch (e) {
      console.error("App.tsx: Failed to load styles from localStorage, using initial styles:", e);
      return INITIAL_STYLES;
    }
  });

  const [editorLayout, setEditorLayout] = useState<EditorLayoutSettings>(() => {
    try {
      const savedLayout = localStorage.getItem('editorLayoutSettings');
      return savedLayout ? JSON.parse(savedLayout) : defaultEditorLayout;
    } catch (e) {
      console.error("Failed to load editor layout settings, using defaults:", e);
      return defaultEditorLayout;
    }
  });

  const updateAndPersistLayout = useCallback((newLayoutAction: React.SetStateAction<EditorLayoutSettings>) => {
    setEditorLayout(prevLayout => {
      const resolvedLayout = typeof newLayoutAction === 'function' ? newLayoutAction(prevLayout) : newLayoutAction;
      try {
        localStorage.setItem('editorLayoutSettings', JSON.stringify(resolvedLayout));
      } catch (e) {
        console.error("Failed to save editor layout to localStorage:", e);
      }
      return resolvedLayout;
    });
  }, []);

  const updateAndPersistStyles = useCallback((newStylesAction: React.SetStateAction<Record<StyleKey, Style>>) => {
    setStyles(prevStyles => {
        const resolvedStyles = typeof newStylesAction === 'function' ? newStylesAction(prevStyles) : newStylesAction;
        try {
            const stylesJson = JSON.stringify(resolvedStyles);
            localStorage.setItem('customStyles', stylesJson);
        } catch (e) {
            console.error("App.tsx: Failed to save styles to localStorage:", e);
        }
        return resolvedStyles;
    });
  }, []);

  const generateDynamicCss = useCallback((currentStyles: Record<StyleKey, Style>, layoutSettings: EditorLayoutSettings) => {
    let css = '';
    const editorWrapperId = 'prosemirror-editor-wrapper';
    const sharedStyleClass = 'prosemirror-styled-content';

    // Add layout styles for the content area within the page
    css += `
      :root {
        --page-margin-top: ${layoutSettings.marginTop};
        --page-margin-right: ${layoutSettings.marginRight};
        --page-margin-bottom: ${layoutSettings.marginBottom};
        --page-margin-left: ${layoutSettings.marginLeft};
        --page-break-height: calc(${layoutSettings.marginTop} + ${layoutSettings.marginBottom});
      }
      #${editorWrapperId} .ProseMirror {
        padding: ${layoutSettings.marginTop} ${layoutSettings.marginRight} ${layoutSettings.marginBottom} ${layoutSettings.marginLeft} !important;
      }
    `;

    for (const styleKey in currentStyles) {
      const style = currentStyles[styleKey];
      if (style.visualSettings) {
        const settings = style.visualSettings;
        let styleCss = '';

        if (settings.fontFamily) styleCss += `font-family: ${settings.fontFamily} !important;\n`;
        if (settings.color) styleCss += `color: ${settings.color} !important;\n`;
        if (settings.fontWeight) styleCss += `font-weight: ${settings.fontWeight} !important;\n`;
        if (settings.fontSize !== undefined) styleCss += `font-size: ${settings.fontSize}px !important;\n`;
        if (settings.lineHeight !== undefined) styleCss += `line-height: ${settings.lineHeight} !important;\n`;
        if (settings.fontStyle) styleCss += `font-style: ${settings.fontStyle} !important;\n`;
        if (settings.textTransform) styleCss += `text-transform: ${settings.textTransform} !important;\n`;
        
        if (settings.textDecoration) {
            styleCss += `text-decoration: ${settings.textDecoration} !important;\n`;
        }

        if (settings.textAlign) styleCss += `text-align: ${settings.textAlign} !important;\n`;
        
        if (settings.textShadow === 'small') styleCss += `text-shadow: 1px 1px 2px rgba(0,0,0,0.2) !important;\n`;
        else if (settings.textShadow === 'medium') styleCss += `text-shadow: 2px 2px 4px rgba(0,0,0,0.4) !important;\n`;
        else if (settings.textShadow === 'large') styleCss += `text-shadow: 3px 3px 6px rgba(0,0,0,0.6) !important;\n`;
        else if (settings.textShadow === 'none') styleCss += `text-shadow: none !important;\n`;

        if (settings.wordBreak) styleCss += `word-break: ${settings.wordBreak} !important;\n`;
        if (settings.letterSpacing !== undefined) styleCss += `letter-spacing: ${settings.letterSpacing}px !important;\n`;
        if (settings.wordSpacing !== undefined) styleCss += `word-spacing: ${settings.wordSpacing}px !important;\n`;
        if (settings.columnCount !== undefined) styleCss += `column-count: ${settings.columnCount} !important;\n`;
        if (settings.direction) styleCss += `direction: ${settings.direction} !important;\n`;

        if (styleCss) {
          css += `.${sharedStyleClass} [data-style="${style.key}"] {\n${styleCss}}\n`;
        }
      }
    }
    return css;
  }, []);

  useEffect(() => {
    const styleElement = document.getElementById('dynamic-styles');
    if (styleElement) {
        styleElement.innerHTML = generateDynamicCss(styles, editorLayout);
    }
  }, [styles, editorLayout, generateDynamicCss]);
  
  const [isStyleManagerOpen, setIsStyleManagerOpen] = useState(false);
  
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    if (typeof window !== 'undefined' && window.localStorage) {
      const storedTheme = window.localStorage.getItem('theme');
      if (storedTheme === 'light' || storedTheme === 'dark') {
        return storedTheme;
      }
      if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
        return 'dark';
      }
    }
    return 'light';
  });

  useEffect(() => {
    const root = window.document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    localStorage.setItem('theme', theme);
  }, [theme]);

  const handleThemeToggle = () => {
    setTheme(prevTheme => prevTheme === 'light' ? 'dark' : 'light');
  };

  const handleUndo = useCallback(() => editorApiRef.current?.undo(), []);
  const handleRedo = useCallback(() => editorApiRef.current?.redo(), []);
  
  const [pdfCss, setPdfCss] = useState<string>(defaultPdfCss);
  const [isLeftSidebarOpen, setIsLeftSidebarOpen] = useState(true);
  const [isRightSidebarOpen, setIsRightSidebarOpen] = useState(true);
  const [rightSidebarWidth, setRightSidebarWidth] = useState(560);
  const [isResizing, setIsResizing] = useState(false);
  const resizeDataRef = useRef<{ startX: number; startWidth: number } | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<{ count: number; current: number }>({ count: 0, current: -1 });
  const [activeBlockId, setActiveBlockId] = useState<number | null>(null);
  const [isPaginated, setIsPaginated] = useState(false);
  const [totalPages, setTotalPages] = useState(1);
  const [startPageNumber, setStartPageNumber] = useState(1);
  const [isPaginationDialogOpen, setIsPaginationDialogOpen] = useState(false);
  const [isLoremIpsumDialogOpen, setIsLoremIpsumDialogOpen] = useState(false);
  const [isPaginating, setIsPaginating] = useState(false);
  const [isSelectionEmpty, setIsSelectionEmpty] = useState(true);

  const [ai, setAi] = useState<GoogleGenAI | null>(null);

  const [versions, setVersions] = useState<DocumentVersion[]>([]);
  
  useEffect(() => {
    try {
      const genAIInstance = new GoogleGenAI({ apiKey: process.env.API_KEY as string });
      setAi(genAIInstance);
    } catch (e) {
      console.error("App.tsx: Failed to initialize GoogleGenAI. Make sure API_KEY is set in your environment.", e);
    }
  }, []);

  useEffect(() => {
    try {
      const savedVersions = localStorage.getItem('documentVersions');
      if (savedVersions) {
        const parsedVersions: DocumentVersion[] = JSON.parse(savedVersions);
        setVersions(parsedVersions);
      }
    } catch (e) {
      console.error("Failed to load document versions from localStorage:", e);
      setVersions([]);
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem('documentVersions', JSON.stringify(versions));
    } catch (e) {
      console.error("Failed to save document versions to localStorage:", e);
    }
  }, [versions]);
  
  const saveCurrentVersion = useCallback((name?: string) => {
    if (!blocks || !metadata) {
      alert("Kan ikke gemme version: Intet dokumentindhold eller metadata at gemme.");
      return;
    }

    const newVersion: DocumentVersion = {
      id: Date.now().toString(),
      timestamp: Date.now(),
      name: name && name.trim() !== '' ? name.trim() : `Auto-gemt ${new Date().toLocaleString()}`,
      blocks: JSON.parse(JSON.stringify(blocks)),
      metadata: JSON.parse(JSON.stringify(metadata)),
    };

    setVersions(prev => [...prev, newVersion]);
    alert(`Version "${newVersion.name}" gemt.`);
  }, [blocks, metadata]);

  const loadVersion = useCallback((versionToLoad: DocumentVersion) => {
    if (window.confirm("Er du sikker på, at du vil indlæse denne version? Alle ikke-gemte ændringer vil gå tabt.")) {
      setBlocks(JSON.parse(JSON.stringify(versionToLoad.blocks)));
      setMetadata(JSON.parse(JSON.stringify(versionToLoad.metadata)));
      alert(`Version "${versionToLoad.name}" indlæst.`);
    }
  }, []);

  const deleteVersion = useCallback((versionId: string) => {
    if (window.confirm("Er du sikker på, at du vil slette denne version? Dette kan ikke fortrydes.")) {
      setVersions(prev => prev.filter(v => v.id !== versionId));
      alert("Version slettet.");
    }
  }, []);

  const updateVersionName = useCallback((versionId: string, newName: string) => {
    setVersions(prev => prev.map(v => v.id === versionId ? { ...v, name: newName } : v));
  }, []);
  
  const handleToggleLeftSidebar = useCallback(() => setIsLeftSidebarOpen(prev => !prev), []);
  const handleToggleRightSidebar = useCallback(() => setIsRightSidebarOpen(prev => !prev), []);

  const handleResizeMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
    resizeDataRef.current = { startX: e.clientX, startWidth: rightSidebarWidth };
  }, [rightSidebarWidth]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing || !resizeDataRef.current) return;
      const deltaX = e.clientX - resizeDataRef.current.startX;
      const newWidth = resizeDataRef.current.startWidth - deltaX;
      const minWidth = 320;
      const maxWidth = 1000;
      if (newWidth >= minWidth && newWidth <= maxWidth) setRightSidebarWidth(newWidth);
    };
    const handleMouseUp = () => {
      setIsResizing(false);
      resizeDataRef.current = null;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
    if (isResizing) {
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing]);

  const handleSelectDocumentType = useCallback((type: DocumentType) => {
    setDocumentType(type);
    if (type === 'journal') {
        setBlocks(journalTemplate);
        setMetadata({ title: 'Din artikels titel', subtitle: '', authors: [{ firstName: '', lastName: '' }] });
    } else {
        setBlocks(bookTemplate);
        setMetadata({ 
            title: 'Bogtitel', 
            subtitle: 'Undertitel til din bog',
            authors: [{ firstName: '', lastName: '' }],
            pIsbn: '',
            eIsbn: '',
            publicationDate: new Date().toISOString().split('T')[0],
            edition: '',
            bookType: 'Lovkommentar',
            coverImageSrc: '',
            description: 'Indtast en kort beskrivelse af bogen her.',
        });
    }
  }, []);

  const handleImportWord = useCallback(async (file: File) => {
    if (!ai) {
      alert("AI-tjenesten er ikke tilgængelig. Kan ikke behandle Word-dokument. Kontroller venligst, om API_KEY er konfigureret.");
      return;
    }
    const reader = new FileReader();
    reader.onload = async (e) => {
        const arrayBuffer = e.target?.result;
        if (!arrayBuffer) return;
        try {
            // @ts-ignore
            const result = await mammoth.convertToHtml({ arrayBuffer: arrayBuffer });
            const html = result.value; 
            const styleDescriptions = Object.values(styles).map((s: Style) => `* \`${s.key}\`: ${s.name} - ${s.description}`).join('\n');
            const documentTypePrompt = documentType === 'book' 
              ? "This is a book. Use 'del' for main parts and 'kapitel' for chapters as the highest-level headings."
              : "This is a journal article. Use 'section_heading_1', 'section_heading_2', etc., for headings."
            const prompt = `
You are an expert document structurer... [rest of prompt unchanged]
...
HTML to process:
\`\`\`html
${html}
\`\`\`
`;
            const responseSchema = {
              type: Type.OBJECT, properties: { metadata: { type: Type.OBJECT, properties: { title: { type: Type.STRING }, subtitle: { type: Type.STRING } }, required: ['title'] }, blocks: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { style: { type: Type.STRING }, content: { type: Type.STRING } }, required: ['style', 'content'] } } } };
            const response = await ai.models.generateContent({ model: 'gemini-2.5-flash', contents: [{text: prompt}], config: { responseMimeType: "application/json", responseSchema: responseSchema } });
            const parsedResponse = JSON.parse(response.text);
            const validStyleKeys = new Set(Object.keys(styles));
            const newBlocks: DocumentBlock[] = parsedResponse.blocks
              .filter((block: any) => validStyleKeys.has(block.style))
              .map((block: any, index: number) => ({ id: Date.now() + index, style: block.style as StyleKey, content: block.content, level: 0 }));
            
            setBlocks(newBlocks);
            setMetadata(prev => ({ ...(prev as Metadata), title: parsedResponse.metadata.title || prev?.title || '', subtitle: parsedResponse.metadata.subtitle || prev?.subtitle || '' }));
            
        } catch (error) {
            console.error("App.tsx: Error processing Word document with AI:", error);
            alert("Kunne ikke behandle Word-dokumentet ved hjælp af AI. Sørg for at din API-nøgle er korrekt, og at dokumentet er formatteret korrekt.");
        }
    };
    reader.readAsArrayBuffer(file);
  }, [ai, documentType, styles]);

  const handleAddBlock = useCallback((styleKey: StyleKey) => editorApiRef.current?.addBlock(styleKey), []);
  const handleApplyStyle = useCallback((styleKey: StyleKey) => editorApiRef.current?.applyStyle(styleKey), []);
  const handleAddFootnote = useCallback(() => editorApiRef.current?.addFootnote(), []);

  const handleMetadataChange = useCallback((newMetadataAction: React.SetStateAction<Metadata>) => {
    setMetadata(newMetadataAction as any);
  }, []);
  
  const handleRemoveEmptyBlocks = useCallback(() => editorApiRef.current?.removeEmptyBlocks(), []);

  const handleSearch = useCallback((query: string) => {
    setSearchQuery(query);
    editorApiRef.current?.search(query);
  }, []);

  const goToNextResult = useCallback(() => editorApiRef.current?.goToSearchResult(1), []);
  const goToPrevResult = useCallback(() => editorApiRef.current?.goToSearchResult(-1), []);

  const handleBlockNavigationClick = useCallback((blockId: number) => editorApiRef.current?.scrollToBlock(blockId), []);

  const handleSelectionChange = useCallback(({activeBlockId, searchResults, canUndo, canRedo, isSelectionEmpty, isPaginated: paginatedStatus, totalPages: newTotalPages}) => {
    setActiveBlockId(activeBlockId);
    if (searchResults) setSearchResults(searchResults);
    setCanUndo(canUndo);
    setCanRedo(canRedo);
    if (isSelectionEmpty !== undefined) {
      setIsSelectionEmpty(isSelectionEmpty);
    }
    if (paginatedStatus !== undefined) {
      setIsPaginated(paginatedStatus);
    }
    if (newTotalPages !== undefined) {
        setTotalPages(newTotalPages);
    }
  }, []);
  
  const handleTogglePagination = useCallback(() => {
    if (isPaginated) {
      editorApiRef.current?.removePagination();
    } else {
      setIsPaginationDialogOpen(true);
    }
  }, [isPaginated]);

  const handleConfirmPagination = useCallback((startPage: number) => {
    setIsPaginationDialogOpen(false);
    setIsPaginating(true);
    // Use a timeout to allow the UI to update and show the loading spinner
    setTimeout(() => {
        try {
            editorApiRef.current?.runPagination(startPage);
            setStartPageNumber(startPage);
        } catch (e) {
            console.error("Failed during pagination:", e);
            alert("Der opstod en fejl under sideinddelingen.");
        } finally {
            setIsPaginating(false);
        }
    }, 50);
  }, []);
  
  const handleConfirmLoremIpsum = useCallback((options: { paragraphs: number; parts: number; chapters: number }) => {
    editorApiRef.current?.insertLoremIpsum(options);
    setIsLoremIpsumDialogOpen(false);
  }, []);

  const totalEditorHeight = useMemo(() => {
    if (!isPaginated) return undefined;
    const pageHeightPx = convertCssUnitToPx(editorLayout.paperHeight, 'height');
    const gutterHeight = 20; // From CSS: .page-break-gutter height
    if (isNaN(pageHeightPx) || pageHeightPx === 0) return undefined;
    return totalPages * pageHeightPx + (totalPages - 1) * gutterHeight;
  }, [isPaginated, totalPages, editorLayout.paperHeight]);

  if (!documentType || !blocks || !metadata) {
    return <DocumentTypeSelection onSelect={handleSelectDocumentType} />;
  }

  return (
    <div className="flex flex-col h-screen font-sans bg-gray-50 dark:bg-gray-900 text-gray-800 dark:text-gray-200">
      {isStyleManagerOpen && <StyleManager styles={styles} setStyles={updateAndPersistStyles} onClose={() => setIsStyleManagerOpen(false)} />}
      <PaginationDialog
        isOpen={isPaginationDialogOpen}
        onClose={() => setIsPaginationDialogOpen(false)}
        onConfirm={handleConfirmPagination}
      />
      <LoremIpsumDialog
        isOpen={isLoremIpsumDialogOpen}
        onClose={() => setIsLoremIpsumDialogOpen(false)}
        onConfirm={handleConfirmLoremIpsum}
        documentType={documentType}
      />
      {isPaginating && <LoadingOverlay />}
      <Header 
        onImportWord={handleImportWord} 
        isLeftSidebarOpen={isLeftSidebarOpen}
        onToggleLeftSidebar={handleToggleLeftSidebar}
        isRightSidebarOpen={isRightSidebarOpen}
        onToggleRightSidebar={handleToggleRightSidebar}
        onUndo={handleUndo}
        onRedo={handleRedo}
        canUndo={canUndo}
        canRedo={canRedo}
        onRemoveEmptyBlocks={handleRemoveEmptyBlocks}
        onGenerateLoremIpsum={() => setIsLoremIpsumDialogOpen(true)}
        theme={theme}
        onToggleTheme={handleThemeToggle}
        metadata={metadata}
        onMetadataChange={handleMetadataChange}
        documentType={documentType}
        onTitleFocus={() => editorApiRef.current?.focusTitle()}
        onSaveVersion={saveCurrentVersion}
        onTogglePagination={handleTogglePagination}
        isPaginated={isPaginated}
      />
      <main className="flex-grow flex overflow-hidden">
        {isLeftSidebarOpen && (
            <div className={`w-[280px] flex-shrink-0 overflow-hidden transition-all duration-300`}>
                <StylePalette 
                  styles={Object.values(styles)} 
                  blocks={blocks}
                  onAddBlock={handleAddBlock}
                  onApplyStyle={handleApplyStyle}
                  onAddFootnote={handleAddFootnote}
                  isSelectionEmpty={isSelectionEmpty}
                  documentType={documentType}
                  selectedBlockIds={new Set(activeBlockId ? [activeBlockId] : [])}
                  disabledStyles={new Set()}
                  onOpenStyleManager={() => setIsStyleManagerOpen(true)}
                />
            </div>
        )}
        <div className="flex-grow min-w-0 overflow-y-auto bg-gray-200 dark:bg-slate-900 p-4 sm:p-8">
            <div 
              id="prosemirror-editor-wrapper" 
              className={`editor-container ${isPaginated ? 'paginated' : ''}`}
              style={{ 
                  width: editorLayout.paperWidth, 
                  minHeight: isPaginated && totalEditorHeight ? `${totalEditorHeight}px` : editorLayout.paperHeight 
              }}
              data-start-page={isPaginated ? startPageNumber : undefined}
              data-last-page={isPaginated ? startPageNumber + totalPages - 1 : undefined}
              data-total-pages={isPaginated ? totalPages : undefined}
            >
              <EditorCanvas 
                styles={styles}
                documentType={documentType}
                blocks={blocks}
                onBlocksChange={setBlocks}
                editorApiRef={editorApiRef}
                onSelectionChange={handleSelectionChange}
                searchQuery={searchQuery}
                layoutSettings={editorLayout}
              />
            </div>
        </div>
        {isRightSidebarOpen && (
            <>
                <div 
                  className="cursor-col-resize bg-gray-200 dark:bg-gray-700 hover:bg-blue-400 dark:hover:bg-blue-600 w-2 self-stretch"
                  onMouseDown={handleResizeMouseDown}
                />
                <div style={{width: `${rightSidebarWidth}px`}} className={`overflow-hidden min-w-0 transition-all duration-300 flex flex-col gap-4 p-4 flex-shrink-0`}>
                  <SearchPanel
                    query={searchQuery}
                    onQueryChange={handleSearch}
                    resultCount={searchResults.count}
                    currentIndex={searchResults.current}
                    onNext={goToNextResult}
                    onPrev={goToPrevResult}
                  />
                  <div className="flex-grow min-h-0">
                    <TabbedPanel>
                      <Tab label="Indholdsfortegnelse">
                        <TocPanel 
                          blocks={blocks}
                          onBlockClick={handleBlockNavigationClick}
                          activeBlockId={activeBlockId}
                        />
                      </Tab>
                      <Tab label="Struktur">
                        <StructurePanel 
                          styles={styles}
                          blocks={blocks} 
                          documentType={documentType} 
                          onBlockClick={handleBlockNavigationClick}
                        />
                      </Tab>
                      <Tab label="Metadata">
                        <MetadataPanel 
                          metadata={metadata} 
                          onMetadataChange={handleMetadataChange}
                          documentType={documentType}
                        />
                      </Tab>
                      <Tab label="Eksport">
                        <ExportPanel 
                          styles={styles}
                          documentBlocks={blocks} 
                          metadata={metadata} 
                          documentType={documentType}
                          pdfCss={pdfCss}
                        />
                      </Tab>
                      <Tab label="CSS">
                        <CssPanel
                          pdfCss={pdfCss}
                          onPdfCssChange={setPdfCss}
                          styles={styles}
                          onStyleChange={updateAndPersistStyles}
                          layoutSettings={editorLayout}
                          onLayoutSettingsChange={updateAndPersistLayout}
                        />
                      </Tab>
                      <Tab label="Versioner">
                        <VersionHistoryPanel
                          versions={versions}
                          onSave={saveCurrentVersion}
                          onLoad={loadVersion}
                          onDelete={deleteVersion}
                          onUpdateName={updateVersionName}
                        />
                      </Tab>
                    </TabbedPanel>
                  </div>
                </div>
            </>
        )}
      </main>
    </div>
  );
};

export default App;