import { TFile } from "obsidian";
import { FileUtils } from "../utils/FileUtils";
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
 * Default processor that simply writes files as-is to the vault
 * Used when no specific processor is configured for a file type
 */
export class DefaultProcessor implements FileProcessor {
	readonly type = "default";
	readonly name = "Default (No Processing)";
	readonly description = "Downloads files without any processing";
	readonly supportedExtensions: string[] = ["*"]; // Matches all extensions

	async process(
		fileData: Uint8Array,
		originalPath: string,
		metadata: FileMetadata,
		config: ProcessorConfig,
		context: ProcessorContext
	): Promise<ProcessorResult> {
		try {
			// Extract filename from path
			const pathParts = originalPath.split("/");
			const filename = pathParts[pathParts.length - 1];

			// Use global attachments folder for binary files
			const attachmentsFolder = getAttachmentsFolder(config, context);
			const sanitizedFilename = FileUtils.sanitizeFilename(filename);
			const outputPath = FileUtils.joinPath(attachmentsFolder, sanitizedFilename);

			// Ensure parent directory exists
			if (attachmentsFolder) {
				await FileUtils.ensurePath(context.vault, attachmentsFolder);
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

	getDefaultConfig(): ProcessorConfig {
		return {};
	}

	getDefaultTemplates(): Record<string, string> {
		// Default processor doesn't use templates
		return {};
	}

	getConfigSchema(): ConfigSchema {
		return {
			fields: [
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
