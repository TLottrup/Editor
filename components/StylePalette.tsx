import React, { useRef, useState } from 'react';
import type { DocumentBlock, Style, StyleKey, DocumentType, TableData, ImageData } from '../types';
import { PlusIcon, TableIcon, ImageIcon, SettingsIcon, FootnoteIcon, ChevronDownIcon } from './icons';

interface StylePaletteProps {
  styles: Style[];
  blocks: DocumentBlock[];
  onAddBlock: (styleKey: StyleKey, content?: string) => void;
  documentType: DocumentType;
  selectedBlockIds: Set<number>;
  onApplyStyle: (styleKey: StyleKey) => void;
  onAddFootnote: () => void;
  isSelectionEmpty: boolean;
  disabledStyles: Set<StyleKey>;
  onOpenStyleManager: () => void;
}

const StyleCard: React.FC<{
    style: Style;
    isActive: boolean;
    onApplyStyle: () => void;
    onAddBlock: () => void;
    disabled: boolean;
}> = ({ style, isActive, onApplyStyle, onAddBlock, disabled }) => {
    // Cap the font size in the preview to prevent it from breaking the layout
    const previewFontSize = style.visualSettings?.fontSize 
        ? `${Math.min(style.visualSettings.fontSize, 22)}px` 
        : '1rem';

    const previewStyle: React.CSSProperties = {
        fontFamily: style.visualSettings?.fontFamily,
        fontWeight: style.visualSettings?.fontWeight,
        fontStyle: style.visualSettings?.fontStyle,
        textTransform: style.visualSettings?.textTransform,
        textDecoration: style.visualSettings?.textDecoration,
        fontSize: previewFontSize,
        lineHeight: 1.2,
    };
    
     if (!isActive) {
        previewStyle.color = style.visualSettings?.color;
    }

    return (
        <button
            onMouseDown={(e) => { e.preventDefault(); onApplyStyle(); }}
            className={`group relative w-full text-left p-3 rounded-lg transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-gray-800 ${
                isActive 
                ? 'bg-blue-100 dark:bg-blue-900/60 ring-2 ring-blue-500' 
                : disabled ? 'opacity-50 cursor-not-allowed' : 'bg-gray-50 hover:bg-gray-100 dark:bg-gray-700/50 dark:hover:bg-gray-700'
            }`}
            aria-label={`Apply style: ${style.name}`}
            title={disabled ? `${style.name} (Ikke tilladt her)` : style.description}
            disabled={disabled}
        >
            <p style={previewStyle} className={`truncate ${isActive ? 'text-blue-800 dark:text-blue-300' : ''}`}>
              {style.name}
            </p>
            <div
                onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); onAddBlock(); }}
                className="absolute top-2 right-2 p-1.5 rounded-full bg-white dark:bg-gray-800 text-gray-400 dark:text-gray-500 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-gray-200 dark:hover:bg-gray-600 hover:text-blue-500"
                aria-label={`Tilføj ny blok med typografi: ${style.name}`}
                title={`Tilføj ny ${style.name} blok`}
            >
                <PlusIcon className="h-4 w-4" />
            </div>
        </button>
    );
};

const StyleCategory: React.FC<{
    title: string;
    styles: Style[];
    activeStyleKey: StyleKey | undefined;
    onAddBlock: (styleKey: StyleKey) => void;
    onApplyStyle: (styleKey: StyleKey) => void;
    disabledStyles: Set<StyleKey>;
    isExpanded: boolean;
    onToggle: () => void;
}> = ({ title, styles, activeStyleKey, onAddBlock, onApplyStyle, disabledStyles, isExpanded, onToggle }) => {
    if (styles.length === 0) return null;
    
    return (
        <div>
            <button 
                onClick={onToggle}
                className="w-full flex justify-between items-center py-2 px-1 text-left"
            >
                <h3 className="text-sm font-bold uppercase text-gray-500 dark:text-gray-400">{title}</h3>
                <ChevronDownIcon className={`h-5 w-5 text-gray-400 transition-transform duration-200 ${!isExpanded ? '-rotate-90' : ''}`} />
            </button>
            {isExpanded && (
                <div className="space-y-2 py-2">
                    {styles.map(style => (
                        <StyleCard 
                            key={style.key}
                            style={style}
                            isActive={style.key === activeStyleKey}
                            onApplyStyle={() => onApplyStyle(style.key)}
                            onAddBlock={() => onAddBlock(style.key)}
                            disabled={disabledStyles.has(style.key)}
                        />
                    ))}
                </div>
            )}
        </div>
    );
};

const ObjectButton: React.FC<{
    title: string;
    description: string;
    icon: React.ReactNode;
    onClick: () => void;
    disabled?: boolean;
}> = ({ title, description, icon, onClick, disabled }) => (
    <button
        onClick={onClick}
        disabled={disabled}
        className="group w-full flex items-center gap-4 text-left p-3 rounded-lg transition-colors bg-gray-50 hover:bg-gray-100 dark:bg-gray-700/50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-gray-800"
        title={description}
    >
        <div className="p-2 bg-gray-200 dark:bg-gray-600 rounded-md text-gray-600 dark:text-gray-300 group-hover:text-blue-500 transition-colors">
            {icon}
        </div>
        <p className="font-semibold text-gray-800 dark:text-gray-200 text-sm">{title}</p>
    </button>
);


export const StylePalette: React.FC<StylePaletteProps> = ({ styles, blocks, onAddBlock, documentType, selectedBlockIds, onApplyStyle, onAddFootnote, isSelectionEmpty, disabledStyles, onOpenStyleManager }) => {
  const imageInputRef = useRef<HTMLInputElement>(null);
  const [activeTab, setActiveTab] = useState<'text' | 'objects'>('text');

  const filteredStyles = styles.filter(s => {
    if (s.key === 'table' || s.key === 'image') return false; // Objects are handled separately
    return s.allowedDocumentTypes?.includes(documentType) ?? true; // Filter by document type
  });
  
  const styleCategories = [
      { title: 'Forord', styles: filteredStyles.filter(s => s.key === 'front_matter_title')},
      { title: 'Dokumentstruktur', styles: filteredStyles.filter(s => ['del', 'kapitel'].includes(s.key)) },
      { title: 'Overskrifter', styles: filteredStyles.filter(s => s.key.startsWith('section_heading')) },
      { title: 'Brødtekst', styles: filteredStyles.filter(s => ['body', 'petit', 'caption'].includes(s.key)) },
      { title: 'Resumé', styles: filteredStyles.filter(s => ['abstract_heading', 'abstract'].includes(s.key)) },
      { title: 'Lister', styles: filteredStyles.filter(s => s.key.includes('list_item')) },
      { title: 'Efterord', styles: filteredStyles.filter(s => s.key === 'back_matter_title')},
  ];

  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(() => new Set(styleCategories.map(c => c.title)));

  const toggleCategory = (title: string) => {
    setExpandedCategories(prev => {
      const newSet = new Set(prev);
      if (newSet.has(title)) {
        newSet.delete(title);
      } else {
        newSet.add(title);
      }
      return newSet;
    });
  };

  const handleAddTable = () => {
    const initialTableData: TableData = {
      caption: 'Indtast din billedtekst her',
      rows: [
        [{ content: 'Header 1' }, { content: 'Header 2' }, { content: 'Header 3' }],
        [{ content: 'Celle 1' }, { content: 'Celle 2' }, { content: 'Celle 3' }],
      ],
    };
    onAddBlock('table', JSON.stringify(initialTableData));
  };

  const handleImageUploadClick = () => { imageInputRef.current?.click(); };

  const handleImageFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const initialImageData: ImageData = {
          src: e.target?.result as string,
          caption: 'Indtast billedtekst her',
          source: 'Kildeangivelse her',
        };
        onAddBlock('image', JSON.stringify(initialImageData));
      };
      reader.readAsDataURL(file);
      event.target.value = '';
    }
  };

  const activeStyleKey = React.useMemo(() => {
    if (selectedBlockIds.size !== 1) return undefined;
    const firstSelectedId = selectedBlockIds.values().next().value;
    const firstSelectedBlock = blocks.find(b => b.id === firstSelectedId);
    return firstSelectedBlock?.style;
  }, [selectedBlockIds, blocks]);

  return (
    <aside className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-4 flex flex-col h-full overflow-y-auto">
      <div className="flex justify-between items-center mb-4 border-b dark:border-gray-700 pb-2">
        <h2 className="text-lg font-semibold text-gray-700 dark:text-gray-300">Typografier</h2>
        <button 
          onClick={onOpenStyleManager} 
          title="Administrer typografier" 
          className="p-1.5 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400 transition-colors"
        >
          <SettingsIcon className="h-5 w-5" />
        </button>
      </div>
      
      <div className="flex border-b dark:border-gray-700 mb-2">
        <button
          onClick={() => setActiveTab('text')}
          className={`flex-1 py-2 text-sm font-semibold text-center transition-colors focus:outline-none ${
            activeTab === 'text'
              ? 'text-blue-600 dark:text-blue-400 border-b-2 border-blue-600 dark:border-blue-400'
              : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
          }`}
        >
          Teksttypografier
        </button>
        <button
          onClick={() => setActiveTab('objects')}
          className={`flex-1 py-2 text-sm font-semibold text-center transition-colors focus:outline-none ${
            activeTab === 'objects'
              ? 'text-blue-600 dark:text-blue-400 border-b-2 border-blue-600 dark:border-blue-400'
              : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
          }`}
        >
          Objekter
        </button>
      </div>

      {activeTab === 'text' && (
        <div>
          {styleCategories.map(category => (
            <StyleCategory 
                key={category.title}
                title={category.title}
                styles={category.styles}
                activeStyleKey={activeStyleKey}
                onAddBlock={onAddBlock}
                onApplyStyle={onApplyStyle}
                disabledStyles={disabledStyles}
                isExpanded={expandedCategories.has(category.title)}
                onToggle={() => toggleCategory(category.title)}
            />
          ))}
        </div>
      )}

      {activeTab === 'objects' && (
        <div className="space-y-2 pt-2">
          <ObjectButton
            onClick={handleAddTable}
            title="Tabel"
            description="Indsæt en tabel med rækker og kolonner"
            icon={<TableIcon className="h-5 w-5" />}
          />
          <ObjectButton
            onClick={handleImageUploadClick}
            title="Billede"
            description="Indsæt et billede med billedtekst"
            icon={<ImageIcon className="h-5 w-5" />}
          />
           <ObjectButton
            onClick={onAddFootnote}
            disabled={isSelectionEmpty}
            title="Tilføj Fodnote"
            description={isSelectionEmpty ? "Vælg tekst for at tilføje en fodnote" : "Tilføj fodnote til valgt tekst"}
            icon={<FootnoteIcon className="h-5 w-5" />}
          />
          <input
            type="file"
            ref={imageInputRef}
            onChange={handleImageFileChange}
            className="hidden"
            accept="image/png, image/jpeg, image/gif"
          />
        </div>
      )}
    </aside>
  );
};