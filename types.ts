import React from 'react';

// Provide full content for types.ts to resolve module import errors across the application.
export type DocumentType = 'journal' | 'book';

export type StyleKey = string;

export interface TabProps {
  label: string;
  children: React.ReactNode;
}

export interface ListAttributes {
  style?: 'disc' | 'circle' | 'square' | 'decimal' | 'lower-alpha' | 'lower-roman' | 'upper-alpha' | 'upper-roman' | 'none';
  start?: number;
  reversed?: boolean;
}

export interface VisualEditorSettings {
  fontFamily?: string;
  color?: string;
  fontWeight?: string;
  fontSize?: number;
  lineHeight?: number;
  fontStyle?: 'normal' | 'italic';
  textTransform?: 'none' | 'uppercase' | 'lowercase' | 'capitalize';
  textDecoration?: 'none' | 'underline' | 'line-through' | 'overline';
  textAlign?: 'left' | 'center' | 'right' | 'justify';
  textShadow?: 'none' | 'small' | 'medium' | 'large'; // Custom mapped shadows
  wordBreak?: 'normal' | 'break-all' | 'keep-all';
  letterSpacing?: number;
  wordSpacing?: number;
  columnCount?: number;
  direction?: 'ltr' | 'rtl';
}

export interface EditorLayoutSettings {
  paperWidth: string;
  paperHeight: string;
  marginTop: string;
  marginRight: string;
  marginBottom: string;
  marginLeft: string;
}

export interface Style {
  key: StyleKey;
  name: string;
  description: string;
  className: string;
  jatsTag: string;
  bitsTag: string;
  nestingParentJats?: string;
  nestingParentBits?: string;
  level?: number;
  attributes?: Record<string, string>;
  matterType?: 'front' | 'body' | 'back' | 'chapter'; // For JATS/BITS front/body/back matter. 'chapter' specific to BITS.
  defaultListAttributes?: ListAttributes;
  visualSettings?: VisualEditorSettings;
  allowedDocumentTypes?: DocumentType[];
}

export interface TableCell {
  content: string;
  colspan?: number;
  rowspan?: number;
  isHidden?: boolean;
}

export interface TableData {
    caption: string;
    rows: TableCell[][];
}

export interface ImageData {
    src: string;
    caption: string;
    source: string;
    width?: number;
    height?: number;
}

export interface Footnote {
  id: string;
  content: string;
}

export interface DocumentBlock {
  id: number;
  style: StyleKey;
  content: string; // For table/image, this will be JSON stringified data
  level?: number;
  list?: ListAttributes;
}

export type BookType = 'Lovkommentar' | 'Håndbog' | 'Debatbog' | 'Afhandling' | 'Festskrift' | 'Lærebog';

export interface Author {
    firstName: string;
    lastName: string;
}

export interface JournalMetadata {
    title: string;
    subtitle?: string;
    authors: Author[];
}

export interface BookMetadata extends JournalMetadata {
    pIsbn?: string;
    eIsbn?: string;
    publicationDate?: string;
    edition?: string;
    bookType?: BookType;
    coverImageSrc?: string;
    description?: string;
}

export type Metadata = JournalMetadata | BookMetadata;

export type ExportFormat = 'jats' | 'bits';

export interface DocumentVersion {
  id: string; // Unique ID for the version
  timestamp: number; // Unix timestamp when the version was saved
  name: string; // User-defined name for the version
  blocks: DocumentBlock[]; // Stored document blocks
  metadata: Metadata; // Stored document metadata
}