import React from 'react';

interface CssEditorPanelProps {
  css: string;
  onCssChange: (newCss: string) => void;
}

export const CssEditorPanel: React.FC<CssEditorPanelProps> = ({ css, onCssChange }) => {
  return (
    <div className="flex flex-col h-full">
      <div className="flex-shrink-0 mb-4">
        <h2 className="text-lg font-semibold text-gray-700 mb-2 border-b pb-2">Brugerdefineret CSS Editor</h2>
        <p className="text-sm text-gray-500">
          Rediger CSS'en nedenfor for at anvende brugerdefinerede stilarter. Målret elementer ved hjælp af <code>[data-style="..."]</code> attributvælgeren.
        </p>
      </div>
      <div className="flex-grow min-h-0">
        <textarea
          value={css}
          onChange={(e) => onCssChange(e.target.value)}
          className="w-full h-full bg-gray-900 text-green-400 font-mono text-xs p-3 rounded-md border border-gray-700 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[400px]"
          spellCheck="false"
        />
      </div>
    </div>
  );
};