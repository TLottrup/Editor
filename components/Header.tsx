import React, { useRef, useEffect } from 'react';
import { ImportIcon, PanelRightCloseIcon, PanelRightOpenIcon, PanelLeftOpenIcon, PanelLeftCloseIcon, UndoIcon, RedoIcon, BroomIcon, SunIcon, MoonIcon, SaveIcon, PlusIcon, SparklesIcon } from './icons';
import type { Metadata, DocumentType } from '../types';

interface HeaderProps {
  onImportWord: (file: File) => void;
  isLeftSidebarOpen: boolean;
  onToggleLeftSidebar: () => void;
  isRightSidebarOpen: boolean;
  onToggleRightSidebar: () => void;
  onUndo: () => void;
  onRedo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  onRemoveEmptyBlocks: () => void;
  onGenerateLoremIpsum: () => void;
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
  metadata: Metadata;
  onMetadataChange: (update: React.SetStateAction<Metadata>) => void;
  documentType: DocumentType;
  onTitleFocus: () => void;
  onSaveVersion: (name?: string) => void;
  onTogglePagination: () => void;
  isPaginated: boolean;
}

export const Header: React.FC<HeaderProps> = ({ 
  onImportWord, 
  isLeftSidebarOpen, 
  onToggleLeftSidebar, 
  isRightSidebarOpen, 
  onToggleRightSidebar,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
  onRemoveEmptyBlocks,
  onGenerateLoremIpsum,
  theme,
  onToggleTheme,
  metadata,
  onMetadataChange,
  documentType,
  onTitleFocus,
  onSaveVersion,
  onTogglePagination,
  isPaginated,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const titleRef = useRef<HTMLDivElement>(null);
  const subtitleRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
      if (titleRef.current && titleRef.current.textContent !== metadata.title) {
          titleRef.current.textContent = metadata.title;
      }
  }, [metadata.title]);

  useEffect(() => {
      if (subtitleRef.current && subtitleRef.current.textContent !== (metadata.subtitle || '')) {
          subtitleRef.current.textContent = metadata.subtitle || '';
      }
  }, [metadata.subtitle]);

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      onImportWord(file);
      // Reset file input to allow importing the same file again
      event.target.value = '';
    }
  };

  const handleSaveVersionClick = () => {
    const versionName = prompt("Indtast et navn for denne version (valgfrit):");
    onSaveVersion(versionName === null ? undefined : versionName); // Pass undefined if cancelled
  };

  return (
    <header className="bg-white dark:bg-gray-800 shadow-md dark:shadow-none dark:border-b dark:border-gray-700 p-3 flex items-center justify-between z-10 gap-4">
      <div className="flex items-center gap-3">
        <button
          onClick={onToggleLeftSidebar}
          className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
          title={isLeftSidebarOpen ? "Skjul typografi-panel" : "Vis typografi-panel"}
        >
          {isLeftSidebarOpen ? <PanelLeftCloseIcon className="h-5 w-5" /> : <PanelLeftOpenIcon className="h-5 w-5" />}
        </button>
        <h1 className="text-xl font-bold text-gray-800 dark:text-gray-200 whitespace-nowrap">
       <span style={{color: 'oklch(58.8% 0.158 241.966)'}}>DocHub</span>
        </h1>
        <div className="flex items-center gap-1">
            <button
              onClick={onUndo}
              disabled={!canUndo}
              className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
              title="Fortryd (Ctrl+Z)"
            >
              <UndoIcon className="h-5 w-5" />
            </button>
            <button
              onClick={onRedo}
              disabled={!canRedo}
              className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
              title="Annuller fortryd (Ctrl+Y)"
            >
              <RedoIcon className="h-5 w-5" />
            </button>
             <button
              onClick={onRemoveEmptyBlocks}
              className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
              title="Fjern tomme blokke"
            >
              <BroomIcon className="h-5 w-5" />
            </button>
            <button
              onClick={onGenerateLoremIpsum}
              className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
              title="Generer Lorem Ipsum tekst"
            >
              <SparklesIcon className="h-5 w-5" />
            </button>
        </div>
      </div>

       <div className="flex-grow flex flex-col items-center min-w-0 text-center">
          <div
            ref={titleRef}
            contentEditable
            suppressContentEditableWarning
            className="text-lg font-bold text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-blue-500 rounded px-2 w-full truncate"
            onInput={e => onMetadataChange(prev => ({ ...prev, title: e.currentTarget.textContent || '' }))}
            onFocus={onTitleFocus}
            title={metadata.title}
          />
          {(documentType === 'book' || (metadata.subtitle && metadata.subtitle.length > 0)) && (
             <div
                ref={subtitleRef}
                contentEditable
                suppressContentEditableWarning
                className="text-sm font-normal text-gray-600 dark:text-gray-400 focus:outline-none focus:ring-1 focus:ring-blue-500 rounded px-2 w-full truncate"
                onInput={e => onMetadataChange(prev => ({ ...prev, subtitle: e.currentTarget.textContent || '' }))}
                onFocus={onTitleFocus}
                title={metadata.subtitle}
            />
          )}
      </div>
      
       <div className="flex items-center gap-4">
        <button
          onClick={onTogglePagination}
          className="flex items-center gap-2 bg-gray-100 hover:bg-gray-200 text-gray-800 dark:bg-gray-700 dark:hover:bg-gray-600 dark:text-gray-200 font-semibold py-2 px-4 rounded-md transition-colors text-sm"
          title={isPaginated ? "Fjern sidenumre fra dokumentet" : "Opdel dokumentet i sider med sidenumre"}
        >
          {isPaginated ? <BroomIcon className="h-5 w-5" /> : <PlusIcon className="h-5 w-5" />}
          {isPaginated ? 'Fjern sidenumre' : 'Tilføj sidenumre'}
        </button>
        <button
          onClick={handleSaveVersionClick} // New save button for version control
          className="flex items-center gap-2 bg-purple-50 hover:bg-purple-100 text-purple-700 dark:bg-purple-900/50 dark:hover:bg-purple-900/80 dark:text-purple-300 font-semibold py-2 px-4 rounded-md transition-colors text-sm"
          title="Gem nuværende version af dokumentet"
        >
          <SaveIcon className="h-5 w-5" />
          Gem Version
        </button>
        <button 
          onClick={handleImportClick}
          className="flex items-center gap-2 bg-blue-50 hover:bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:hover:bg-blue-900/80 dark:text-blue-300 font-semibold py-2 px-4 rounded-md transition-colors text-sm"
        >
          <ImportIcon className="h-5 w-5" />
          Importer Word
        </button>
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileChange}
          className="hidden"
          accept=".docx"
        />
        <div className="border-l border-gray-300 dark:border-gray-600 h-6"></div>
         <button
          onClick={onToggleTheme}
          className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
          title={theme === 'light' ? "Skift til mørk tilstand" : "Skift til lys tilstand"}
        >
          {theme === 'light' ? <MoonIcon className="h-5 w-5" /> : <SunIcon className="h-5 w-5" />}
        </button>
        <button
          onClick={onToggleRightSidebar}
          className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
          title={isRightSidebarOpen ? "Skjul sidepanel" : "Vis sidepanel"}
        >
          {isRightSidebarOpen ? <PanelRightCloseIcon className="h-5 w-5" /> : <PanelRightOpenIcon className="h-5 w-5" />}
        </button>
      </div>
    </header>
  );
};