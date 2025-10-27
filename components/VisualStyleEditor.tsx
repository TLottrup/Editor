import React, { useState, useCallback, useMemo } from 'react';
import type { Style, StyleKey, VisualEditorSettings, EditorLayoutSettings, ListAttributes } from '../types';
import { ChevronRightIcon } from './icons';

interface VisualEditorCssPanelProps {
  styles: Record<StyleKey, Style>;
  onStyleChange: (update: React.SetStateAction<Record<StyleKey, Style>>) => void;
  layoutSettings: EditorLayoutSettings;
  onLayoutSettingsChange: (newSettings: EditorLayoutSettings) => void;
}

const ORDERED_LIST_STYLES = ['decimal', 'lower-alpha', 'upper-alpha', 'lower-roman', 'upper-roman', 'none'];
const UNORDERED_LIST_STYLES = ['disc', 'circle', 'square', 'none'];

// Helper to sanitize numerical inputs
const sanitizeNumber = (value: string | number | undefined, defaultValue: number | undefined = undefined) => {
  if (value === undefined || value === null || value === '') return defaultValue;
  const num = parseFloat(value as string);
  return isNaN(num) ? defaultValue : num;
};

const getTextShadowValue = (shadow: string | undefined) => {
    switch (shadow) {
        case 'small': return '1px 1px 2px rgba(0,0,0,0.2)';
        case 'medium': return '2px 2px 4px rgba(0,0,0,0.4)';
        case 'large': return '3px 3px 6px rgba(0,0,0,0.6)';
        case 'none':
        default: return 'none';
    }
}

// Common font families
const FONT_FAMILIES = [
  'Nunito, sans-serif',
  'Arial, sans-serif',
  'Verdana, sans-serif',
  'Helvetica, sans-serif',
  'Tahoma, sans-serif',
  'Georgia, serif',
  'Times New Roman, serif',
  'Courier New, monospace',
];

// Common font weights
const FONT_WEIGHTS = [
  '100', '200', '300', '400', '500', '600', '700', '800', '900', 'normal', 'bold',
];

// Text shadow presets
const TEXT_SHADOW_OPTIONS = [
  { value: 'none', label: 'None' },
  { value: 'small', label: 'Small' },
  { value: 'medium', label: 'Medium' },
  { value: 'large', label: 'Large' },
];

const BREAKING_OPTIONS = [
  { value: 'normal', label: 'Normal' },
  { value: 'break-all', label: 'Break All' },
  { value: 'keep-all', label: 'Keep All' },
];

const ACCORDION_ANIMATION_DURATION = 'duration-200'; // Tailwind duration class

const AccordionItem: React.FC<{
  title: string;
  children: React.ReactNode;
  isExpanded: boolean;
  onToggle: () => void;
}> = ({ title, children, isExpanded, onToggle }) => {
  return (
    <div className="border-b border-gray-200 dark:border-gray-700">
      <button
        className="flex justify-between items-center w-full px-4 py-3 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
        onClick={onToggle}
        aria-expanded={isExpanded}
      >
        <span>{title}</span>
        <ChevronRightIcon className={`h-4 w-4 transform transition-transform ${ACCORDION_ANIMATION_DURATION} ${isExpanded ? 'rotate-90' : ''}`} />
      </button>
      <div
        className={`overflow-hidden transition-all ease-in-out ${ACCORDION_ANIMATION_DURATION}`}
        style={{ maxHeight: isExpanded ? '1000px' : '0px' }} // MaxHeight for smooth transition
      >
        <div className="px-4 py-3 space-y-4 bg-gray-50 dark:bg-gray-800 border-t dark:border-gray-700">
          {children}
        </div>
      </div>
    </div>
  );
};

const DimensionInput: React.FC<{
  label: string;
  value: string;
  onChange: (value: string) => void;
}> = ({ label, value, onChange }) => {
  const [number, unit] = useMemo(() => {
    const numMatch = value.match(/^[0-9.]+/);
    const unitMatch = value.match(/[a-zA-Z%]+$/);
    return [numMatch ? numMatch[0] : '0', unitMatch ? unitMatch[0] : 'mm'];
  }, [value]);

  const handleNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange(`${e.target.value}${unit}`);
  };

  const handleUnitChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    onChange(`${number}${e.target.value}`);
  };

  return (
    <div>
      <label className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">{label}</label>
      <div className="flex items-center gap-2">
        <input
          type="number"
          value={number}
          onChange={handleNumberChange}
          className="w-full px-2 py-1.5 text-sm border border-gray-300 bg-white dark:border-gray-600 dark:bg-gray-700 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
        />
        <select
          value={unit}
          onChange={handleUnitChange}
          className="px-2 py-1.5 text-sm border border-gray-300 bg-white dark:border-gray-600 dark:bg-gray-700 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
        >
          <option value="mm">mm</option>
          <option value="cm">cm</option>
          <option value="in">in</option>
          <option value="px">px</option>
        </select>
      </div>
    </div>
  );
};

export const VisualEditorCssPanel: React.FC<VisualEditorCssPanelProps> = ({ styles, onStyleChange, layoutSettings, onLayoutSettingsChange }) => {
  const [expandedKey, setExpandedKey] = useState<StyleKey | 'layout' | null>('layout');
  const [areMarginsLinked, setAreMarginsLinked] = useState(true);

  const handleSettingsChange = useCallback((styleKey: StyleKey, newSettings: Partial<VisualEditorSettings>) => {
    onStyleChange(prevStyles => ({
      ...prevStyles,
      [styleKey]: {
        ...prevStyles[styleKey],
        visualSettings: {
          ...(prevStyles[styleKey].visualSettings || {}),
          ...newSettings,
        },
      },
    }));
  }, [onStyleChange]);

  const handleListAttributeChange = useCallback((styleKey: StyleKey, newAttributes: Partial<ListAttributes>) => {
    onStyleChange(prevStyles => ({
      ...prevStyles,
      [styleKey]: {
        ...prevStyles[styleKey],
        defaultListAttributes: {
          ...(prevStyles[styleKey].defaultListAttributes || {}),
          ...newAttributes,
        },
      },
    }));
  }, [onStyleChange]);
  
  const handleLayoutChange = useCallback((newSettings: Partial<EditorLayoutSettings>) => {
    onLayoutSettingsChange({
      ...layoutSettings,
      ...newSettings,
    });
  }, [layoutSettings, onLayoutSettingsChange]);

  const handleMarginChange = (field: keyof EditorLayoutSettings, value: string) => {
    if (areMarginsLinked) {
      handleLayoutChange({
        marginTop: value,
        marginRight: value,
        marginBottom: value,
        marginLeft: value,
      });
    } else {
      handleLayoutChange({ [field]: value });
    }
  };

  const sortedStyles = useMemo(() => {
    return Object.values(styles).sort((a: Style, b: Style) => a.name.localeCompare(b.name));
  }, [styles]);

  const InputField: React.FC<{
    label: string;
    value: string | number | undefined;
    onChange: (value: string | number | undefined) => void;
    type?: string;
    min?: number;
    max?: number;
    step?: number;
    unit?: string;
    isSlider?: boolean;
    defaultValue?: number;
    resetButton?: boolean;
  }> = ({ label, value, onChange, type = 'text', min, max, step, unit, isSlider, defaultValue, resetButton }) => (
    <div>
      <label className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">{label}</label>
      <div className="flex items-center gap-2">
        {isSlider && (
          <input
            type="range"
            min={min}
            max={max}
            step={step}
            value={value === undefined ? defaultValue : value}
            onChange={(e) => onChange(sanitizeNumber(e.target.value))}
            className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-gray-700"
          />
        )}
        <input
          type={type === 'range' ? 'number' : type}
          value={value === undefined ? (defaultValue === undefined ? '' : defaultValue) : value}
          onChange={(e) => onChange(type === 'number' ? sanitizeNumber(e.target.value) : e.target.value)}
          className="w-24 px-2 py-1.5 text-sm border border-gray-300 bg-white dark:border-gray-600 dark:bg-gray-700 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
          min={min}
          max={max}
          step={step}
        />
        {unit && <span className="text-sm text-gray-500 dark:text-gray-400">{unit}</span>}
        {resetButton && (
          <button
            onClick={() => onChange(defaultValue)}
            className="px-3 py-1.5 text-sm rounded-md bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 transition-colors"
            title="Reset to Normal"
          >
            Normal
          </button>
        )}
      </div>
    </div>
  );

  const SelectField: React.FC<{
    label: string;
    value: string | undefined;
    onChange: (value: string) => void;
    options: { value: string; label: string }[];
  }> = ({ label, value, onChange, options }) => (
    <div>
      <label className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">{label}</label>
      <select
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-3 py-1.5 text-sm border border-gray-300 bg-white dark:border-gray-600 dark:bg-gray-700 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );

  const ToggleButtons: React.FC<{
    label: string;
    options: { value: string; label: string; icon?: React.ReactNode }[];
    value: string | undefined;
    onChange: (value: string) => void;
  }> = ({ label, options, value, onChange }) => (
    <div>
      <label className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">{label}</label>
      <div className="flex rounded-md shadow-sm">
        {options.map((option, index) => (
          <button
            key={option.value}
            onClick={() => onChange(option.value)}
            className={`flex-1 px-3 py-2 text-sm font-medium border border-gray-300 dark:border-gray-600 
                        ${value === option.value
                ? 'bg-blue-600 text-white dark:bg-blue-700'
                : 'bg-white text-gray-700 hover:bg-gray-50 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700'
              }
                        ${index === 0 ? 'rounded-l-md' : ''}
                        ${index === options.length - 1 ? 'rounded-r-md' : ''}
                        ${index !== 0 ? '-ml-px' : ''}
                        focus:z-10 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 transition-colors flex justify-center items-center gap-1`}
          >
            {option.icon || option.label}
          </button>
        ))}
      </div>
    </div>
  );

  return (
    <div className="flex flex-col h-full">
      <div className="flex-shrink-0 mb-4">
        <h2 className="text-lg font-semibold text-gray-700 dark:text-gray-300 mb-2 border-b dark:border-gray-700 pb-2">Editor CSS</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Juster de visuelle stilarter for hver typografi direkte i editoren.
        </p>
      </div>
      <div className="flex-grow min-h-0 overflow-y-auto -mx-4">
        <AccordionItem
          key="layout"
          title="Sideopsætning"
          isExpanded={expandedKey === 'layout'}
          onToggle={() => setExpandedKey(expandedKey === 'layout' ? null : 'layout')}
        >
          <div className="grid grid-cols-2 gap-4">
            <DimensionInput 
              label="Papirbredde"
              value={layoutSettings.paperWidth}
              onChange={(val) => handleLayoutChange({ paperWidth: val })}
            />
            <DimensionInput 
              label="Papirhøjde"
              value={layoutSettings.paperHeight}
              onChange={(val) => handleLayoutChange({ paperHeight: val })}
            />
          </div>
          <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
             <div className="flex justify-between items-center mb-2">
                <h4 className="text-sm font-medium text-gray-600 dark:text-gray-400">Indholdsmarginer</h4>
                <label className="flex items-center text-xs text-gray-500 dark:text-gray-400 cursor-pointer">
                  <input 
                    type="checkbox" 
                    checked={areMarginsLinked}
                    onChange={(e) => setAreMarginsLinked(e.target.checked)}
                    className="h-3 w-3 rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500 bg-white dark:bg-gray-700 mr-1.5"
                  />
                  Sammenkæd marginer
                </label>
             </div>
             {areMarginsLinked ? (
                <DimensionInput
                  label="Alle sider"
                  value={layoutSettings.marginTop}
                  onChange={(val) => handleMarginChange('marginTop', val)}
                />
             ) : (
                <div className="grid grid-cols-2 gap-4">
                  <DimensionInput
                    label="Top"
                    value={layoutSettings.marginTop}
                    onChange={(val) => handleMarginChange('marginTop', val)}
                  />
                  <DimensionInput
                    label="Højre"
                    value={layoutSettings.marginRight}
                    onChange={(val) => handleMarginChange('marginRight', val)}
                  />
                  <DimensionInput
                    label="Bund"
                    value={layoutSettings.marginBottom}
                    onChange={(val) => handleMarginChange('marginBottom', val)}
                  />
                  <DimensionInput
                    label="Venstre"
                    value={layoutSettings.marginLeft}
                    onChange={(val) => handleMarginChange('marginLeft', val)}
                  />
                </div>
             )}
          </div>
        </AccordionItem>

        {sortedStyles.map((style) => {
          const vs = style.visualSettings || {};
          const isListItem = style.key.includes('_list_item');
          const listAttrs = style.defaultListAttributes || {};
          const previewStyle: React.CSSProperties = {
                fontFamily: vs.fontFamily,
                color: vs.color,
                fontWeight: vs.fontWeight,
                fontSize: vs.fontSize ? `${vs.fontSize}px` : undefined,
                lineHeight: vs.lineHeight,
                fontStyle: vs.fontStyle,
                textTransform: vs.textTransform,
                textDecoration: vs.textDecoration,
                textAlign: vs.textAlign,
                textShadow: getTextShadowValue(vs.textShadow),
                wordBreak: vs.wordBreak,
                letterSpacing: vs.letterSpacing ? `${vs.letterSpacing}px` : undefined,
                wordSpacing: vs.wordSpacing ? `${vs.wordSpacing}px` : undefined,
                direction: vs.direction,
                columnCount: vs.columnCount,
            };
          return (
          <AccordionItem
            key={style.key}
            title={style.name}
            isExpanded={expandedKey === style.key}
            onToggle={() => setExpandedKey(expandedKey === style.key ? null : style.key)}
          >
             <div className="p-4 mb-4 rounded-md bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700">
                <p style={previewStyle}>
                    Hurtige brune ræve hopper over dovne hunde.
                </p>
             </div>
            <div className="grid grid-cols-2 gap-4">
              <SelectField
                label="Font Family"
                value={vs.fontFamily}
                onChange={(val) => handleSettingsChange(style.key, { fontFamily: val })}
                options={FONT_FAMILIES.map((ff) => ({ value: ff, label: ff.split(',')[0] }))}
              />
              <div className="relative">
                <label className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">Color</label>
                <input
                  type="color"
                  value={vs.color || '#374151'}
                  onChange={(e) => handleSettingsChange(style.key, { color: e.target.value })}
                  className="w-full h-9 p-1 border border-gray-300 bg-white dark:border-gray-600 dark:bg-gray-700 rounded-md"
                />
                <span className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 dark:text-gray-400 text-xs pointer-events-none">
                  {vs.color || '#374151'}
                </span>
              </div>
              <SelectField
                label="Weight"
                value={vs.fontWeight}
                onChange={(val) => handleSettingsChange(style.key, { fontWeight: val })}
                options={FONT_WEIGHTS.map((fw) => ({ value: fw, label: fw }))}
              />
              <InputField
                label="Font Size"
                type="number"
                min={8}
                max={72}
                step={1}
                unit="px"
                isSlider
                defaultValue={16}
                value={vs.fontSize}
                onChange={(val) => handleSettingsChange(style.key, { fontSize: sanitizeNumber(val, 16) })}
              />
              <InputField
                label="Line Height"
                type="number"
                min={0.8}
                max={3.0}
                step={0.1}
                unit="em"
                isSlider
                defaultValue={1.42}
                value={vs.lineHeight}
                onChange={(val) => handleSettingsChange(style.key, { lineHeight: sanitizeNumber(val, 1.42) })}
              />
              <ToggleButtons
                label="Style"
                options={[
                  { value: 'normal', label: 'Normal' },
                  { value: 'italic', label: 'Italic' },
                ]}
                value={vs.fontStyle || 'normal'}
                onChange={(val) => handleSettingsChange(style.key, { fontStyle: val as 'normal' | 'italic' })}
              />
              <ToggleButtons
                label="Transform"
                options={[
                  { value: 'none', label: 'no' },
                  { value: 'capitalize', label: 'Aa' },
                  { value: 'uppercase', label: 'AA' },
                  { value: 'lowercase', label: 'aa' },
                ]}
                value={vs.textTransform || 'none'}
                onChange={(val) => handleSettingsChange(style.key, { textTransform: val as 'none' | 'uppercase' | 'lowercase' | 'capitalize' })}
              />
              <ToggleButtons
                label="Decoration"
                options={[
                  { value: 'none', label: 'A', icon: undefined },
                  { value: 'underline', label: '', icon: <span className="underline">A</span> },
                  { value: 'line-through', label: '', icon: <span className="line-through">A</span> },
                  { value: 'overline', label: '', icon: <span className="overline">A</span> },
                ]}
                value={vs.textDecoration || 'none'}
                onChange={(val) => handleSettingsChange(style.key, { textDecoration: val as 'none' | 'underline' | 'line-through' | 'overline' })}
              />
              <ToggleButtons
                label="Align"
                options={[
                  { value: 'left', label: '', icon: <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20"><path d="M2 4h16v2H2zm0 4h10v2H2zm0 4h16v2H2zm0 4h10v2H2z" /></svg> },
                  { value: 'center', label: '', icon: <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20"><path d="M2 4h16v2H2zm2 4h12v2H4zm-2 4h16v2H2zm2 4h12v2H4z" /></svg> },
                  { value: 'right', label: '', icon: <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20"><path d="M2 4h16v2H2zm8 4h8v2h-8zm-8 4h16v2H2zm8 4h8v2h-8z" /></svg> },
                  { value: 'justify', label: '', icon: <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20"><path d="M2 4h16v2H2zm0 4h16v2H2zm0 4h16v2H2zm0 4h16v2H2z" /></svg> },
                ]}
                value={vs.textAlign || 'left'}
                onChange={(val) => handleSettingsChange(style.key, { textAlign: val as 'left' | 'center' | 'right' | 'justify' })}
              />
              <SelectField
                label="Text Shadow"
                value={vs.textShadow}
                onChange={(val) => handleSettingsChange(style.key, { textShadow: val as 'none' | 'small' | 'medium' | 'large' })}
                options={TEXT_SHADOW_OPTIONS}
              />
              <SelectField
                label="Breaking"
                value={vs.wordBreak}
                onChange={(val) => handleSettingsChange(style.key, { wordBreak: val as 'normal' | 'break-all' | 'keep-all' })}
                options={BREAKING_OPTIONS}
              />
              <InputField
                label="Letter Spacing"
                type="number"
                min={-5}
                max={10}
                step={0.1}
                unit="px"
                isSlider
                defaultValue={0}
                resetButton
                value={vs.letterSpacing}
                onChange={(val) => handleSettingsChange(style.key, { letterSpacing: sanitizeNumber(val, 0) })}
              />
              <InputField
                label="Word Spacing"
                type="number"
                min={-5}
                max={10}
                step={0.1}
                unit="px"
                isSlider
                defaultValue={0}
                value={vs.wordSpacing}
                onChange={(val) => handleSettingsChange(style.key, { wordSpacing: sanitizeNumber(val, 0) })}
              />
              <InputField
                label="Columns"
                type="number"
                min={1}
                max={5}
                step={1}
                isSlider
                defaultValue={1}
                value={vs.columnCount}
                onChange={(val) => handleSettingsChange(style.key, { columnCount: sanitizeNumber(val, 1) })}
              />
              <ToggleButtons
                label="Direction"
                options={[
                  { value: 'ltr', label: 'left' },
                  { value: 'rtl', label: 'right' },
                ]}
                value={vs.direction || 'ltr'}
                onChange={(val) => handleSettingsChange(style.key, { direction: val as 'ltr' | 'rtl' })}
              />
            </div>
             {isListItem && (
              <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                <h4 className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-2">Listeindstillinger</h4>
                <div className="grid grid-cols-2 gap-4">
                  <SelectField
                    label="Listestil"
                    value={listAttrs.style}
                    onChange={(val) => handleListAttributeChange(style.key, { style: val as any })}
                    options={(style.key === 'ordered_list_item' ? ORDERED_LIST_STYLES : UNORDERED_LIST_STYLES).map(s => ({ value: s, label: s }))}
                  />
                  {style.key === 'ordered_list_item' && (
                    <>
                      <InputField
                        label="Startnummer"
                        type="number"
                        min={1}
                        value={listAttrs.start}
                        onChange={(val) => handleListAttributeChange(style.key, { start: sanitizeNumber(val, 1) })}
                      />
                      <div className="col-span-2 flex items-center">
                         <input
                           type="checkbox"
                           id={`reversed-${style.key}`}
                           checked={!!listAttrs.reversed}
                           onChange={(e) => handleListAttributeChange(style.key, { reversed: e.target.checked })}
                           className="h-4 w-4 rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500 bg-white dark:bg-gray-700"
                         />
                         <label htmlFor={`reversed-${style.key}`} className="ml-2 block text-sm text-gray-900 dark:text-gray-300">
                           Omvendt rækkefølge
                         </label>
                       </div>
                    </>
                  )}
                </div>
              </div>
            )}
          </AccordionItem>
        )})}
      </div>
    </div>
  );
};