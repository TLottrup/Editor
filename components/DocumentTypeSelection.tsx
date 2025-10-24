import React from 'react';
// Fix: Corrected import path.
import type { DocumentType } from '../types';
import { BookIcon, JournalIcon } from './icons';

interface DocumentTypeSelectionProps {
  onSelect: (type: DocumentType) => void;
}

const SelectionCard: React.FC<{
  title: string;
  description: string;
  icon: React.ReactNode;
  onClick: () => void;
}> = ({ title, description, icon, onClick }) => (
  <button
    onClick={onClick}
    className="flex flex-col items-center justify-center text-center p-8 bg-white dark:bg-gray-800 rounded-xl shadow-lg hover:shadow-2xl hover:-translate-y-2 transition-all duration-300 ease-in-out w-80 h-80 border-2 border-transparent hover:border-blue-500"
  >
    <div className="text-blue-600 mb-4">{icon}</div>
    <h3 className="text-2xl font-bold text-gray-800 dark:text-gray-200 mb-2">{title}</h3>
    <p className="text-gray-500 dark:text-gray-400">{description}</p>
  </button>
);

export const DocumentTypeSelection: React.FC<DocumentTypeSelectionProps> = ({ onSelect }) => {
  return (
    <div className="h-screen w-screen bg-gray-100 dark:bg-gray-900 flex flex-col items-center justify-center font-sans">
      <div className="text-center mb-12">
        <h1 className="text-5xl font-extrabold text-gray-800 dark:text-gray-200 mb-2">Opret et nyt dokument</h1>
        <p className="text-lg text-gray-600 dark:text-gray-400">Vælg en dokumenttype for at starte med en skræddersyet skabelon.</p>
      </div>
      <div className="flex flex-col md:flex-row gap-10">
        <SelectionCard
          title="Tidsskriftartikel"
          description="Optimeret til JATS XML."
          icon={<JournalIcon className="h-20 w-20" />}
          onClick={() => onSelect('journal')}
        />
        <SelectionCard
          title="Bog"
          description="Optimeret til BITS XML."
          icon={<BookIcon className="h-20 w-20" />}
          onClick={() => onSelect('book')}
        />
      </div>
    </div>
  );
};

export default DocumentTypeSelection;