import React, { useState, useEffect, useCallback } from 'react';
import type { Style, StyleKey, ListAttributes, DocumentType } from '../types';
import { PlusIcon, TrashIcon } from './icons';
import { emptyStyle as initialEmptyStyle } from '../constants';

interface StyleManagerProps {
  styles: Record<StyleKey, Style>;
  setStyles: React.Dispatch<React.SetStateAction<Record<StyleKey, Style>>>;
  onClose: () => void;
}

// Define a type for the attribute in the internal state for easier management
interface EditableAttribute {
  id: string; // Unique ID for React key
  key: string;
  value: string;
}

const ORDERED_LIST_STYLES = ['decimal', 'lower-alpha', 'upper-alpha', 'lower-roman', 'upper-roman', 'none'];
const UNORDERED_LIST_STYLES = ['disc', 'circle', 'square', 'none'];

export const StyleManager: React.FC<StyleManagerProps> = ({ styles, setStyles, onClose }) => {
  const [selectedStyleKey, setSelectedStyleKey] = useState<StyleKey | null>(null);
  const [formData, setFormData] = useState<Omit<Style, 'key'> & { key: string }>(() => ({...initialEmptyStyle, key: ''}));
  const [isNew, setIsNew] = useState(false);
  const [attributeList, setAttributeList] = useState<EditableAttribute[]>([]);

  // Effect to update formData and attributeList when selectedStyleKey or styles change
  useEffect(() => {
    if (selectedStyleKey && styles[selectedStyleKey]) {
      const currentStyle = styles[selectedStyleKey];
      setFormData({ ...currentStyle });
      setIsNew(false);
      // Convert attributes object to an array of EditableAttribute for internal management
      const newAttributeList: EditableAttribute[] = Object.entries(currentStyle.attributes || {}).map(([key, value]) => ({
        id: `${Date.now()}-${Math.random()}`, // Generate a stable string ID for React key
        key,
        value: value as string,
      }));
      setAttributeList(newAttributeList);
    } else {
      setFormData({...initialEmptyStyle, key: '', defaultListAttributes: {}});
      setIsNew(true);
      setAttributeList([]); // Clear attributes for new style
    }
  }, [selectedStyleKey, styles]);

  const handleSelectStyle = (key: StyleKey) => {
    setSelectedStyleKey(key);
    setIsNew(false);
  };

  const handleAddNew = () => {
    setSelectedStyleKey(null);
    setFormData({...initialEmptyStyle, key: '', defaultListAttributes: {}});
    setIsNew(true);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => {
        let newValue: any = value;
        if (name === 'level') {
            newValue = value === '' ? undefined : parseInt(value, 10);
        } else if (name === 'matterType' && value === '') { // Allow empty string for "Ingen" matterType
            newValue = undefined;
        }
        return { 
            ...prev, 
            [name]: newValue
        };
    });
  };
  
  const handleAllowedDocTypeChange = (docType: DocumentType, isChecked: boolean) => {
    setFormData(prev => {
        const currentTypes = prev.allowedDocumentTypes || [];
        if (isChecked) {
            return { ...prev, allowedDocumentTypes: [...currentTypes, docType] };
        } else {
            return { ...prev, allowedDocumentTypes: currentTypes.filter(t => t !== docType) };
        }
    });
  };

  const handleListAttributeChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    const checked = (e.target as HTMLInputElement).checked;
    
    setFormData(prev => {
        const newAttrs = { ...(prev.defaultListAttributes || {}) };
        
        let finalValue: any;
        if (type === 'checkbox') {
            finalValue = checked;
        } else if (type === 'number') {
            finalValue = value ? parseInt(value, 10) : undefined;
        } else {
            finalValue = value;
        }

        // @ts-ignore
        newAttrs[name as keyof ListAttributes] = finalValue;
        
        return {
            ...prev,
            defaultListAttributes: newAttrs
        };
    });
};

  const handleAttributeChange = useCallback((id: string, field: 'key' | 'value', newValue: string) => {
    setAttributeList(prev => prev.map(attr =>
      attr.id === id ? { ...attr, [field]: newValue } : attr
    ));
  }, []);

  const handleAddAttribute = useCallback(() => {
    setAttributeList(prev => [...prev, { 
      id: `${Date.now()}-${Math.random()}`,
      key: '', 
      value: '' 
    }]);
  }, []);

  const handleRemoveAttribute = useCallback((id: string) => {
    setAttributeList(prev => prev.filter(attr => attr.id !== id));
  }, []);


  const handleSave = () => {
    if (!formData.key || !formData.name) {
        alert('Nøgle og Navn er påkrævede felter.');
        return;
    }
    if (isNew && styles[formData.key]) {
        alert('Nøglen findes allerede. Vælg venligst en unik nøgle.');
        return;
    }

    // Convert attributeList back to Record<string, string> for saving
    const savedAttributes: Record<string, string> = {};
    for (const attr of attributeList) {
      if (attr.key.trim() !== '') { // Only save attributes with a non-empty key
        savedAttributes[attr.key.trim()] = attr.value;
      }
    }
    
    const finalFormData = { ...formData };
    if (Object.keys(finalFormData.defaultListAttributes || {}).length === 0) {
        delete finalFormData.defaultListAttributes;
    }

    setStyles(prev => {
        const newStyles = { ...prev };
        if (selectedStyleKey && selectedStyleKey !== finalFormData.key) {
            delete newStyles[selectedStyleKey];
        }
        newStyles[finalFormData.key] = { ...finalFormData, attributes: savedAttributes };
        console.log("StyleManager.tsx: Attempting to save style:", newStyles[finalFormData.key]);
        return newStyles;
    });

    if (isNew) {
        handleSelectStyle(finalFormData.key);
    }
  };

  const handleDelete = () => {
    if (!selectedStyleKey) return;
    if (window.confirm(`Er du sikker på, at du vil slette typografien "${styles[selectedStyleKey].name}"? Dette kan ikke fortrydes.`)) {
        setStyles(prev => {
            const newStyles = { ...prev };
            delete newStyles[selectedStyleKey];
            console.log("StyleManager.tsx: Attempting to delete style. New styles:", newStyles);
            return newStyles;
        });
        setSelectedStyleKey(null);
    }
  };

  const isListItem = formData.key.includes('_list_item');

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-4xl h-[90vh] flex flex-col">
        <header className="flex items-center justify-between p-4 border-b dark:border-gray-700">
          <h2 className="text-xl font-bold text-gray-800 dark:text-gray-200">Administrer Typografier</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">&times;</button>
        </header>
        <div className="flex-grow flex min-h-0">
          <aside className="w-1/3 border-r dark:border-gray-700 flex flex-col">
            <div className="p-2">
                <button onClick={handleAddNew} className="w-full flex items-center justify-center gap-2 bg-blue-500 hover:bg-blue-600 text-white font-semibold py-2 px-4 rounded-md transition-colors text-sm">
                    <PlusIcon className="h-5 w-5" />
                    Tilføj Ny Typografi
                </button>
            </div>
            <ul className="overflow-y-auto flex-grow">
              {Object.values(styles).sort((a: Style, b: Style) => a.name.localeCompare(b.name)).map((style: Style) => (
                <li key={style.key}>
                  <button
                    onClick={() => handleSelectStyle(style.key)}
                    className={`w-full text-left px-4 py-2 text-sm ${selectedStyleKey === style.key ? 'bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300' : 'hover:bg-gray-100 dark:hover:bg-gray-700'}`}
                  >
                    {style.name}
                  </button>
                </li>
              ))}
            </ul>
          </aside>
          <main className="w-2/3 overflow-y-auto p-6 space-y-4">
            <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-300">{isNew ? 'Ny Typografi' : `Redigerer: ${formData.name}`}</h3>
            
            <div>
              <label htmlFor="key" className="block text-sm font-medium text-gray-600 dark:text-gray-400">Nøgle (Unik ID)</label>
              <input type="text" name="key" id="key" value={formData.key} onChange={handleInputChange} disabled={!isNew} className="mt-1 w-full p-2 border border-gray-300 bg-white dark:border-gray-700 dark:bg-gray-700 rounded-md shadow-sm disabled:bg-gray-100 dark:disabled:bg-gray-800/50" />
            </div>

            <div>
              <label htmlFor="name" className="block text-sm font-medium text-gray-600 dark:text-gray-400">Navn</label>
              <input type="text" name="name" id="name" value={formData.name} onChange={handleInputChange} className="mt-1 w-full p-2 border border-gray-300 bg-white dark:border-gray-700 dark:bg-gray-700 rounded-md shadow-sm" />
            </div>

            <div>
              <label htmlFor="description" className="block text-sm font-medium text-gray-600 dark:text-gray-400">Beskrivelse</label>
              <textarea name="description" id="description" value={formData.description} onChange={handleInputChange} rows={2} className="mt-1 w-full p-2 border border-gray-300 bg-white dark:border-gray-700 dark:bg-gray-700 rounded-md shadow-sm" />
            </div>
            
            <div>
              <label htmlFor="className" className="block text-sm font-medium text-gray-600 dark:text-gray-400">CSS Klasser (Tailwind)</label>
              <textarea name="className" id="className" value={formData.className} onChange={handleInputChange} rows={3} className="mt-1 w-full p-2 border border-gray-300 bg-white dark:border-gray-700 dark:bg-gray-700 rounded-md shadow-sm font-mono text-sm" />
            </div>

            <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="jatsTag" className="block text-sm font-medium text-gray-600 dark:text-gray-400">JATS Tag</label>
                  <input type="text" name="jatsTag" id="jatsTag" value={formData.jatsTag} onChange={handleInputChange} className="mt-1 w-full p-2 border border-gray-300 bg-white dark:border-gray-700 dark:bg-gray-700 rounded-md shadow-sm" />
                </div>
                 <div>
                  <label htmlFor="bitsTag" className="block text-sm font-medium text-gray-600 dark:text-gray-400">BITS Tag</label>
                  <input type="text" name="bitsTag" id="bitsTag" value={formData.bitsTag} onChange={handleInputChange} className="mt-1 w-full p-2 border border-gray-300 bg-white dark:border-gray-700 dark:bg-gray-700 rounded-md shadow-sm" />
                </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                  <label htmlFor="nestingParentJats" className="block text-sm font-medium text-gray-600 dark:text-gray-400">JATS Nesting Parent</label>
                  <input type="text" name="nestingParentJats" id="nestingParentJats" value={formData.nestingParentJats || ''} onChange={handleInputChange} className="mt-1 w-full p-2 border border-gray-300 bg-white dark:border-gray-700 dark:bg-gray-700 rounded-md shadow-sm" />
              </div>
              <div>
                  <label htmlFor="nestingParentBits" className="block text-sm font-medium text-gray-600 dark:text-gray-400">BITS Nesting Parent</label>
                  <input type="text" name="nestingParentBits" id="nestingParentBits" value={formData.nestingParentBits || ''} onChange={handleInputChange} className="mt-1 w-full p-2 border border-gray-300 bg-white dark:border-gray-700 dark:bg-gray-700 rounded-md shadow-sm" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
                <div>
                    <label htmlFor="level" className="block text-sm font-medium text-gray-600 dark:text-gray-400">Hierarkiniveau (for overskrifter)</label>
                    <input type="number" name="level" id="level" value={formData.level === undefined ? '' : formData.level} onChange={handleInputChange} className="mt-1 w-full p-2 border border-gray-300 bg-white dark:border-gray-700 dark:bg-gray-700 rounded-md shadow-sm" />
                </div>
                <div>
                    <label htmlFor="matterType" className="block text-sm font-medium text-gray-600 dark:text-gray-400">Matter Type (JATS/BITS)</label>
                    <select name="matterType" id="matterType" value={formData.matterType || ''} onChange={handleInputChange} className="mt-1 w-full p-2 border border-gray-300 bg-white dark:border-gray-700 dark:bg-gray-700 rounded-md shadow-sm">
                        <option value="">Ingen</option>
                        <option value="front">Front Matter</option>
                        <option value="body">Body Matter</option>
                        <option value="back">Back Matter</option>
                        <option value="chapter">Chapter (BITS)</option>
                    </select>
                </div>
            </div>
            
            <div className="p-3 border dark:border-gray-700 rounded-md bg-gray-50 dark:bg-gray-700/50">
                <h4 className="text-md font-semibold mb-2">Dokumenttype synlighed</h4>
                 <div className="flex gap-4">
                    <div className="flex items-center">
                        <input
                            type="checkbox"
                            id="docTypeJournal"
                            checked={formData.allowedDocumentTypes?.includes('journal') ?? false}
                            onChange={(e) => handleAllowedDocTypeChange('journal', e.target.checked)}
                             className="h-4 w-4 rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500 bg-white dark:bg-gray-700"
                        />
                         <label htmlFor="docTypeJournal" className="ml-2 block text-sm text-gray-900 dark:text-gray-300">
                           Tidsskriftartikel
                        </label>
                    </div>
                     <div className="flex items-center">
                        <input
                            type="checkbox"
                            id="docTypeBook"
                            checked={formData.allowedDocumentTypes?.includes('book') ?? false}
                            onChange={(e) => handleAllowedDocTypeChange('book', e.target.checked)}
                            className="h-4 w-4 rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500 bg-white dark:bg-gray-700"
                        />
                         <label htmlFor="docTypeBook" className="ml-2 block text-sm text-gray-900 dark:text-gray-300">
                           Bog
                        </label>
                    </div>
                </div>
            </div>

            {isListItem && (
              <div className="p-3 border dark:border-gray-700 rounded-md bg-gray-50 dark:bg-gray-700/50">
                <h4 className="text-md font-semibold mb-2">Listeindstillinger</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="style" className="block text-sm font-medium text-gray-600 dark:text-gray-400">Listestil</label>
                    <select
                      name="style"
                      id="style"
                      value={formData.defaultListAttributes?.style || ''}
                      onChange={handleListAttributeChange}
                      className="mt-1 w-full p-2 border border-gray-300 bg-white dark:border-gray-700 dark:bg-gray-700 rounded-md shadow-sm"
                    >
                      <option value="">Standard</option>
                      {(formData.key === 'ordered_list_item' ? ORDERED_LIST_STYLES : UNORDERED_LIST_STYLES).map(s => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                  </div>
                  {formData.key === 'ordered_list_item' && (
                    <div>
                      <label htmlFor="start" className="block text-sm font-medium text-gray-600 dark:text-gray-400">Startnummer</label>
                      <input
                        type="number"
                        name="start"
                        id="start"
                        value={formData.defaultListAttributes?.start || ''}
                        onChange={handleListAttributeChange}
                        className="mt-1 w-full p-2 border border-gray-300 bg-white dark:border-gray-700 dark:bg-gray-700 rounded-md shadow-sm"
                      />
                    </div>
                  )}
                  {formData.key === 'ordered_list_item' && (
                    <div className="flex items-center col-span-2">
                        <input
                            type="checkbox"
                            name="reversed"
                            id="reversed"
                            checked={!!formData.defaultListAttributes?.reversed}
                            onChange={handleListAttributeChange}
                            className="h-4 w-4 rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500 bg-white dark:bg-gray-700"
                        />
                        <label htmlFor="reversed" className="ml-2 block text-sm text-gray-900 dark:text-gray-300">
                            Omvendt rækkefølge
                        </label>
                    </div>
                  )}
                </div>
              </div>
            )}
            
            <div className="p-3 border dark:border-gray-700 rounded-md bg-gray-50 dark:bg-gray-700/50">
                <h4 className="text-md font-semibold mb-2">Brugerdefinerede XML Attributter</h4>
                <div className="space-y-2">
                    {attributeList.map((attr, index) => (
                        <div key={attr.id} className="flex items-center gap-2">
                            <input
                                type="text"
                                placeholder="Nøgle"
                                value={attr.key}
                                onChange={(e) => handleAttributeChange(attr.id, 'key', e.target.value)}
                                className="w-full p-2 border border-gray-300 bg-white dark:border-gray-700 dark:bg-gray-700 rounded-md shadow-sm text-sm"
                            />
                            <input
                                type="text"
                                placeholder="Værdi"
                                value={attr.value}
                                onChange={(e) => handleAttributeChange(attr.id, 'value', e.target.value)}
                                className="w-full p-2 border border-gray-300 bg-white dark:border-gray-700 dark:bg-gray-700 rounded-md shadow-sm text-sm"
                            />
                            <button onClick={() => handleRemoveAttribute(attr.id)} className="p-2 text-gray-400 hover:text-red-500 rounded-full hover:bg-gray-100 dark:hover:bg-gray-600">
                                <TrashIcon className="h-4 w-4" />
                            </button>
                        </div>
                    ))}
                </div>
                <button onClick={handleAddAttribute} className="mt-2 flex items-center gap-2 text-sm text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 font-medium py-1 px-2 rounded">
                    <PlusIcon className="h-4 w-4" />
                    Tilføj Attribut
                </button>
            </div>


          </main>
        </div>
        <footer className="flex items-center justify-between p-4 border-t dark:border-gray-700">
            <div>
                {!isNew && selectedStyleKey && (
                    <button onClick={handleDelete} className="bg-red-50 hover:bg-red-100 text-red-700 dark:bg-red-900/50 dark:hover:bg-red-900/80 dark:text-red-300 font-semibold py-2 px-4 rounded-md transition-colors">
                        Slet
                    </button>
                )}
            </div>
            <div className="flex gap-3">
                <button onClick={onClose} className="bg-gray-200 hover:bg-gray-300 text-gray-800 dark:bg-gray-600 dark:hover:bg-gray-500 dark:text-gray-200 font-semibold py-2 px-4 rounded-md transition-colors">
                    Annuller
                </button>
                <button onClick={handleSave} className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded-md transition-colors">
                    {isNew ? 'Opret' : 'Gem Ændringer'}
                </button>
            </div>
        </footer>
      </div>
    </div>
  );
};