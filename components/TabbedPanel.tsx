import React, { useState } from 'react';
import type { TabProps } from '../types';

interface TabbedPanelProps {
  children: React.ReactElement<TabProps>[];
}

export const Tab: React.FC<TabProps> = ({ children }) => <>{children}</>;

export const TabbedPanel: React.FC<TabbedPanelProps> = ({ children }) => {
  // Safely initialize activeTab, returning an empty string if no children are present.
  const [activeTab, setActiveTab] = useState(() => {
    if (children && children.length > 0) {
      return children[0].props.label;
    }
    return ''; // Default to an empty string if no tabs are provided
  });

  const activeContent = children.find(child => child.props.label === activeTab);

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm flex flex-col overflow-hidden h-full">
      <div className="flex border-b dark:border-gray-700 flex-shrink-0">
        {children.map(child => (
          <button
            key={child.props.label}
            className={`flex-1 py-2 px-4 text-sm font-semibold text-center transition-colors focus:outline-none ${
              activeTab === child.props.label
                ? 'text-blue-600 dark:text-blue-400 border-b-2 border-blue-600 dark:border-blue-400'
                : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
            }`}
            onClick={() => setActiveTab(child.props.label)}
          >
            {child.props.label}
          </button>
        ))}
      </div>
      <div className="flex-grow min-h-0 overflow-y-auto p-4">
        {activeContent}
      </div>
    </div>
  );
};