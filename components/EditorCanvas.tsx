import React, { useEffect, useRef, useMemo, useState, useCallback } from 'react';
import { createRoot, Root } from 'react-dom/client';
import type { DocumentBlock, DocumentType, StyleKey, TableData, ImageData, Style, TableCell, EditorLayoutSettings, ListAttributes } from '../types';

import { EditorState, NodeSelection, Plugin, Transaction, Command, PluginKey, TextSelection } from 'prosemirror-state';
import { EditorView, Decoration, DecorationSet } from 'prosemirror-view';
import { Schema, DOMParser, Node as ProsemirrorNode, DOMSerializer, NodeSpec, Fragment, MarkType, Mark } from 'prosemirror-model';
import { schema as basicSchema } from 'prosemirror-schema-basic';
import { keymap } from 'prosemirror-keymap';
import { baseKeymap, setBlockType, toggleMark, chainCommands, splitBlock, liftEmptyBlock, createParagraphNear, newlineInCode } from 'prosemirror-commands';
import { history, undo, redo } from 'prosemirror-history';
import { dropCursor } from 'prosemirror-dropcursor';
import { gapCursor } from 'prosemirror-gapcursor';
import { TrashIcon, RowInsertAboveIcon, RowInsertBelowIcon, ColumnInsertLeftIcon, ColumnInsertRightIcon, MergeCellsIcon, SplitCellIcon } from './icons';

// Helper function to strip page_break nodes for state comparison
const stripPageBreaks = (doc: ProsemirrorNode, schema: Schema): ProsemirrorNode => {
    const content: ProsemirrorNode[] = [];
    doc.forEach(node => {
        if (node.type.name !== 'page_break') {
            content.push(node);
        }
    });
    return schema.node('doc', null, Fragment.from(content));
};


const TableEditor: React.FC<{ data: TableData; onChange: (newData: TableData) => void; }> = ({ data, onChange }) => {
    const [internalData, setInternalData] = useState(data);

    useEffect(() => {
        setInternalData(data);
    }, [data]);

    const updateCellContent = (rowIndex: number, colIndex: number, content: string) => {
        const newRows = internalData.rows.map(row => [...row]);
        newRows[rowIndex][colIndex] = { ...newRows[rowIndex][colIndex], content };
        onChange({ ...internalData, rows: newRows });
    };

    const handleAction = (action: 'addRowAbove' | 'addRowBelow' | 'addColLeft' | 'addColRight' | 'deleteRow' | 'deleteCol') => {
        const newRows = internalData.rows.map(row => [...row]);
        const colCount = newRows[0]?.length || 1;
        
        // For simplicity, this example assumes the first cell is selected.
        // A real implementation would need to track the selected cell.
        const rowIndex = 0; 
        const colIndex = 0;

        switch (action) {
            case 'addRowAbove':
                newRows.splice(rowIndex, 0, Array(colCount).fill({ content: '' }));
                break;
            case 'addRowBelow':
                newRows.splice(rowIndex + 1, 0, Array(colCount).fill({ content: '' }));
                break;
            case 'addColLeft':
                newRows.forEach(row => row.splice(colIndex, 0, { content: '' }));
                break;
            case 'addColRight':
                newRows.forEach(row => row.splice(colIndex + 1, 0, { content: '' }));
                break;
            case 'deleteRow':
                 if (newRows.length > 1) newRows.splice(rowIndex, 1);
                break;
            case 'deleteCol':
                if (colCount > 1) newRows.forEach(row => row.splice(colIndex, 1));
                break;
        }
        onChange({ ...internalData, rows: newRows });
    };

    return (
        <div className="my-4 p-2 border rounded-md relative bg-gray-50 dark:bg-gray-900/50 dark:border-gray-700 group">
            <div className="absolute top-1 right-1 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button title="Add Row Above" onClick={() => handleAction('addRowAbove')} className="p-1.5 bg-white dark:bg-gray-800 rounded shadow"><RowInsertAboveIcon className="w-4 h-4" /></button>
                <button title="Add Row Below" onClick={() => handleAction('addRowBelow')} className="p-1.5 bg-white dark:bg-gray-800 rounded shadow"><RowInsertBelowIcon className="w-4 h-4" /></button>
                <button title="Add Column Left" onClick={() => handleAction('addColLeft')} className="p-1.5 bg-white dark:bg-gray-800 rounded shadow"><ColumnInsertLeftIcon className="w-4 h-4" /></button>
                <button title="Add Column Right" onClick={() => handleAction('addColRight')} className="p-1.5 bg-white dark:bg-gray-800 rounded shadow"><ColumnInsertRightIcon className="w-4 h-4" /></button>
                <button title="Delete Row" onClick={() => handleAction('deleteRow')} className="p-1.5 bg-white dark:bg-gray-800 rounded shadow"><TrashIcon className="w-4 h-4 text-red-500" /></button>
                 <button title="Delete Column" onClick={() => handleAction('deleteCol')} className="p-1.5 bg-white dark:bg-gray-800 rounded shadow"><TrashIcon className="w-4 h-4 text-red-500" /></button>
            </div>
            <table className="w-full border-collapse">
                <tbody>
                    {internalData.rows.map((row, rIndex) => (
                        <tr key={rIndex}>
                            {row.map((cell, cIndex) => (
                                <td 
                                    key={cIndex} 
                                    className="border border-gray-300 dark:border-gray-600 p-2"
                                    contentEditable
                                    suppressContentEditableWarning
                                    onBlur={(e) => updateCellContent(rIndex, cIndex, e.currentTarget.innerHTML)}
                                    dangerouslySetInnerHTML={{ __html: cell.content }}
                                />
                            ))}
                        </tr>
                    ))}
                </tbody>
            </table>
            <input 
                type="text" 
                value={internalData.caption}
                onChange={(e) => onChange({ ...internalData, rows: internalData.rows, caption: e.target.value })}
                placeholder="Table caption"
                className="w-full mt-2 text-center text-sm italic bg-transparent border-none focus:outline-none focus:ring-0 p-1"
            />
        </div>
    );
};

const ImageEditor: React.FC<{ data: ImageData; onChange: (newData: ImageData) => void; }> = ({ data, onChange }) => {
    return (
        <div className="my-4 p-4 border rounded-md bg-gray-50 dark:bg-gray-900/50 dark:border-gray-700 flex flex-col items-center">
            <img src={data.src} alt={data.caption} className="max-w-full rounded" />
            <input 
                type="text"
                value={data.caption}
                onChange={(e) => onChange({ ...data, caption: e.target.value })}
                placeholder="Image caption"
                className="w-full mt-2 text-center text-sm italic bg-transparent border-none focus:outline-none focus:ring-0 p-1"
            />
            <input 
                type="text"
                value={data.source}
                onChange={(e) => onChange({ ...data, source: e.target.value })}
                placeholder="Image source"
                className="w-full mt-1 text-center text-xs bg-transparent border-none focus:outline-none focus:ring-0 p-1"
            />
        </div>
    );
};

class ReactNodeView {
    dom: HTMLElement;
    root: Root;
    view: EditorView;
    getPos: () => number;
    node: ProsemirrorNode;
    
    constructor(node: ProsemirrorNode, view: EditorView, getPos: () => number, component: React.FC<any>, props: any) {
        this.node = node;
        this.view = view;
        this.getPos = getPos;
        
        this.dom = document.createElement('div');
        this.dom.classList.add('react-node-view');

        this.root = createRoot(this.dom);
        this.root.render(React.createElement(component, props));
    }

    update(node: ProsemirrorNode) {
        if (node.type !== this.node.type) return false;
        this.node = node;
        return true;
    }

    destroy() {
        this.root.unmount();
    }
}

export interface EditorApi {
    applyStyle: (style: StyleKey) => void;
    addBlock: (style: StyleKey) => void;
    removeEmptyBlocks: () => void;
    search: (query: string) => void;
    goToSearchResult: (direction: 1 | -1) => void;
    scrollToBlock: (blockId: number) => void;
    focusTitle: () => void;
    undo: () => void;
    redo: () => void;
    runPagination: (startPage: number) => void;
    removePagination: () => void;
    insertLoremIpsum: (options: { paragraphs: number; parts: number; chapters: number }) => void;
    addFootnote: () => void;
}

const enterKeyCommand: Command = (state, dispatch) => {
    const { $from } = state.selection;
    const parent = $from.parent;

    const isListItem = parent.type.name.endsWith('_list_item');
    if (isListItem) {
        return false;
    }

    const bodyType = state.schema.nodes.body;
    if (!bodyType) {
        return false;
    }

    if (parent.content.size === 0 && parent.type !== bodyType) {
        if (dispatch) {
            dispatch(state.tr.setBlockType($from.start(), $from.end(), bodyType));
        }
        return true;
    }
    
    if (dispatch) {
        dispatch(
            state.tr
                .split($from.pos, 1, [{type: bodyType, attrs: { id: Date.now() }}])
                .scrollIntoView()
        );
    }
    return true;
};

const createPaginationCommand = (layoutSettings: EditorLayoutSettings, styles: Record<StyleKey, Style>, startPage: number = 1): Command => (state, dispatch) => {
    const { schema } = state;
    const pageBreakType = schema.nodes.page_break;
    if (!pageBreakType) return false;

    // Helper to convert CSS units to pixels
    const convertToPx = (value: string, dimension: 'width' | 'height' = 'width'): number => {
        const temp = document.createElement("div");
        temp.style.position = "absolute";
        temp.style.visibility = "hidden";
        temp.style.width = '1000' + value.replace(/[^a-z%]/g, '');
        temp.style.height = '1000' + value.replace(/[^a-z%]/g, '');
        document.body.appendChild(temp);
        const rect = temp.getBoundingClientRect();
        const px = (dimension === 'width' ? rect.width : rect.height) / 1000 * parseFloat(value);
        document.body.removeChild(temp);
        return px;
    };

    const paperHeightPx = convertToPx(layoutSettings.paperHeight, 'height');
    const marginTopPx = convertToPx(layoutSettings.marginTop, 'height');
    const marginBottomPx = convertToPx(layoutSettings.marginBottom, 'height');
    const paperWidthPx = convertToPx(layoutSettings.paperWidth, 'width');
    const marginLeftPx = convertToPx(layoutSettings.marginLeft, 'width');
    const marginRightPx = convertToPx(layoutSettings.marginRight, 'width');
    
    const contentHeightAvailable = paperHeightPx - marginTopPx - marginBottomPx;
    const contentWidth = `${paperWidthPx - marginLeftPx - marginRightPx}px`;

    const measurementNode = document.createElement('div');
    measurementNode.style.position = 'absolute';
    measurementNode.style.top = '-9999px';
    measurementNode.style.left = '-9999px';
    measurementNode.style.width = contentWidth;
    measurementNode.className = 'ProseMirror prosemirror-styled-content'; // Apply same styles
    document.body.appendChild(measurementNode);
    
    const serializer = DOMSerializer.fromSchema(schema);

    let tr = state.tr;
    
    // 1. Remove all existing page breaks
    const positionsToRemove: number[] = [];
    state.doc.descendants((node, pos) => {
        if (node.type === pageBreakType) {
            positionsToRemove.push(pos);
        }
    });
    // Iterate backwards to not mess up positions
    for (let i = positionsToRemove.length - 1; i >= 0; i--) {
        tr = tr.delete(positionsToRemove[i], positionsToRemove[i] + 1);
    }

    // After removing breaks, the transaction's doc is the one to measure against
    const cleanDoc = tr.doc;
    
    const nodeInfos: {node: ProsemirrorNode, pos: number}[] = [];
    cleanDoc.forEach((node, pos) => {
        nodeInfos.push({node, pos});
    });
    
    measurementNode.innerHTML = ''; // Clear out the full doc

    let pageCounter = startPage;
    const positionsToInsert: { pos: number, pageNumber: number }[] = [];
    
    let currentPageContent: ProsemirrorNode[] = [];
    let cumulativeHeight = 0;

    for (let i = 0; i < nodeInfos.length; i++) {
        const { node, pos } = nodeInfos[i];
        
        const style = styles[node.type.name as StyleKey];
        const isMajorHeading = style && (style.key === 'del' || style.key === 'kapitel');
        
        const virtualPage = document.createElement('div');
        [...currentPageContent, node].forEach(n => virtualPage.appendChild(serializer.serializeNode(n)));
        measurementNode.appendChild(virtualPage);
        const newTotalHeight = measurementNode.scrollHeight;
        measurementNode.innerHTML = ''; // Clean up

        const forceBreakBefore = isMajorHeading && i > 0 && currentPageContent.length > 0;
        
        if (forceBreakBefore || (newTotalHeight > contentHeightAvailable && i > 0 && currentPageContent.length > 0)) {
            let breakPos = pos;
            
            const prevNode = currentPageContent[currentPageContent.length - 1];
            const prevNodeInfo = nodeInfos[i - 1];
            const prevStyle = styles[prevNode.type.name as StyleKey];
            const isPrevNodeHeading = prevStyle && (prevStyle.key.includes('heading') || prevStyle.key === 'kapitel' || prevStyle.key === 'del');

            if (!forceBreakBefore && isPrevNodeHeading) {
                // Widow prevention: If the last item on the page is a heading, move it to the next page.
                breakPos = prevNodeInfo.pos;
                currentPageContent.pop(); // Remove the heading from this page's content
            }
            
            const lastBreak = positionsToInsert[positionsToInsert.length - 1];
            if (!lastBreak || lastBreak.pos !== breakPos) {
                 positionsToInsert.push({ pos: breakPos, pageNumber: pageCounter });
                 pageCounter++;
            }
            
            // Start new page
            currentPageContent = [];
            if (!forceBreakBefore && isPrevNodeHeading) {
                currentPageContent.push(prevNode); // The heading starts the new page
            }
            currentPageContent.push(node); // The current node is on the new page
        } else {
            currentPageContent.push(node);
        }
    }

    // 3. Insert new page breaks
    for (let i = positionsToInsert.length - 1; i >= 0; i--) {
        const { pos, pageNumber } = positionsToInsert[i];
        const pageBreakNode = pageBreakType.create({ pageNumber });
        tr = tr.insert(pos, pageBreakNode);
    }
    
    document.body.removeChild(measurementNode);
    
    if (dispatch && tr.docChanged) {
        tr.setMeta('addToHistory', false);
        dispatch(tr);
        return true;
    }
    
    return false;
};

// --- Start Lorem Ipsum Generation ---
const LOREM_IPSUM_WORDS = "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.".split(" ");

const generateSentence = (wordCount: number) => {
    let sentence = "";
    for (let i = 0; i < wordCount; i++) {
        sentence += LOREM_IPSUM_WORDS[Math.floor(Math.random() * LOREM_IPSUM_WORDS.length)] + " ";
    }
    const trimmedSentence = sentence.trim() + ".";
    return trimmedSentence.charAt(0).toUpperCase() + trimmedSentence.slice(1);
};

const generateParagraph = (sentenceCount: number) => {
    let paragraph = "";
    for (let i = 0; i < sentenceCount; i++) {
        paragraph += generateSentence(Math.floor(Math.random() * 10) + 5) + " ";
    }
    return paragraph.trim();
};

const generateLoremIpsumBlocks = (options: { paragraphs: number; parts: number; chapters: number }, documentType: DocumentType): DocumentBlock[] => {
    const { paragraphs: paragraphCount, parts: partCount, chapters: chapterCount } = options;
    const blocks: DocumentBlock[] = [];

    if (documentType === 'book' && partCount > 0 && chapterCount > 0) {
        let globalChapterCounter = 1;
        let paragraphsPerChapter = Math.max(1, Math.floor(paragraphCount / chapterCount));
        let remainingParagraphs = paragraphCount % chapterCount;

        for (let i = 1; i <= partCount; i++) {
            blocks.push({
                id: Date.now() + blocks.length,
                style: 'del',
                content: `Del ${i}: ${generateSentence(3)}`,
                level: 0,
            });

            const chaptersInThisPart = Math.floor(chapterCount / partCount) + (i <= (chapterCount % partCount) ? 1 : 0);

            for (let j = 0; j < chaptersInThisPart; j++) {
                if (globalChapterCounter > chapterCount) break;
                blocks.push({
                    id: Date.now() + blocks.length,
                    style: 'kapitel',
                    content: `Kapitel ${globalChapterCounter++}: ${generateSentence(4)}`,
                    level: 0,
                });
                
                let pCount = paragraphsPerChapter + (remainingParagraphs > 0 ? 1 : 0);
                if(remainingParagraphs > 0) remainingParagraphs--;

                for (let k = 0; k < pCount; k++) {
                    blocks.push({
                        id: Date.now() + blocks.length,
                        style: 'body',
                        content: generateParagraph(Math.floor(Math.random() * 4) + 3),
                        level: 0,
                    });
                }
            }
        }
    } else {
        // Fallback for journal or simple paragraph generation
        let headingCounter = 1;
        for (let i = 0; i < paragraphCount; i++) {
            // Always add a heading for the first paragraph, and for subsequent ones with a 25% chance.
            if (i === 0 || Math.random() < 0.25) {
                 blocks.push({
                    id: Date.now() + blocks.length,
                    style: 'section_heading_1',
                    content: `${headingCounter++}. ${generateSentence(4)}`,
                    level: 0,
                });
            }
            blocks.push({
                id: Date.now() + blocks.length,
                style: 'body',
                content: generateParagraph(Math.floor(Math.random() * 4) + 3),
                level: 0,
            });
        }
    }
    return blocks;
};
// --- End Lorem Ipsum Generation ---

// --- Footnote Plugin ---
const footnotePluginKey = new PluginKey('footnotePlugin');

const createFootnotePlugin = (schema: Schema) => {
    let currentPopover: { dom: HTMLElement, destroy: () => void } | null = null;
    
    return new Plugin({
        key: footnotePluginKey,
        props: {
            decorations(state) {
                const footnoteType = schema.marks.footnote;
                if (!footnoteType) return DecorationSet.empty;

                const decorations: Decoration[] = [];
                let footnoteCounter = 1;
                
                state.doc.descendants((node, pos) => {
                    if (node.isText) {
                        const hasFootnote = node.marks.some(mark => mark.type === footnoteType);
                        if (hasFootnote) {
                            decorations.push(
                                Decoration.widget(pos + node.nodeSize, () => {
                                    const span = document.createElement('span');
                                    span.className = 'footnote-marker-number';
                                    span.textContent = String(footnoteCounter++);
                                    return span;
                                })
                            );
                        }
                    }
                });
                return DecorationSet.create(state.doc, decorations);
            },
            handleClick(view, pos, event) {
                const { schema, doc } = view.state;
                const footnoteType = schema.marks.footnote;
                if (!footnoteType) return false;
                
                const $pos = doc.resolve(pos);
                const marks = $pos.marks();
                const footnoteMark = marks.find(mark => mark.type === footnoteType);

                if (currentPopover) {
                    currentPopover.destroy();
                    currentPopover = null;
                }
                
                if (footnoteMark) {
                    event.preventDefault();
                    
                    const popover = document.createElement('div');
                    popover.className = 'footnote-popover';
                    popover.textContent = footnoteMark.attrs.content;
                    
                    document.body.appendChild(popover);

                    const coords = view.coordsAtPos(pos);
                    popover.style.left = `${coords.left}px`;
                    popover.style.top = `${coords.bottom + 5}px`;

                    const clickOutsideHandler = (e: MouseEvent) => {
                        if (!popover.contains(e.target as Node)) {
                            destroyPopover();
                        }
                    };
                    
                    const destroyPopover = () => {
                        document.removeEventListener('click', clickOutsideHandler);
                        if (popover.parentNode) {
                            popover.parentNode.removeChild(popover);
                        }
                        currentPopover = null;
                    };
                    
                    document.addEventListener('click', clickOutsideHandler, { once: true });
                    
                    currentPopover = { dom: popover, destroy: destroyPopover };

                    return true;
                }

                return false;
            },
        },
    });
};

// --- End Footnote Plugin ---

// --- Search Plugin ---
const searchPluginKey = new PluginKey('search');

interface SearchState {
  query: string;
  results: { from: number; to: number }[];
  currentIndex: number;
}

const createSearchPlugin = () => {
  return new Plugin<SearchState>({
    key: searchPluginKey,
    state: {
      init(): SearchState {
        return { query: '', results: [], currentIndex: -1 };
      },
      apply(tr, value): SearchState {
        const action = tr.getMeta(searchPluginKey);
        if (action) {
          if (action.type === 'SEARCH') {
            return { ...value, query: action.query, results: action.results, currentIndex: action.currentIndex };
          }
          if (action.type === 'NAVIGATE') {
            return { ...value, currentIndex: action.currentIndex };
          }
          if (action.type === 'CLEAR') {
            return { query: '', results: [], currentIndex: -1 };
          }
        }
        
        // If the document changed and there's an active query, re-run the search
        if (tr.docChanged && value.query) {
            const query = value.query;
            const results: { from: number; to: number }[] = [];
            const queryLower = query.toLowerCase();

            tr.doc.descendants((node, pos) => {
                if (node.isText && node.text) {
                    const textLower = node.text.toLowerCase();
                    let index = textLower.indexOf(queryLower);
                    while (index !== -1) {
                        results.push({
                            from: pos + index,
                            to: pos + index + query.length,
                        });
                        index = textLower.indexOf(queryLower, index + 1);
                    }
                }
            });

            const newCurrentIndex = value.currentIndex >= results.length ? (results.length > 0 ? results.length - 1 : -1) : value.currentIndex;
            
            return {
                query,
                results,
                currentIndex: newCurrentIndex
            };
        }
        
        if (tr.docChanged) {
            return { query: '', results: [], currentIndex: -1 };
        }

        return value;
      },
    },
    props: {
      decorations(state) {
        const searchState = this.getState(state);
        if (!searchState || searchState.results.length === 0) return DecorationSet.empty;

        const decorations = searchState.results.map((result, index) => {
          const className = index === searchState.currentIndex ? 'current-search-result' : 'search-result';
          return Decoration.inline(result.from, result.to, { class: className });
        });

        return DecorationSet.create(state.doc, decorations);
      },
    },
  });
};
// --- End Search Plugin ---

// --- List Numbering Plugin ---
const createListNumberingPlugin = (styles: Record<StyleKey, Style>) => {
    // Helper to convert a number to a specific list style format
    const formatNumber = (num: number, style: ListAttributes['style']): string => {
        const toRoman = (n: number): string => {
            if (isNaN(n) || n < 1) return '';
            const roman = { M: 1000, CM: 900, D: 500, CD: 400, C: 100, XC: 90, L: 50, XL: 40, X: 10, IX: 9, V: 5, IV: 4, I: 1 };
            let str = '';
            for (const i of Object.keys(roman)) {
                const q = Math.floor(n / roman[i as keyof typeof roman]);
                n -= q * roman[i as keyof typeof roman];
                str += i.repeat(q);
            }
            return str;
        };
        const toAlpha = (n: number) => n > 0 && n < 27 ? String.fromCharCode(96 + n) : '';

        switch (style) {
            case 'lower-alpha': return toAlpha(num);
            case 'upper-alpha': return toAlpha(num).toUpperCase();
            case 'lower-roman': return toRoman(num).toLowerCase();
            case 'upper-roman': return toRoman(num);
            case 'decimal':
            default: return String(num);
        }
    };
    
    return new Plugin({
        key: new PluginKey('listNumbering'),
        props: {
            decorations(state) {
                const decorations: Decoration[] = [];
                const doc = state.doc;
                const counters: Map<number, { isReversed: boolean, current: number, style: ListAttributes['style'] }> = new Map();
                const reversedListCounts: Map<number, number> = new Map();

                // First pass: find contiguous reversed lists and count their items.
                doc.forEach((node, pos, i) => {
                    const styleDef = styles[node.type.name];
                    const listAttrs = (node.attrs.list || styleDef?.defaultListAttributes) as ListAttributes | null;
                    const level = node.attrs.level || 0;

                    if (node.type.name === 'ordered_list_item' && listAttrs?.reversed && !reversedListCounts.has(pos)) {
                        let count = 0;
                        let j = i;
                        while (j < doc.childCount) {
                            const scanNode = doc.child(j);
                            if (scanNode.type.name === 'ordered_list_item' && (scanNode.attrs.level || 0) === level) {
                                count++;
                            } else {
                                break;
                            }
                            j++;
                        }
                        reversedListCounts.set(pos, count);
                    }
                });

                // Second pass: apply decorations
                doc.forEach((node, pos, i) => {
                    if (!node.type.name.includes('_list_item')) {
                        counters.clear();
                        return;
                    }

                    if (node.type.name === 'ordered_list_item') {
                        const styleDef = styles[node.type.name];
                        const listAttrs = (node.attrs.list || styleDef?.defaultListAttributes) as ListAttributes | null;

                        if (!listAttrs || (!listAttrs.reversed && (!listAttrs.start || listAttrs.start === 1))) {
                            return; // CSS can handle this
                        }

                        const level = node.attrs.level || 0;
                        const prevNode = i > 0 ? doc.child(i - 1) : null;
                        const isNewList = !prevNode || !prevNode.type.name.includes('_list_item') || (prevNode.attrs.level || 0) < level;

                        if (isNewList) {
                            for (const k of counters.keys()) {
                                if (k > level) counters.delete(k);
                            }
                            if (listAttrs.reversed) {
                                const count = reversedListCounts.get(pos) || 0;
                                const start = listAttrs.start ?? count;
                                counters.set(level, { isReversed: true, current: start, style: listAttrs.style || 'decimal' });
                            } else {
                                counters.set(level, { isReversed: false, current: (listAttrs.start || 1) - 1, style: listAttrs.style || 'decimal' });
                            }
                        }

                        const counter = counters.get(level);
                        if (counter) {
                            const displayValue = counter.isReversed ? counter.current-- : ++counter.current;
                            const marker = `${formatNumber(displayValue, counter.style)}.`;
                            decorations.push(Decoration.node(pos, pos + node.nodeSize, { 'data-display-number': marker }));
                        }
                    }
                });
                return DecorationSet.create(doc, decorations);
            }
        }
    });
};
// --- End List Numbering Plugin ---

export const EditorCanvas: React.FC<{
  blocks: DocumentBlock[];
  documentType: DocumentType;
  onBlocksChange: (blocks: DocumentBlock[]) => void;
  editorApiRef: React.MutableRefObject<EditorApi | null>;
  onSelectionChange: (selectionInfo: { activeBlockId: number | null, canUndo: boolean, canRedo: boolean, searchResults?: { count: number, current: number }, isPaginated?: boolean, totalPages?: number, isSelectionEmpty?: boolean }) => void;
  searchQuery: string;
  styles: Record<StyleKey, Style>;
  layoutSettings: EditorLayoutSettings;
}> = ({ blocks, documentType, onBlocksChange, editorApiRef, onSelectionChange, searchQuery, styles, layoutSettings }) => {
    const editorRef = useRef<HTMLDivElement>(null);
    const viewRef = useRef<EditorView | null>(null);
    const isUpdatingFromOutside = useRef(false);

    const editorSchema = useMemo(() => {
        const nodes: Record<string, NodeSpec> = {
            doc: { content: "block+" },
            text: basicSchema.spec.nodes.get("text") as NodeSpec,
            hard_break: basicSchema.spec.nodes.get("hard_break") as NodeSpec,
            page_break: {
                group: "block",
                atom: true,
                attrs: { pageNumber: { default: 1 } },
                toDOM: (node: ProsemirrorNode) => {
                    const pageNum = node.attrs.pageNumber;
                    return ["div", { class: "page-break-container" },
                        ["div", { class: "page-break-footer" }, `Slut side ${pageNum}`],
                        ["div", { class: "page-break-gutter" }],
                        ["div", { class: "page-break-header" }, `Start side ${pageNum + 1}`]
                    ];
                },
                parseDOM: [{
                    tag: "div.page-break-container",
                    getAttrs: (dom: HTMLElement) => {
                        const footer = dom.querySelector('.page-break-footer');
                        const pageNumText = footer?.textContent?.match(/\d+/);
                        return {
                            pageNumber: pageNumText ? parseInt(pageNumText[0], 10) : 1
                        };
                    }
                }]
            }
        };

        Object.values(styles).forEach((style: Style) => {
            if (style.key === 'table' || style.key === 'image') {
                nodes[style.key] = {
                    attrs: { id: { default: 0 }, data: { default: '' } },
                    group: "block", atom: true,
                    toDOM: (node: ProsemirrorNode) => ["div", { "data-style": style.key, "data-id": node.attrs.id }],
                    parseDOM: [{ tag: `div[data-style="${style.key}"]`, getAttrs: (dom: HTMLElement) => ({ id: dom.dataset.id ? parseInt(dom.dataset.id, 10) : 0, data: '' }) }]
                };
            } else {
                nodes[style.key] = {
                    attrs: { id: { default: 0 }, level: { default: 0 }, list: { default: null } },
                    content: "inline*", group: "block",
                    toDOM: (node: ProsemirrorNode) => {
                        const domAttrs: Record<string, any> = {
                            "class": styles[node.type.name as StyleKey]?.className || '',
                            "data-style": style.key,
                            "data-id": node.attrs.id,
                            "data-level": node.attrs.level,
                        };
                        const listAttrs = (node.attrs.list || styles[node.type.name]?.defaultListAttributes) as ListAttributes | null;
                        if (style.key.includes('_list_item') && listAttrs && listAttrs.style) {
                            domAttrs['data-list-style'] = listAttrs.style;
                        }
                        return ["div", domAttrs, 0];
                    },
                    parseDOM: [{ 
                        tag: `div[data-style="${style.key}"]`, 
                        getAttrs: (dom: HTMLElement) => {
                             const list: ListAttributes = {};
                             if (dom.dataset.listStyle) list.style = dom.dataset.listStyle as any;
                             // Note: start and reversed are not parsed from DOM as they are handled by a plugin
                             return {
                                id: dom.dataset.id ? parseInt(dom.dataset.id, 10) : 0, 
                                level: dom.dataset.level ? parseInt(dom.dataset.level, 10) : 0,
                                list: Object.keys(list).length > 0 ? list : null,
                            };
                        }
                    }]
                };
            }
        });
        
        const marks = {
            bold: basicSchema.spec.marks.get("strong"),
            italic: basicSchema.spec.marks.get("em"),
            footnote: {
                attrs: { id: { default: '' }, content: { default: '' } },
                inclusive: false,
                toDOM: (mark: Mark) => ["sup", {
                    "data-footnote-id": mark.attrs.id,
                    "data-footnote-content": mark.attrs.content,
                    "class": "footnote-marker cursor-pointer",
                    "title": "Klik for at se fodnote"
                }] as const,
                parseDOM: [{
                    tag: "sup[data-footnote-id]",
                    getAttrs: (dom: HTMLElement) => ({
                        id: dom.getAttribute("data-footnote-id"),
                        content: dom.getAttribute("data-footnote-content"),
                    })
                }]
            }
        };

        return new Schema({ nodes, marks });
    }, [styles]);

    const blocksToDoc = useCallback((blocks: DocumentBlock[]): ProsemirrorNode => {
        const pmNodes: ProsemirrorNode[] = blocks.map(block => {
            const type = editorSchema.nodes[block.style];
            if (!type) return null;
            if (type.isAtom) {
                return type.create({ id: block.id, data: block.content });
            }
            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = block.content;
            const contentFragment = DOMParser.fromSchema(editorSchema).parseSlice(tempDiv).content;
            return type.create({ id: block.id, level: block.level, list: block.list }, contentFragment);
        }).filter((n): n is ProsemirrorNode => n !== null);
        return editorSchema.node('doc', null, pmNodes);
    }, [editorSchema]);

    const docToBlocks = useCallback((doc: ProsemirrorNode): DocumentBlock[] => {
        const blocks: DocumentBlock[] = [];
        const domSerializer = DOMSerializer.fromSchema(editorSchema);
        doc.forEach(node => {
            if (node.type.name === 'page_break') return; // Skip page breaks when serializing back to blocks
            let content = '';
            if (node.isAtom) {
                content = node.attrs.data;
            } else {
                const fragment = domSerializer.serializeFragment(node.content);
                const tempDiv = document.createElement('div');
                tempDiv.appendChild(fragment);
                content = tempDiv.innerHTML;
            }
            blocks.push({
                id: node.attrs.id || Date.now() + Math.random(), style: node.type.name as StyleKey, content: content,
                level: node.attrs.level, list: node.attrs.list,
            });
        });
        return blocks;
    }, [editorSchema]);

    useEffect(() => {
        if (!editorRef.current) return;

        if (viewRef.current) {
            viewRef.current.destroy();
            viewRef.current = null;
        }

        const state = EditorState.create({
            doc: blocksToDoc(blocks),
            plugins: [
                history(),
                keymap({
                    ...baseKeymap,
                    "Enter": chainCommands(enterKeyCommand, newlineInCode, createParagraphNear, liftEmptyBlock, splitBlock),
                    "Mod-z": undo, "Mod-y": redo, "Mod-Shift-z": redo,
                    "Mod-b": toggleMark(editorSchema.marks.bold), "Mod-i": toggleMark(editorSchema.marks.italic),
                }),
                dropCursor(), gapCursor(),
                createFootnotePlugin(editorSchema),
                createSearchPlugin(),
                createListNumberingPlugin(styles),
                new Plugin({
                    key: new PluginKey('apiPlugin'),
                    view(editorView) {
                        if (editorApiRef) {
                            editorApiRef.current = {
                                applyStyle: (styleKey) => {
                                    const { state, dispatch } = editorView;
                                    const type = editorSchema.nodes[styleKey];
                                    if (type) {
                                        const styleDef = styles[styleKey];
                                        let attrs = { ...state.selection.$from.parent.attrs };
                                        delete attrs.list;
                                        if (styleKey.includes('_list_item') && styleDef.defaultListAttributes) {
                                            attrs.list = styleDef.defaultListAttributes;
                                        }
                                        setBlockType(type, attrs)(state, dispatch);
                                    }
                                },
                                addBlock: (style) => { const { state, dispatch } = editorView; const type = editorSchema.nodes[style]; const endPos = state.doc.content.size; const tr = state.tr.insert(endPos, type.create({ id: Date.now() })); dispatch(tr); },
                                addFootnote: () => {
                                    const { state, dispatch } = editorView;
                                    const { from, to } = state.selection;
                                    if (from === to) return;
                                    
                                    const content = prompt("Indtast fodnotetekst:");
                                    if (content) {
                                        const id = `fn-${Date.now()}`;
                                        const footnoteMark = editorSchema.marks.footnote.create({ id, content });
                                        const tr = state.tr.addMark(from, to, footnoteMark);
                                        dispatch(tr);
                                    }
                                },
                                removeEmptyBlocks: () => {
                                    const { state, dispatch } = editorView;
                                    const { doc } = state;
                                    let tr = state.tr;
                                    let modified = false;
                                    
                                    const positionsToDelete: number[] = [];
                            
                                    doc.forEach((node, pos) => {
                                        if (node.isBlock && !node.isAtom && node.content.size === 0) {
                                            positionsToDelete.push(pos);
                                        }
                                    });
                                    
                                    if (positionsToDelete.length === doc.childCount && doc.childCount > 0) {
                                        positionsToDelete.pop(); 
                                    }
                            
                                    if (positionsToDelete.length > 0) {
                                        modified = true;
                                        for (let i = positionsToDelete.length - 1; i >= 0; i--) {
                                            const pos = positionsToDelete[i];
                                            const node = doc.nodeAt(pos);
                                            if (node) {
                                                tr.delete(pos, pos + node.nodeSize);
                                            }
                                        }
                                    }
                            
                                    if (modified) {
                                        dispatch(tr);
                                    }
                                },
                                insertLoremIpsum: (options) => {
                                    const { state, dispatch } = editorView;
                                    const newBlocks = generateLoremIpsumBlocks(options, documentType);
                                    const newNodes = newBlocks.map(block => {
                                        const type = editorSchema.nodes[block.style];
                                        if (!type) return null;
                                        const tempDiv = document.createElement('div');
                                        tempDiv.innerHTML = block.content;
                                        const contentFragment = DOMParser.fromSchema(editorSchema).parseSlice(tempDiv).content;
                                        return type.create({ id: block.id, level: block.level }, contentFragment);
                                    }).filter((n): n is ProsemirrorNode => n !== null);

                                    if (newNodes.length > 0) {
                                        const fragment = Fragment.from(newNodes);
                                        const tr = state.tr.replaceWith(0, state.doc.content.size, fragment);
                                        dispatch(tr);
                                    }
                                },
                                search: (query) => {
                                    const { state, dispatch } = editorView;
                                    if (!query) {
                                        dispatch(state.tr.setMeta(searchPluginKey, { type: 'CLEAR' }));
                                        return;
                                    }
                        
                                    const results: { from: number; to: number }[] = [];
                                    const queryLower = query.toLowerCase();
                        
                                    state.doc.descendants((node, pos) => {
                                        if (node.isText && node.text) {
                                            const textLower = node.text.toLowerCase();
                                            let index = textLower.indexOf(queryLower);
                                            while (index !== -1) {
                                                results.push({
                                                    from: pos + index,
                                                    to: pos + index + query.length,
                                                });
                                                index = textLower.indexOf(queryLower, index + 1);
                                            }
                                        }
                                    });
                                    
                                    const currentIndex = results.length > 0 ? 0 : -1;
                                    const tr = state.tr.setMeta(searchPluginKey, { type: 'SEARCH', query, results, currentIndex });
                                    
                                    if (results.length > 0) {
                                        const resultPos = results[currentIndex];
                                        tr.setSelection(TextSelection.create(tr.doc, resultPos.from, resultPos.to));
                                        tr.scrollIntoView();
                                    }
                                    
                                    dispatch(tr);
                                },
                                goToSearchResult: (direction) => {
                                    const { state, dispatch } = editorView;
                                    const searchState = searchPluginKey.getState(state);
                                    if (!searchState || searchState.results.length === 0) return;
                        
                                    let nextIndex = searchState.currentIndex + direction;
                                    if (nextIndex < 0) {
                                        nextIndex = searchState.results.length - 1;
                                    } else if (nextIndex >= searchState.results.length) {
                                        nextIndex = 0;
                                    }
                        
                                    const tr = state.tr.setMeta(searchPluginKey, { type: 'NAVIGATE', currentIndex: nextIndex });
                                    
                                    const resultPos = searchState.results[nextIndex];
                                    tr.setSelection(TextSelection.create(tr.doc, resultPos.from, resultPos.to));
                                    tr.scrollIntoView();
                                    
                                    dispatch(tr);
                                },
                                scrollToBlock: (blockId) => {
                                    const { doc } = editorView.state; let targetPos = -1;
                                    doc.forEach((node, pos) => { if (node.attrs.id === blockId) targetPos = pos; });
                                    if (targetPos !== -1) { const domNode = editorView.nodeDOM(targetPos); if (domNode) (domNode as HTMLElement).scrollIntoView({ behavior: 'smooth', block: 'center' }); }
                                },
                                focusTitle: () => editorView.dom.blur(),
                                undo: () => undo(editorView.state, editorView.dispatch),
                                redo: () => redo(editorView.state, editorView.dispatch),
                                runPagination: (startPage: number) => {
                                    const command = createPaginationCommand(layoutSettings, styles, startPage);
                                    command(editorView.state, editorView.dispatch);
                                },
                                removePagination: () => {
                                    const { state, dispatch } = editorView;
                                    const pageBreakType = editorSchema.nodes.page_break;
                                    if (!pageBreakType) return;

                                    let tr = state.tr;
                                    const positionsToRemove: number[] = [];
                                    state.doc.descendants((node, pos) => {
                                        if (node.type === pageBreakType) {
                                            positionsToRemove.push(pos);
                                        }
                                    });

                                    if (positionsToRemove.length === 0) return;

                                    for (let i = positionsToRemove.length - 1; i >= 0; i--) {
                                        tr = tr.delete(positionsToRemove[i], positionsToRemove[i] + 1);
                                    }

                                    if (dispatch && tr.docChanged) {
                                        dispatch(tr.setMeta('addToHistory', false));
                                    }
                                }
                            };
                        }
                        return {};
                    },
                    props: {
                        nodeViews: {
                            table: (node, view, getPos) => {
                                const onChange = (newData: TableData) => { const tr = view.state.tr.setNodeMarkup(getPos(), undefined, { ...node.attrs, data: JSON.stringify(newData) }); view.dispatch(tr); };
                                let parsedData; try { parsedData = JSON.parse(node.attrs.data || '{}'); } catch (e) { parsedData = {}; console.error("Could not parse table data:", node.attrs.data); }
                                const data: TableData = { caption: parsedData.caption || '', rows: parsedData.rows && Array.isArray(parsedData.rows) ? parsedData.rows : [[{ content: ' ' }]] };
                                if (data.rows.length === 0) { data.rows.push([{ content: ' ' }]); }
                                return new ReactNodeView(node, view, getPos, TableEditor, { data, onChange });
                            },
                            image: (node, view, getPos) => {
                                const onChange = (newData: ImageData) => { const tr = view.state.tr.setNodeMarkup(getPos(), undefined, { ...node.attrs, data: JSON.stringify(newData) }); view.dispatch(tr); };
                                let parsedData; try { parsedData = JSON.parse(node.attrs.data || '{}'); } catch (e) { parsedData = {src: '', caption: '', source: ''}; }
                                return new ReactNodeView(node, view, getPos, ImageEditor, { data: parsedData, onChange });
                            },
                        }
                    }
                })
            ]
        });

        const view = new EditorView(editorRef.current, {
            state,
            dispatchTransaction(tr: Transaction) {
                if (!viewRef.current) return;
                const newState = viewRef.current.state.apply(tr);
                viewRef.current.updateState(newState);

                const searchState = searchPluginKey.getState(newState);
                const { selection } = newState;
                const node = selection.$anchor.node(1);
                const selectionInfo: { 
                    activeBlockId: number | null; 
                    canUndo: boolean; 
                    canRedo: boolean; 
                    isPaginated?: boolean;
                    totalPages?: number;
                    isSelectionEmpty?: boolean;
                    searchResults?: { count: number, current: number };
                } = { 
                    activeBlockId: node?.attrs.id || null,
                    canUndo: undo(newState),
                    canRedo: redo(newState),
                    isSelectionEmpty: newState.selection.empty,
                    searchResults: {
                        count: searchState?.results.length || 0,
                        current: searchState?.currentIndex ?? -1,
                    },
                };

                if (tr.docChanged) {
                    isUpdatingFromOutside.current = true;
                    onBlocksChange(docToBlocks(newState.doc));
                    requestAnimationFrame(() => { isUpdatingFromOutside.current = false; });
                    
                    let pageBreakCount = 0;
                    newState.doc.descendants(node => {
                        if (node.type.name === 'page_break') {
                            pageBreakCount++;
                        }
                    });
                    const hasPageBreaks = pageBreakCount > 0;
                    selectionInfo.isPaginated = hasPageBreaks;
                    selectionInfo.totalPages = hasPageBreaks ? pageBreakCount + 1 : 1;
                }
                
                onSelectionChange(selectionInfo);
            },
        });
        viewRef.current = view;

        return () => {
            if (viewRef.current) {
                viewRef.current.destroy();
                viewRef.current = null;
            }
            if (editorApiRef.current) {
                editorApiRef.current = null;
            }
        };
    }, [styles, editorApiRef, onSelectionChange, editorSchema, blocksToDoc, docToBlocks, layoutSettings, documentType]);

    useEffect(() => {
        if (viewRef.current && !isUpdatingFromOutside.current && blocks) {
            const state = viewRef.current.state;
            const newDocFromProps = blocksToDoc(blocks);

            // Create versions of the documents without page breaks for comparison.
            const currentDocStripped = stripPageBreaks(state.doc, editorSchema);
            const newDocStripped = stripPageBreaks(newDocFromProps, editorSchema);

            // Only sync if the actual content (sans page breaks) is different.
            if (!newDocStripped.eq(currentDocStripped)) {
                const tr = state.tr.replaceWith(0, state.doc.content.size, newDocFromProps.content).setMeta('isSync', true);
                viewRef.current.dispatch(tr);
            }
        }
    }, [blocks, blocksToDoc, editorSchema]);

    return <div ref={editorRef} className="prosemirror-editor prosemirror-styled-content" />;
};
