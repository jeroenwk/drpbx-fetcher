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
	// Sync settings
	syncOnStartup: boolean; // Whether to sync automatically on startup
	syncStartupDelay: number; // Delay in milliseconds before starting sync (default 3000)
	// Logging settings
	loggerType: 'console' | 'stream'; // Logger type: console or network stream
	streamLogHost: string; // Host for stream logger (default: "localhost")
	streamLogPort: number; // Port for stream logger (default: 3000)
	// Mobile file size limit
	maxFileSizeMobile: number; // Maximum file size in bytes for mobile platforms (default: 10MB)
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
};
