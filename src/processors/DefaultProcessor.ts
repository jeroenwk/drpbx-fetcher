import { TFile } from "obsidian";
import { FileUtils } from "../utils/FileUtils";
import { StreamLogger } from "../utils/StreamLogger";
import {
	FileProcessor,
	ProcessorConfig,
	ProcessorContext,
	ProcessorResult,
	FileMetadata,
	ValidationResult,
	ConfigSchema,
	getAttachmentsFolder,
} from "./types";

/**
 * Configuration for DefaultProcessor
 */
export interface DefaultProcessorConfig extends ProcessorConfig {
	allowedExtensions?: string[]; // File extensions to process (if empty, auto-populates from routed file extension)
}

/**
 * Default processor that simply writes files as-is to the vault
 * Used when no specific processor is configured for a file type
 */
export class DefaultProcessor implements FileProcessor {
	readonly type = "default";
	readonly name = "Default (No Processing)";
	readonly description = "Downloads files without any processing";
	readonly supportedExtensions: string[] = ["*"]; // Matches all extensions (but filtered by allowedExtensions)

	async process(
		fileData: Uint8Array,
		originalPath: string,
		metadata: FileMetadata,
		config: ProcessorConfig,
		context: ProcessorContext
	): Promise<ProcessorResult> {
		try {
			const defaultConfig = config as DefaultProcessorConfig;

			// Get the file extension
			const fileExtension = metadata.name.split(".").pop()?.toLowerCase() || "";

			// Parse allowedExtensions - handle both array and comma-separated string formats
			let allowedExtensions: string[] = [];
			const exts = defaultConfig.allowedExtensions;
			if (Array.isArray(exts)) {
				allowedExtensions = exts;
			} else if (typeof exts === "string") {
				// eslint-disable-next-line @typescript-eslint/no-base-to-string
				allowedExtensions = String(exts).split(",").map((ext: string) => ext.trim().toLowerCase().replace(/^\./, ''));
			}

			// If no allowedExtensions configured, auto-populate with current file extension
			// Since this file was explicitly routed via FileTypeMapping, trust that routing
			if (allowedExtensions.length === 0) {
				allowedExtensions = [fileExtension];
				StreamLogger.log(`[DefaultProcessor] Auto-allowed extension from routing`, {
					filePath: originalPath,
					fileName: metadata.name,
					extension: fileExtension,
				});
			}

			// Check if this file type is allowed to be processed
			if (!allowedExtensions.includes(fileExtension) && !allowedExtensions.includes("*")) {
				StreamLogger.log(`[DefaultProcessor] Skipping file with extension '${fileExtension}' (not in allowed extensions: ${allowedExtensions.join(", ")})`, {
					filePath: originalPath,
					fileName: metadata.name,
				});
				return {
					success: false,
					createdFiles: [],
					errors: [`File type '${fileExtension}' is not configured to be processed by Default processor`],
				};
			}

			// Extract filename from path
			const pathParts = originalPath.split("/");
			const filename = pathParts[pathParts.length - 1];

			// Determine output path based on file type
			let outputPath: string;

			if (filename.endsWith('.md')) {
				// Markdown files go directly to basePath (folder mapping location)
				// If basePath is not set, fall back to root (same as original behavior for non-processed files)
				const basePath = context.basePath || "";
				const sanitizedFilename = FileUtils.sanitizeFilename(filename);
				outputPath = FileUtils.joinPath(basePath, sanitizedFilename);
			} else {
				// Binary files go to attachments folder
				const attachmentsFolder = getAttachmentsFolder(config, context);
				const sanitizedFilename = FileUtils.sanitizeFilename(filename);
				outputPath = FileUtils.joinPath(attachmentsFolder, sanitizedFilename);

				// Ensure parent directory exists for binary files
				if (attachmentsFolder) {
					await FileUtils.ensurePath(context.vault, attachmentsFolder);
				}
			}

			// Write file
			const existingFile = context.vault.getAbstractFileByPath(outputPath);
			if (existingFile instanceof TFile) {
				// Use modifyBinary to trigger Obsidian's file change detection
				await context.vault.modifyBinary(existingFile, fileData);
			} else {
				await context.vault.createBinary(outputPath, fileData);
			}

			return {
				success: true,
				createdFiles: [outputPath],
			};
		} catch (error) {
			return {
				success: false,
				createdFiles: [],
				errors: [`Failed to write file: ${error.message}`],
			};
		}
	}

	validateConfig(config: ProcessorConfig): ValidationResult {
		// Default processor has no required config
		return { valid: true };
	}

	getDefaultConfig(): DefaultProcessorConfig {
		return {
			allowedExtensions: [], // Empty by default - auto-populates from routed file extension
		};
	}

	getDefaultTemplates(): Record<string, string> {
		// Default processor doesn't use templates
		return {};
	}

	getConfigSchema(): ConfigSchema {
		return {
			fields: [
				{
					key: "allowedExtensions",
					label: "Allowed File Extensions",
					description: "File extensions to process (e.g., md, txt). Use '*' for all files. Audio files (mp4, mp3, m4a, wav) should NOT be included as they're handled by Viwoods processor.",
					type: "text",
					required: false,
					defaultValue: "md",
					placeholder: "md, txt, pdf",
				},
				{
					key: "attachmentsFolder",
					label: "Attachments Folder",
					description: "Override global attachments folder for unmatched file types",
					type: "folder",
					required: false,
					defaultValue: "",
					placeholder: "Leave empty to use global setting",
				},
			],
		};
	}
}
