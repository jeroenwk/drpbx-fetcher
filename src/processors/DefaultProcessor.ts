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

			// Determine output path
			const outputFolder = (config.outputFolder as string) || "";
			const sanitizedFilename = FileUtils.sanitizeFilename(filename);
			const outputPath = FileUtils.joinPath(outputFolder, sanitizedFilename);

			// Ensure parent directory exists
			if (outputFolder) {
				await FileUtils.ensurePath(context.vault, outputFolder);
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
		return {
			outputFolder: "",
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
					key: "outputFolder",
					label: "Output Folder",
					description: "Folder where files will be saved (relative to vault root)",
					type: "folder",
					required: false,
					defaultValue: "",
					placeholder: "Leave empty for vault root",
				},
			],
		};
	}
}
