import { ProcessorConfig } from "../types";

/**
 * Viwoods module types based on package names
 */
export enum ViwoodsModuleType {
	LEARNING = "learning",    // com.wisky.learning
	PAPER = "paper",          // com.wisky.notewriter
	DAILY = "daily",          // com.wisky.schedule
	MEETING = "meeting",      // com.wisky.meeting
	PICKING = "picking",      // com.wisky.captureLog
	MEMO = "memo",            // com.wisky.memo
	UNKNOWN = "unknown"
}

/**
 * Package name to module type mapping
 */
export const PACKAGE_TO_MODULE: Record<string, ViwoodsModuleType> = {
	"com.wisky.learning": ViwoodsModuleType.LEARNING,
	"com.wisky.notewriter": ViwoodsModuleType.PAPER,
	"com.wisky.schedule": ViwoodsModuleType.DAILY,
	"com.wisky.meeting": ViwoodsModuleType.MEETING,
	"com.wisky.captureLog": ViwoodsModuleType.PICKING,
	"com.wisky.memo": ViwoodsModuleType.MEMO,
};

/**
 * Metadata for tracking Viwoods note processing
 */
export interface ViwoodsNoteMetadata {
	noteId: string; // Viwoods internal note ID (from NoteFileInfo.json - stable across renames)
	dropboxFileId: string; // Dropbox file ID (changes on rename)
	lastModified: number; // Last modified timestamp
	notePath: string; // Path to markdown file in vault
	creationTime?: number; // Creation timestamp (for date-based cross-referencing)
	pages: Array<{
		page: number;
		image: string; // Current image path
	}>;
	audioFiles?: Array<{
		fileName: string; // Audio filename
		path: string; // Path to audio file in vault
		timestamp?: number; // Audio file timestamp for matching
	}>;
}

/**
 * Common configuration for all modules
 */
export interface BaseModuleConfig {
	enabled: boolean;
	outputFolder: string;
	template?: string;
	includeMetadata?: boolean;
	includeThumbnail?: boolean;
	extractImages?: boolean;
	attachmentsFolder?: string; // Optional override for global attachments folder
}

/**
 * Learning module configuration (EPUB/PDF reading notes)
 */
export interface LearningModuleConfig extends BaseModuleConfig {
	highlightsFolder: string;
	annotationsFolder: string;
	sourcesFolder: string;
	highlightTemplate?: string;
	annotationTemplate?: string;
	processAnnotations?: boolean;
	annotationImagesFolder?: string;
	includeSummaryInAnnotation?: boolean;
	createCompositeImages?: boolean;
	downloadSourceFiles?: boolean; // Whether to download source files (.epub, .note) to Sources folder
}

/**
 * Paper module configuration (handwritten notes)
 */
export interface PaperModuleConfig extends BaseModuleConfig {
	notesFolder: string;
	noteTemplate?: string;
	preserveFolderStructure?: boolean;
}

/**
 * Daily module configuration (daily journal)
 */
export interface DailyModuleConfig extends BaseModuleConfig {
	dailyNotesFolder: string;
	dateFormat?: string;
	includeTaskData?: boolean;
}

/**
 * Meeting module configuration (meeting notes)
 */
export interface MeetingModuleConfig extends BaseModuleConfig {
	meetingsFolder: string;
	pagesFolder: string;
	resourcesFolder: string;
	meetingTemplate?: string;
	extractActionItems?: boolean;
}

/**
 * Picking module configuration (quick captures)
 */
export interface PickingModuleConfig extends BaseModuleConfig {
	capturesFolder: string;
	resourcesFolder: string;
	captureTemplate?: string;
	preserveLayout?: boolean;
	createCompositeImages?: boolean;
}

/**
 * Memo module configuration (text memos)
 */
export interface MemoModuleConfig extends BaseModuleConfig {
	memosFolder: string;
	memoTemplate?: string;
}

/**
 * Main Viwoods processor configuration with module-specific sections
 */
export interface ViwoodsProcessorConfig extends ProcessorConfig {
	// Module configurations
	learning: LearningModuleConfig;
	paper: PaperModuleConfig;
	daily: DailyModuleConfig;
	meeting: MeetingModuleConfig;
	picking: PickingModuleConfig;
	memo: MemoModuleConfig;

	// Viwoods-specific attachments folder (overrides global attachmentsFolder for Viwoods modules)
	viwoodsAttachmentsFolder?: string;

	// Legacy fields for backwards compatibility (deprecated)
	/** @deprecated Use learning.highlightsFolder instead */
	highlightsFolder?: string;
	/** @deprecated Use learning.annotationsFolder instead */
	annotationsFolder?: string;
	/** @deprecated Use learning.sourcesFolder instead */
	sourcesFolder?: string;
	/** @deprecated Use paper.pagesFolder instead */
	pagesFolder?: string;
	/** @deprecated Use learning.highlightTemplate instead */
	highlightTemplate?: string;
	/** @deprecated Use learning.annotationTemplate instead */
	annotationTemplate?: string;
	/** @deprecated Use paper.pageTemplate instead */
	pageTemplate?: string;
	/** @deprecated Use module-specific settings */
	includeMetadata?: boolean;
	/** @deprecated Use module-specific settings */
	includeThumbnail?: boolean;
	/** @deprecated Use module-specific settings */
	extractImages?: boolean;
	/** @deprecated Use module-specific settings */
	createIndex?: boolean;
	/** @deprecated Use learning.processAnnotations instead */
	processAnnotations?: boolean;
	/** @deprecated Use learning.annotationImagesFolder instead */
	annotationImagesFolder?: string;
	/** @deprecated Use learning.includeSummaryInAnnotation instead */
	includeSummaryInAnnotation?: boolean;
	/** @deprecated Use learning.createCompositeImages instead */
	createCompositeImages?: boolean;
}

/**
 * Common JSON file structures
 */

/**
 * HeaderInfo.json - Identifies which Viwoods app created the note
 */
export interface HeaderInfo {
	appVersion: string;
	dbVersion: number;
	packageName: string;
}

/**
 * NoteFileInfo.json - Used by Paper and Meeting modules
 */
export interface NoteFileInfo {
	author: string;
	creationTime: number;
	description: string;
	fileName: string;
	fileParentName: string;
	fileState: number;
	fileType: number;
	iconResource: number;
	id: string;
	isChecked: boolean;
	isShowMenu: boolean;
	lastModifiedTime: number;
	lastSyncTime: number;
	order: number;
	page: unknown[];
	pid: string;
	resource: unknown[];
	totalPageSize: number;
	uniqueId: string;
	userId: string;
}

/**
 * NotesBean.json - Used by Daily and Picking modules
 */
export interface NotesBean {
	noteId?: string;
	noteName?: string;
	createTime?: number;
	creationTime?: number;
	pageCount?: number;
	lastModifiedTime?: number;
	id?: string;
	// Daily-specific
	fileName?: string;
	fileType?: number;
	year?: number;
	month?: number;
	day?: number;
	lastTab?: string;
	taskPageCount?: number;
	taskLastPageIndex?: number;
	lastPageIndex?: number;
	isDelete?: boolean;
	// Picking-specific
	nickname?: string;
	currentPage?: number;
	userId?: string;
	lastEditDialogTime?: number;
	upTime?: number;
}

/**
 * NoteList.json - Used by Daily and Picking modules for page/image metadata
 */
export interface NoteListEntry {
	id: string;                // Image UUID
	fileName: string;          // Base filename
	pageFilePath: string;      // Original Android path
	isNote: number;            // 0 or 1
	creationTime: number;      // Unix timestamp
	lastModifiedTime: number;  // Unix timestamp
	pageOrder: number;         // Page ordering
	pageShotFilePath?: string; // Screenshot path (optional)
	offsetY?: string;          // Y offset (optional)
	fullPagePath?: string;     // Full path (optional)
	userId?: string;           // User ID (optional)
}

/**
 * PageListFileInfo.json - Array of page metadata
 */
export interface PageListFileInfo {
	author: string;
	creationTime: number;
	description: string;
	fileName: string;
	fileParentName: string;
	fileState: number;
	fileType: number;
	iconResource: number;
	id: string;
	isChecked: boolean;
	isShowMenu: boolean;
	lastModifiedTime: number;
	lastSyncTime: number;
	order: number;
	page: unknown[];
	pid: string;
	resource: unknown[];
	totalPageSize: number;
	uniqueId: string;
	userId: string;
}

/**
 * PageResource.json - Array of resource metadata
 */
export interface PageResource {
	bottom: number;
	creationTime: number;
	description: string;
	fileName: string;
	id: string;
	imageBoxPath?: string;
	isChecked: boolean;
	lastModifiedTime: number;
	lastSyncTime: number;
	left: number;
	nickname: string;
	noteId: string;
	order: number;
	pid: string;
	resourceState: number;
	resourceType: number;
	right: number;
	rotate: number;
	scale: number;
	screenHeight: number;
	screenWidth: number;
	top: number;
	uniqueId: string;
}

/**
 * Resource types enumeration
 */
export enum ResourceType {
	MAIN_BITMAP = 1,
	SCREENSHOT = 2,
	PATH_DATA = 7,
	ORDER_FILE = 8,
	THUMBNAIL = 9,
	BROWSING_HISTORY = 11,
}

/**
 * NoteList.json - Used by Daily and Picking modules
 */
export interface NoteList {
	creationTime: number;
	fileName: string;
	fullPagePath?: string;
	id: string;
	isNote?: number;
	lastModifiedTime: number;
	offsetY?: string;
	pageFilePath?: string;
	pageOrder?: number;
	pageShotFilePath?: string;
	userId?: string;
	// Picking-specific
	fixHeightHandWrite?: number;
	fixHeightLayer?: number;
	isChose?: boolean;
	noteId?: string;
	pageId?: string;
	pathFile?: string;
	pathOrder?: number;
	smallOrderId?: string;
}

/**
 * Layout structures for Picking module
 */
export interface LayoutText {
	[key: string]: unknown;
}

export interface LayoutImage {
	imgUrl?: string;
	isShow?: boolean;
	layHeight?: number;
	layId?: string;
	layType?: number;
	layWidth?: number;
	layX?: number;
	layY?: number;
	noteId?: string;
	pageId?: string;
	screenHeight?: number;
	screenWidth?: number;
	upTime?: number;
	word?: string;
}

/**
 * BookBean structure for EPUB metadata (Learning module)
 */
export interface BookBean {
	bookId: string;
	bookName: string;
	bookPath: string;
	[key: string]: unknown;
}

/**
 * ReadNoteBean structure for EPUB annotations (Learning module)
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
 * Highlight data structure from PageTextAnnotation (Learning module)
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

/**
 * FolderFileInfo.json - Folder metadata
 */
export interface FolderFileInfo {
	author: string;
	creationTime: number;
	description: string;
	fileName: string;
	fileParentName: string;
	fileState: number;
	fileType: number;
	iconResource: number;
	id: string;
	isChecked: boolean;
	isShowMenu: boolean;
	lastModifiedTime: number;
	lastSyncTime: number;
	order: number;
	page: unknown[];
	pid: string;
	resource: unknown[];
	totalPageSize: number;
	uniqueId: string;
	userId: string;
}

/**
 * Resolve the attachments folder for a Viwoods module
 * Hierarchy: module override > viwoodsAttachmentsFolder > global attachmentsFolder
 * @param moduleConfig Module-specific configuration (may contain attachmentsFolder override)
 * @param viwoodsConfig Full Viwoods processor configuration (contains viwoodsAttachmentsFolder)
 * @param context Processing context (contains global plugin settings)
 * @returns The attachments folder path
 */
export function getViwoodsAttachmentsFolder<T extends { attachmentsFolder?: string }>(
	moduleConfig: T,
	viwoodsConfig: ViwoodsProcessorConfig,
	context: { pluginSettings: { attachmentsFolder?: string } }
): string {
	// 1. Check module-specific override first
	if (moduleConfig.attachmentsFolder) {
		return moduleConfig.attachmentsFolder;
	}
	// 2. Check Viwoods-specific attachments folder
	if (viwoodsConfig.viwoodsAttachmentsFolder) {
		return viwoodsConfig.viwoodsAttachmentsFolder;
	}
	// 3. Fall back to global setting
	return context.pluginSettings.attachmentsFolder || "Attachments";
}
