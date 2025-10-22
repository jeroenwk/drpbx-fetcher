import { ProcessorConfig } from "../processors/types";

/**
 * Folder mapping configuration
 */
export interface FolderMapping {
	remotePath: string;
	localPath: string;
}

/**
 * File type mapping configuration for processors
 */
export interface FileTypeMapping {
	id: string; // Unique ID for this mapping
	extension: string; // File extension without dot, e.g., "note"
	processorType: string; // Processor type identifier, e.g., "viwoods"
	enabled: boolean; // Whether this mapping is active
	config: ProcessorConfig; // Processor-specific configuration
}

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
}

/**
 * Main plugin settings
 */
export interface DrpbxFetcherSettings {
	accessToken: string;
	refreshToken: string;
	clientId: string;
	codeVerifier: string;
	folderMappings: FolderMapping[];
	fileTypeMappings: FileTypeMapping[];
	skippedExtensions: string[]; // File extensions to skip (not download or process)
	processedFiles: Record<string, number>; // Dropbox file.id -> file.size (tracks processed files)
	// Mobile auth state
	authInProgress: boolean;
	// Fetch settings
	syncOnStartup: boolean; // Whether to fetch automatically on startup
	syncStartupDelay: number; // Delay in milliseconds before starting fetch (default 3000)
	// Logging settings
	loggerType: 'console' | 'stream'; // Logger type: console or network stream
	streamLogHost: string; // Host for stream logger (default: "localhost")
	streamLogPort: number; // Port for stream logger (default: 3000)
	// Mobile file size limit
	maxFileSizeMobile: number; // Maximum file size in bytes for mobile platforms (default: 10MB)
	// Chunked download settings
	chunkSizeBytes: number; // Chunk size for large file downloads (default: 2MB)
	chunkedDownloadThreshold: number; // File size threshold to use chunked download (default: 10MB)
	// Viwoods note metadata removed - now stored in separate file
	// viwoodsNoteMetadata: Record<string, ViwoodsNoteMetadata>; // Key: markdown file path
}

/**
 * Default settings
 */
export const DEFAULT_SETTINGS: DrpbxFetcherSettings = {
	accessToken: "",
	refreshToken: "",
	clientId: "",
	codeVerifier: "",
	folderMappings: [],
	fileTypeMappings: [],
	skippedExtensions: [],
	processedFiles: {},
	authInProgress: false,
	syncOnStartup: false, // Default off
	syncStartupDelay: 3000, // 3 seconds
	loggerType: 'console', // Default to console logging
	streamLogHost: 'localhost', // Default host
	streamLogPort: 3000, // Default port
	maxFileSizeMobile: 10 * 1024 * 1024, // 10 MB default for mobile
	chunkSizeBytes: 2 * 1024 * 1024, // 2 MB chunks
	chunkedDownloadThreshold: 10 * 1024 * 1024, // Use chunked download for files >10 MB
	// viwoodsNoteMetadata removed - stored in separate file
};
