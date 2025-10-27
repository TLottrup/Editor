

import React from 'react';
import { SearchIcon, ArrowUpIcon, ArrowDownIcon } from './icons';

interface SearchPanelProps {
  query: string;
  onQueryChange: (query: string) => void;
  resultCount: number;
  currentIndex: number;
  onNext: () => void;
  onPrev: () => void;
}

export const SearchPanel: React.FC<SearchPanelProps> = ({
  query,
  onQueryChange,
  resultCount,
  currentIndex,
  onNext,
  onPrev
}) => {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-3 flex-shrink-0">
      <div className="relative">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          <SearchIcon className="h-4 w-4 text-gray-400" />
        </div>
        <input
          type="text"
          placeholder="Søg i dokument..."
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          className="w-full pl-9 pr-24 py-2 border border-gray-300 bg-white dark:border-gray-600 dark:bg-gray-700 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-sm"
        />
        <div className="absolute inset-y-0 right-0 flex items-center pr-2">
          {query && (
            <span className="text-sm text-gray-500 dark:text-gray-400 mr-2">
              {resultCount > 0 ? `${currentIndex + 1} af ${resultCount}` : '0 af 0'}
            </span>
          )}
          <button 
            onClick={onPrev} 
            disabled={resultCount === 0}
            className="p-1 text-gray-500 dark:text-gray-400 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-30 disabled:cursor-not-allowed"
            title="Forrige resultat"
          >
            <ArrowUpIcon className="h-4 w-4" />
          </button>
           <button 
            onClick={onNext} 
            disabled={resultCount === 0}
            className="p-1 text-gray-500 dark:text-gray-400 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-30 disabled:cursor-not-allowed"
            title="Næste resultat"
          >
            <ArrowDownIcon className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
};