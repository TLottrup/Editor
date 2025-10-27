import React from 'react';
import type { Metadata, DocumentType, BookMetadata, BookType, Author } from '../types';
import { PlusIcon, TrashIcon } from './icons';

interface MetadataPanelProps {
  metadata: Metadata;
  onMetadataChange: React.Dispatch<React.SetStateAction<Metadata>>;
  documentType: DocumentType;
}

const BOOK_TYPES: BookType[] = ['Lovkommentar', 'Håndbog', 'Debatbog', 'Afhandling', 'Festskrift', 'Lærebog'];

export const MetadataPanel: React.FC<MetadataPanelProps> = ({ metadata, onMetadataChange, documentType }) => {
  const coverInputRef = React.useRef<HTMLInputElement>(null);

  const handleMetadataFieldChange = (field: keyof BookMetadata, value: string) => {
    onMetadataChange(prev => ({ ...prev, [field]: value }));
  };

  const handleAuthorChange = (index: number, field: keyof Author, value: string) => {
    onMetadataChange(prev => {
        const newAuthors = [...(prev.authors || [])];
        newAuthors[index] = { ...newAuthors[index], [field]: value };
        return { ...prev, authors: newAuthors };
    });
  };

  const handleAddAuthor = () => {
    onMetadataChange(prev => ({
        ...prev,
        authors: [...(prev.authors || []), { firstName: '', lastName: '' }],
    }));
  };

  const handleRemoveAuthor = (index: number) => {
    onMetadataChange(prev => ({
        ...prev,
        authors: (prev.authors || []).filter((_, i) => i !== index),
    }));
  };
  
  const handleCoverUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        handleMetadataFieldChange('coverImageSrc', e.target?.result as string);
      };
      reader.readAsDataURL(file);
      // Reset file input to allow re-uploading the same file
      event.target.value = '';
    }
  };

  const bookMetadata = metadata as BookMetadata;

  return (
    <div className="flex flex-col h-full">
      <h2 className="text-lg font-semibold text-gray-700 dark:text-gray-300 mb-4 border-b dark:border-gray-700 pb-2">Metadata</h2>
      <div className="space-y-4">
        <div>
          <label htmlFor="title" className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">Titel</label>
          <input
            type="text"
            id="title"
            value={metadata.title}
            onChange={(e) => handleMetadataFieldChange('title', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 bg-white dark:border-gray-600 dark:bg-gray-700 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-sm"
          />
        </div>
        <div>
          <label htmlFor="subtitle" className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">Undertitel</label>
          <input
            type="text"
            id="subtitle"
            value={metadata.subtitle || ''}
            onChange={(e) => handleMetadataFieldChange('subtitle', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 bg-white dark:border-gray-600 dark:bg-gray-700 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-sm"
          />
        </div>
        
        {documentType === 'book' && (
            <div>
              <label htmlFor="description" className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">Beskrivelse</label>
              <textarea
                id="description"
                value={bookMetadata.description || ''}
                onChange={(e) => handleMetadataFieldChange('description', e.target.value)}
                rows={4}
                className="w-full px-3 py-2 border border-gray-300 bg-white dark:border-gray-600 dark:bg-gray-700 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-sm"
                placeholder="Indtast en kort beskrivelse af bogen her..."
              />
            </div>
        )}

        <div>
            <label className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">Forfatter(e)</label>
            <div className="space-y-2">
                {(metadata.authors || []).map((author, index) => (
                    <div key={index} className="flex items-center gap-2">
                        <input
                            type="text"
                            placeholder="Fornavn"
                            value={author.firstName}
                            onChange={(e) => handleAuthorChange(index, 'firstName', e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 bg-white dark:border-gray-600 dark:bg-gray-700 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-sm"
                        />
                        <input
                            type="text"
                            placeholder="Efternavn"
                            value={author.lastName}
                            onChange={(e) => handleAuthorChange(index, 'lastName', e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 bg-white dark:border-gray-600 dark:bg-gray-700 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-sm"
                        />
                        <button 
                            onClick={() => handleRemoveAuthor(index)}
                            disabled={(metadata.authors || []).length <= 1}
                            className="p-2 text-gray-400 dark:text-gray-500 hover:text-red-600 dark:hover:text-red-500 disabled:text-gray-200 disabled:cursor-not-allowed rounded-full hover:bg-gray-100 dark:hover:bg-gray-700"
                            title="Fjern forfatter"
                        >
                            <TrashIcon className="h-4 w-4" />
                        </button>
                    </div>
                ))}
                <button
                    onClick={handleAddAuthor}
                    className="flex items-center gap-2 text-sm text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 font-medium py-1 px-2 rounded"
                >
                    <PlusIcon className="h-4 w-4" />
                    Tilføj forfatter
                </button>
            </div>
        </div>


        {documentType === 'book' && (
          <>
            <div>
              <label htmlFor="pIsbn" className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">P-ISBN</label>
              <input
                type="text"
                id="pIsbn"
                value={bookMetadata.pIsbn || ''}
                onChange={(e) => handleMetadataFieldChange('pIsbn', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 bg-white dark:border-gray-600 dark:bg-gray-700 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-sm"
              />
            </div>
            <div>
              <label htmlFor="eIsbn" className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">E-ISBN</label>
              <input
                type="text"
                id="eIsbn"
                value={bookMetadata.eIsbn || ''}
                onChange={(e) => handleMetadataFieldChange('eIsbn', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 bg-white dark:border-gray-600 dark:bg-gray-700 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-sm"
              />
            </div>
            <div>
              <label htmlFor="publicationDate" className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">Udgivelsesdato</label>
              <input
                type="date"
                id="publicationDate"
                value={bookMetadata.publicationDate || ''}
                onChange={(e) => handleMetadataFieldChange('publicationDate', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 bg-white dark:border-gray-600 dark:bg-gray-700 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-sm"
              />
            </div>
            <div>
              <label htmlFor="edition" className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">Udgave</label>
              <input
                type="text"
                id="edition"
                value={bookMetadata.edition || ''}
                onChange={(e) => handleMetadataFieldChange('edition', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 bg-white dark:border-gray-600 dark:bg-gray-700 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-sm"
              />
            </div>
            <div>
              <label htmlFor="bookType" className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">Bogtype</label>
              <select
                id="bookType"
                value={bookMetadata.bookType || ''}
                onChange={(e) => handleMetadataFieldChange('bookType', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 bg-white dark:border-gray-600 dark:bg-gray-700 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-sm"
              >
                {BOOK_TYPES.map(type => <option key={type} value={type}>{type}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">Omslagsbillede</label>
              <div className="flex items-center gap-2">
                {bookMetadata.coverImageSrc && (
                  <img src={bookMetadata.coverImageSrc} alt="Omslag" className="w-16 h-20 object-cover rounded"/>
                )}
                <button
                  onClick={() => coverInputRef.current?.click()}
                  className="px-3 py-2 text-sm border border-gray-300 bg-white dark:border-gray-600 dark:bg-gray-700 rounded-md shadow-sm hover:bg-gray-50 dark:hover:bg-gray-600"
                >
                  {bookMetadata.coverImageSrc ? 'Skift billede' : 'Upload billede'}
                </button>
                <input
                  type="file"
                  ref={coverInputRef}
                  onChange={handleCoverUpload}
                  className="hidden"
                  accept="image/png, image/jpeg"
                />
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};