import React from 'react';
import { TabbedPanel, Tab } from './TabbedPanel';
import { PdfCssPanel } from './PdfCssPanel';
import { VisualEditorCssPanel } from './VisualEditorCssPanel';
import type { Style, StyleKey, VisualEditorSettings, EditorLayoutSettings } from '../types';

interface CssPanelProps {
  pdfCss: string;
  onPdfCssChange: (css: string) => void;
  styles: Record<StyleKey, Style>;
  onStyleChange: (update: React.SetStateAction<Record<StyleKey, Style>>) => void;
  layoutSettings: EditorLayoutSettings;
  onLayoutSettingsChange: (newSettings: EditorLayoutSettings) => void;
}

export const CssPanel: React.FC<CssPanelProps> = ({
  pdfCss,
  onPdfCssChange,
  styles,
  onStyleChange,
  layoutSettings,
  onLayoutSettingsChange,
}) => {
  return (
    <div className="flex flex-col h-full -m-4">
        <TabbedPanel>
            <Tab label="PDF CSS Editor">
                <PdfCssPanel
                pdfCss={pdfCss}
                onPdfCssChange={onPdfCssChange}
                />
            </Tab>
            <Tab label="Editor CSS">
                <VisualEditorCssPanel
                styles={styles}
                onStyleChange={onStyleChange}
                layoutSettings={layoutSettings}
                onLayoutSettingsChange={onLayoutSettingsChange}
                />
            </Tab>
        </TabbedPanel>
    </div>
  );
};