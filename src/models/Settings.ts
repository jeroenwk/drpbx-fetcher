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
};
