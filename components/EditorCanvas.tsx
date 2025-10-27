import React, { useEffect, useRef, useMemo, useState, useCallback } from 'react';
import { createRoot, Root } from 'react-dom/client';
import type { DocumentBlock, DocumentType, StyleKey, TableData, ImageData, Style, TableCell, EditorLayoutSettings } from '../types';

import { EditorState, NodeSelection, Plugin, Transaction, Command, PluginKey } from 'prosemirror-state';
import { EditorView, Decoration, DecorationSet } from 'prosemirror-view';
// FIX: Alias Prosemirror's Node to ProsemirrorNode to avoid conflict with DOM's Node. Import Mark.
import { Schema, DOMParser, Node as ProsemirrorNode, DOMSerializer, NodeSpec, Fragment, MarkType, Mark } from 'prosemirror-model';
import { schema as basicSchema } from 'prosemirror-schema-basic';
import { keymap } from 'prosemirror-keymap';
import { baseKeymap, setBlockType, toggleMark, chainCommands, splitBlock, liftEmptyBlock, createParagraphNear, newlineInCode } from 'prosemirror-commands';
import { history, undo, redo } from 'prosemirror-history';
import { dropCursor } from 'prosemirror-dropcursor';
import { gapCursor } from 'prosemirror-gapcursor';
import { TrashIcon, RowInsertAboveIcon, RowInsertBelowIcon, ColumnInsertLeftIcon, ColumnInsertRightIcon, MergeCellsIcon, SplitCellIcon } from './icons';

// Helper function to strip page_break nodes for state comparison
// FIX: Use ProsemirrorNode alias
const stripPageBreaks = (doc: ProsemirrorNode, schema: Schema): ProsemirrorNode => {
    // FIX: Use ProsemirrorNode alias
    const content: ProsemirrorNode[] = [];
    doc.forEach(node => {
        if (node.type.name !== 'page_break') {
            content.push(node);
        }
    });
    // FIX: Use ProsemirrorNode alias
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
    // FIX: Use ProsemirrorNode alias
    node: ProsemirrorNode;
    
    // FIX: Use ProsemirrorNode alias
    constructor(node: ProsemirrorNode, view: EditorView, getPos: () => number, component: React.FC<any>, props: any) {
        this.node = node;
        this.view = view;
        this.getPos = getPos;
        
        this.dom = document.createElement('div');
        this.dom.classList.add('react-node-view');

        this.root = createRoot(this.dom);
        this.root.render(React.createElement(component, props));
    }

    // FIX: Use ProsemirrorNode alias
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
    insertLoremIpsum: (count: number) => void;
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
    return sentence.trim() + ".";
};

const generateParagraph = (sentenceCount: number) => {
    let paragraph = "";
    for (let i = 0; i < sentenceCount; i++) {
        paragraph += generateSentence(Math.floor(Math.random() * 10) + 5) + " ";
    }
    return paragraph.trim();
};

const generateLoremIpsumBlocks = (paragraphCount: number, availableStyles: Record<StyleKey, Style>, documentType: DocumentType): DocumentBlock[] => {
    const blocks: DocumentBlock[] = [];
    let paragraphsGenerated = 0;

    const textStyles = Object.values(availableStyles).filter(s => s.key !== 'table' && s.key !== 'image');
    const headingStyles = textStyles.filter(s => s.level !== undefined && s.level >= 0).sort((a, b) => (a.level || 0) - (b.level || 0));
    const bodyStyles = textStyles.filter(s => ['body', 'petit'].includes(s.key));
    const listStyles = textStyles.filter(s => s.key.includes('_list_item'));
    
    let currentHeadingLevel = -1;

    if (documentType === 'book') {
        blocks.push({
            id: Date.now() + blocks.length,
            style: 'del',
            content: generateSentence(3),
            level: 0,
        });
        currentHeadingLevel = 0;
    }

    while (paragraphsGenerated < paragraphCount) {
        // Add a heading
        const nextHeadingLevel = Math.floor(Math.random() * 2) + currentHeadingLevel + 1;
        const potentialHeadings = headingStyles.filter(s => (s.level || 0) >= nextHeadingLevel);
        const headingStyle = potentialHeadings.length > 0 ? potentialHeadings[0] : headingStyles[headingStyles.length - 1];
        
        if (headingStyle) {
            blocks.push({
                id: Date.now() + blocks.length,
                style: headingStyle.key,
                content: generateSentence(Math.floor(Math.random() * 4) + 3),
                level: 0
            });
            currentHeadingLevel = headingStyle.level || 0;
        }

        // Add some paragraphs
        const numParagraphs = Math.floor(Math.random() * 3) + 1;
        for (let i = 0; i < numParagraphs && paragraphsGenerated < paragraphCount; i++) {
            const bodyStyle = bodyStyles[Math.floor(Math.random() * bodyStyles.length)] || { key: 'body' };
            blocks.push({
                id: Date.now() + blocks.length,
                style: bodyStyle.key,
                content: generateParagraph(Math.floor(Math.random() * 4) + 3),
                level: 0
            });
            paragraphsGenerated++;
        }

        // Maybe add a list
        if (Math.random() > 0.5 && listStyles.length > 0 && paragraphsGenerated < paragraphCount) {
            const listStyle = listStyles[Math.floor(Math.random() * listStyles.length)];
            const numListItems = Math.floor(Math.random() * 4) + 3;
            for (let i = 0; i < numListItems; i++) {
                blocks.push({
                    id: Date.now() + blocks.length,
                    style: listStyle.key,
                    content: generateSentence(Math.floor(Math.random() * 8) + 4),
                    level: 0
                });
            }
            paragraphsGenerated++; // Count a list as one paragraph for simplicity
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
                // FIX: Use ProsemirrorNode alias
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
                    // FIX: Use ProsemirrorNode alias
                    toDOM: (node: ProsemirrorNode) => ["div", { "data-style": style.key, "data-id": node.attrs.id }],
                    parseDOM: [{ tag: `div[data-style="${style.key}"]`, getAttrs: (dom: HTMLElement) => ({ id: dom.dataset.id ? parseInt(dom.dataset.id, 10) : 0, data: '' }) }]
                };
            } else {
                nodes[style.key] = {
                    attrs: { id: { default: 0 }, level: { default: 0 }, list: { default: null } },
                    content: "inline*", group: "block",
                    // FIX: Use ProsemirrorNode alias
                    toDOM: (node: ProsemirrorNode) => ["div", { "class": styles[node.type.name as StyleKey]?.className || '', "data-style": style.key, "data-id": node.attrs.id, "data-level": node.attrs.level }, 0],
                    parseDOM: [{ tag: `div[data-style="${style.key}"]`, getAttrs: (dom: HTMLElement) => ({ id: dom.dataset.id ? parseInt(dom.dataset.id, 10) : 0, level: dom.dataset.level ? parseInt(dom.dataset.level, 10) : 0 }) }]
                };
            }
        });
        
        const marks = {
            bold: basicSchema.spec.marks.get("strong"),
            italic: basicSchema.spec.marks.get("em"),
            footnote: {
                attrs: { id: { default: '' }, content: { default: '' } },
                inclusive: false,
                // FIX: Correct toDOM signature for marks. Use `mark: Mark` instead of `node: Node`.
// FIX: Added 'as const' to ensure the return type is inferred as a tuple, matching the DOMOutputSpec type expected by ProseMirror.
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

    // FIX: Use ProsemirrorNode alias
    const blocksToDoc = useCallback((blocks: DocumentBlock[]): ProsemirrorNode => {
        // FIX: Use ProsemirrorNode alias
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
        // FIX: Use ProsemirrorNode alias
        }).filter((n): n is ProsemirrorNode => n !== null);
        // FIX: Use ProsemirrorNode alias
        return editorSchema.node('doc', null, pmNodes);
    }, [editorSchema]);

    // FIX: Use ProsemirrorNode alias
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
                new Plugin({
                    key: new PluginKey('apiPlugin'),
                    view(editorView) {
                        if (editorApiRef) {
                            editorApiRef.current = {
                                applyStyle: (style) => { const type = editorSchema.nodes[style]; if (type) setBlockType(type)(editorView.state, editorView.dispatch); },
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
                                insertLoremIpsum: (count: number) => {
                                    const { state, dispatch } = editorView;
                                    const newBlocks = generateLoremIpsumBlocks(count, styles, documentType);
                                    // FIX: Use ProsemirrorNode alias
                                    const newNodes = newBlocks.map(block => {
                                        const type = editorSchema.nodes[block.style];
                                        if (!type) return null;
                                        const tempDiv = document.createElement('div');
                                        tempDiv.innerHTML = block.content;
                                        const contentFragment = DOMParser.fromSchema(editorSchema).parseSlice(tempDiv).content;
                                        return type.create({ id: block.id, level: block.level }, contentFragment);
                                    // FIX: Use ProsemirrorNode alias
                                    }).filter((n): n is ProsemirrorNode => n !== null);

                                    if (newNodes.length > 0) {
                                        const fragment = Fragment.from(newNodes);
                                        const tr = state.tr.replaceWith(0, state.doc.content.size, fragment);
                                        dispatch(tr);
                                    }
                                },
                                search: () => { /* TODO */ }, goToSearchResult: () => { /* TODO */ },
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

                const { selection } = newState;
                const node = selection.$anchor.node(1);
                const selectionInfo: { 
                    activeBlockId: number | null; 
                    canUndo: boolean; 
                    canRedo: boolean; 
                    isPaginated?: boolean;
                    totalPages?: number;
                    isSelectionEmpty?: boolean;
                } = { 
                    activeBlockId: node?.attrs.id || null,
                    canUndo: undo(newState),
                    canRedo: redo(newState),
                    isSelectionEmpty: newState.selection.empty,
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
            // FIX: Use ProsemirrorNode alias
            const newDocFromProps = blocksToDoc(blocks);

            // Create versions of the documents without page breaks for comparison.
            // FIX: Use ProsemirrorNode alias
            const currentDocStripped = stripPageBreaks(state.doc, editorSchema);
            // FIX: Use ProsemirrorNode alias
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
