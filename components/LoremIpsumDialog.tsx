import React, { useState } from 'react';
import type { DocumentType } from '../types';

interface LoremIpsumDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (options: { paragraphs: number; parts: number; chapters: number }) => void;
  documentType: DocumentType;
}

export const LoremIpsumDialog: React.FC<LoremIpsumDialogProps> = ({ isOpen, onClose, onConfirm, documentType }) => {
  const [paragraphCount, setParagraphCount] = useState(20);
  const [partCount, setPartCount] = useState(2);
  const [chapterCount, setChapterCount] = useState(5);

  if (!isOpen) {
    return null;
  }

  const handleConfirm = () => {
    onConfirm({
      paragraphs: paragraphCount,
      parts: documentType === 'book' ? partCount : 0,
      chapters: documentType === 'book' ? chapterCount : 0,
    });
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-sm">
        <header className="flex items-center justify-between p-4 border-b dark:border-gray-700">
          <h2 className="text-xl font-bold text-gray-800 dark:text-gray-200">Generer Tekst</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-2xl">&times;</button>
        </header>
        <main className="p-6 space-y-4">
          <div>
            <label htmlFor="paragraphCount" className="block text-sm font-medium text-gray-600 dark:text-gray-400">
              Antal afsnit til at generere
            </label>
            <input
              type="number"
              id="paragraphCount"
              value={paragraphCount}
              onChange={(e) => setParagraphCount(Math.max(1, parseInt(e.target.value, 10) || 1))}
              min="1"
              className="mt-1 w-full p-2 border border-gray-300 bg-white dark:border-gray-700 dark:bg-gray-700 rounded-md shadow-sm"
              autoFocus
            />
          </div>
          {documentType === 'book' && (
            <>
              <div>
                <label htmlFor="partCount" className="block text-sm font-medium text-gray-600 dark:text-gray-400">
                  Antal dele
                </label>
                <input
                  type="number"
                  id="partCount"
                  value={partCount}
                  onChange={(e) => setPartCount(Math.max(1, parseInt(e.target.value, 10) || 1))}
                  min="1"
                  className="mt-1 w-full p-2 border border-gray-300 bg-white dark:border-gray-700 dark:bg-gray-700 rounded-md shadow-sm"
                />
              </div>
              <div>
                <label htmlFor="chapterCount" className="block text-sm font-medium text-gray-600 dark:text-gray-400">
                  Antal kapitler
                </label>
                <input
                  type="number"
                  id="chapterCount"
                  value={chapterCount}
                  onChange={(e) => setChapterCount(Math.max(1, parseInt(e.target.value, 10) || 1))}
                  min="1"
                  className="mt-1 w-full p-2 border border-gray-300 bg-white dark:border-gray-700 dark:bg-gray-700 rounded-md shadow-sm"
                />
              </div>
            </>
          )}
        </main>
        <footer className="flex items-center justify-end p-4 border-t dark:border-gray-700 gap-3">
          <button
            onClick={onClose}
            className="bg-gray-200 hover:bg-gray-300 text-gray-800 dark:bg-gray-600 dark:hover:bg-gray-500 dark:text-gray-200 font-semibold py-2 px-4 rounded-md transition-colors"
          >
            Annuller
          </button>
          <button
            onClick={handleConfirm}
            className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded-md transition-colors"
          >
            Generer
          </button>
        </footer>
      </div>
    </div>
  );
};