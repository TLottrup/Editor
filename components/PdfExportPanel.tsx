import React from 'react';
import { DownloadIcon } from './icons';
import type { DocumentBlock, Metadata, DocumentType, Style, StyleKey, TableData, ImageData, Footnote } from '../types';

declare const jspdf: any;

interface PdfExportPanelProps {
  documentBlocks: DocumentBlock[];
  metadata: Metadata;
  documentType: DocumentType;
  pdfCss: string;
  styles: Record<StyleKey, Style>;
}

export const PdfExportPanel: React.FC<PdfExportPanelProps> = ({ documentBlocks, metadata, documentType, pdfCss, styles }) => {
  
  const handleExportPdf = async () => {
    const { jsPDF } = jspdf;
    const doc = new jsPDF({ orientation: 'p', unit: 'pt', format: 'a4' });

    const A4_WIDTH = 595.28;
    const A4_HEIGHT = 841.89;
    const MARGIN_TOP = 72;
    const MARGIN_BOTTOM = 72;
    const MARGIN_LEFT = 72;
    const MARGIN_RIGHT = 72;
    let y = MARGIN_TOP;
    let pageNumber = 1;

    const parsedCss: Record<string, Record<string, string>> = {};
    const ruleRegex = /\[data-style="([^"]+)"\]\s*{([^}]+)}/g;
    let regexMatch;
    while ((regexMatch = ruleRegex.exec(pdfCss)) !== null) {
      const styleKey = regexMatch[1];
      const cssContent = regexMatch[2];
      if (styleKey && cssContent) {
        parsedCss[styleKey] = {};
        cssContent.trim().split(';').filter(Boolean).forEach(prop => {
          const [key, value] = prop.split(':').map(s => s.trim());
          if (key && value) {
            parsedCss[styleKey][key] = value;
          }
        });
      }
    }

    const getStyle = (styleKey: StyleKey) => {
        const style = parsedCss[styleKey] || {};
        const defaultStyle = styles[styleKey]?.visualSettings || {};
        return {
            fontSize: parseFloat(style['font-size'] || String(defaultStyle.fontSize) || '12'),
            fontWeight: style['font-weight'] || defaultStyle.fontWeight || 'normal',
            fontStyle: style['font-style'] || defaultStyle.fontStyle || 'normal',
            color: style['color'] || defaultStyle.color || '#000000',
            textAlign: style['text-align'] || defaultStyle.textAlign || 'left',
            marginTop: parseFloat(style['margin-top'] || '0'),
            marginBottom: parseFloat(style['margin-bottom'] || '5'),
            width: style['width'],
            maxWidth: style['max-width'],
        };
    };
    
    const addHeaderAndFooterToPage = (pageNum: number) => {
        doc.setPage(pageNum);
        doc.setFontSize(9);
        doc.setTextColor('#888888');
        doc.text(`Start side ${pageNum}`, A4_WIDTH / 2, MARGIN_TOP / 2, { align: 'center' });
        doc.text(`Slut side ${pageNum}`, A4_WIDTH / 2, A4_HEIGHT - MARGIN_BOTTOM / 2, { align: 'center' });
    };
    
    addHeaderAndFooterToPage(1);

    const checkPageBreak = (requiredHeight: number) => {
      if (y + requiredHeight > A4_HEIGHT - MARGIN_BOTTOM) {
        doc.addPage();
        y = MARGIN_TOP;
        pageNumber++;
        addHeaderAndFooterToPage(pageNumber);
      }
    };
    
    const parseCssDimension = (value: string | undefined, total: number): number | null => {
        if (!value) return null;
        if (value.endsWith('pt')) return parseFloat(value);
        if (value.endsWith('px')) return parseFloat(value) * 0.75;
        if (value.endsWith('%')) return (parseFloat(value) / 100) * total;
        return parseFloat(value);
    };
    
    const footnotes: Footnote[] = [];
    const tempDiv = document.createElement('div');
    const contentWidth = A4_WIDTH - MARGIN_LEFT - MARGIN_RIGHT;

    // State for list rendering
    const listCounters = [0, 0, 0, 0]; // Supports nesting up to 4 levels
    let lastBlockStyle: StyleKey | null = null;

    for (const block of documentBlocks) {
      if (block.style === 'page_break') continue;
      
      const style = getStyle(block.style);
      
      y += style.marginTop;

      if (block.style === 'image') {
        const imageData: ImageData = JSON.parse(block.content);
        if (!imageData.src) continue;

        const maxWidth = parseCssDimension(style.maxWidth, contentWidth) || contentWidth;
        let imgWidth = parseCssDimension(style.width, contentWidth) || contentWidth;
        
        const img = new Image();
        img.src = imageData.src;
        await new Promise(resolve => { img.onload = resolve; });

        const aspectRatio = img.width / img.height;
        if (imgWidth > maxWidth) imgWidth = maxWidth;
        let imgHeight = imgWidth / aspectRatio;

        const captionLines = doc.splitTextToSize(imageData.caption, contentWidth);
        const captionHeight = captionLines.length * (style.fontSize * 0.8) * 1.2;
        
        const totalHeight = imgHeight + captionHeight + 5;
        checkPageBreak(totalHeight);

        let imgX = MARGIN_LEFT;
        if (style.textAlign === 'center') imgX = (A4_WIDTH - imgWidth) / 2;
        if (style.textAlign === 'right') imgX = A4_WIDTH - MARGIN_RIGHT - imgWidth;
        
        doc.addImage(imageData.src, 'JPEG', imgX, y, imgWidth, imgHeight);
        y += imgHeight + 5;
        
        doc.setFont('Helvetica', 'italic');
        doc.setFontSize(style.fontSize * 0.8);
        doc.setTextColor('#555555');
        doc.text(captionLines, A4_WIDTH / 2, y, { align: 'center' });
        y += captionHeight + style.marginBottom;
      
      } else if (block.style === 'table') {
        try {
          const tableData: TableData = JSON.parse(block.content);
          
          doc.setFontSize(style.fontSize * 0.9);
          doc.setTextColor(style.color);
          const captionLines = doc.splitTextToSize(tableData.caption, contentWidth);
          const captionHeight = captionLines.length * (style.fontSize * 0.9) * 1.2;
          checkPageBreak(captionHeight);
          doc.text(captionLines, A4_WIDTH / 2, y, {align: 'center'});
          y += captionHeight;

          const head = tableData.rows.slice(0, 1).map(row => row.map(cell => cell.content.replace(/<[^>]*>?/gm, '')));
          const body = tableData.rows.slice(1).map(row => row.map(cell => cell.content.replace(/<[^>]*>?/gm, '')));
          
          (doc as any).autoTable({
            startY: y,
            head,
            body,
            theme: 'grid',
            styles: {
              font: 'Helvetica',
              fontSize: style.fontSize,
              cellPadding: 4,
            },
            headStyles: {
              fillColor: '#f3f4f6',
              textColor: '#111827',
              fontStyle: 'bold',
            },
            margin: { left: MARGIN_LEFT, right: MARGIN_RIGHT },
          });

          y = (doc as any).lastAutoTable.finalY + style.marginBottom;
        } catch (e) {
          console.error("Failed to parse or render table for PDF:", e);
        }

      } else if (block.style.includes('_list_item')) {
          const level = block.level || 0;
          
          if (!lastBlockStyle?.includes('_list_item') || level === 0) {
              for(let i = 0; i < listCounters.length; i++) listCounters[i] = 0;
          }

          const indent = MARGIN_LEFT + (level * 20);
          const itemWidth = contentWidth - (level * 20) - 15; // 15 for marker

          let marker = '';
          if (block.style === 'ordered_list_item') {
              listCounters[level]++;
              const listStyle = block.list?.style || styles[block.style].defaultListAttributes?.style || 'decimal';
              
              const toRoman = (num: number) => {
                  const roman = { M: 1000, CM: 900, D: 500, CD: 400, C: 100, XC: 90, L: 50, XL: 40, X: 10, IX: 9, V: 5, IV: 4, I: 1 };
                  let str = '';
                  for (let i of Object.keys(roman)) {
                      let q = Math.floor(num / roman[i as keyof typeof roman]);
                      num -= q * roman[i as keyof typeof roman];
                      str += i.repeat(q);
                  }
                  return str;
              };
              
              const toAlpha = (num: number) => String.fromCharCode(96 + num);

              switch(listStyle) {
                  case 'lower-alpha': marker = `${toAlpha(listCounters[level])}.`; break;
                  case 'upper-alpha': marker = `${toAlpha(listCounters[level]).toUpperCase()}.`; break;
                  case 'lower-roman': marker = `${toRoman(listCounters[level]).toLowerCase()}.`; break;
                  case 'upper-roman': marker = `${toRoman(listCounters[level])}.`; break;
                  default: marker = `${listCounters[level]}.`;
              }
          } else { // unordered
              const listStyle = block.list?.style || styles[block.style].defaultListAttributes?.style || 'disc';
              switch(listStyle) {
                  case 'circle': marker = '◦'; break;
                  case 'square': marker = '▪'; break;
                  default: marker = '•';
              }
          }
          
          doc.setFont('Helvetica', style.fontStyle, style.fontWeight);
          doc.setFontSize(style.fontSize);
          doc.setTextColor(style.color);

          tempDiv.innerHTML = block.content;
          const text = tempDiv.textContent || '';
          const lines = doc.splitTextToSize(text, itemWidth);
          const requiredHeight = lines.length * style.fontSize * 0.9;
          
          checkPageBreak(requiredHeight);

          doc.text(marker, indent, y);
          doc.text(lines, indent + 15, y, { align: 'left' });
          
          y += requiredHeight + style.marginBottom;
          
      } else { // Handle all other text-based blocks
        doc.setFont('Helvetica', style.fontStyle, style.fontWeight);
        doc.setFontSize(style.fontSize);
        doc.setTextColor(style.color);

        tempDiv.innerHTML = block.content;
        const footnoteMarkers = Array.from(tempDiv.querySelectorAll('sup[data-footnote-id]'));
        footnoteMarkers.forEach(sup => {
            const id = sup.getAttribute('data-footnote-id');
            const content = sup.getAttribute('data-footnote-content');
            if (id && content) {
                if (!footnotes.find(f => f.id === id)) {
                    footnotes.push({ id, content });
                }
                const number = footnotes.findIndex(f => f.id === id) + 1;
                sup.textContent = `[${number}]`;
            }
        });
        const text = tempDiv.textContent || '';
        const lines = doc.splitTextToSize(text, contentWidth);
        const requiredHeight = lines.length * style.fontSize * 0.9;

        checkPageBreak(requiredHeight);

        let x = MARGIN_LEFT;
        if (style.textAlign === 'center') x = A4_WIDTH / 2;
        if (style.textAlign === 'right') x = A4_WIDTH - MARGIN_RIGHT;
        
        let processedLines: string[] = [];
        lines.forEach((line: string) => {
            const lineWithFootnotes = line.replace(/\[(\d+)\]/g, ' $1 ');
            const parts = lineWithFootnotes.split(/(\s\d+\s)/);
            let currentLine = '';
            
            parts.forEach((part: string) => {
                const footnoteMatch = part.match(/\s(\d+)\s/);
                if (footnoteMatch) {
                    if (currentLine) {
                        processedLines.push(currentLine);
                    }
                    processedLines.push(`[${footnoteMatch[1]}]`); // Special marker for superscript
                    currentLine = '';
                } else {
                    currentLine += part;
                }
            });
            if (currentLine) {
                processedLines.push(currentLine);
            }
        });
        
        let currentX;
        for (const line of processedLines) {
            currentX = x;
            if (style.textAlign === 'left') {
                const textParts = line.split(/(\[\d+\])/g).filter(Boolean);
                textParts.forEach(part => {
                    const footnoteMatch = part.match(/\[(\d+)\]/);
                    if (footnoteMatch) {
                        doc.setFontSize(style.fontSize * 0.7);
                        doc.text(footnoteMatch[1], currentX, y - style.fontSize * 0.3, { baseline: 'bottom' });
                        currentX += doc.getTextWidth(footnoteMatch[1]) * 0.7; // Approx width of superscript
                        doc.setFontSize(style.fontSize);
                    } else {
                        doc.text(part, currentX, y);
                        currentX += doc.getTextWidth(part);
                    }
                });
            } else {
                 doc.text(line.replace(/\[(\d+)\]/g, '$1'), x, y, { align: style.textAlign || 'left' });
            }
            y += style.fontSize * 1.2;
        }

        y += style.marginBottom - (style.fontSize * 1.2); // Adjust y position after rendering all lines

      }
      lastBlockStyle = block.style;
    }

    if (footnotes.length > 0) {
        checkPageBreak(72); // Space for title
        y += 24;
        doc.setFont('Helvetica', 'bold');
        doc.setFontSize(14);
        doc.text('Fodnoter', MARGIN_LEFT, y);
        y += 20;

        footnotes.forEach((fn, index) => {
            doc.setFont('Helvetica', 'normal');
            doc.setFontSize(10);
            const content = `${index + 1}. ${fn.content}`;
            const lines = doc.splitTextToSize(content, contentWidth);
            const requiredHeight = lines.length * 10 * 1.2;
            checkPageBreak(requiredHeight);
            doc.text(lines, MARGIN_LEFT, y);
            y += requiredHeight + 5;
        });
    }
    
    doc.save(`${(metadata.title || 'document').replace(/ /g, '_')}.pdf`);
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex-shrink-0 mb-4 space-y-2">
        <h2 className="text-lg font-semibold text-gray-700 dark:text-gray-300 border-b dark:border-gray-700 pb-2">PDF Eksport</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Generer en PDF-version af dit dokument. Styling kan tilpasses i fanen "CSS".
        </p>
      </div>
      <div className="flex-grow flex items-center justify-center">
        <button
          onClick={handleExportPdf}
          className="w-1/2 flex items-center justify-center gap-2 bg-blue-600 text-white py-3 rounded-md hover:bg-blue-700 transition-colors font-semibold"
        >
          <DownloadIcon className="h-5 w-5" />
          Eksporter til PDF
        </button>
      </div>
    </div>
  );
};