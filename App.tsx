

import React, { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { Header } from './components/Header';
import { StylePalette } from './components/StylePalette';
import { EditorCanvas, EditorApi } from './components/EditorCanvas';
import { TabbedPanel } from './components/TabbedPanel';
import { ExportPanel } from './components/ExportPanel';
import { MetadataPanel } from './components/MetadataPanel';
import { PdfCssPanel } from './components/PdfCssPanel'; // Renamed from CssPanel
import { VisualEditorCssPanel } from './components/VisualEditorCssPanel'; // New import
import { TocPanel } from './components/TocPanel';
import { StructurePanel } from './components/StructurePanel';
import { SearchPanel } from './components/SearchPanel';
import { DocumentTypeSelection } from './components/DocumentTypeSelection';
import { StyleManager } from './components/StyleManager';
import { STYLES as INITIAL_STYLES } from './constants';
import { VersionHistoryPanel } from './components/VersionHistoryPanel'; // New import for VersionHistoryPanel
// Fix: Import TabProps from types.ts
import type { DocumentBlock, StyleKey, DocumentType, Metadata, Style, VisualEditorSettings, TabProps, DocumentVersion, EditorLayoutSettings } from './types';
import { GoogleGenAI, Type } from "@google/genai";

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

// Fix: Use the imported TabProps interface
const Tab: React.FC<TabProps> = ({ children }) => <>{children}</>;

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
      console.log("App.tsx: Loading styles from localStorage (customStyles):", savedStyles);
      const parsedStyles = savedStyles ? JSON.parse(savedStyles) : INITIAL_STYLES;
      console.log("App.tsx: Initializing styles state with:", parsedStyles);
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
        console.log("App.tsx: Resolved new styles state for saving:", resolvedStyles);
        try {
            const stylesJson = JSON.stringify(resolvedStyles);
            localStorage.setItem('customStyles', stylesJson);
            console.log("App.tsx: Storing in localStorage 'customStyles':", stylesJson.substring(0, 200) + (stylesJson.length > 200 ? '...' : ''));
            const verifiedStyles = localStorage.getItem('customStyles');
            console.log("App.tsx: Verifying localStorage 'customStyles' immediately after set:", verifiedStyles?.substring(0, 200) + (verifiedStyles && verifiedStyles.length > 200 ? '...' : ''));
        } catch (e) {
            console.error("App.tsx: Failed to save styles to localStorage:", e);
        }
        return resolvedStyles;
    });
  }, []);

  const generateDynamicCss = useCallback((currentStyles: Record<StyleKey, Style>, layoutSettings: EditorLayoutSettings) => {
    let css = '';
    const editorWrapperId = 'prosemirror-editor-wrapper';

    // Add layout styles
    css += `
      .editor-container {
        max-width: ${layoutSettings.paperWidth} !important;
        min-height: ${layoutSettings.paperHeight} !important;
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
        
        // Simplified textDecoration handling to directly use the selected value
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
          // Use the ID selector for higher specificity
          css += `#${editorWrapperId} [data-style="${style.key}"] {\n${styleCss}}\n`;
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

  const [ai, setAi] = useState<GoogleGenAI | null>(null);

  // New state for version control
  const [versions, setVersions] = useState<DocumentVersion[]>([]);
  
  useEffect(() => {
    try {
      const genAIInstance = new GoogleGenAI({ apiKey: process.env.API_KEY as string });
      setAi(genAIInstance);
    } catch (e) {
      console.error("App.tsx: Failed to initialize GoogleGenAI. Make sure API_KEY is set in your environment.", e);
    }
  }, []);

  // Load versions from localStorage on initial render
  useEffect(() => {
    try {
      const savedVersions = localStorage.getItem('documentVersions');
      if (savedVersions) {
        const parsedVersions: DocumentVersion[] = JSON.parse(savedVersions);
        setVersions(parsedVersions);
      }
    } catch (e) {
      console.error("Failed to load document versions from localStorage:", e);
      setVersions([]); // Start fresh if loading fails
    }
  }, []);

  // Persist versions to localStorage whenever `versions` state changes
  useEffect(() => {
    try {
      localStorage.setItem('documentVersions', JSON.stringify(versions));
    } catch (e) {
      console.error("Failed to save document versions to localStorage:", e);
    }
  }, [versions]);
  
  // New: Function to save the current document state as a version
  const saveCurrentVersion = useCallback((name?: string) => {
    if (!blocks || !metadata) {
      alert("Kan ikke gemme version: Intet dokumentindhold eller metadata at gemme.");
      return;
    }

    const newVersion: DocumentVersion = {
      id: Date.now().toString(), // Simple unique ID
      timestamp: Date.now(),
      name: name && name.trim() !== '' ? name.trim() : `Auto-gemt ${new Date().toLocaleString()}`,
      blocks: JSON.parse(JSON.stringify(blocks)), // Deep copy
      metadata: JSON.parse(JSON.stringify(metadata)), // Deep copy
    };

    setVersions(prev => [...prev, newVersion]);
    alert(`Version "${newVersion.name}" gemt.`);
  }, [blocks, metadata]);

  // New: Function to load a specific version
  const loadVersion = useCallback((versionToLoad: DocumentVersion) => {
    if (window.confirm("Er du sikker på, at du vil indlæse denne version? Alle ikke-gemte ændringer vil gå tabt.")) {
      setBlocks(JSON.parse(JSON.stringify(versionToLoad.blocks))); // Deep copy
      setMetadata(JSON.parse(JSON.stringify(versionToLoad.metadata))); // Deep copy
      alert(`Version "${versionToLoad.name}" indlæst.`);
    }
  }, []);

  // New: Function to delete a specific version
  const deleteVersion = useCallback((versionId: string) => {
    if (window.confirm("Er du sikker på, at du vil slette denne version? Dette kan ikke fortrydes.")) {
      setVersions(prev => prev.filter(v => v.id !== versionId));
      alert("Version slettet.");
    }
  }, []);

  // New: Function to update a version's name
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
            // Fix: Explicitly type `s` as `Style` to resolve properties.
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

  const handleMetadataChange = useCallback((newMetadataAction: React.SetStateAction<Metadata>) => {
    setMetadata(newMetadataAction as any); // Let's trust the caller for now
  }, []);
  
  const handleRemoveEmptyBlocks = useCallback(() => editorApiRef.current?.removeEmptyBlocks(), []);

  const handleSearch = useCallback((query: string) => {
    setSearchQuery(query);
    editorApiRef.current?.search(query);
  }, []);

  const goToNextResult = useCallback(() => editorApiRef.current?.goToSearchResult(1), []);
  const goToPrevResult = useCallback(() => editorApiRef.current?.goToSearchResult(-1), []);

  const handleBlockNavigationClick = useCallback((blockId: number) => editorApiRef.current?.scrollToBlock(blockId), []);
  
  if (!documentType || !blocks || !metadata) {
    return <DocumentTypeSelection onSelect={handleSelectDocumentType} />;
  }

  return (
    <div className="flex flex-col h-screen font-sans bg-gray-50 dark:bg-gray-900 text-gray-800 dark:text-gray-200">
      {isStyleManagerOpen && <StyleManager styles={styles} setStyles={updateAndPersistStyles} onClose={() => setIsStyleManagerOpen(false)} />}
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
        theme={theme}
        onToggleTheme={handleThemeToggle}
        metadata={metadata}
        onMetadataChange={handleMetadataChange}
        documentType={documentType}
        onTitleFocus={() => editorApiRef.current?.focusTitle()}
        onSaveVersion={saveCurrentVersion} // Pass new prop for saving versions
      />
      <main className="flex-grow flex overflow-hidden">
        {isLeftSidebarOpen && (
            <div className={`w-[280px] flex-shrink-0 overflow-hidden transition-all duration-300`}>
                <StylePalette 
                  styles={Object.values(styles)} 
                  blocks={blocks}
                  onAddBlock={handleAddBlock}
                  onApplyStyle={handleApplyStyle}
                  documentType={documentType}
                  selectedBlockIds={new Set(activeBlockId ? [activeBlockId] : [])} // Simplified for now
                  disabledStyles={new Set()} // TODO: Re-implement this logic
                  onOpenStyleManager={() => setIsStyleManagerOpen(true)}
                />
            </div>
        )}
        <div className="flex-grow min-w-0 overflow-y-auto bg-gray-200 dark:bg-slate-900 p-4 sm:p-8">
            <div id="prosemirror-editor-wrapper" className="editor-container">
            <EditorCanvas 
              styles={styles}
              documentType={documentType}
              blocks={blocks}
              onBlocksChange={setBlocks}
              editorApiRef={editorApiRef}
              onSelectionChange={({activeBlockId, searchResults, canUndo, canRedo}) => {
                setActiveBlockId(activeBlockId);
                if (searchResults) setSearchResults(searchResults);
                setCanUndo(canUndo);
                setCanRedo(canRedo);
              }}
              searchQuery={searchQuery}
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
                        {/* Nested TabbedPanel for CSS */}
                        <TabbedPanel>
                          <Tab label="PDF CSS Editor">
                            <PdfCssPanel
                              pdfCss={pdfCss}
                              onPdfCssChange={setPdfCss}
                            />
                          </Tab>
                          <Tab label="Editor CSS">
                            <VisualEditorCssPanel
                              styles={styles}
                              onStyleChange={updateAndPersistStyles}
                              layoutSettings={editorLayout}
                              onLayoutSettingsChange={updateAndPersistLayout}
                            />
                          </Tab>
                        </TabbedPanel>
                      </Tab>
                      <Tab label="Versioner"> {/* New Tab for Version History */}
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