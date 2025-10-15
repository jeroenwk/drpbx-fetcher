import { ProcessorConfig } from "../types";

/**
 * Configuration for viwoods processor
 */
export interface ViwoodsProcessorConfig extends ProcessorConfig {
	highlightsFolder: string;
	annotationsFolder: string;
	sourcesFolder: string;
	pagesFolder: string;
	highlightTemplate?: string;
	annotationTemplate?: string;
	pageTemplate?: string;
	includeMetadata: boolean;
	includeThumbnail: boolean;
	extractImages: boolean;
	createIndex: boolean;
	// Annotation processing options
	processAnnotations?: boolean;
	annotationImagesFolder?: string;
	includeSummaryInAnnotation?: boolean;
	createCompositeImages?: boolean;
}

/**
 * viwoods .note file structures
 */
export interface NotesBean {
	noteId?: string;
	noteName?: string;
	createTime?: string;
	pageCount?: number;
}

export interface LayoutText {
	[key: string]: unknown;
}

export interface LayoutImage {
	[key: string]: unknown;
}

/**
 * BookBean structure for EPUB metadata
 */
export interface BookBean {
	bookId: string;
	bookName: string;
	bookPath: string;
	// Add other fields as needed
	[key: string]: unknown;
}

/**
 * ReadNoteBean structure for EPUB annotations
 */
export interface ReadNoteBean {
	id: number;
	bookId: string;
	bookName: string;
	userId: string;
	// Page & Location
	epubPageIndex: number;
	pageIndex: number;
	pageIndexItem: number;
	rootChapterName: string;
	rootChapterLinkUri: string;
	title: string;
	// Content
	sumary: string; // Note: misspelling in source data
	alias: string;
	// Images
	noteImagePath: string; // PNG overlay
	pageImage: string; // JPG background
	// Metadata
	upDataTime: number;
	noteType: number;
	epubSettingStr: string;
	bookType: number;
}

/**
 * Highlight data structure from PageTextAnnotation
 */
export interface EpubHighlight {
	bookName: string;
	chapterName: string;
	rootChapterName: string;
	chapterLinkUri: string;
	rawText: string;
	pageIndex: number;
	pageCount: number;
	createTime: number;
}
