
import React, { useEffect, useRef, useMemo, useState, useCallback } from 'react';
import { createRoot, Root } from 'react-dom/client';
import type { DocumentBlock, DocumentType, StyleKey, TableData, ImageData, Style, TableCell, EditorLayoutSettings } from '../types';

import { EditorState, NodeSelection, Plugin, Transaction, Command, PluginKey } from 'prosemirror-state';
import { EditorView, Decoration, DecorationSet } from 'prosemirror-view';
import { Schema, DOMParser, Node, DOMSerializer, NodeSpec } from 'prosemirror-model';
import { schema as basicSchema } from 'prosemirror-schema-basic';
import { keymap } from 'prosemirror-keymap';
import { baseKeymap, setBlockType, toggleMark, chainCommands, splitBlock, liftEmptyBlock, createParagraphNear, newlineInCode } from 'prosemirror-commands';
import { history, undo, redo } from 'prosemirror-history';
import { dropCursor } from 'prosemirror-dropcursor';
import { gapCursor } from 'prosemirror-gapcursor';
import { TrashIcon, RowInsertAboveIcon, RowInsertBelowIcon, ColumnInsertLeftIcon, ColumnInsertRightIcon, MergeCellsIcon, SplitCellIcon } from './icons';

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
                onChange={(e) => onChange({ ...internalData, caption: e.target.value })}
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
    node: Node;
    
    constructor(node: Node, view: EditorView, getPos: () => number, component: React.FC<any>, props: any) {
        this.node = node;
        this.view = view;
        this.getPos = getPos;
        
        this.dom = document.createElement('div');
        this.dom.classList.add('react-node-view');

        this.root = createRoot(this.dom);
        this.root.render(React.createElement(component, props));
    }

    update(node: Node) {
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

const getPixelHeightForUnit = (cssUnit: string): number => {
    if (typeof document === 'undefined' || !cssUnit) return 0;
    const div = document.createElement('div');
    div.style.position = 'absolute';
    div.style.height = cssUnit;
    div.style.top = '-9999px';
    document.body.appendChild(div);
    const height = div.offsetHeight;
    document.body.removeChild(div);
    return height || 0;
};

const paginationPluginKey = new PluginKey('pagination');

export const EditorCanvas: React.FC<{
  blocks: DocumentBlock[];
  documentType: DocumentType;
  onBlocksChange: (blocks: DocumentBlock[]) => void;
  editorApiRef: React.MutableRefObject<EditorApi | null>;
  onSelectionChange: (selectionInfo: { activeBlockId: number | null, canUndo: boolean, canRedo: boolean, searchResults?: { count: number, current: number } }) => void;
  searchQuery: string;
  styles: Record<StyleKey, Style>;
  layoutSettings: EditorLayoutSettings;
  onPaginationChange: (pageCount: number) => void;
}> = ({ blocks, onBlocksChange, editorApiRef, onSelectionChange, searchQuery, styles, layoutSettings, onPaginationChange }) => {
    const editorRef = useRef<HTMLDivElement>(null);
    const viewRef = useRef<EditorView | null>(null);
    const isUpdatingFromOutside = useRef(false);

    const editorSchema = useMemo(() => {
        const nodes: Record<string, NodeSpec> = {
            doc: { content: "block+" },
            text: basicSchema.spec.nodes.get("text") as NodeSpec,
            hard_break: basicSchema.spec.nodes.get("hard_break") as NodeSpec,
            page_break: {
                group: 'block',
                atom: true,
                selectable: false,
                toDOM: () => ['div', { 'data-page-break': 'true', style: 'display: none;' }],
                parseDOM: [{ tag: 'div[data-page-break]' }],
            },
        };

        Object.values(styles).forEach((style: Style) => {
            if (style.key === 'table' || style.key === 'image') {
                nodes[style.key] = {
                    attrs: { id: { default: 0 }, data: { default: '' } },
                    group: "block", atom: true,
                    toDOM: (node: Node) => ["div", { "data-style": style.key, "data-id": node.attrs.id }],
                    parseDOM: [{ tag: `div[data-style="${style.key}"]`, getAttrs: (dom: HTMLElement) => ({ id: dom.dataset.id ? parseInt(dom.dataset.id, 10) : 0, data: '' }) }]
                };
            } else {
                nodes[style.key] = {
                    attrs: { id: { default: 0 }, level: { default: 0 }, list: { default: null } },
                    content: "inline*", group: "block",
                    toDOM: (node: Node) => ["div", { "class": styles[node.type.name as StyleKey]?.className || '', "data-style": style.key, "data-id": node.attrs.id, "data-level": node.attrs.level }, 0],
                    parseDOM: [{ tag: `div[data-style="${style.key}"]`, getAttrs: (dom: HTMLElement) => ({ id: dom.dataset.id ? parseInt(dom.dataset.id, 10) : 0, level: dom.dataset.level ? parseInt(dom.dataset.level, 10) : 0 }) }]
                };
            }
        });
        return new Schema({ nodes, marks: { bold: basicSchema.spec.marks.get("strong"), italic: basicSchema.spec.marks.get("em") }});
    }, [styles]);

    const blocksToDoc = useCallback((blocks: DocumentBlock[]): Node => {
        const pmNodes: Node[] = blocks.map(block => {
            const type = editorSchema.nodes[block.style];
            if (!type) return null;
            if (type.isAtom) {
                return type.create({ id: block.id, data: block.content });
            }
            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = block.content;
            const contentFragment = DOMParser.fromSchema(editorSchema).parseSlice(tempDiv).content;
            return type.create({ id: block.id, level: block.level, list: block.list }, contentFragment);
        }).filter((n): n is Node => n !== null);
        return editorSchema.node('doc', null, pmNodes);
    }, [editorSchema]);

    const docToBlocks = useCallback((doc: Node): DocumentBlock[] => {
        const blocks: DocumentBlock[] = [];
        const domSerializer = DOMSerializer.fromSchema(editorSchema);
        doc.forEach(node => {
            if (node.type.name === 'page_break') return;
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

        class PaginationView {
            private view: EditorView;
            private debounceTimeout: number | undefined;
            private measurementContainer: HTMLElement | null = null;
            private domSerializer: DOMSerializer;
            private styles: Record<StyleKey, Style>;

            constructor(view: EditorView, styles: Record<StyleKey, Style>) {
                this.view = view;
                this.styles = styles;
                this.domSerializer = DOMSerializer.fromSchema(view.state.schema);
                this.recalculate(view.state);
            }

            update(view: EditorView, prevState: EditorState) {
                if (!prevState.doc.eq(view.state.doc) || !prevState.selection.eq(view.state.selection)) {
                    this.recalculate(view.state);
                }
            }
            
            private ensureMeasurementContainer() {
                if (!this.measurementContainer) {
                    this.measurementContainer = document.createElement('div');
                    this.measurementContainer.className = 'ProseMirror prosemirror-styled-content';
                    this.measurementContainer.style.position = 'absolute';
                    this.measurementContainer.style.top = '-9999px';
                    this.measurementContainer.style.left = '-9999px';
                    this.measurementContainer.style.whiteSpace = 'pre-wrap';
                    this.measurementContainer.style.overflowWrap = 'break-word';
                    document.body.appendChild(this.measurementContainer);
                }
                const editorContentWidth = this.view.dom.clientWidth;
                 if (editorContentWidth > 0) {
                   this.measurementContainer.style.width = `${editorContentWidth}px`;
                }
            }

            private measureNodeFallback(node: Node): number {
                this.ensureMeasurementContainer();
                if (!this.measurementContainer) return 20;

                const domNode = this.domSerializer.serializeNode(node);
                this.measurementContainer.appendChild(domNode);
                const element = this.measurementContainer.lastElementChild as HTMLElement;
                if (!element) {
                    this.measurementContainer.innerHTML = '';
                    return 20;
                }
                const style = window.getComputedStyle(element);
                const marginTop = parseFloat(style.marginTop) || 0;
                const marginBottom = parseFloat(style.marginBottom) || 0;
                const height = element.offsetHeight + marginTop + marginBottom;
                this.measurementContainer.innerHTML = '';
                return height;
            }

            private findSplitPoint(node: Node, availableHeight: number): number {
                if (!node.isTextblock || node.content.size === 0 || availableHeight <= 5) {
                    return -1;
                }
            
                let low = 0;
                let high = node.content.size;
                let bestCharSplit = -1;
            
                while (low <= high) {
                    const mid = Math.floor((low + high) / 2);
                    if (mid === 0) {
                        low = mid + 1;
                        continue;
                    }
                    const slicedNode = node.copy(node.content.cut(0, mid));
                    const measuredHeight = this.measureNodeFallback(slicedNode);
            
                    if (measuredHeight <= availableHeight) {
                        bestCharSplit = mid;
                        low = mid + 1;
                    } else {
                        high = mid - 1;
                    }
                }
            
                if (bestCharSplit <= 0) {
                    return -1;
                }
            
                const text = node.textContent;
                const textSlice = text.substring(0, bestCharSplit);
                const lastSpace = textSlice.lastIndexOf(' ');
                const lastNewline = textSlice.lastIndexOf('\n');
                
                const boundary = Math.max(lastSpace, lastNewline);
            
                if (boundary > 0) {
                    return boundary + 1;
                }
            
                if (bestCharSplit > 0) {
                    return bestCharSplit;
                }
                
                return -1;
            }

            recalculate(state: EditorState) {
                window.clearTimeout(this.debounceTimeout);
                this.debounceTimeout = window.setTimeout(() => {
                    if (!viewRef.current) return;
                    
                    const pageHeightPx = getPixelHeightForUnit(layoutSettings.paperHeight);
                    if (pageHeightPx <= 0) return;
                    
                    const paddingBottomPx = getPixelHeightForUnit(layoutSettings.marginBottom);
                    const paddingTopPx = getPixelHeightForUnit(layoutSettings.marginTop);
                    const contentHeightPerPage = pageHeightPx - paddingTopPx - paddingBottomPx;

                    const initialTr = this.view.state.tr;
                    let cleanDoc = this.view.state.doc;

                    // Pass 1: Remove all existing page breaks.
                    let pageBreakFound = false;
                    initialTr.doc.descendants((node, pos) => {
                        if (node.type.name === 'page_break') {
                            initialTr.delete(pos, pos + node.nodeSize);
                            pageBreakFound = true;
                        }
                    });

                    if (pageBreakFound) {
                        cleanDoc = initialTr.doc;
                    }

                    const newContent: Node[] = [];
                    let pageContentHeight = 0;

                    const processNode = (node: Node) => {
                        const nodeHeight = this.measureNodeFallback(node);

                        if (pageContentHeight + nodeHeight <= contentHeightPerPage) {
                            newContent.push(node);
                            pageContentHeight += nodeHeight;
                            return;
                        }

                        const availableHeight = contentHeightPerPage - pageContentHeight;
                        const splitIndex = this.findSplitPoint(node, availableHeight);

                        if (splitIndex > 0 && splitIndex < node.content.size) {
                            const part1 = node.copy(node.content.cut(0, splitIndex));
                            newContent.push(part1);
                            
                            let remainder = node.copy(node.content.cut(splitIndex));
                            
                            const styleInfo = this.styles[node.type.name as StyleKey];
                            const isHeading = styleInfo?.level !== undefined && (styleInfo.key.includes('heading') || styleInfo.key === 'kapitel' || styleInfo.key === 'del');

                            if (isHeading) {
                                const bodyType = this.view.state.schema.nodes.body;
                                if (bodyType) {
                                    // Fix: `NodeType` does not have a `defaultAttrs` property.
                                    // The `create` method automatically merges provided attributes with the defaults from the schema.
                                    const newAttrs = { id: Date.now() + Math.random() };
                                    remainder = bodyType.create(newAttrs, remainder.content, remainder.marks);
                                }
                            }

                            while (true) {
                                newContent.push(this.view.state.schema.nodes.page_break.create());
                                const remainderHeight = this.measureNodeFallback(remainder);

                                if (remainderHeight <= contentHeightPerPage) {
                                    newContent.push(remainder);
                                    pageContentHeight = remainderHeight;
                                    break;
                                }

                                const nextSplitIndex = this.findSplitPoint(remainder, contentHeightPerPage);
                                if (nextSplitIndex > 0 && nextSplitIndex < remainder.content.size) {
                                    const nextPart = remainder.copy(remainder.content.cut(0, nextSplitIndex));
                                    newContent.push(nextPart);
                                    remainder = remainder.copy(remainder.content.cut(nextSplitIndex));
                                } else {
                                    newContent.push(remainder);
                                    pageContentHeight = remainderHeight;
                                    break;
                                }
                            }
                        } else {
                            if (pageContentHeight > 0) {
                                newContent.push(this.view.state.schema.nodes.page_break.create());
                            }
                            newContent.push(node);
                            pageContentHeight = nodeHeight;
                        }
                    };

                    cleanDoc.forEach(processNode);
                    
                    const finalTr = this.view.state.tr.replaceWith(0, this.view.state.doc.content.size, newContent);

                    if (!finalTr.doc.eq(this.view.state.doc)) {
                        this.view.dispatch(finalTr);
                    }

                    requestAnimationFrame(() => {
                        if (!viewRef.current) return;
                        const totalHeight = viewRef.current.dom.scrollHeight;
                        const newPageCount = pageHeightPx > 0 ? Math.max(1, Math.ceil(totalHeight / pageHeightPx)) : 1;
                        onPaginationChange(newPageCount);
                    });

                }, 200);
            }

            destroy() {
                window.clearTimeout(this.debounceTimeout);
                 if (this.measurementContainer) {
                    document.body.removeChild(this.measurementContainer);
                    this.measurementContainer = null;
                }
            }
        }

        const paginationPlugin = new Plugin({
            key: paginationPluginKey,
            view: (editorView) => new PaginationView(editorView, styles),
        });

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
                paginationPlugin,
                new Plugin({
                    view(editorView) {
                        if (editorApiRef) {
                            editorApiRef.current = {
                                applyStyle: (style) => { const type = editorSchema.nodes[style]; if (type) setBlockType(type)(editorView.state, editorView.dispatch); },
                                addBlock: (style) => { const { state, dispatch } = editorView; const type = editorSchema.nodes[style]; const endPos = state.doc.content.size; const tr = state.tr.insert(endPos, type.create({ id: Date.now() })); dispatch(tr); },
                                removeEmptyBlocks: () => { /* TODO */ }, search: () => { /* TODO */ }, goToSearchResult: () => { /* TODO */ },
                                scrollToBlock: (blockId) => {
                                    const { doc } = editorView.state; let targetPos = -1;
                                    doc.forEach((node, pos) => { if (node.attrs.id === blockId) targetPos = pos; });
                                    if (targetPos !== -1) { const domNode = editorView.nodeDOM(targetPos); if (domNode) (domNode as HTMLElement).scrollIntoView({ behavior: 'smooth', block: 'center' }); }
                                },
                                focusTitle: () => editorView.dom.blur(),
                                undo: () => undo(editorView.state, editorView.dispatch),
                                redo: () => redo(editorView.state, editorView.dispatch),
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

                if (tr.docChanged) {
                    isUpdatingFromOutside.current = true;
                    onBlocksChange(docToBlocks(newState.doc));
                    requestAnimationFrame(() => { isUpdatingFromOutside.current = false; });
                }
                
                const { selection } = newState;
                const node = selection.$anchor.node(1);
                onSelectionChange({ 
                    activeBlockId: node?.attrs.id || null,
                    canUndo: undo(newState),
                    canRedo: redo(newState)
                });
            },
        });
        viewRef.current = view;

        return () => {
            if (viewRef.current) {
                viewRef.current.destroy();
                viewRef.current = null;
            }
        };
    }, [styles, layoutSettings, onPaginationChange, editorApiRef, onSelectionChange, editorSchema, blocksToDoc, docToBlocks]);

    useEffect(() => {
        if (viewRef.current && !isUpdatingFromOutside.current && blocks) {
            const state = viewRef.current.state;
            const newDoc = blocksToDoc(blocks);
            if (!newDoc.eq(state.doc)) {
                const tr = state.tr.replaceWith(0, state.doc.content.size, newDoc.content);
                viewRef.current.dispatch(tr);
            }
        }
    }, [blocks, blocksToDoc]);

    return <div ref={editorRef} className="prosemirror-editor prosemirror-styled-content" />;
};
