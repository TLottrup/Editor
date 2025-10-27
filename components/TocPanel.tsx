

import React, { useMemo, useState, useEffect } from 'react';
import type { DocumentBlock, StyleKey } from '../types';
import { ChevronRightIcon } from './icons';

interface TocPanelProps {
  blocks: DocumentBlock[];
  onBlockClick: (blockId: number) => void;
  activeBlockId: number | null;
}

const HEADING_STYLES: StyleKey[] = [
    'del',
    'kapitel',
    'section_heading_1',
    'section_heading_2',
    'section_heading_3',
    'section_heading_4',
    'section_heading_5',
];

const getIndentLevel = (styleKey: StyleKey): number => {
    switch(styleKey) {
        case 'del': return 0;
        case 'kapitel': return 1;
        case 'section_heading_1': return 2;
        case 'section_heading_2': return 3;
        case 'section_heading_3': return 4;
        case 'section_heading_4': return 5;
        case 'section_heading_5': return 6;
        default: return 0;
    }
};

interface TocNode {
  block: DocumentBlock;
  children: TocNode[];
}

const buildTocTree = (blocks: DocumentBlock[]): TocNode[] => {
  if (!blocks.length) return [];

  // Use a sentinel root node to simplify the logic
  const root: TocNode = { block: { id: -1, style: 'body', content: 'root', level: -1 }, children: [] };
  const stack: { node: TocNode; level: number }[] = [{ node: root, level: -1 }];

  for (const block of blocks) {
    const level = getIndentLevel(block.style);
    const node: TocNode = { block, children: [] };

    let lastOnStack = stack[stack.length - 1];
    while (level <= lastOnStack.level && stack.length > 1) {
      stack.pop();
      lastOnStack = stack[stack.length - 1];
    }

    lastOnStack.node.children.push(node);
    stack.push({ node, level });
  }

  return root.children;
};

const TocItem: React.FC<{ node: TocNode; onBlockClick: (blockId: number) => void; activeBlockId: number | null; }> = ({ node, onBlockClick, activeBlockId }) => {
    const [isExpanded, setIsExpanded] = useState(true);
    const hasChildren = node.children.length > 0;
    const isActive = node.block.id === activeBlockId;

    const nodeContainsActiveChild = useMemo(() => {
        const checkNode = (n: TocNode): boolean => {
            if (n.block.id === activeBlockId) return true;
            return n.children.some(child => checkNode(child));
        };
        return checkNode;
    }, [activeBlockId]);

    useEffect(() => {
        // Automatically expand parent nodes if a child is active
        if (nodeContainsActiveChild(node) && !isActive) {
            setIsExpanded(true);
        }
    }, [activeBlockId, node, isActive, nodeContainsActiveChild]);

    return (
        <li className="space-y-1">
            <div className={`flex items-center group w-full text-left text-sm rounded transition-colors ${
                isActive ? 'bg-blue-100 dark:bg-blue-900/50' : 'hover:bg-gray-100 dark:hover:bg-gray-700'
            }`}>
                <button
                    onClick={() => setIsExpanded(prev => !prev)}
                    className={`p-1.5 rounded-full text-gray-400 dark:text-gray-500 hover:bg-gray-200 dark:hover:bg-gray-600 ${!hasChildren ? 'invisible' : ''}`}
                    aria-label={isExpanded ? `Collapse ${node.block.content}` : `Expand ${node.block.content}`}
                    aria-expanded={isExpanded}
                >
                    <ChevronRightIcon className={`h-3 w-3 transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
                </button>
                <button
                    onClick={() => onBlockClick(node.block.id)}
                    className={`flex-grow text-left px-1 truncate py-1 ${isActive ? 'font-semibold text-blue-700 dark:text-blue-400' : 'text-gray-700 dark:text-gray-300'}`}
                    title={node.block.content.replace(/<[^>]*>?/gm, '')}
                >
                    {node.block.content.replace(/<[^>]*>?/gm, '')}
                </button>
            </div>
            {hasChildren && isExpanded && (
                <ul className="pl-4 space-y-1">
                    {node.children.map(childNode => (
                        <TocItem key={childNode.block.id} node={childNode} onBlockClick={onBlockClick} activeBlockId={activeBlockId} />
                    ))}
                </ul>
            )}
        </li>
    );
};


export const TocPanel: React.FC<TocPanelProps> = ({ blocks, onBlockClick, activeBlockId }) => {
  const tocTree = useMemo(() => {
    const headingBlocks = blocks.filter(b => HEADING_STYLES.includes(b.style));
    return buildTocTree(headingBlocks);
  }, [blocks]);

  return (
    <div className="flex flex-col h-full">
      <h2 className="text-lg font-semibold text-gray-700 dark:text-gray-300 mb-4 border-b dark:border-gray-700 pb-2">Indholdsfortegnelse</h2>
      <nav className="flex-grow overflow-y-auto -mx-4 px-4">
        <ul className="space-y-1">
          {tocTree.length > 0 ? tocTree.map(node => (
            <TocItem key={node.block.id} node={node} onBlockClick={onBlockClick} activeBlockId={activeBlockId}/>
          )) : (
            <p className="text-sm text-gray-500 dark:text-gray-400 italic">Dokumentet har ingen overskrifter endnu.</p>
          )}
        </ul>
      </nav>
    </div>
  );
};