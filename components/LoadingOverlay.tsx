import React from 'react';
import { SpinnerIcon } from './icons';

export const LoadingOverlay: React.FC = () => {
  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex flex-col items-center justify-center p-4">
      <div className="flex items-center gap-4 bg-white dark:bg-gray-800 p-6 rounded-lg shadow-xl">
        <SpinnerIcon className="h-8 w-8 text-blue-600 dark:text-blue-400" />
        <p className="text-lg font-semibold text-gray-700 dark:text-gray-300">
          Beregner sidelayout, vent venligst...
        </p>
      </div>
    </div>
  );
};
