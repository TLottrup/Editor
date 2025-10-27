
import React, { useState, useEffect, useCallback } from 'react';
import { generateJatsXml, generateBitsXml } from '../services/xmlSerializer';
import { DownloadIcon } from './icons';
import type { DocumentBlock, Metadata, DocumentType, Style, StyleKey } from '../types';

declare const JSZip: any; // Assuming JSZip is available globally from the script tag in index.html

interface XmlExportPanelProps {
  documentBlocks: DocumentBlock[];
  metadata: Metadata;
  documentType: DocumentType;
  styles: Record<StyleKey, Style>;
}

export const XmlExportPanel: React.FC<XmlExportPanelProps> = ({ documentBlocks, metadata, documentType, styles }) => {
  const [format, setFormat] = useState<'jats' | 'bits'>(documentType === 'book' ? 'bits' : 'jats');
  const [xmlString, setXmlString] = useState('');
  const [images, setImages] = useState<Record<string, string>>({});

  useEffect(() => {
    // Automatically switch format if document type changes
    const suggestedFormat = documentType === 'book' ? 'bits' : 'jats';
    if (format !== suggestedFormat) {
      setFormat(suggestedFormat);
    }
  }, [documentType, format]);
  
  useEffect(() => {
    try {
      if (format === 'jats') {
        const { xmlString: generatedXml, images: generatedImages } = generateJatsXml(documentBlocks, metadata, styles);
        setXmlString(generatedXml);
        setImages(generatedImages);
      } else { // bits
        const { xmlString: generatedXml, images: generatedImages } = generateBitsXml(documentBlocks, metadata, styles);
        setXmlString(generatedXml);
        setImages(generatedImages);
      }
    } catch (error) {
      console.error(`Failed to generate ${format.toUpperCase()} XML:`, error);
      setXmlString(`<error>Kunne ikke generere ${format.toUpperCase()} XML. Tjek konsollen for detaljer.</error>`);
      setImages({});
    }
  }, [documentBlocks, metadata, format, styles]);

  const handleDownload = useCallback(async () => {
    const zip = new JSZip();
    const filename = `${(metadata.title || 'document').replace(/ /g, '_')}.${format}.xml`;
    zip.file(filename, xmlString);

    if (Object.keys(images).length > 0) {
      const imgFolder = zip.folder("Images");
      if (imgFolder) {
        for (const [imgName, base64Data] of Object.entries(images)) {
          imgFolder.file(imgName, base64Data, { base64: true });
        }
      }
    }

    const content = await zip.generateAsync({ type: "blob" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(content);
    link.download = `${(metadata.title || 'export').replace(/ /g, '_')}.zip`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }, [xmlString, images, metadata.title, format]);

  return (
    <div className="flex flex-col h-full">
      <div className="flex-shrink-0 mb-4 space-y-2">
        <h2 className="text-lg font-semibold text-gray-700 dark:text-gray-300 border-b dark:border-gray-700 pb-2">XML Eksport</h2>
        <div className="flex rounded-md shadow-sm">
          <button
            onClick={() => setFormat('jats')}
            disabled={documentType === 'book'}
            className={`flex-1 px-3 py-2 text-sm font-medium border border-gray-300 dark:border-gray-600 rounded-l-md transition-colors
              ${format === 'jats' ? 'bg-blue-600 text-white' : 'bg-white text-gray-700 dark:bg-gray-800 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'}
              ${documentType === 'book' ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            JATS (Tidsskriftartikel)
          </button>
          <button
            onClick={() => setFormat('bits')}
            disabled={documentType === 'journal'}
            className={`-ml-px flex-1 px-3 py-2 text-sm font-medium border border-gray-300 dark:border-gray-600 rounded-r-md transition-colors
              ${format === 'bits' ? 'bg-blue-600 text-white' : 'bg-white text-gray-700 dark:bg-gray-800 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'}
              ${documentType === 'journal' ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            BITS (Bog)
          </button>
        </div>
      </div>
      <div className="flex-grow min-h-0 bg-gray-900 rounded-md p-1">
        <pre className="w-full h-full overflow-auto text-xs text-green-400 p-2 whitespace-pre-wrap break-all">
          <code>{xmlString}</code>
        </pre>
      </div>
      <div className="flex-shrink-0 pt-4">
        <button
          onClick={handleDownload}
          className="w-full flex items-center justify-center gap-2 bg-blue-600 text-white py-2 rounded-md hover:bg-blue-700 transition-colors font-semibold"
        >
          <DownloadIcon className="h-5 w-5" />
          Download ZIP ({format.toUpperCase()})
        </button>
      </div>
    </div>
  );
};
