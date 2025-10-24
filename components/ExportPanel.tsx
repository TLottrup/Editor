

import React, { useState, useCallback } from 'react';
// Fix: Corrected import path.
import type { DocumentBlock, ExportFormat, DocumentType, ImageData, TableData, Metadata, BookMetadata, Style, StyleKey } from '../types';
import { generateJatsXml, generateBitsXml } from '../services/xmlSerializer';
import { DownloadIcon } from './icons';

type ParsedCssStyles = Record<string, Record<string, string>>;

const parsePdfCss = (css: string): ParsedCssStyles => {
    const styles: ParsedCssStyles = {};
    const ruleRegex = /\[data-style="([^"]+)"\]\s*\{([^}]+)\}/g;
    let match;
    while ((match = ruleRegex.exec(css)) !== null) {
        const styleKey = match[1];
        const propertiesStr = match[2];
        const properties: Record<string, string> = {};
        propertiesStr.split(';').forEach(prop => {
            const parts = prop.split(':');
            if (parts.length === 2) {
                const key = parts[0].trim();
                const value = parts[1].trim();
                properties[key] = value;
            }
        });
        styles[styleKey] = properties;
    }
    return styles;
};

interface ExportPanelProps {
  documentBlocks: DocumentBlock[];
  metadata: Metadata; 
  documentType: DocumentType;
  pdfCss: string;
  styles: Record<StyleKey, Style>;
}

export const ExportPanel: React.FC<ExportPanelProps> = ({ documentBlocks, metadata, documentType, pdfCss, styles }) => {
  const [xmlOutput, setXmlOutput] = useState('');
  const [imagesToZip, setImagesToZip] = useState<Record<string, string>>({});
  const [activeFormat, setActiveFormat] = useState<ExportFormat | null>(null);
  
  const [pdfOptions, setPdfOptions] = useState({
      fontSize: 'normal',
      fontFamily: 'helvetica',
      margin: 'normal',
      pageNumbers: true,
      textColor: '#333333',
      headingColor: '#1E40AF',
  });

  const handleExport = useCallback((format: ExportFormat) => {
    let result: { xmlString: string, images: Record<string, string> };
    if (format === 'jats') {
      result = generateJatsXml(documentBlocks, metadata, styles);
    } else { // 'bits'
      result = generateBitsXml(documentBlocks, metadata as BookMetadata, styles);
    }
    setXmlOutput(result.xmlString);
    setImagesToZip(result.images);
    setActiveFormat(format);
  }, [documentBlocks, metadata, styles]);

  const handleDownload = () => {
    if (!xmlOutput || !activeFormat) return;

    const hasImages = Object.keys(imagesToZip).length > 0;

    if (hasImages) {
        // @ts-ignore - JSZip is loaded from CDN
        const zip = new JSZip();
        
        // Add XML file
        zip.file(`eksport.${activeFormat}.xml`, xmlOutput);
        
        // Add Images folder and files
        const imgFolder = zip.folder("Images");
        if (imgFolder) {
            for (const [filename, base64Data] of Object.entries(imagesToZip)) {
                imgFolder.file(filename, base64Data, { base64: true });
            }
        }

        zip.generateAsync({ type: "blob" })
            .then(function(content) {
                const url = URL.createObjectURL(content);
                const a = document.createElement('a');
                a.href = url;
                a.download = `eksport.${activeFormat}.zip`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
            });
    } else {
        // Original logic for just XML
        const blob = new Blob([xmlOutput], { type: 'application/xml;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `eksport.${activeFormat}.xml`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }
  };

    const handleExportPdf = useCallback(async () => {
    // @ts-ignore - jsPDF is loaded from CDN
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({
        unit: 'pt',
        format: 'a4',
    });

    const parsedCss = parsePdfCss(pdfCss);
    
    const fontSizes = {
        small: { base: 10, h1: 18, h2: 16, h3: 14, h4: 12 },
        normal: { base: 12, h1: 22, h2: 18, h3: 16, h4: 14 },
        large: { base: 14, h1: 26, h2: 20, h3: 18, h4: 16 },
    };
    const currentFontSizes = fontSizes[pdfOptions.fontSize as keyof typeof fontSizes];

    const margins = {
        small: 30,
        normal: 50,
        large: 80,
    };
    const currentMargin = margins[pdfOptions.margin as keyof typeof margins];

    let cursorY = currentMargin;
    const pageHeight = doc.internal.pageSize.getHeight();
    const contentWidth = doc.internal.pageSize.getWidth() - currentMargin * 2;
    let pageCount = 1;

    const checkPageBreak = (requiredHeight: number) => {
        if (cursorY + requiredHeight > pageHeight - currentMargin) {
            if (pdfOptions.pageNumbers) {
                doc.setFontSize(8);
                doc.setTextColor('#888888');
                doc.text(`Side ${pageCount}`, doc.internal.pageSize.getWidth() / 2, pageHeight - 20, { align: 'center' });
            }
            doc.addPage();
            cursorY = currentMargin;
            pageCount++;
        }
    };
    
    doc.setFont(pdfOptions.fontFamily);

    // Render Title from metadata
    if (metadata.title) {
        const titleCss = parsedCss['title'] || {};
        const titleFontSize = parseFloat(titleCss['font-size']) || currentFontSizes.h1 * 1.2;
        doc.setFontSize(titleFontSize);
        doc.setFont(pdfOptions.fontFamily, titleCss['font-weight'] || 'bold');
        doc.setTextColor(titleCss.color || pdfOptions.headingColor);
        const titleLines = doc.splitTextToSize(metadata.title, contentWidth);
        const titleAlign = titleCss['text-align'] || 'left';
        let xPos = currentMargin;
        if (titleAlign === 'center') xPos = doc.internal.pageSize.getWidth() / 2;
        else if (titleAlign === 'right') xPos = doc.internal.pageSize.getWidth() - currentMargin;
        checkPageBreak(titleLines.length * titleFontSize * 1.15 + 20);
        doc.text(titleLines, xPos, cursorY, { align: titleAlign as any });
        cursorY += (titleLines.length * titleFontSize * 1.15) + 20;
    }

    // Render Subtitle from metadata
    if (metadata.subtitle) {
        const subtitleCss = parsedCss['subtitle'] || {};
        const subtitleFontSize = parseFloat(subtitleCss['font-size']) || currentFontSizes.h2 * 0.9;
        doc.setFontSize(subtitleFontSize);
        doc.setFont(pdfOptions.fontFamily, subtitleCss['font-weight'] || 'normal');
        doc.setTextColor(subtitleCss.color || pdfOptions.textColor);
        const subtitleLines = doc.splitTextToSize(metadata.subtitle, contentWidth);
        const subtitleAlign = subtitleCss['text-align'] || 'left';
        let xPos = currentMargin;
        if (subtitleAlign === 'center') xPos = doc.internal.pageSize.getWidth() / 2;
        else if (subtitleAlign === 'right') xPos = doc.internal.pageSize.getWidth() - currentMargin;
        checkPageBreak(subtitleLines.length * subtitleFontSize * 1.15 + 30);
        doc.text(subtitleLines, xPos, cursorY, { align: subtitleAlign as any });
        cursorY += (subtitleLines.length * subtitleFontSize * 1.15) + 30;
    }

    const isHeading = (styleKey: StyleKey) => 
        ['del', 'kapitel', 'section_heading_1', 'section_heading_2', 'section_heading_3', 'section_heading_4', 'section_heading_5'].includes(styleKey);

    for (const block of documentBlocks) {
        const styleInfo = styles[block.style];
        const blockCss = parsedCss[block.style] || {};

        if (block.style === 'image') {
             try {
                const imageData: ImageData = JSON.parse(block.content);
                await new Promise<void>((resolve, reject) => {
                    const img = new Image();
                    img.onload = () => {
                        const aspectRatio = img.naturalWidth / img.naturalHeight;
                        const targetWidth = imageData.width || img.naturalWidth;
                        let displayWidth = Math.min(contentWidth, targetWidth);
                        let displayHeight = displayWidth / aspectRatio;

                        if (displayHeight > pageHeight - (currentMargin * 2)) {
                            displayHeight = pageHeight - (currentMargin * 2);
                            displayWidth = displayHeight * aspectRatio;
                        }

                        checkPageBreak(displayHeight + 25); 
                        doc.addImage(imageData.src, 'PNG', currentMargin, cursorY, displayWidth, displayHeight);
                        cursorY += displayHeight + 5;

                        doc.setFontSize(currentFontSizes.base * 0.8);
                        doc.setFont(pdfOptions.fontFamily, 'italic');
                        doc.setTextColor(blockCss.color || pdfOptions.textColor);
                        
                        if (imageData.caption) {
                           const captionLines = doc.splitTextToSize(imageData.caption, contentWidth);
                           doc.text(captionLines, doc.internal.pageSize.getWidth() / 2, cursorY, { align: 'center' });
                           cursorY += (captionLines.length * currentFontSizes.base * 0.8) + 2;
                        }
                        if (imageData.source) {
                            const sourceLines = doc.splitTextToSize(`Kilde: ${imageData.source}`, contentWidth);
                           doc.text(sourceLines, doc.internal.pageSize.getWidth() / 2, cursorY, { align: 'center' });
                           cursorY += (sourceLines.length * currentFontSizes.base * 0.8) + 5;
                        }
                        cursorY += 10;
                        resolve();
                    };
                    img.onerror = () => {
                        checkPageBreak(15);
                        doc.setFontSize(currentFontSizes.base * 0.9);
                        doc.setTextColor(255, 0, 0);
                        doc.text(`[Billede kunne ikke indlæses: ${imageData.caption}]`, currentMargin, cursorY);
                        cursorY += 15;
                        resolve();
                    };
                    img.src = imageData.src;
                });
            } catch (e) { 
                console.error("Could not add image to PDF", e); 
                checkPageBreak(15);
                doc.setFontSize(currentFontSizes.base * 0.9);
                doc.setTextColor(255, 0, 0);
                doc.text(`[Fejl ved behandling af billede]`, currentMargin, cursorY);
                cursorY += 15;
            }
            continue;
        }

        if (block.style === 'table') {
            try {
                const tableData: TableData = JSON.parse(block.content);
                checkPageBreak(20);
                doc.setFontSize(currentFontSizes.base);
                doc.setFont(pdfOptions.fontFamily, 'bold');
                doc.setTextColor(blockCss.color || pdfOptions.headingColor);
                doc.text(tableData.caption, currentMargin, cursorY);
                cursorY += currentFontSizes.base * 1.5;
                
                doc.setTextColor(pdfOptions.textColor);
                doc.setFontSize(currentFontSizes.base * 0.9);
                tableData.rows.forEach((row, rowIndex) => {
                    checkPageBreak(currentFontSizes.base);
                    doc.setFont(pdfOptions.fontFamily, rowIndex === 0 ? 'bold' : 'normal');
                    const rowText = row.join('   |   ');
                    const lines = doc.splitTextToSize(rowText, contentWidth);
                    doc.text(lines, currentMargin, cursorY);
                    cursorY += (lines.length * currentFontSizes.base) + 2;
                });
                cursorY += 5;
            } catch (e) { console.error("Could not add table to PDF", e); }
            continue;
        }

        let fontSize = currentFontSizes.base;
        if (styleInfo.key === 'del') fontSize = currentFontSizes.h1 * 1.2;
        else if (styleInfo.key === 'kapitel') fontSize = currentFontSizes.h2;
        else if (styleInfo.key === 'section_heading_1') fontSize = currentFontSizes.h3;
        else if (styleInfo.key === 'section_heading_2') fontSize = currentFontSizes.h4;
        else if (styleInfo.key === 'section_heading_3') fontSize = currentFontSizes.h4 * 0.9;
        else if (styleInfo.key === 'section_heading_4') fontSize = currentFontSizes.base * 1.1;
        else if (styleInfo.key === 'section_heading_5') fontSize = currentFontSizes.base * 1.05;
        else if (styleInfo.key === 'petit') fontSize = currentFontSizes.base * 0.8;
        
        if(blockCss['font-size']) fontSize = parseFloat(blockCss['font-size']) || fontSize;

        let fontWeight = styleInfo.className.includes('font-bold') || styleInfo.className.includes('font-semibold') || styleInfo.className.includes('font-black') ? 'bold' : 'normal';
        if(blockCss['font-weight']) fontWeight = blockCss['font-weight'];

        let fontStyle = styleInfo.className.includes('italic') ? 'italic' : 'normal';
        if(blockCss['font-style']) fontStyle = blockCss['font-style'];
        
        const finalFontStyle = [fontWeight, fontStyle].filter(s => s !== 'normal').join(' ');
        
        doc.setFontSize(fontSize);
        doc.setFont(pdfOptions.fontFamily, finalFontStyle || 'normal');
        
        const color = blockCss.color || (isHeading(block.style) ? pdfOptions.headingColor : pdfOptions.textColor);
        doc.setTextColor(color);
        
        const marginTop = parseFloat(blockCss['margin-top']) || 0;
        const marginBottom = parseFloat(blockCss['margin-bottom']) || (isHeading(block.style) ? fontSize * 0.5 : fontSize * 0.5);
        const textAlign = blockCss['text-align'] || 'left';
        
        const plainText = block.content.replace(/<[^>]*>?/gm, '');
        const lines = doc.splitTextToSize(plainText, contentWidth);
        const requiredHeight = (lines.length * fontSize * 1.15) + marginTop + marginBottom;
        
        cursorY += marginTop;
        checkPageBreak(requiredHeight - marginTop);
        
        let xPos = currentMargin;
        if (textAlign === 'center') xPos = doc.internal.pageSize.getWidth() / 2;
        else if (textAlign === 'right') xPos = doc.internal.pageSize.getWidth() - currentMargin;

        doc.text(lines, xPos, cursorY, { align: textAlign as any });
        cursorY += (lines.length * fontSize * 1.15) + marginBottom;
    }
    
    if (pdfOptions.pageNumbers) {
       doc.setFontSize(8);
       doc.setTextColor('#888888');
       doc.text(`Side ${pageCount}`, doc.internal.pageSize.getWidth() / 2, pageHeight - 20, { align: 'center' });
    }

    doc.save(`eksport-${documentType}.pdf`);
  }, [documentBlocks, documentType, pdfOptions, pdfCss, metadata, styles]);
  
  return (
    <div className="flex flex-col h-full">
      <div className="flex-shrink-0">
        <h2 className="text-lg font-semibold text-gray-700 dark:text-gray-300 mb-4 border-b dark:border-gray-700 pb-2">Eksport</h2>
        <div className="space-y-4">
            
            {/* PDF Export Section */}
            <div className="p-3 border rounded-md bg-gray-50 dark:bg-gray-900/50 dark:border-gray-700">
                 <h3 className="text-md font-semibold text-gray-700 dark:text-gray-300 mb-3">PDF-indstillinger</h3>
                 <div className="space-y-3">
                     <div>
                        <label className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">Skriftstørrelse</label>
                        <select value={pdfOptions.fontSize} onChange={(e) => setPdfOptions(p => ({...p, fontSize: e.target.value}))} className="w-full text-sm p-1.5 border border-gray-300 bg-white dark:border-gray-600 dark:bg-gray-700 rounded-md">
                            <option value="small">Lille</option>
                            <option value="normal">Normal</option>
                            <option value="large">Stor</option>
                        </select>
                     </div>
                     <div>
                        <label className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">Skrifttype</label>
                        <select value={pdfOptions.fontFamily} onChange={(e) => setPdfOptions(p => ({...p, fontFamily: e.target.value}))} className="w-full text-sm p-1.5 border border-gray-300 bg-white dark:border-gray-600 dark:bg-gray-700 rounded-md">
                            <option value="helvetica">Helvetica</option>
                            <option value="times">Times New Roman</option>
                            <option value="courier">Courier</option>
                        </select>
                     </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">Side-marginer</label>
                        <select value={pdfOptions.margin} onChange={(e) => setPdfOptions(p => ({...p, margin: e.target.value}))} className="w-full text-sm p-1.5 border border-gray-300 bg-white dark:border-gray-600 dark:bg-gray-700 rounded-md">
                            <option value="small">Smal</option>
                            <option value="normal">Normal</option>
                            <option value="large">Bred</option>
                        </select>
                     </div>
                     <div>
                        <label className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">Standard tekstfarve</label>
                        <input type="color" value={pdfOptions.textColor} onChange={(e) => setPdfOptions(p => ({...p, textColor: e.target.value}))} className="w-full h-8 p-1 border border-gray-300 bg-white dark:border-gray-600 dark:bg-gray-700 rounded-md"/>
                     </div>
                     <div>
                        <label className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">Standard overskriftsfarve</label>
                        <input type="color" value={pdfOptions.headingColor} onChange={(e) => setPdfOptions(p => ({...p, headingColor: e.target.value}))} className="w-full h-8 p-1 border border-gray-300 bg-white dark:border-gray-600 dark:bg-gray-700 rounded-md"/>
                     </div>
                     <div className="flex items-center">
                        <input type="checkbox" id="pageNumbers" checked={pdfOptions.pageNumbers} onChange={(e) => setPdfOptions(p => ({...p, pageNumbers: e.target.checked}))} className="h-4 w-4 rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500 bg-white dark:bg-gray-700"/>
                        <label htmlFor="pageNumbers" className="ml-2 block text-sm text-gray-900 dark:text-gray-300">Inkluder sidetal</label>
                     </div>
                 </div>
                 <button 
                    onClick={handleExportPdf} 
                    className="w-full mt-4 bg-red-600 text-white py-2 rounded-md hover:bg-red-700 transition-colors font-semibold"
                >
                  Eksporter til PDF
                </button>
            </div>
            
            {/* XML Export Section */}
            <div>
              {documentType === 'journal' && (
                <button onClick={() => handleExport('jats')} className="w-full bg-blue-600 text-white py-2 rounded-md hover:bg-blue-700 transition-colors font-semibold">
                  Eksporter JATS
                </button>
              )}
              {documentType === 'book' && (
                <button onClick={() => handleExport('bits')} className="w-full bg-green-600 text-white py-2 rounded-md hover:bg-green-700 transition-colors font-semibold">
                  Eksporter BITS
                </button>
              )}
            </div>
        </div>
      </div>
      
      {xmlOutput && (
        <div className="flex flex-col flex-grow min-h-0 mt-4">
           <div className="flex justify-between items-center mb-2">
                <h3 className="text-md font-semibold text-gray-600 dark:text-gray-400">{activeFormat?.toUpperCase()} Visning</h3>
                <button onClick={handleDownload} className="flex items-center gap-2 text-sm bg-gray-200 hover:bg-gray-300 text-gray-700 dark:bg-gray-700 dark:hover:bg-gray-600 dark:text-gray-300 font-medium py-1 px-3 rounded-md transition-colors">
                    <DownloadIcon className="h-4 w-4" />
                    Download
                </button>
           </div>
          <textarea
            readOnly
            value={xmlOutput}
            className="w-full h-full flex-grow bg-gray-900 text-green-400 font-mono text-xs p-3 rounded-md border border-gray-700 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[400px]"
          />
        </div>
      )}
    </div>
  );
};
