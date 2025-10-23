/**
 * Daily module components - refactored for better maintainability
 *
 * This module provides processing for Daily notes from Viwoods,
 * broken down into logical components:
 *
 * - DailyProcessor: Main orchestrator
 * - NotesBeanHandler: Handles NotesBean extraction and validation
 * - PageImageProcessor: Processes page images from note lists
 * - RelatedNotesManager: Manages cross-references to other modules
 * - TemplateRenderer: Handles template rendering and variable building
 * - NoteFileManager: Manages file operations and merging
 */

export { DailyProcessor } from './DailyProcessor';
export { NotesBeanHandler } from './NotesBeanHandler';
export { PageImageProcessor } from './PageImageProcessor';
export { RelatedNotesManager } from './RelatedNotesManager';
export { TemplateRenderer } from './TemplateRenderer';
export { NoteFileManager } from './NoteFileManager';

export type { NotesBeanData } from './NotesBeanHandler';
export type { PageImageData } from './PageImageProcessor';
export type { RelatedNotesData } from './RelatedNotesManager';
export type { TemplateVariables } from './TemplateRenderer';