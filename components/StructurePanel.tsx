

import React, { useState, useEffect, useMemo } from 'react';
import type { DocumentBlock, DocumentType, Style, StyleKey } from '../types';
import { ChevronRightIcon } from './icons';

interface StructureNode {
  id: string;
  tag: string;
  contentPreview?: string;
  children: StructureNode[];
  blockId?: number;
}

const isListItem = (style: StyleKey) => style === 'ordered_list_item' || style === 'unordered_list_item';

const buildStructureTree = (blocks: DocumentBlock[], format: 'jats' | 'bits', idPrefix: string, styles: Record<StyleKey, Style>): StructureNode[] => {
    let idCounter = 0;
    const generateId = (prefix: string) => `${prefix}-${idCounter++}`;
    
    const root: StructureNode & { level?: number } = { id: `${idPrefix}-root`, tag: 'root', children: [] };
    let sectionStack: (StructureNode & { level?: number })[] = [root];

    const tagKey = format === 'jats' ? 'jatsTag' : 'bitsTag';
    const parentKey = format === 'jats' ? 'nestingParentJats' : 'nestingParentBits';

    for (let i = 0; i < blocks.length; i++) {
        const block = blocks[i];
        const style = styles[block.style as StyleKey];
        if (!style) continue;

        const currentSectionOrRoot = sectionStack[sectionStack.length - 1];
        
        if (isListItem(block.style)) {
            let listEndIndex = i;
            while (listEndIndex < blocks.length - 1 && isListItem(blocks[listEndIndex + 1].style)) {
                listEndIndex++;
            }
            const listBlocks = blocks.slice(i, listEndIndex + 1);
            
            const rootList: StructureNode & { level: number } = {
                id: generateId(currentSectionOrRoot.id),
                tag: 'list',
                children: [],
                level: -1,
                blockId: listBlocks[0].id,
            };
            const listStack = [rootList];

            listBlocks.forEach(lb => {
                const level = lb.level || 0;
                const plainText = lb.content.replace(/<[^>]*>?/gm, '').trim();
                const preview = plainText.substring(0, 30) + (plainText.length > 30 ? '...' : '');

                let parentList = listStack[listStack.length - 1];
                while (level < parentList.level) {
                    listStack.pop();
                    parentList = listStack[listStack.length - 1];
                }

                const listItemNode: StructureNode = {
                    id: generateId(parentList.id),
                    tag: 'list-item',
                    blockId: lb.id,
                    children: [{
                        id: generateId(parentList.id + '_li'),
                        tag: 'p',
                        contentPreview: preview,
                        blockId: lb.id,
                        children: []
                    }]
                };

                if (level > parentList.level) {
                    const newList: StructureNode & { level: number } = {
                        id: generateId(parentList.id),
                        tag: 'list',
                        children: [listItemNode],
                        level: level,
                        blockId: lb.id,
                    };
                    const lastListItem = parentList.children[parentList.children.length - 1];
                    if (lastListItem) {
                        // BITS/JATS spec nests sub-lists inside the parent list-item
                        lastListItem.children.push(newList);
                    } else {
                        parentList.children.push(newList);
                    }
                    listStack.push(newList);
                } else {
                    parentList.children.push(listItemNode);
                }
            });

            currentSectionOrRoot.children.push(rootList);
            i = listEndIndex;
            continue;
        }

        const plainText = (block.style === 'table' || block.style === 'image') 
            ? styles[block.style].name
            : block.content.replace(/<[^>]*>?/gm, '').trim();
        const preview = plainText.substring(0, 30) + (plainText.length > 30 ? '...' : '');

        const element: StructureNode = {
            id: generateId(currentSectionOrRoot.id),
            tag: style[tagKey],
            contentPreview: preview || undefined,
            children: [],
            blockId: block.id,
        };
        const isHeading = style.level !== undefined && (style.key.includes('heading') || style.key === 'kapitel' || style.key === 'del');

        if (isHeading) {
            const level = style.level!;
            let parentLevel = sectionStack[sectionStack.length - 1].level ?? -1;
            while (level <= parentLevel && sectionStack.length > 1) {
                sectionStack.pop();
                parentLevel = sectionStack[sectionStack.length - 1].level ?? -1;
            }

            const parentSection = sectionStack[sectionStack.length - 1];
            const newSectionTag = style[parentKey] || (format === 'bits' && style.key === 'kapitel' ? 'chapter' : 'sec');
            const newSection: StructureNode & { level: number } = {
                id: generateId(parentSection.id),
                tag: newSectionTag,
                level: style.level!,
                children: [element],
                blockId: block.id,
            };

            parentSection.children.push(newSection);
            sectionStack.push(newSection);
        } else if (style[parentKey]) {
             const parentTag = style[parentKey]!;
             const lastChild = currentSectionOrRoot.children[currentSectionOrRoot.children.length - 1];

             if (lastChild && lastChild.tag === parentTag) {
                 lastChild.children.push(element);
             } else {
                 const parentElement: StructureNode = {
                     id: generateId(currentSectionOrRoot.id),
                     tag: parentTag,
                     children: [element],
                     blockId: element.blockId,
                 };
                 currentSectionOrRoot.children.push(parentElement);
             }
        } else {
            currentSectionOrRoot.children.push(element);
        }
    }
    return root.children;
};

const StructureNodeView: React.FC<{ 
  node: StructureNode; 
  expandedNodes: Set<string>; 
  toggleNode: (id: string) => void;
  level: number;
  onNodeClick: (blockId: number) => void;
}> = ({ node, expandedNodes, toggleNode, level, onNodeClick }) => {
    const isExpanded = expandedNodes.has(node.id);
    const hasChildren = node.children.length > 0;

    return (
        <div className="text-xs font-mono">
            <div 
                className={`flex items-center py-0.5 rounded ${node.blockId ? 'cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700/50' : ''}`}
                style={{ paddingLeft: `${level * 1.5}rem` }}
                onClick={() => node.blockId && onNodeClick(node.blockId)}
            >
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        toggleNode(node.id);
                    }}
                    className={`p-0.5 rounded text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 ${!hasChildren ? 'invisible' : ''}`}
                    aria-label={isExpanded ? `Collapse ${node.tag}` : `Expand ${node.tag}`}
                >
                    <ChevronRightIcon className={`h-3 w-3 transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
                </button>
                <span className="w-1.5 h-1.5 bg-blue-400 rounded-full mr-2 ml-1 flex-shrink-0"></span>
                <span className="text-blue-400">{node.tag}</span>
                {node.contentPreview && (
                    <span className="text-gray-500 dark:text-gray-400 ml-2 truncate whitespace-nowrap overflow-hidden">
                        {`"${node.contentPreview}"`}
                    </span>
                )}
            </div>
            {isExpanded && hasChildren && (
                <div>
                    {node.children.map((child) => (
                        <StructureNodeView 
                            key={child.id}
                            node={child} 
                            expandedNodes={expandedNodes}
                            toggleNode={toggleNode}
                            level={level + 1}
                            onNodeClick={onNodeClick}
                        />
                    ))}
                </div>
            )}
        </div>
    );
};

interface StructurePanelProps {
  blocks: DocumentBlock[];
  documentType: DocumentType;
  styles: Record<StyleKey, Style>;
  onBlockClick: (blockId: number) => void;
}

export const StructurePanel: React.FC<StructurePanelProps> = ({ blocks, documentType, styles, onBlockClick }) => {
  const [format, setFormat] = useState<'jats' | 'bits'>(documentType === 'book' ? 'bits' : 'jats');
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());

  const tree = useMemo(() => buildStructureTree(blocks, format, format, styles), [blocks, format, styles]);

  useEffect(() => {
    // Auto-expand all nodes when the tree is first built or format changes
    const allIds = new Set<string>();
    const collectIds = (nodes: StructureNode[]) => {
      for (const node of nodes) {
        allIds.add(node.id);
        if (node.children.length > 0) {
          collectIds(node.children);
        }
      }
    };
    collectIds(tree);
    setExpandedNodes(allIds);
  }, [tree]);

  const toggleNode = (id: string) => {
    setExpandedNodes(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  };

  return (
    <div className="flex flex-col h-full">
      <h2 className="text-lg font-semibold text-gray-700 dark:text-gray-300 mb-4 border-b dark:border-gray-700 pb-2">
        Dokumentstruktur ({format.toUpperCase()})
      </h2>
      <div className="flex-shrink-0 mb-2">
        <div className="flex rounded-md shadow-sm">
          <button
            onClick={() => setFormat('jats')}
            disabled={documentType === 'book'}
            className={`flex-1 px-3 py-2 text-sm font-medium border border-gray-300 dark:border-gray-600 rounded-l-md transition-colors
              ${format === 'jats' ? 'bg-blue-600 text-white' : 'bg-white text-gray-700 dark:bg-gray-800 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'}
              ${documentType === 'book' ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            JATS
          </button>
          <button
            onClick={() => setFormat('bits')}
            disabled={documentType === 'journal'}
            className={`-ml-px flex-1 px-3 py-2 text-sm font-medium border border-gray-300 dark:border-gray-600 rounded-r-md transition-colors
              ${format === 'bits' ? 'bg-blue-600 text-white' : 'bg-white text-gray-700 dark:bg-gray-800 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'}
              ${documentType === 'journal' ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            BITS
          </button>
        </div>
      </div>
      <div className="flex-grow min-h-0 overflow-y-auto bg-gray-100 dark:bg-gray-900/70 rounded-md p-2 -mx-4">
        {tree.map((node) => (
          <StructureNodeView
            key={node.id}
            node={node}
            expandedNodes={expandedNodes}
            toggleNode={toggleNode}
            level={0}
            onNodeClick={onBlockClick}
          />
        ))}
      </div>
    </div>
  );
};