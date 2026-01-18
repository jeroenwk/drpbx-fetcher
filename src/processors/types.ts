import { App, Vault } from "obsidian";
import { files } from "dropbox";
import type { DrpbxFetcherSettings } from "../models/Settings";

/**
 * Base configuration interface for all processors
 */
export interface ProcessorConfig {
	[key: string]: unknown;
}

/**
 * Validation result for processor configuration
 */
export interface ValidationResult {
	valid: boolean;
	errors?: string[];
	warnings?: string[];
}

/**
 * Context provided to processors during file processing
 */
export interface ProcessorContext {
	vault: Vault;
	app: App;
	templateResolver: TemplateResolver;
	pluginSettings: DrpbxFetcherSettings;
	/** Base path from folder mapping where files should be written */
	basePath?: string;
	/** Optional template configuration passed to templates (e.g., dropboxFileId) */
	templateConfig?: Record<string, unknown>;
}

/**
 * Result of a processor's file processing operation
 */
export interface ProcessorResult {
	success: boolean;
	createdFiles: string[];
	errors?: string[];
	warnings?: string[];
}

/**
 * File metadata from Dropbox
 */
export type FileMetadata = files.FileMetadata;

/**
 * Configuration schema field types for UI generation
 */
export type ConfigFieldType = "text" | "folder" | "file" | "boolean" | "number" | "select" | "button" | "progress" | "info";

/**
 * Configuration schema field definition
 */
export interface ConfigField {
	key: string;
	label: string;
	description?: string;
	type: ConfigFieldType;
	required?: boolean;
	defaultValue?: unknown;
	placeholder?: string;
	options?: { value: string; label: string }[]; // For select type
	group?: string; // Optional group name for organizing fields into collapsible sections
	groupToggleKey?: string; // Key to check if group should be shown (e.g., "learning.enabled")
	buttonText?: string; // For button type - text to display on the button
	buttonAction?: string; // For button type - action identifier for the processor to handle
	/** For progress type - key in config that holds the currently selected value (e.g., "llm.model") */
	progressSourceKey?: string;
}

/**
 * Configuration schema for a processor
 */
export interface ConfigSchema {
	fields: ConfigField[];
}

/**
 * Template resolver interface for loading and caching templates
 */
export interface TemplateResolver {
	/**
	 * Resolve a template by path (custom) or use default
	 * @param customPath Optional custom template path in vault
	 * @param defaultTemplate Default template content
	 * @returns Template content
	 */
	resolve(customPath: string | undefined, defaultTemplate: string): Promise<string>;

	/**
	 * Clear template cache
	 */
	clearCache(): void;
}

/**
 * Processor capability flags for UI customization
 * Allows processors to declare special behaviors without hardcoded checks
 */
export interface ProcessorCapabilities {
	/**
	 * Processor handles multiple extensions internally
	 * If true, the "Edit Extension" button will be hidden in settings UI
	 */
	multiExtension?: boolean;

	/**
	 * Custom placeholder for a specific config field
	 * Allows processors to indicate which field needs a dynamic placeholder
	 * The UI code will look up the actual value from appropriate source
	 */
	customPlaceholder?: { field: string; value?: string };
}

/**
 * Core FileProcessor interface that all processors must implement
 */
export interface FileProcessor {
	/**
	 * Unique identifier for this processor type
	 */
	readonly type: string;

	/**
	 * Human-readable name for UI display
	 */
	readonly name: string;

	/**
	 * Description of what this processor does
	 */
	readonly description: string;

	/**
	 * File extensions this processor handles (without dot)
	 */
	readonly supportedExtensions: string[];

	/**
	 * Process a file and write output to vault
	 * @param fileData Binary data of the downloaded file
	 * @param originalPath Original Dropbox path
	 * @param metadata File metadata from Dropbox
	 * @param config Processor-specific configuration
	 * @param context Processing context (vault, app, template resolver)
	 * @returns Processing result with created files and any errors
	 */
	process(
		fileData: Uint8Array,
		originalPath: string,
		metadata: FileMetadata,
		config: ProcessorConfig,
		context: ProcessorContext
	): Promise<ProcessorResult>;

	/**
	 * Validate processor configuration
	 * @param config Configuration to validate
	 * @returns Validation result
	 */
	validateConfig(config: ProcessorConfig): ValidationResult;

	/**
	 * Get default configuration for this processor
	 * @returns Default configuration object
	 */
	getDefaultConfig(): ProcessorConfig;

	/**
	 * Get default templates for this processor
	 * @returns Map of template names to template content
	 */
	getDefaultTemplates(): Record<string, string>;

	/**
	 * Get configuration schema for UI generation
	 * @returns Configuration schema
	 */
	getConfigSchema(): ConfigSchema;

	/**
	 * Optional: Check if a file should be skipped before download
	 * Allows processors to implement early filtering optimizations
	 * @param filePath Original Dropbox path
	 * @param metadata File metadata from Dropbox
	 * @param config Processor configuration
	 * @returns Object with shouldSkip boolean and optional reason
	 */
	shouldSkipFile?(
		filePath: string,
		metadata: FileMetadata,
		config: ProcessorConfig
	): { shouldSkip: boolean; reason?: string };

	/**
	 * Optional: Check if processor should handle this file based on path
	 * Allows processors to claim files by path patterns (beyond extension matching)
	 * @param filePath Original Dropbox path
	 * @param fileExtension File extension (lowercase, without dot)
	 * @param config Processor configuration
	 * @returns true if this processor should handle the file
	 */
	canHandleFile?(
		filePath: string,
		fileExtension: string,
		config: ProcessorConfig
	): boolean;

	/**
	 * Optional: Get processor capability flags for UI customization
	 * Allows processors to declare special behaviors without hardcoded checks
	 * @returns Processor capabilities
	 */
	getCapabilities?(): ProcessorCapabilities;

	/**
	 * Optional: Handle button actions from configuration UI
	 * Called when a button field is clicked in the processor configuration modal
	 * @param action Action identifier from buttonAction field
	 * @param context Processing context (vault, app, etc.)
	 * @param options Optional options including progress callback and current form values
	 * @returns Promise that resolves when action is complete
	 */
	handleButtonAction?(
		action: string,
		context: ProcessorContext,
		options?: ButtonActionOptions
	): Promise<void>;
}

/**
 * Options for handleButtonAction
 */
export interface ButtonActionOptions {
	/** Callback to report progress (0.0-1.0) and status message */
	onProgress?: (progress: number, status: string) => void;
	/** Current form values (useful for accessing selected options) */
	formValues?: ProcessorConfig;
}

/**
 * Resolve the attachments folder for a processor
 * Checks processor-specific override first, then falls back to global setting
 * @param config Processor configuration (may contain attachmentsFolder override)
 * @param context Processing context (contains global plugin settings)
 * @returns The attachments folder path
 */
export function getAttachmentsFolder<T extends { attachmentsFolder?: string }>(
	config: T,
	context: ProcessorContext
): string {
	// Check processor-specific override first
	if (config.attachmentsFolder) {
		return config.attachmentsFolder;
	}
	// Fall back to global setting
	return context.pluginSettings.attachmentsFolder || "Attachments";
}
