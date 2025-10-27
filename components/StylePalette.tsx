import React, { useRef, useState } from 'react';
import type { DocumentBlock, Style, StyleKey, DocumentType, TableData, ImageData } from '../types';
import { PlusIcon, TableIcon, ImageIcon, OrderedListIcon, UnorderedListIcon, SettingsIcon, FootnoteIcon } from './icons';

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

const StyleButton: React.FC<{
    style: Style;
    isActive: boolean;
    onApplyStyle: () => void;
    onAddBlock: () => void;
    disabled: boolean;
}> = ({ style, isActive, onApplyStyle, onAddBlock, disabled }) => {
    const Icon = () => {
        const className = `h-5 w-5 transition-colors ${
            isActive ? 'text-blue-500' : 'text-gray-400 dark:text-gray-500 group-hover:text-blue-500'
        }`;

        switch (style.key) {
            case 'ordered_list_item': return <OrderedListIcon className={className} />;
            case 'unordered_list_item': return <UnorderedListIcon className={className} />;
            default: return <PlusIcon className={className} />;
        }
    };

    return (
        <div
            className={`w-full flex justify-between items-center rounded-md transition-all duration-150 group ${
                isActive 
                ? 'bg-blue-100 dark:bg-blue-900/60 ring-2 ring-blue-500' 
                : disabled ? 'opacity-50' : 'hover:bg-gray-100 dark:hover:bg-gray-700'
            }`}
        >
            <button
                onMouseDown={(e) => {
                    e.preventDefault();
                    onApplyStyle();
                }}
                className="flex-grow text-left py-2 px-3 focus:outline-none disabled:cursor-not-allowed"
                aria-label={`Apply style: ${style.name}`}
                title={disabled ? `${style.name} (Ikke tilladt her)` : style.description}
                disabled={disabled}
            >
                <p className={`font-semibold text-sm ${
                    isActive ? 'text-blue-800 dark:text-blue-300' : 'text-gray-800 dark:text-gray-200'
                }`}>{style.name}</p>
            </button>
            <button 
                onClick={onAddBlock} 
                className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-600 focus:outline-none group"
                aria-label={`Add new block with style: ${style.name}`}
                title={`Add new ${style.name} block`}
            >
                <Icon />
            </button>
        </div>
    );
};

const StyleCategory: React.FC<{
    title: string;
    styles: Style[];
    activeStyleKey: StyleKey | undefined;
    onAddBlock: (styleKey: StyleKey) => void;
    onApplyStyle: (styleKey: StyleKey) => void;
    disabledStyles: Set<StyleKey>;
}> = ({ title, styles, activeStyleKey, onAddBlock, onApplyStyle, disabledStyles }) => {
    if (styles.length === 0) return null;
    
    return (
        <div className="space-y-1">
            <h3 className="text-xs font-bold uppercase text-gray-500 dark:text-gray-400 mt-4 mb-2 px-1">{title}</h3>
            {styles.map(style => (
                <StyleButton 
                    key={style.key}
                    style={style}
                    isActive={style.key === activeStyleKey}
                    onApplyStyle={() => onApplyStyle(style.key)}
                    onAddBlock={() => onAddBlock(style.key)}
                    disabled={disabledStyles.has(style.key)}
                />
            ))}
        </div>
    );
};

export const StylePalette: React.FC<StylePaletteProps> = ({ styles, blocks, onAddBlock, documentType, selectedBlockIds, onApplyStyle, onAddFootnote, isSelectionEmpty, disabledStyles, onOpenStyleManager }) => {
  const imageInputRef = useRef<HTMLInputElement>(null);
  const [activeTab, setActiveTab] = useState<'text' | 'objects'>('text');

  const filteredStyles = styles.filter(s => {
    if (s.key === 'table' || s.key === 'image') return false; // Objects are handled separately
    if (documentType === 'book') return s.key !== 'abstract' && s.key !== 'abstract_heading';
    if (documentType === 'journal') return s.key !== 'kapitel' && s.key !== 'del';
    return true;
  });
  
  const styleCategories = [
      {
        title: 'Dokumentstruktur',
        styles: filteredStyles.filter(s => ['del', 'kapitel'].includes(s.key)),
      },
      {
        title: 'Overskrifter',
        styles: filteredStyles.filter(s => s.key.startsWith('section_heading')),
      },
      {
        title: 'Brødtekst',
        styles: filteredStyles.filter(s => ['body', 'petit', 'caption'].includes(s.key)),
      },
      {
        title: 'Resumé',
        styles: filteredStyles.filter(s => ['abstract_heading', 'abstract'].includes(s.key)),
      },
      {
        title: 'Lister',
        styles: filteredStyles.filter(s => s.key.includes('list_item')),
      }
  ];

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

  const handleImageUploadClick = () => {
    imageInputRef.current?.click();
  };

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
    if (selectedBlockIds.size === 0) return undefined;
    const firstSelectedId = selectedBlockIds.values().next().value;
    const firstSelectedBlock = blocks.find(b => b.id === firstSelectedId);
    if (!firstSelectedBlock) return undefined;

    const firstStyle = firstSelectedBlock.style;
    // If all selected blocks have the same style, that's the active one.
    // Otherwise, none is active.
    for (const id of selectedBlockIds) {
        const block = blocks.find(b => b.id === id);
        if (block && block.style !== firstStyle) {
            return undefined; // Indeterminate state
        }
    }
    return firstStyle;
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
            />
          ))}
        </div>
      )}

      {activeTab === 'objects' && (
        <div className="space-y-1 pt-2">
          <button
            onClick={handleAddTable}
            className="w-full text-left py-2 px-3 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors group"
            title="Indsæt en tabel med rækker og kolonner"
          >
            <div className="flex justify-between items-center">
              <p className="font-semibold text-gray-800 dark:text-gray-200 text-sm">Tabel</p>
              <TableIcon className="h-5 w-5 text-gray-400 dark:text-gray-500 group-hover:text-blue-500 transition-colors" />
            </div>
          </button>
          <button
            onClick={handleImageUploadClick}
            className="w-full text-left py-2 px-3 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors group"
            title="Indsæt et billede med billedtekst"
          >
            <div className="flex justify-between items-center">
              <p className="font-semibold text-gray-800 dark:text-gray-200 text-sm">Billede</p>
              <ImageIcon className="h-5 w-5 text-gray-400 dark:text-gray-500 group-hover:text-blue-500 transition-colors" />
            </div>
          </button>
           <button
            onClick={onAddFootnote}
            disabled={isSelectionEmpty}
            className="w-full text-left py-2 px-3 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors group disabled:opacity-50 disabled:cursor-not-allowed"
            title={isSelectionEmpty ? "Vælg tekst for at tilføje en fodnote" : "Tilføj fodnote til valgt tekst"}
          >
            <div className="flex justify-between items-center">
              <p className="font-semibold text-gray-800 dark:text-gray-200 text-sm">Tilføj Fodnote</p>
              <FootnoteIcon className="h-5 w-5 text-gray-400 dark:text-gray-500 group-hover:text-blue-500 transition-colors" />
            </div>
          </button>
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