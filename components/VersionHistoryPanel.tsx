
import React, { useState, useCallback } from 'react';
import type { DocumentVersion } from '../types';
import { SaveIcon, DownloadIcon, TrashIcon, EditIcon } from './icons';

interface VersionHistoryPanelProps {
  versions: DocumentVersion[];
  onSave: (name?: string) => void;
  onLoad: (version: DocumentVersion) => void;
  onDelete: (versionId: string) => void;
  onUpdateName: (versionId: string, newName: string) => void;
}

export const VersionHistoryPanel: React.FC<VersionHistoryPanelProps> = ({
  versions,
  onSave,
  onLoad,
  onDelete,
  onUpdateName,
}) => {
  const [editingVersionId, setEditingVersionId] = useState<string | null>(null);
  const [editingVersionName, setEditingVersionName] = useState<string>('');

  const handleSaveClick = () => {
    const versionName = prompt("Indtast et navn for denne version (valgfrit):");
    onSave(versionName === null ? undefined : versionName); // Pass undefined if prompt is cancelled
  };

  const handleEditNameClick = (version: DocumentVersion) => {
    setEditingVersionId(version.id);
    setEditingVersionName(version.name);
  };

  const handleSaveName = (versionId: string) => {
    if (editingVersionName.trim() !== '') {
      onUpdateName(versionId, editingVersionName.trim());
    }
    setEditingVersionId(null);
    setEditingVersionName('');
  };

  const handleCancelEdit = () => {
    setEditingVersionId(null);
    setEditingVersionName('');
  };

  const sortedVersions = [...versions].sort((a, b) => b.timestamp - a.timestamp); // Sort by newest first

  return (
    <div className="flex flex-col h-full">
      <h2 className="text-lg font-semibold text-gray-700 dark:text-gray-300 mb-4 border-b dark:border-gray-700 pb-2">Versionshistorik</h2>
      <div className="flex-shrink-0 mb-4">
        <button
          onClick={handleSaveClick}
          className="w-full flex items-center justify-center gap-2 bg-blue-600 text-white py-2 rounded-md hover:bg-blue-700 transition-colors font-semibold"
          title="Gem nuværende dokument som en ny version"
        >
          <SaveIcon className="h-5 w-5" />
          Gem nuværende version
        </button>
      </div>

      <div className="flex-grow overflow-y-auto space-y-3 pr-2">
        {sortedVersions.length === 0 ? (
          <p className="text-sm text-gray-500 dark:text-gray-400 italic text-center py-4">Ingen gemte versioner endnu.</p>
        ) : (
          sortedVersions.map((version) => (
            <div key={version.id} className="bg-gray-50 dark:bg-gray-900/50 rounded-lg p-3 border dark:border-gray-700 shadow-sm flex flex-col gap-2">
              <div className="flex justify-between items-start">
                {editingVersionId === version.id ? (
                  <div className="flex-grow mr-2">
                    <input
                      type="text"
                      value={editingVersionName}
                      onChange={(e) => setEditingVersionName(e.target.value)}
                      className="w-full p-1 border border-gray-300 bg-white dark:border-gray-600 dark:bg-gray-700 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-sm"
                      autoFocus
                    />
                  </div>
                ) : (
                  <span className="font-semibold text-gray-800 dark:text-gray-200 text-base flex-grow">
                    {version.name}
                  </span>
                )}
                <div className="flex items-center gap-1">
                  {editingVersionId === version.id ? (
                    <>
                      <button
                        onClick={() => handleSaveName(version.id)}
                        className="p-1.5 rounded-full hover:bg-green-100 dark:hover:bg-green-700 text-green-600 dark:text-green-400 transition-colors"
                        title="Gem navn"
                      >
                        <SaveIcon className="h-4 w-4" />
                      </button>
                      <button
                        onClick={handleCancelEdit}
                        className="p-1.5 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300 transition-colors"
                        title="Annuller"
                      >
                        <TrashIcon className="h-4 w-4" /> {/* Using trash for cancel, usually an X icon */}
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={() => handleEditNameClick(version)}
                      className="p-1.5 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300 transition-colors"
                      title="Rediger navn"
                    >
                      <EditIcon className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Gemt: {new Date(version.timestamp).toLocaleString()}
              </p>
              <div className="flex justify-end gap-2 mt-2">
                <button
                  onClick={() => onLoad(version)}
                  className="flex items-center gap-1 text-sm bg-blue-50 hover:bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:hover:bg-blue-900/80 dark:text-blue-300 font-medium py-1 px-3 rounded-md transition-colors"
                  title="Indlæs denne version (vil overskrive nuværende indhold)"
                >
                  <DownloadIcon className="h-4 w-4" />
                  Indlæs
                </button>
                <button
                  onClick={() => onDelete(version.id)}
                  className="flex items-center gap-1 text-sm bg-red-50 hover:bg-red-100 text-red-700 dark:bg-red-900/50 dark:hover:bg-red-900/80 dark:text-red-300 font-medium py-1 px-3 rounded-md transition-colors"
                  title="Slet denne version permanent"
                >
                  <TrashIcon className="h-4 w-4" />
                  Slet
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
