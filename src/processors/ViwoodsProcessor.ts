import { FileUtils } from "../utils/FileUtils";
import { StreamingZipUtils } from "../utils/StreamingZipUtils";
import { TemplateEngine } from "./templates/TemplateEngine";
import { StreamLogger } from "../utils/StreamLogger";
import {
	FileProcessor,
	ProcessorConfig,
	ProcessorContext,
	ProcessorResult,
	FileMetadata,
	ValidationResult,
	ConfigSchema,
} from "./types";
import { ZipReader } from "@zip.js/zip.js";
import { files } from "dropbox";

/**
 * Configuration for viwoods processor
 */
export interface ViwoodsProcessorConfig extends ProcessorConfig {
	highlightsFolder: string;
	annotationsFolder: string;
	sourcesFolder: string;
	pagesFolder: string;
	highlightTemplate?: string;
	annotationTemplate?: string;
	pageTemplate?: string;
	includeMetadata: boolean;
	includeThumbnail: boolean;
	extractImages: boolean;
	createIndex: boolean;
	// Annotation processing options
	processAnnotations?: boolean;
	annotationImagesFolder?: string;
	includeSummaryInAnnotation?: boolean;
	createCompositeImages?: boolean;
}

/**
 * viwoods .note file structures
 */
interface NotesBean {
	noteId?: string;
	noteName?: string;
	createTime?: string;
	pageCount?: number;
}

interface LayoutText {
	[key: string]: unknown;
}

interface LayoutImage {
	[key: string]: unknown;
}

/**
 * ReadNoteBean structure for EPUB annotations
 */
interface ReadNoteBean {
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
		const createdFiles: string[] = [];
		const errors: string[] = [];
		const warnings: string[] = [];

		let zipReader: ZipReader<Blob> | null = null;

		try {
			await StreamLogger.log(`[ViwoodsProcessor] Loading ZIP file...`);

			// Create Blob from Uint8Array for streaming ZIP extraction
			// Note: The data is already in memory, so we just wrap it in a Blob
			// This allows zip.js to use streaming extraction instead of loading entire ZIP
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

			if (hasEpubFormat) {
				await StreamLogger.log(`[ViwoodsProcessor] Processing as EPUB format...`);
				// EPUB reader format - use different processing
				const result = await this.processEpubFormat(zipReader, fileData, originalPath, metadata, viwoodsConfig, context);

				// Close ZIP reader
				await StreamingZipUtils.close(zipReader);

				return result;
			}

			// Original handwritten notes format
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
			await this.ensureFolders(context, viwoodsConfig);

			// Extract source file if requested
			let sourceLink = "";
			if (viwoodsConfig.sourcesFolder) {
				const sourcePath = FileUtils.joinPath(
					viwoodsConfig.sourcesFolder,
					`${noteSlug}.note`
				);
				await context.vault.adapter.writeBinary(sourcePath, fileData);
				createdFiles.push(sourcePath);
				sourceLink = sourcePath;
			}

			// Extract thumbnail if requested
			if (viwoodsConfig.includeThumbnail) {
				const thumbnail = await StreamingZipUtils.extractFile(zipReader, "thumbnai.png"); // Note: misspelling in spec
				if (thumbnail) {
					const thumbPath = FileUtils.joinPath(
						viwoodsConfig.pagesFolder,
						`${noteSlug}-thumbnail.png`
					);
					await context.vault.adapter.writeBinary(thumbPath, thumbnail);
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
						if (imageData && viwoodsConfig.extractImages) {
							pageImagePath = FileUtils.joinPath(
								viwoodsConfig.pagesFolder,
								`${noteSlug}-page-${pageNum}.png`
							);
							await context.vault.adapter.writeBinary(pageImagePath, imageData);
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
							pointCount = pathData.reduce((sum, stroke) => {
								if (Array.isArray(stroke)) {
									return sum + stroke.length;
								}
								return sum;
							}, 0);
						}

						// Generate highlight file
						if (viwoodsConfig.highlightsFolder) {
							const highlightFile = await this.generateHighlight(
								context,
								viwoodsConfig,
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
					if (hasText && viwoodsConfig.annotationsFolder) {
						const annotationFile = await this.generateAnnotation(
							context,
							viwoodsConfig,
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
					if (viwoodsConfig.pagesFolder && viwoodsConfig.createIndex) {
						const pageFile = await this.generatePage(
							context,
							viwoodsConfig,
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
				} catch (pageError: any) {
					errors.push(`Error processing page ${pageNum}: ${pageError.message}`);
				}
			}

			// Create index file if requested
			if (viwoodsConfig.createIndex && createdFiles.length > 0) {
				const indexPath = await this.generateIndex(
					context,
					viwoodsConfig,
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

			// Close ZIP reader
			if (zipReader) {
				await StreamingZipUtils.close(zipReader);
			}

			return {
				success: errors.length === 0,
				createdFiles,
				errors: errors.length > 0 ? errors : undefined,
				warnings: warnings.length > 0 ? warnings : undefined,
			};
		} catch (error: any) {
			// Ensure cleanup even on error
			if (zipReader) {
				try {
					await StreamingZipUtils.close(zipReader);
				} catch (cleanupError) {
					// Ignore cleanup errors
				}
			}

			return {
				success: false,
				createdFiles,
				errors: [`Failed to process viwoods note: ${error.message}`],
			};
		}
	}

	private async processEpubFormat(
		zipReader: ZipReader<Blob>,
		fileData: Uint8Array,
		originalPath: string,
		metadata: files.FileMetadata,
		config: ViwoodsProcessorConfig,
		context: ProcessorContext
	): Promise<ProcessorResult> {
		await StreamLogger.log(`[ViwoodsProcessor.processEpubFormat] Starting EPUB format processing`);
		const createdFiles: string[] = [];
		const errors: string[] = [];

		try {
			// Find the JSON files (they have prefix based on book name)
			await StreamLogger.log(`[ViwoodsProcessor.processEpubFormat] Looking for JSON files in ZIP...`);
			const allFiles = await StreamingZipUtils.listFiles(zipReader);
			const pageTextAnnotationFile = allFiles.find(f => f.endsWith("_PageTextAnnotation.json"));
			const bookBeanFile = allFiles.find(f => f.endsWith("_BookBean.json"));
			const epubFile = allFiles.find(f => f.endsWith(".epub"));

			await StreamLogger.log(`[ViwoodsProcessor.processEpubFormat] Found files:`, {
				pageTextAnnotationFile,
				bookBeanFile,
				epubFile
			});

			if (!pageTextAnnotationFile) {
				await StreamLogger.error("No PageTextAnnotation.json found in EPUB note file");
				errors.push("No PageTextAnnotation.json found in EPUB note file");
				return { success: false, createdFiles, errors };
			}

			// Extract highlights
			await StreamLogger.log(`[ViwoodsProcessor.processEpubFormat] Extracting highlights from ${pageTextAnnotationFile}...`);
			const highlights = await StreamingZipUtils.extractJson<Array<{
				bookName: string;
				chapterName: string;
				rootChapterName: string;
				chapterLinkUri: string;
				rawText: string;
				pageIndex: number;
				pageCount: number;
				createTime: number;
			}>>(zipReader, pageTextAnnotationFile);

			await StreamLogger.log(`[ViwoodsProcessor.processEpubFormat] Extracted highlights:`, {
				count: highlights?.length || 0
			});

			if (!highlights || highlights.length === 0) {
				await StreamLogger.error("No highlights found in note file");
				errors.push("No highlights found in note file");
				return { success: false, createdFiles, errors };
			}

			const bookName = highlights[0].bookName;
			const bookSlug = FileUtils.slugify(bookName);
			const totalPages = highlights[0].pageCount;

			await StreamLogger.log(`[ViwoodsProcessor.processEpubFormat] Book info:`, {
				bookName,
				bookSlug,
				totalPages
			});

			// Extract EPUB file if configured
			let epubPath = "";
			if (epubFile && config.sourcesFolder) {
				await StreamLogger.log(`[ViwoodsProcessor.processEpubFormat] Extracting EPUB file: ${epubFile}`);
				const epubData = await StreamingZipUtils.extractFile(zipReader, epubFile);
				if (epubData) {
					epubPath = FileUtils.joinPath(config.sourcesFolder, `${bookSlug}.epub`);
					await StreamLogger.log(`[ViwoodsProcessor.processEpubFormat] Creating folder: ${config.sourcesFolder}`);
					await FileUtils.ensurePath(context.vault, config.sourcesFolder);
					await context.vault.adapter.writeBinary(epubPath, epubData);
					createdFiles.push(epubPath);
				}
			}

			// Generate highlight for each annotation
			await StreamLogger.log(`[ViwoodsProcessor.processEpubFormat] Creating highlights folder: ${config.highlightsFolder}`);
			await FileUtils.ensurePath(context.vault, config.highlightsFolder);

			await StreamLogger.log(`[ViwoodsProcessor.processEpubFormat] Processing ${highlights.length} highlights...`);
			for (let i = 0; i < highlights.length; i++) {
				const highlight = highlights[i];
				await StreamLogger.log(`[ViwoodsProcessor.processEpubFormat] Processing highlight ${i + 1}/${highlights.length}`);
				const dateHighlighted = new Date(highlight.createTime * 1000);

				// Build location string
				const location = highlight.rootChapterName
					? `${highlight.rootChapterName} → ${highlight.chapterName}`
					: highlight.chapterName;

				// Build EPUB link
				const epubLink = epubPath
					? `${epubPath}#${highlight.chapterLinkUri}`
					: highlight.chapterLinkUri;

				const highlightData = {
					bookName: highlight.bookName,
					noteTitle: highlight.bookName,
					bookSlug,
					location,
					chapterName: highlight.chapterName,
					rootChapterName: highlight.rootChapterName,
					pageNumber: highlight.pageIndex,
					totalPages,
					dateHighlighted: TemplateEngine.formatDate(dateHighlighted, "YYYY-MM-DD"),
					sourceLink: epubLink,
					highlightText: highlight.rawText,
				};

				const defaultTemplate = `## {{bookName}}

**Location:** {{location}}
**Page:** {{pageNumber}}/{{totalPages}}
**Date highlighted:** {{dateHighlighted}}
**Source:** [Open in EPUB]({{sourceLink}})

---

> {{highlightText}}

### Notes

*Add your thoughts here*

---
#highlight #book/{{bookSlug}}
`;

				const template = await context.templateResolver.resolve(
					config.highlightTemplate,
					defaultTemplate
				);
				const content = TemplateEngine.render(template, highlightData, dateHighlighted);

				const filename = `${bookSlug}-highlight-${i + 1}.md`;
				const filepath = FileUtils.joinPath(config.highlightsFolder, filename);

				// Only write if file doesn't exist (preserve user edits to existing highlights)
				const existingFile = context.vault.getAbstractFileByPath(filepath);
				if (!existingFile) {
					await context.vault.adapter.write(filepath, content);
					createdFiles.push(filepath);
				} else {
					console.log(`Preserving existing highlight: ${filename}`);
				}
			}

			// Process annotations from ReadNoteBean
			if (config.processAnnotations !== false) {
				const readNoteBeanFile = allFiles.find(f => f.endsWith('_ReadNoteBean.json'));

				if (readNoteBeanFile) {
					await StreamLogger.log(`[ViwoodsProcessor.processEpubFormat] Found ReadNoteBean file: ${readNoteBeanFile}`);
					const annotations = await StreamingZipUtils.extractJson<ReadNoteBean[]>(
						zipReader,
						readNoteBeanFile
					);

					if (annotations && annotations.length > 0) {
						await StreamLogger.log(`[ViwoodsProcessor.processEpubFormat] Processing ${annotations.length} annotations...`);

						for (const annotation of annotations) {
							const files = await this.processAnnotation(
								zipReader,
								annotation,
								bookName,  // Use bookName from highlights instead of annotation.bookName
								bookSlug,
								totalPages,
								epubPath,
								config,
								context
							);
							createdFiles.push(...files);
						}
					}
				} else {
					await StreamLogger.log(`[ViwoodsProcessor.processEpubFormat] No ReadNoteBean file found, skipping annotations`);
				}
			}

			return {
				success: true,
				createdFiles,
			};
		} catch (error: unknown) {
			const err = error as Error;
			return {
				success: false,
				createdFiles,
				errors: [`Failed to process EPUB note: ${err.message}`],
			};
		}
	}

	private async ensureFolders(context: ProcessorContext, config: ViwoodsProcessorConfig): Promise<void> {
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

	private async generateHighlight(
		context: ProcessorContext,
		config: ViwoodsProcessorConfig,
		data: Record<string, unknown>
	): Promise<string | null> {
		try {
			const defaultTemplate = await this.loadDefaultTemplate("viwoods-highlight.md");
			const template = await context.templateResolver.resolve(config.highlightTemplate, defaultTemplate);
			const content = TemplateEngine.render(template, data);

			const filename = `${data.noteSlug}-page-${data.pageNumber}-highlight.md`;
			const filepath = FileUtils.joinPath(config.highlightsFolder, filename);

			await context.vault.adapter.write(filepath, content);
			return filepath;
		} catch (error) {
			console.error("Failed to generate highlight:", error);
			return null;
		}
	}

	private async generateAnnotation(
		context: ProcessorContext,
		config: ViwoodsProcessorConfig,
		data: Record<string, unknown>
	): Promise<string | null> {
		try {
			const defaultTemplate = await this.loadDefaultTemplate("viwoods-annotation.md");
			const template = await context.templateResolver.resolve(config.annotationTemplate, defaultTemplate);
			const content = TemplateEngine.render(template, data);

			const filename = `${data.noteSlug}-page-${data.pageNumber}-annotation.md`;
			const filepath = FileUtils.joinPath(config.annotationsFolder, filename);

			await context.vault.adapter.write(filepath, content);
			return filepath;
		} catch (error) {
			console.error("Failed to generate annotation:", error);
			return null;
		}
	}

	private async generatePage(
		context: ProcessorContext,
		config: ViwoodsProcessorConfig,
		data: Record<string, unknown>
	): Promise<string | null> {
		try {
			const defaultTemplate = await this.loadDefaultTemplate("viwoods-page.md");
			const template = await context.templateResolver.resolve(config.pageTemplate, defaultTemplate);
			const content = TemplateEngine.render(template, data);

			const filename = `${data.noteSlug}-page-${data.pageNumber}.md`;
			const filepath = FileUtils.joinPath(config.pagesFolder, filename);

			await context.vault.adapter.write(filepath, content);
			return filepath;
		} catch (error) {
			console.error("Failed to generate page:", error);
			return null;
		}
	}

	private async generateIndex(
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
#viwoods/${data.noteSlug} #index
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

	/**
	 * Process a single annotation from ReadNoteBean
	 */
	private async processAnnotation(
		zipReader: ZipReader<Blob>,
		annotation: ReadNoteBean,
		bookName: string,
		bookSlug: string,
		totalPages: number,
		epubPath: string,
		config: ViwoodsProcessorConfig,
		context: ProcessorContext
	): Promise<string[]> {
		const createdFiles: string[] = [];

		try {
			// 1. Extract image filenames from paths
			const pngFilename = annotation.noteImagePath.split('/').pop();
			const jpgFilename = annotation.pageImage.split('/').pop();

			if (!pngFilename || !jpgFilename) {
				await StreamLogger.error(`Missing image filenames for annotation ${annotation.id}`);
				return createdFiles;
			}

			await StreamLogger.log(`[processAnnotation] Processing annotation ${annotation.id}, PNG: ${pngFilename}, JPG: ${jpgFilename}`);

			// 2. Extract both images from ZIP
			const pngData = await StreamingZipUtils.extractFile(zipReader, pngFilename);
			const jpgData = await StreamingZipUtils.extractFile(zipReader, jpgFilename);

			if (!pngData || !jpgData) {
				await StreamLogger.error(`Missing image files for annotation ${annotation.id}`);
				return createdFiles;
			}

			await StreamLogger.log(`[processAnnotation] Extracted images, PNG: ${pngData.length} bytes, JPG: ${jpgData.length} bytes`);

			// 3. Create composite image
			const compositeImage = await this.createCompositeAnnotationImage(
				jpgData,
				pngData,
				config.createCompositeImages !== false
			);

			// 4. Save composite image
			const imageFolder = config.annotationImagesFolder || config.annotationsFolder;
			await FileUtils.ensurePath(context.vault, imageFolder);

			const pageStr = String(annotation.pageIndex).padStart(3, '0');
			const imageName = `${bookSlug}-p${pageStr}-annotation-${annotation.id}.png`;
			const imagePath = FileUtils.joinPath(imageFolder, imageName);

			const imageBuffer = await compositeImage.arrayBuffer();
			await context.vault.adapter.writeBinary(imagePath, new Uint8Array(imageBuffer));
			createdFiles.push(imagePath);

			await StreamLogger.log(`[processAnnotation] Saved composite image: ${imagePath}`);

			// 5. Generate markdown file
			const mdPath = await this.generateAnnotationMarkdownFromBean(
				annotation,
				bookName,
				bookSlug,
				totalPages,
				epubPath,
				imagePath,
				config,
				context
			);

			if (mdPath) {
				createdFiles.push(mdPath);
				await StreamLogger.log(`[processAnnotation] Saved markdown file: ${mdPath}`);
			}

			return createdFiles;
		} catch (error: any) {
			await StreamLogger.error(`Failed to process annotation ${annotation.id}: ${error.message}`);
			return createdFiles;
		}
	}

	/**
	 * Create composite annotation image from JPG page and PNG overlay
	 */
	private async createCompositeAnnotationImage(
		jpgData: Uint8Array,
		pngData: Uint8Array,
		shouldComposite: boolean
	): Promise<Blob> {
		// If composition disabled, return PNG only
		if (!shouldComposite) {
			return new Blob([pngData], { type: 'image/png' });
		}

		// Create blobs for image loading
		const jpgBlob = new Blob([jpgData], { type: 'image/jpeg' });
		const pngBlob = new Blob([pngData], { type: 'image/png' });

		const jpgUrl = URL.createObjectURL(jpgBlob);
		const pngUrl = URL.createObjectURL(pngBlob);

		try {
			// Load both images
			const jpgImg = await this.loadImage(jpgUrl);
			const pngImg = await this.loadImage(pngUrl);

			// Create canvas with JPG dimensions
			const canvas = document.createElement('canvas');
			canvas.width = jpgImg.width;
			canvas.height = jpgImg.height;

			const ctx = canvas.getContext('2d');
			if (!ctx) {
				throw new Error('Failed to get canvas context');
			}

			// Draw JPG background
			ctx.drawImage(jpgImg, 0, 0);

			// Draw PNG overlay
			ctx.drawImage(pngImg, 0, 0);

			// Convert to blob
			return new Promise<Blob>((resolve, reject) => {
				canvas.toBlob((blob) => {
					if (blob) {
						resolve(blob);
					} else {
						reject(new Error('Failed to create blob from canvas'));
					}
				}, 'image/png');
			});
		} finally {
			// Cleanup object URLs
			URL.revokeObjectURL(jpgUrl);
			URL.revokeObjectURL(pngUrl);
		}
	}

	/**
	 * Load an image from a URL
	 */
	private loadImage(url: string): Promise<HTMLImageElement> {
		return new Promise((resolve, reject) => {
			const img = new Image();
			img.onload = () => resolve(img);
			img.onerror = () => reject(new Error(`Failed to load image: ${url}`));
			img.src = url;
		});
	}

	/**
	 * Generate markdown file for annotation from ReadNoteBean
	 */
	private async generateAnnotationMarkdownFromBean(
		annotation: ReadNoteBean,
		bookName: string,
		bookSlug: string,
		totalPages: number,
		epubPath: string,
		imagePath: string,
		config: ViwoodsProcessorConfig,
		context: ProcessorContext
	): Promise<string | null> {
		try {
			const dateAnnotated = new Date(annotation.upDataTime * 1000);

			// Build location string
			const location = annotation.rootChapterName
				? `${annotation.rootChapterName} → ${annotation.title}`
				: annotation.title;

			// Build EPUB deep link
			const sourceLink = epubPath
				? `${epubPath}#${annotation.rootChapterLinkUri}`
				: annotation.rootChapterLinkUri;

			// Build template data (use passed bookName from PageTextAnnotation, not annotation.bookName)
			const templateData = {
				bookName: bookName,
				bookSlug,
				location,
				chapterName: annotation.title,
				rootChapterName: annotation.rootChapterName,
				pageNumber: annotation.pageIndex,
				totalPages,
				sourceLink,
				annotationImagePath: imagePath,
				dateAnnotated: TemplateEngine.formatDate(dateAnnotated, "YYYY-MM-DD"),
				annotationId: annotation.id,
			};

			// Load template
			const defaultTemplate = await this.loadDefaultTemplate("viwoods-epub-annotation.md");
			const template = await context.templateResolver.resolve(
				config.annotationTemplate,
				defaultTemplate
			);

			// Render markdown
			let content = TemplateEngine.render(template, templateData, dateAnnotated);

			// Add summary section if enabled and summary exists
			if (config.includeSummaryInAnnotation !== false && annotation.sumary) {
				// Insert summary as blockquote before "### Notes" section
				content = content.replace(
					'### Notes',
					`### Summary\n\n> ${annotation.sumary}\n\n### Notes`
				);
			}

			// Generate filename
			const pageStr = String(annotation.pageIndex).padStart(3, '0');
			const filename = `${bookSlug}-p${pageStr}-annotation-${annotation.id}.md`;
			const filepath = FileUtils.joinPath(config.annotationsFolder, filename);

			// Only write if file doesn't exist (preserve user edits)
			const existingFile = context.vault.getAbstractFileByPath(filepath);
			if (!existingFile) {
				await FileUtils.ensurePath(context.vault, config.annotationsFolder);
				await context.vault.adapter.write(filepath, content);
				return filepath;
			} else {
				await StreamLogger.log(`Preserving existing annotation: ${filename}`);
				return null;
			}
		} catch (error: any) {
			await StreamLogger.error(`Failed to generate annotation markdown: ${error.message}`);
			return null;
		}
	}

	private async loadDefaultTemplate(name: string): Promise<string> {
		// In production, templates are bundled with the plugin
		// For now, we'll use inline defaults as fallback
		const templates: Record<string, string> = {
			"viwoods-highlight.md": `## {{noteTitle}}

**Page:** {{pageNumber}}/{{totalPages}}
**Date:** {{date:YYYY-MM-DD}}
**Source:** [Open Note]({{sourceLink}})

---

![[{{pageImagePath}}]]

### Handwriting Data

Strokes: {{strokeCount}}
Points: {{pointCount}}

### Notes

*Add your thoughts here*

---
#highlight #viwoods/{{noteSlug}}`,
			"viwoods-annotation.md": `## {{noteTitle}} - Annotation

**Page:** {{pageNumber}}/{{totalPages}}
**Date:** {{date:YYYY-MM-DD}}
**Source:** [Open Note]({{sourceLink}})

---

### Text Content

{{textContent}}

### Notes

*Add your thoughts here*

---
#annotation #viwoods/{{noteSlug}}`,
			"viwoods-epub-annotation.md": `## {{bookName}}

**Location:** {{location}}
**Page:** {{pageNumber}}/{{totalPages}}
**Date:** {{dateAnnotated}}
**Source:** [Open in EPUB]({{sourceLink}})

---

![[{{annotationImagePath}}]]

### Notes

*Add your thoughts here*

---
#annotation #book/{{bookSlug}} #page/{{pageNumber}}`,
			"viwoods-page.md": `# {{noteTitle}} - Page {{pageNumber}}

**Created:** {{createTime}}
**Page:** {{pageNumber}}/{{totalPages}}
**Source:** [{{noteName}}]({{sourceLink}})

---

## Page Content

![[{{pageImagePath}}]]

### Notes

*Add your notes here*

---

#viwoods/{{noteSlug}} #page-{{pageNumber}}`,
		};

		return templates[name] || "";
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
			highlightsFolder: "viwoods/Highlights",
			annotationsFolder: "viwoods/Annotations",
			sourcesFolder: "viwoods/Sources",
			pagesFolder: "viwoods/Pages",
			includeMetadata: true,
			includeThumbnail: true,
			extractImages: true,
			createIndex: true,
			processAnnotations: true,
			annotationImagesFolder: "viwoods/Annotations/resources",
			includeSummaryInAnnotation: true,
			createCompositeImages: true,
		};
	}

	getDefaultTemplates(): Record<string, string> {
		return {
			highlight: this.loadDefaultTemplate("viwoods-highlight.md").toString(),
			annotation: this.loadDefaultTemplate("viwoods-annotation.md").toString(),
			page: this.loadDefaultTemplate("viwoods-page.md").toString(),
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
					defaultValue: "viwoods/Highlights",
				},
				{
					key: "annotationsFolder",
					label: "Annotations Folder",
					description: "Folder for annotation markdown files",
					type: "folder",
					required: false,
					defaultValue: "viwoods/Annotations",
				},
				{
					key: "sourcesFolder",
					label: "Sources Folder",
					description: "Folder for original .note files",
					type: "folder",
					required: false,
					defaultValue: "viwoods/Sources",
				},
				{
					key: "pagesFolder",
					label: "Pages Folder",
					description: "Folder for page images and markdown",
					type: "folder",
					required: false,
					defaultValue: "viwoods/Pages",
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
					defaultValue: "viwoods/Annotations/resources",
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
