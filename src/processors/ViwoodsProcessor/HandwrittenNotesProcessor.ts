import { ZipReader } from "@zip.js/zip.js";
import { FileUtils } from "../../utils/FileUtils";
import { StreamingZipUtils } from "../../utils/StreamingZipUtils";
import { StreamLogger } from "../../utils/StreamLogger";
import { TemplateEngine } from "../templates/TemplateEngine";
import { ProcessorContext, ProcessorResult, FileMetadata } from "../types";
import { ViwoodsProcessorConfig, NotesBean, LayoutText, LayoutImage } from "./ViwoodsTypes";
import { TemplateDefaults } from "./TemplateDefaults";

/**
 * Handles processing of handwritten notes format
 */
export class HandwrittenNotesProcessor {
	/**
	 * Process handwritten notes format
	 */
	public static async process(
		zipReader: ZipReader<Blob>,
		fileData: Uint8Array,
		originalPath: string,
		metadata: FileMetadata,
		config: ViwoodsProcessorConfig,
		context: ProcessorContext
	): Promise<ProcessorResult> {
		const createdFiles: string[] = [];
		const errors: string[] = [];
		const warnings: string[] = [];

		try {
			// Parse JSON files
			const notesBean = await StreamingZipUtils.extractJson<NotesBean>(zipReader, "NotesBean.json");
			const layoutText = await StreamingZipUtils.extractJson<LayoutText>(zipReader, "LayoutText.json");
			const layoutImage = await StreamingZipUtils.extractJson<LayoutImage>(zipReader, "LayoutImage.json");

			if (!notesBean) {
				errors.push("Failed to parse NotesBean.json - file may be corrupt. This might be a different .note format.");
				return { success: false, createdFiles, errors };
			}

			// Extract basic info
			const noteName = notesBean.noteName || FileUtils.getBasename(metadata.name);
			const noteSlug = FileUtils.slugify(noteName);
			const totalPages = notesBean.pageCount || 0;
			const createTime = notesBean.createTime || metadata.client_modified;

			// Ensure output folders exist
			await this.ensureFolders(context, config);

			// Extract source file if requested and enabled in settings
			let sourceLink = "";
			if (config.sourcesFolder && context.pluginSettings.downloadSourceFiles) {
				const sourcePath = FileUtils.joinPath(
					config.sourcesFolder,
					`${noteSlug}.note`
				);
				await context.vault.adapter.writeBinary(sourcePath, fileData.buffer);
				createdFiles.push(sourcePath);
				sourceLink = sourcePath;
			}

			// Extract thumbnail if requested
			if (config.includeThumbnail) {
				const thumbnail = await StreamingZipUtils.extractFile(zipReader, "thumbnai.png"); // Note: misspelling in spec
				if (thumbnail) {
					const thumbPath = FileUtils.joinPath(
						config.pagesFolder,
						`${noteSlug}-thumbnail.png`
					);
					await context.vault.adapter.writeBinary(thumbPath, thumbnail.buffer);
					createdFiles.push(thumbPath);
				}
			}

			// Process each page
			for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
				try {
					// Extract page image
					const pageImageFile = `${pageNum}.png`;
					let pageImagePath = "";

					if (await StreamingZipUtils.fileExists(zipReader, pageImageFile)) {
						const imageData = await StreamingZipUtils.extractFile(zipReader, pageImageFile);
						if (imageData && config.extractImages) {
							pageImagePath = FileUtils.joinPath(
								config.pagesFolder,
								`${noteSlug}-page-${pageNum}.png`
							);
							await context.vault.adapter.writeBinary(pageImagePath, imageData.buffer);
							createdFiles.push(pageImagePath);
						}
					}

					// Check for handwriting data
					const pathFile = `PATH_${pageNum}.json`;
					const hasHandwriting = await StreamingZipUtils.fileExists(zipReader, pathFile);
					let strokeCount = 0;
					let pointCount = 0;

					if (hasHandwriting) {
						const pathData = await StreamingZipUtils.extractJson<unknown[]>(zipReader, pathFile);
						if (pathData && Array.isArray(pathData)) {
							strokeCount = pathData.length;
							pointCount = pathData.reduce((sum: number, stroke) => {
								if (Array.isArray(stroke)) {
									return sum + stroke.length;
								}
								return sum;
							}, 0);
						}

						// Generate highlight file
						if (config.highlightsFolder) {
							const highlightFile = await this.generateHighlight(
								context,
								config,
								{
									noteName,
									noteTitle: noteName,
									noteSlug,
									pageNumber: pageNum,
									totalPages,
									createTime,
									sourceLink,
									pageImagePath,
									strokeCount,
									pointCount,
								}
							);
							if (highlightFile) {
								createdFiles.push(highlightFile);
							}
						}
					}

					// Check for text annotations
					const hasText = layoutText && Object.keys(layoutText).length > 0;
					const hasImages = layoutImage && Object.keys(layoutImage).length > 0;

					// Generate annotation file if there's text
					if (hasText && config.annotationsFolder) {
						const annotationFile = await this.generateAnnotation(
							context,
							config,
							{
								noteName,
								noteTitle: noteName,
								noteSlug,
								pageNumber: pageNum,
								totalPages,
								sourceLink,
								textContent: JSON.stringify(layoutText, null, 2),
							}
						);
						if (annotationFile) {
							createdFiles.push(annotationFile);
						}
					}

					// Generate page file if requested
					if (config.pagesFolder && config.createIndex) {
						const pageFile = await this.generatePage(
							context,
							config,
							{
								noteName,
								noteTitle: noteName,
								noteSlug,
								pageNumber: pageNum,
								totalPages,
								createTime,
								sourceLink,
								pageImagePath,
								hasHandwriting,
								strokeCount,
								hasText,
								textContent: hasText ? JSON.stringify(layoutText, null, 2) : "",
								hasImages,
								imageCount: hasImages ? Object.keys(layoutImage).length : 0,
							}
						);
						if (pageFile) {
							createdFiles.push(pageFile);
						}
					}
				} catch (pageError: Error | unknown) {
					const err = pageError as Error;
					errors.push(`Error processing page ${pageNum}: ${err.message}`);
				}
			}

			// Create index file if requested
			if (config.createIndex && createdFiles.length > 0) {
				const indexPath = await this.generateIndex(
					context,
					config,
					{
						noteName,
						noteTitle: noteName,
						noteSlug,
						totalPages,
						createTime,
						createdFiles,
					}
				);
				if (indexPath) {
					createdFiles.push(indexPath);
				}
			}

			return {
				success: errors.length === 0,
				createdFiles,
				errors: errors.length > 0 ? errors : undefined,
				warnings: warnings.length > 0 ? warnings : undefined,
			};
		} catch (error: Error | unknown) {
			const err = error as Error;
			return {
				success: false,
				createdFiles,
				errors: [`Failed to process handwritten note: ${err.message}`],
			};
		}
	}

	private static async ensureFolders(context: ProcessorContext, config: ViwoodsProcessorConfig): Promise<void> {
		const folders = [
			config.highlightsFolder,
			config.annotationsFolder,
			config.sourcesFolder,
			config.pagesFolder,
		].filter((f) => f && f.length > 0);

		for (const folder of folders) {
			await FileUtils.ensurePath(context.vault, folder);
		}
	}

	private static async generateHighlight(
		context: ProcessorContext,
		config: ViwoodsProcessorConfig,
		data: Record<string, unknown>
	): Promise<string | null> {
		try {
			const defaultTemplate = await TemplateDefaults.load("viwoods-highlight.md");
			const template = await context.templateResolver.resolve(config.highlightTemplate, defaultTemplate);
			const content = TemplateEngine.render(template, data);

			const filename = `${data.noteSlug}-page-${data.pageNumber}-highlight.md`;
			const filepath = FileUtils.joinPath(config.highlightsFolder, filename);

			await StreamLogger.log(`[HandwrittenNotesProcessor.generateHighlight] Creating highlight file`, {
				highlightsFolder: config.highlightsFolder,
				filename,
				fullPath: filepath,
				contentLength: content.length
			});
			await context.vault.adapter.write(filepath, content);
			await StreamLogger.log(`[HandwrittenNotesProcessor.generateHighlight] Highlight file created successfully: ${filepath}`);
			return filepath;
		} catch (error) {
			console.error("Failed to generate highlight:", error);
			return null;
		}
	}

	private static async generateAnnotation(
		context: ProcessorContext,
		config: ViwoodsProcessorConfig,
		data: Record<string, unknown>
	): Promise<string | null> {
		try {
			const defaultTemplate = await TemplateDefaults.load("viwoods-annotation.md");
			const template = await context.templateResolver.resolve(config.annotationTemplate, defaultTemplate);
			const content = TemplateEngine.render(template, data);

			const filename = `${data.noteSlug}-page-${data.pageNumber}-annotation.md`;
			const filepath = FileUtils.joinPath(config.annotationsFolder, filename);

			await StreamLogger.log(`[HandwrittenNotesProcessor.generateAnnotation] Creating annotation file`, {
				annotationsFolder: config.annotationsFolder,
				filename,
				fullPath: filepath,
				contentLength: content.length
			});
			await context.vault.adapter.write(filepath, content);
			await StreamLogger.log(`[HandwrittenNotesProcessor.generateAnnotation] Annotation file created successfully: ${filepath}`);
			return filepath;
		} catch (error) {
			console.error("Failed to generate annotation:", error);
			return null;
		}
	}

	private static async generatePage(
		context: ProcessorContext,
		config: ViwoodsProcessorConfig,
		data: Record<string, unknown>
	): Promise<string | null> {
		try {
			const defaultTemplate = await TemplateDefaults.load("viwoods-page.md");
			const template = await context.templateResolver.resolve(config.pageTemplate, defaultTemplate);
			const content = TemplateEngine.render(template, data);

			const filename = `${data.noteSlug}-page-${data.pageNumber}.md`;
			const filepath = FileUtils.joinPath(config.pagesFolder, filename);

			await StreamLogger.log(`[HandwrittenNotesProcessor.generatePage] Creating page file`, {
				pagesFolder: config.pagesFolder,
				filename,
				fullPath: filepath,
				contentLength: content.length
			});
			await context.vault.adapter.write(filepath, content);
			await StreamLogger.log(`[HandwrittenNotesProcessor.generatePage] Page file created successfully: ${filepath}`);
			return filepath;
		} catch (error) {
			console.error("Failed to generate page:", error);
			return null;
		}
	}

	private static async generateIndex(
		context: ProcessorContext,
		config: ViwoodsProcessorConfig,
		data: Record<string, unknown>
	): Promise<string | null> {
		try {
			const content = `# ${data.noteTitle}

**Created:** ${data.createTime}
**Total Pages:** ${data.totalPages}

## Files Created

${(data.createdFiles as string[]).map((f) => `- [[${f}]]`).join("\n")}

---
#Viwoods/${data.noteSlug} #index
`;

			const filename = `${data.noteSlug}-index.md`;
			const filepath = FileUtils.joinPath(config.pagesFolder, filename);

			await context.vault.adapter.write(filepath, content);
			return filepath;
		} catch (error) {
			console.error("Failed to generate index:", error);
			return null;
		}
	}
}
