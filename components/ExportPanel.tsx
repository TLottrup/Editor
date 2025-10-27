import React from 'react';
import { TabbedPanel, Tab } from './TabbedPanel';
import { XmlExportPanel } from './XmlExportPanel';
import { PdfExportPanel } from './PdfExportPanel';
import type { DocumentBlock, Metadata, DocumentType, Style, StyleKey } from '../types';

interface ExportPanelProps {
  documentBlocks: DocumentBlock[];
  metadata: Metadata; 
  documentType: DocumentType;
  pdfCss: string;
  styles: Record<StyleKey, Style>;
}

export const ExportPanel: React.FC<ExportPanelProps> = ({ documentBlocks, metadata, documentType, pdfCss, styles }) => {
  return (
    <div className="flex flex-col h-full -m-4">
      <TabbedPanel>
        <Tab label="XML Eksport">
          <XmlExportPanel 
            documentBlocks={documentBlocks}
            metadata={metadata}
            documentType={documentType}
            styles={styles}
          />
        </Tab>
        <Tab label="PDF eksport">
          <PdfExportPanel 
            documentBlocks={documentBlocks}
            metadata={metadata}
            documentType={documentType}
            pdfCss={pdfCss}
            styles={styles}
          />
        </Tab>
      </TabbedPanel>
    </div>
  );
};