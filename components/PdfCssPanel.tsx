

import React from 'react';

interface PdfCssPanelProps {
  pdfCss: string;
  onPdfCssChange: (css: string) => void;
}

export const PdfCssPanel: React.FC<PdfCssPanelProps> = ({ pdfCss, onPdfCssChange }) => {
  return (
    <div className="flex flex-col h-full">
      <div className="flex-shrink-0 mb-4">
        <h2 className="text-lg font-semibold text-gray-700 dark:text-gray-300 mb-2 border-b dark:border-gray-700 pb-2">PDF CSS Editor</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Rediger CSS'en nedenfor for at anvende brugerdefinerede stilarter på din PDF-eksport. Målret elementer ved hjælp af <code>[data-style="..."]</code> attributvælgeren.
        </p>
      </div>
      <div className="flex-grow min-h-0">
        <textarea
          value={pdfCss}
          onChange={(e) => onPdfCssChange(e.target.value)}
          className="w-full h-full bg-gray-900 text-green-400 font-mono text-xs p-3 rounded-md border border-gray-700 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
          spellCheck="false"
          placeholder="/* Eksempel: [data-style='body'] { font-size: 12pt; } */"
        />
      </div>
    </div>
  );
};