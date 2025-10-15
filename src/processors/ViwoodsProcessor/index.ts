import { StreamingZipUtils } from "../../utils/StreamingZipUtils";
import { StreamLogger } from "../../utils/StreamLogger";
import {
	FileProcessor,
	ProcessorConfig,
	ProcessorContext,
	ProcessorResult,
	FileMetadata,
	ValidationResult,
	ConfigSchema,
} from "../types";
import { ZipReader } from "@zip.js/zip.js";
import { ViwoodsProcessorConfig } from "./ViwoodsTypes";
import { HandwrittenNotesProcessor } from "./HandwrittenNotesProcessor";
import { EpubFormatProcessor } from "./EpubFormatProcessor";
import { TemplateDefaults } from "./TemplateDefaults";

/**
 * Processor for viwoods .note files (AIPaper format)
 */
export class ViwoodsProcessor implements FileProcessor {
	readonly type = "viwoods";
	readonly name = "Viwoods Notes";
	readonly description = "Process viwoods .note files";
	readonly supportedExtensions = ["note"];

	async process(
		fileData: Uint8Array,
		originalPath: string,
		metadata: FileMetadata,
		config: ProcessorConfig,
		context: ProcessorContext
	): Promise<ProcessorResult> {
		await StreamLogger.log(`[ViwoodsProcessor] Starting processing of ${metadata.name}`);
		await StreamLogger.log(`[ViwoodsProcessor] File size: ${fileData.length} bytes`);
		await StreamLogger.log(`[ViwoodsProcessor] Original path: ${originalPath}`);

		const viwoodsConfig = config as ViwoodsProcessorConfig;

		let zipReader: ZipReader<Blob> | null = null;

		try {
			await StreamLogger.log(`[ViwoodsProcessor] Loading ZIP file...`);

			// Create Blob from Uint8Array for streaming ZIP extraction
			await StreamLogger.log(`[ViwoodsProcessor] Creating Blob for streaming ZIP extraction`);
			const blob = new Blob([fileData]);

			// Load ZIP file using streaming
			zipReader = await StreamingZipUtils.loadZipFromBlob(blob);
			await StreamLogger.log(`[ViwoodsProcessor] ZIP file loaded successfully`);

			// Check which format this is by looking at file names
			const allFiles = await StreamingZipUtils.listFiles(zipReader);
			await StreamLogger.log(`[ViwoodsProcessor] Files in ZIP:`, { count: allFiles.length, files: allFiles });

			const hasEpubFormat = allFiles.some(f => f.includes("_BookBean.json") || f.includes("_ReadNoteBean.json"));
			await StreamLogger.log(`[ViwoodsProcessor] Format detected: ${hasEpubFormat ? 'EPUB' : 'Handwritten'}`);

			let result: ProcessorResult;

			if (hasEpubFormat) {
				await StreamLogger.log(`[ViwoodsProcessor] Processing as EPUB format...`);
				result = await EpubFormatProcessor.process(zipReader, fileData, originalPath, metadata, viwoodsConfig, context);
			} else {
				await StreamLogger.log(`[ViwoodsProcessor] Processing as handwritten format...`);
				result = await HandwrittenNotesProcessor.process(zipReader, fileData, originalPath, metadata, viwoodsConfig, context);
			}

			// Close ZIP reader
			await StreamingZipUtils.close(zipReader);

			return result;
		} catch (error: unknown) {
			// Ensure cleanup even on error
			if (zipReader) {
				try {
					await StreamingZipUtils.close(zipReader);
				} catch (cleanupError) {
					// Ignore cleanup errors
				}
			}

			const err = error as Error;
			return {
				success: false,
				createdFiles: [],
				errors: [`Failed to process viwoods note: ${err.message}`],
			};
		}
	}

	validateConfig(config: ProcessorConfig): ValidationResult {
		const viwoodsConfig = config as ViwoodsProcessorConfig;
		const errors: string[] = [];

		// At least one output folder must be specified
		if (
			!viwoodsConfig.highlightsFolder &&
			!viwoodsConfig.annotationsFolder &&
			!viwoodsConfig.pagesFolder &&
			!viwoodsConfig.sourcesFolder
		) {
			errors.push("At least one output folder must be specified");
		}

		return {
			valid: errors.length === 0,
			errors: errors.length > 0 ? errors : undefined,
		};
	}

	getDefaultConfig(): ViwoodsProcessorConfig {
		return {
			highlightsFolder: "Viwoods/Highlights",
			annotationsFolder: "Viwoods/Annotations",
			sourcesFolder: "Viwoods/Library",
			pagesFolder: "Viwoods/Pages",
			includeMetadata: true,
			includeThumbnail: true,
			extractImages: true,
			createIndex: true,
			processAnnotations: true,
			annotationImagesFolder: "Viwoods/Annotations/resources",
			includeSummaryInAnnotation: true,
			createCompositeImages: true,
		};
	}

	getDefaultTemplates(): Record<string, string> {
		const templates = TemplateDefaults.getAll();
		return {
			highlight: templates["viwoods-highlight.md"] || "",
			annotation: templates["viwoods-annotation.md"] || "",
			page: templates["viwoods-page.md"] || "",
		};
	}

	getConfigSchema(): ConfigSchema {
		return {
			fields: [
				{
					key: "highlightsFolder",
					label: "Highlights Folder",
					description: "Folder for highlight markdown files",
					type: "folder",
					required: false,
					defaultValue: "Viwoods/Highlights",
				},
				{
					key: "annotationsFolder",
					label: "Annotations Folder",
					description: "Folder for annotation markdown files",
					type: "folder",
					required: false,
					defaultValue: "Viwoods/Annotations",
				},
				{
					key: "sourcesFolder",
					label: "Sources Folder",
					description: "Folder for original .note files",
					type: "folder",
					required: false,
					defaultValue: "Viwoods/Library",
				},
				{
					key: "pagesFolder",
					label: "Pages Folder",
					description: "Folder for page images and markdown",
					type: "folder",
					required: false,
					defaultValue: "Viwoods/Pages",
				},
				{
					key: "highlightTemplate",
					label: "Highlight Template",
					description: "Path to custom template file (with .md extension). Leave empty to use default template.",
					type: "file",
					required: false,
					placeholder: "Example: Templates/Highlights.md",
				},
				{
					key: "annotationTemplate",
					label: "Annotation Template",
					description: "Path to custom template file (with .md extension). Leave empty to use default template.",
					type: "file",
					required: false,
					placeholder: "Example: Templates/Annotations.md",
				},
				{
					key: "pageTemplate",
					label: "Page Template",
					description: "Path to custom template file (with .md extension). Leave empty to use default template.",
					type: "file",
					required: false,
					placeholder: "Example: Templates/Pages.md",
				},
				{
					key: "includeMetadata",
					label: "Include Metadata",
					description: "Extract and include HeaderInfo.json data",
					type: "boolean",
					defaultValue: true,
				},
				{
					key: "includeThumbnail",
					label: "Include Thumbnail",
					description: "Extract and save thumbnail image",
					type: "boolean",
					defaultValue: true,
				},
				{
					key: "extractImages",
					label: "Extract Images",
					description: "Extract page images from note",
					type: "boolean",
					defaultValue: true,
				},
				{
					key: "createIndex",
					label: "Create Index",
					description: "Create an index file linking all content",
					type: "boolean",
					defaultValue: true,
				},
				{
					key: "processAnnotations",
					label: "Process Annotations",
					description: "Extract and process handwritten annotations from ReadNoteBean.json (EPUB format)",
					type: "boolean",
					defaultValue: true,
				},
				{
					key: "annotationImagesFolder",
					label: "Annotation Images Folder",
					description: "Folder for annotation images.",
					type: "folder",
					required: false,
					defaultValue: "Viwoods/Annotations/resources",
				},
				{
					key: "includeSummaryInAnnotation",
					label: "Include Summary Text",
					description: "Include annotation summary text in markdown files",
					type: "boolean",
					defaultValue: true,
				},
				{
					key: "createCompositeImages",
					label: "Create Composite Images",
					description: "Combine page image (JPG) with annotation overlay (PNG). If disabled, only PNG will be saved.",
					type: "boolean",
					defaultValue: true,
				},
			],
		};
	}
}

// Export types
export * from "./ViwoodsTypes";
