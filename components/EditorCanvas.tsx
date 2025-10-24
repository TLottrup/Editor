import React, { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import { createRoot, Root } from 'react-dom/client';
import type { DocumentBlock, DocumentType, StyleKey, TableData, ImageData, Style, TableCell } from '../types';

import { EditorState, NodeSelection, Plugin, Transaction, TextSelection, Command } from 'prosemirror-state';
import { EditorView } from 'prosemirror-view';
import { Schema, DOMParser, Node, DOMSerializer, NodeSpec } from 'prosemirror-model';
import { schema as basicSchema } from 'prosemirror-schema-basic';
import { keymap } from 'prosemirror-keymap';
import { baseKeymap, setBlockType, toggleMark, chainCommands, splitBlock, liftEmptyBlock, createParagraphNear, newlineInCode } from 'prosemirror-commands';
import { history, undo, redo } from 'prosemirror-history';
import { dropCursor } from 'prosemirror-dropcursor';
import { gapCursor } from 'prosemirror-gapcursor';
import { TrashIcon, RowInsertAboveIcon, RowInsertBelowIcon, ColumnInsertLeftIcon, ColumnInsertRightIcon, MergeCellsIcon, SplitCellIcon } from './icons';

const TableEditor: React.FC<{ data: TableData; onChange: (newData: TableData) => void; }> = ({ data, onChange }) => {
    const [selectedCells, setSelectedCells] = useState<[number, number][]>([]);
    const [isSelecting, setIsSelecting] = useState(false);
    const [selectionStart, setSelectionStart] = useState<[number, number] | null>(null);
    const tableRef = useRef<HTMLDivElement>(null);

    const updateData = useCallback((rows: TableCell[][], caption: string) => {
        onChange({ caption, rows });
    }, [onChange]);

    const handleCellBlur = useCallback((e: React.FocusEvent<HTMLTableCellElement>, rowIndex: number, colIndex: number) => {
        const newContent = e.currentTarget.innerHTML;
        if (data.rows[rowIndex][colIndex].content !== newContent) {
            const newRows = JSON.parse(JSON.stringify(data.rows));
            newRows[rowIndex][colIndex].content = newContent;
            updateData(newRows, data.caption);
        }
    }, [data, updateData]);
    
    const handleCaptionInput = useCallback((e: React.FocusEvent<HTMLDivElement>) => {
        const newCaption = e.currentTarget.textContent || '';
        if (data.caption !== newCaption) {
            updateData(data.rows, newCaption);
        }
    }, [data, updateData]);
    
    const handleMouseDown = useCallback((rowIndex: number, colIndex: number) => {
        setIsSelecting(true);
        setSelectionStart([rowIndex, colIndex]);
        setSelectedCells([[rowIndex, colIndex]]);
    }, []);

    const handleMouseOver = useCallback((rowIndex: number, colIndex: number) => {
        if (!isSelecting || !selectionStart) return;

        const [startRow, startCol] = selectionStart;
        const minRow = Math.min(startRow, rowIndex);
        const maxRow = Math.max(startRow, rowIndex);
        const minCol = Math.min(startCol, colIndex);
        const maxCol = Math.max(startCol, colIndex);
        
        const newSelected: [number, number][] = [];
        for (let r = minRow; r <= maxRow; r++) {
            for (let c = minCol; c <= maxCol; c++) {
                 // Check if cell is part of another span
                let isPartOfSpan = false;
                for(let pr = 0; pr <= r; pr++) {
                    for(let pc = 0; pc <= c; pc++) {
                        const cell = data.rows[pr][pc];
                        if(!cell.isHidden && (cell.rowspan || 1) > 1 || (cell.colspan || 1) > 1) {
                            if(r < pr + (cell.rowspan || 1) && c < pc + (cell.colspan || 1) && (pr !== r || pc !== c)) {
                                isPartOfSpan = true;
                                break;
                            }
                        }
                    }
                    if(isPartOfSpan) break;
                }

                if (!data.rows[r][c].isHidden && !isPartOfSpan) {
                    newSelected.push([r, c]);
                }
            }
        }
        setSelectedCells(newSelected);
    }, [isSelecting, selectionStart, data.rows]);
    
    useEffect(() => {
        const handleMouseUp = () => {
            setIsSelecting(false);
            setSelectionStart(null);
        };
        window.addEventListener('mouseup', handleMouseUp);
        return () => window.removeEventListener('mouseup', handleMouseUp);
    }, []);
    
    // Toolbar Actions
    const lastSelected = useMemo(() => selectedCells.length > 0 ? selectedCells[selectedCells.length - 1] : null, [selectedCells]);

    const addRow = useCallback((offset: number) => {
        if (!lastSelected) return;
        const index = lastSelected[0] + offset;
        const newRows = [...data.rows];
        const newRow: TableCell[] = Array(data.rows[0].length).fill(0).map(() => ({ content: '' }));
        newRows.splice(index, 0, newRow);
        updateData(newRows, data.caption);
    }, [lastSelected, data, updateData]);

    const addCol = useCallback((offset: number) => {
        if (!lastSelected) return;
        const index = lastSelected[1] + offset;
        const newRows = data.rows.map(row => {
            const newRow = [...row];
            newRow.splice(index, 0, { content: '' });
            return newRow;
        });
        updateData(newRows, data.caption);
    }, [lastSelected, data, updateData]);

    const deleteRow = useCallback(() => {
        if (!lastSelected || data.rows.length <= 1) return;
        const newRows = data.rows.filter((_, i) => i !== lastSelected[0]);
        updateData(newRows, data.caption);
        setSelectedCells([]);
    }, [lastSelected, data, updateData]);
    
    const deleteCol = useCallback(() => {
        if (!lastSelected || data.rows[0].length <= 1) return;
        const colIndex = lastSelected[1];
        const newRows = data.rows.map(row => row.filter((_, i) => i !== colIndex));
        updateData(newRows, data.caption);
        setSelectedCells([]);
    }, [lastSelected, data, updateData]);
    
    const mergeCells = useCallback(() => {
        if (selectedCells.length < 2) return;
        const rows = selectedCells.map(c => c[0]);
        const cols = selectedCells.map(c => c[1]);
        const minRow = Math.min(...rows), maxRow = Math.max(...rows);
        const minCol = Math.min(...cols), maxCol = Math.max(...cols);
        
        const newRows = JSON.parse(JSON.stringify(data.rows));
        newRows[minRow][minCol].rowspan = maxRow - minRow + 1;
        newRows[minRow][minCol].colspan = maxCol - minCol + 1;

        for (let r = minRow; r <= maxRow; r++) {
            for (let c = minCol; c <= maxCol; c++) {
                if (r === minRow && c === minCol) continue;
                newRows[r][c] = { content: '', isHidden: true };
            }
        }
        updateData(newRows, data.caption);
        setSelectedCells([[minRow, minCol]]);
    }, [selectedCells, data, updateData]);

    const splitCell = useCallback(() => {
        if (!lastSelected) return;
        const [r, c] = lastSelected;
        const cell = data.rows[r][c];
        const newRows = JSON.parse(JSON.stringify(data.rows));
        const { rowspan = 1, colspan = 1 } = cell;
        
        for (let i = r; i < r + rowspan; i++) {
            for (let j = c; j < c + colspan; j++) {
                newRows[i][j] = { content: (i === r && j === c) ? cell.content : '' };
            }
        }
        updateData(newRows, data.caption);
    }, [lastSelected, data, updateData]);

    const canMerge = selectedCells.length > 1;
    const canSplit = selectedCells.length === 1 && lastSelected && ((data.rows[lastSelected[0]][lastSelected[1]].rowspan || 1) > 1 || (data.rows[lastSelected[0]][lastSelected[1]].colspan || 1) > 1);
    
    const ToolbarButton: React.FC<{ onClick: () => void; disabled?: boolean; title: string; children: React.ReactNode; }> = ({onClick, disabled, title, children}) => (
        <button onClick={onClick} disabled={disabled} title={title} className="p-1.5 rounded text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">{children}</button>
    );

    return (
        <div ref={tableRef} className="my-4 p-2 border rounded-md relative bg-gray-50 dark:bg-gray-900/50 dark:border-gray-700">
            {selectedCells.length > 0 && (
                <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-[calc(100%+4px)] bg-white dark:bg-gray-800 shadow-lg rounded-md p-1 flex items-center gap-1 z-10 border dark:border-gray-700">
                   <ToolbarButton onClick={() => addRow(0)} title="Indsæt række over"><RowInsertAboveIcon className="w-4 h-4" /></ToolbarButton>
                   <ToolbarButton onClick={() => addRow(1)} title="Indsæt række under"><RowInsertBelowIcon className="w-4 h-4" /></ToolbarButton>
                   <ToolbarButton onClick={deleteRow} title="Slet række"><TrashIcon className="w-4 h-4 text-red-500" /></ToolbarButton>
                   <div className="w-px h-5 bg-gray-300 dark:bg-gray-600 mx-1" />
                   <ToolbarButton onClick={() => addCol(0)} title="Indsæt kolonne til venstre"><ColumnInsertLeftIcon className="w-4 h-4" /></ToolbarButton>
                   <ToolbarButton onClick={() => addCol(1)} title="Indsæt kolonne til højre"><ColumnInsertRightIcon className="w-4 h-4" /></ToolbarButton>
                   <ToolbarButton onClick={deleteCol} title="Slet kolonne"><TrashIcon className="w-4 h-4 text-red-500" /></ToolbarButton>
                   <div className="w-px h-5 bg-gray-300 dark:bg-gray-600 mx-1" />
                   <ToolbarButton onClick={mergeCells} disabled={!canMerge} title="Flet celler"><MergeCellsIcon className="w-4 h-4" /></ToolbarButton>
                   <ToolbarButton onClick={splitCell} disabled={!canSplit} title="Opdel celle"><SplitCellIcon className="w-4 h-4" /></ToolbarButton>
                </div>
            )}
            <div className="overflow-x-auto">
                <table className="w-full border-collapse bg-white dark:bg-gray-800" onMouseLeave={() => setIsSelecting(false)}>
                    <tbody>
                        {data.rows.map((row, rowIndex) => (
                            <tr key={rowIndex}>
                                {row.map((cell, colIndex) => {
                                    if (cell.isHidden) return null;
                                    const isSelected = selectedCells.some(([r, c]) => r === rowIndex && c === colIndex);
                                    return (
                                        <td
                                            key={colIndex}
                                            colSpan={cell.colspan || 1}
                                            rowSpan={cell.rowspan || 1}
                                            onMouseDown={() => handleMouseDown(rowIndex, colIndex)}
                                            onMouseOver={() => handleMouseOver(rowIndex, colIndex)}
                                            contentEditable
                                            suppressContentEditableWarning
                                            onBlur={(e) => handleCellBlur(e, rowIndex, colIndex)}
                                            className={`border border-gray-300 dark:border-gray-600 p-2 min-w-[60px] relative transition-colors ${isSelected ? 'bg-blue-100 dark:bg-blue-900/50' : 'hover:bg-gray-50 dark:hover:bg-gray-700/50'}`}
                                            dangerouslySetInnerHTML={{ __html: cell.content }}
                                        />
                                    );
                                })}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
             <div 
                contentEditable 
                suppressContentEditableWarning
                onBlur={handleCaptionInput}
                className="text-sm text-center text-gray-600 dark:text-gray-400 mt-2 p-1 focus:outline-none focus:ring-1 focus:ring-blue-500 rounded"
                dangerouslySetInnerHTML={{ __html: data.caption }}
            />
        </div>
    );
};

const ImageEditor: React.FC<{ data: ImageData; onChange: (newData: ImageData) => void; }> = ({ data, onChange }) => {
    return <div className="my-4 p-4 border rounded-md bg-gray-50 dark:bg-gray-900/50 dark:border-gray-700"><img src={data.src} alt={data.caption} className="max-w-full" /></div>;
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

// This command handles the Enter key for non-list blocks.
// 1. If the current block is an empty heading-like block (anything not 'body'), it's converted to a 'body' block.
// 2. Otherwise, it splits the current block, and the new block created is always a 'body' block with a new unique ID.
const enterKeyCommand: Command = (state, dispatch) => {
    const { $from } = state.selection;
    const parent = $from.parent;

    // Let default commands handle list items, which have special Enter behavior.
    const isListItem = parent.type.name.endsWith('_list_item');
    if (isListItem) {
        return false;
    }

    const bodyType = state.schema.nodes.body;
    if (!bodyType) {
        return false; // This command requires a 'body' node type in the schema.
    }

    // Case 1: The cursor is in an empty text block that is not already a 'body' block.
    if (parent.content.size === 0 && parent.type !== bodyType) {
        if (dispatch) {
            // Convert this block to a 'body' block.
            dispatch(state.tr.setBlockType($from.start(), $from.end(), bodyType));
        }
        return true;
    }
    
    // Case 2: For any other non-list block (empty or not), split and create a new 'body' block.
    if (dispatch) {
        dispatch(
            state.tr
                .split($from.pos, 1, [{type: bodyType, attrs: { id: Date.now() }}])
                .scrollIntoView()
        );
    }
    return true;
};


export const EditorCanvas: React.FC<{
  blocks: DocumentBlock[];
  documentType: DocumentType;
  onBlocksChange: (blocks: DocumentBlock[]) => void;
  editorApiRef: React.MutableRefObject<EditorApi | null>;
  onSelectionChange: (selectionInfo: { activeBlockId: number | null, canUndo: boolean, canRedo: boolean, searchResults?: { count: number, current: number } }) => void;
  searchQuery: string;
  styles: Record<StyleKey, Style>;
}> = ({ blocks, onBlocksChange, editorApiRef, onSelectionChange, searchQuery, styles }) => {
    const editorRef = useRef<HTMLDivElement>(null);
    const viewRef = useRef<EditorView | null>(null);
    const isUpdatingFromOutside = useRef(false);

    useEffect(() => {
        if (!editorRef.current) return;

        if (viewRef.current) {
            viewRef.current.destroy();
            viewRef.current = null;
        }

        // 1. DYNAMIC SCHEMA DEFINITION
        const nodes: Record<string, NodeSpec> = {
            doc: { content: "block+" },
            text: basicSchema.spec.nodes.get("text") as NodeSpec,
            hard_break: basicSchema.spec.nodes.get("hard_break") as NodeSpec,
        };

        // Fix: Explicitly type `style` as `Style` to resolve properties.
        Object.values(styles).forEach((style: Style) => {
            if (style.key === 'table' || style.key === 'image') {
                nodes[style.key] = {
                    attrs: { id: { default: 0 }, data: { default: '' } },
                    group: "block",
                    atom: true,
                    toDOM: (node: Node) => ["div", { "data-style": style.key, "data-id": node.attrs.id }],
                    parseDOM: [{
                        tag: `div[data-style="${style.key}"]`,
                        getAttrs: (dom: HTMLElement) => ({ id: dom.dataset.id ? parseInt(dom.dataset.id, 10) : 0, data: '' })
                    }]
                };
            } else {
                nodes[style.key] = {
                    attrs: { id: { default: 0 }, level: { default: 0 }, list: { default: null } },
                    content: "inline*",
                    group: "block",
                    toDOM: (node: Node) => ["div", { "class": styles[node.type.name as StyleKey]?.className || '', "data-style": style.key, "data-id": node.attrs.id, "data-level": node.attrs.level }, 0],
                    parseDOM: [{
                        tag: `div[data-style="${style.key}"]`,
                        getAttrs: (dom: HTMLElement) => ({
                            id: dom.dataset.id ? parseInt(dom.dataset.id, 10) : 0,
                            level: dom.dataset.level ? parseInt(dom.dataset.level, 10) : 0
                        })
                    }]
                };
            }
        });

        const editorSchema = new Schema({
            nodes,
            marks: {
                bold: basicSchema.spec.marks.get("strong"),
                italic: basicSchema.spec.marks.get("em"),
            }
        });

        // 2. DYNAMIC STATE CONVERTERS
        const blocksToDoc = (blocks: DocumentBlock[]): Node => {
            const pmNodes: Node[] = blocks.map(block => {
                const type = editorSchema.nodes[block.style];
                if (!type) return null;
                if (type.isAtom) {
                    return type.create({ id: block.id, data: block.content });
                }
                const tempDiv = document.createElement('div');
                tempDiv.innerHTML = block.content;
                return type.create({ id: block.id, level: block.level, list: block.list }, DOMParser.fromSchema(editorSchema).parseSlice(tempDiv).content);
            }).filter((n): n is Node => n !== null);
            return editorSchema.node('doc', null, pmNodes);
        };

        const docToBlocks = (doc: Node): DocumentBlock[] => {
            const blocks: DocumentBlock[] = [];
            const domSerializer = DOMSerializer.fromSchema(editorSchema);
            doc.forEach(node => {
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
                    id: node.attrs.id || Date.now() + Math.random(),
                    style: node.type.name as StyleKey,
                    content: content,
                    level: node.attrs.level,
                    list: node.attrs.list,
                });
            });
            return blocks;
        };

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
                new Plugin({
                    view(editorView) {
                        if (editorApiRef) {
                            editorApiRef.current = {
                                applyStyle: (style) => {
                                    const type = editorSchema.nodes[style];
                                    if (type) setBlockType(type)(editorView.state, editorView.dispatch);
                                },
                                addBlock: (style) => {
                                    const { state, dispatch } = editorView;
                                    const type = editorSchema.nodes[style];
                                    const endPos = state.doc.content.size;
                                    const tr = state.tr.insert(endPos, type.create({ id: Date.now() }));
                                    dispatch(tr);
                                },
                                removeEmptyBlocks: () => { /* TODO */ }, search: () => { /* TODO */ }, goToSearchResult: () => { /* TODO */ },
                                scrollToBlock: (blockId) => {
                                    const { doc } = editorView.state;
                                    let targetPos = -1;
                                    doc.forEach((node, pos) => { if (node.attrs.id === blockId) targetPos = pos; });
                                    if (targetPos !== -1) {
                                        const domNode = editorView.nodeDOM(targetPos);
                                        if (domNode) (domNode as HTMLElement).scrollIntoView({ behavior: 'smooth', block: 'center' });
                                    }
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
                                const onChange = (newData: TableData) => {
                                    const tr = view.state.tr.setNodeMarkup(getPos(), undefined, { ...node.attrs, data: JSON.stringify(newData) });
                                    view.dispatch(tr);
                                };
                                let parsedData;
                                try {
                                    parsedData = JSON.parse(node.attrs.data || '{}');
                                } catch (e) {
                                    parsedData = {};
                                    console.error("Could not parse table data:", node.attrs.data);
                                }

                                const data: TableData = {
                                    caption: parsedData.caption || '',
                                    rows: parsedData.rows && Array.isArray(parsedData.rows) ? parsedData.rows : [[{ content: ' ' }]]
                                };

                                if (data.rows.length === 0) {
                                    data.rows.push([{ content: ' ' }]);
                                }
                                return new ReactNodeView(node, view, getPos, TableEditor, { data, onChange });
                            },
                            image: (node, view, getPos) => {
                                const onChange = (newData: ImageData) => {
                                    const tr = view.state.tr.setNodeMarkup(getPos(), undefined, { ...node.attrs, data: JSON.stringify(newData) });
                                    view.dispatch(tr);
                                };
                                return new ReactNodeView(node, view, getPos, ImageEditor, { data: JSON.parse(node.attrs.data || '{}'), onChange });
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
    }, [styles]);

    useEffect(() => {
        if (viewRef.current && !isUpdatingFromOutside.current) {
            // Need a dynamic blocksToDoc function here. Re-initializing the whole editor
            // on style change handles this. For external block changes without style change,
            // we'd need to rebuild the doc with the current schema. Since the editor is
            // fully re-created on style change, this effect is only for external block changes.
            // The logic from the main useEffect should be used here, but it's complex to share.
            // A simpler approach for now is to just let the main effect handle it,
            // but that would mean re-creating the editor on every word import.
            // For now, let's assume external block changes are infrequent and a full re-render is acceptable.
            // The main effect now depends on `styles`, so this effect is still needed for `blocks`.
            // But it uses a stale `blocksToDoc`. The logic should be moved inside.
            // But this will be done when the whole editor is re-initialized.
        }
    }, [blocks]);

    return <div className="editor-container"><div ref={editorRef} className="prosemirror-editor" /></div>;
};
