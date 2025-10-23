import { ZipReader } from "@zip.js/zip.js";
import { files } from "dropbox";
import { FileUtils } from "../../../utils/FileUtils";
import { StreamingZipUtils } from "../../../utils/StreamingZipUtils";
import { StreamLogger } from "../../../utils/StreamLogger";
import { TemplateEngine } from "../../templates/TemplateEngine";
import { ProcessorContext, ProcessorResult } from "../../types";
import { LearningModuleConfig, EpubHighlight, BookBean, ReadNoteBean } from "../ViwoodsTypes";
import { AnnotationProcessor } from "../AnnotationProcessor";

/**
 * Handles processing of Learning module notes (EPUB/PDF annotations)
 */
export class LearningProcessor {
	/**
	 * Process Learning module EPUB format notes
	 */
	public static async process(
		zipReader: ZipReader<Blob>,
		fileData: Uint8Array,
		originalPath: string,
		metadata: files.FileMetadata,
		config: LearningModuleConfig,
		context: ProcessorContext
	): Promise<ProcessorResult> {
		await StreamLogger.log(`[LearningProcessor.process] Starting Learning module processing`);
		const createdFiles: string[] = [];
		const errors: string[] = [];

		try {
			// Find the JSON files (they have prefix based on book name)
			await StreamLogger.log(`[LearningProcessor.process] Looking for JSON files in ZIP...`);
			const allFiles = await StreamingZipUtils.listFiles(zipReader);
			const pageTextAnnotationFile = allFiles.find(f => f.endsWith("_PageTextAnnotation.json"));
			const bookBeanFile = allFiles.find(f => f.endsWith("_BookBean.json"));
			const epubFile = allFiles.find(f => f.endsWith(".epub"));

			await StreamLogger.log(`[LearningProcessor.process] Found files:`, {
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
			await StreamLogger.log(`[LearningProcessor.process] Extracting highlights from ${pageTextAnnotationFile}...`);
			const highlights = await StreamingZipUtils.extractJson<EpubHighlight[]>(zipReader, pageTextAnnotationFile);

			await StreamLogger.log(`[LearningProcessor.process] Extracted highlights:`, {
				count: highlights?.length || 0
			});

			// Get book metadata - try highlights first, then BookBean, then ReadNoteBean
			let bookName = "";
			let bookSlug = "";
			let totalPages = 0;
			let bookPath = "";

			if (highlights && highlights.length > 0) {
				// Get metadata from highlights
				bookName = highlights[0].bookName;
				bookSlug = FileUtils.slugify(bookName);
				totalPages = highlights[0].pageCount;
				await StreamLogger.log(`[LearningProcessor.process] Got book metadata from highlights:`, {
					bookName,
					totalPages
				});
			}

			// Extract bookPath from BookBean.json if available
			if (bookBeanFile) {
				await StreamLogger.log(`[LearningProcessor.process] Extracting BookBean: ${bookBeanFile}`);
				const bookBean = await StreamingZipUtils.extractJson<BookBean>(zipReader, bookBeanFile);
				if (bookBean && bookBean.bookPath) {
					bookPath = bookBean.bookPath;
					await StreamLogger.log(`[LearningProcessor.process] Found bookPath: ${bookPath}`);
					// If we don't have bookName yet, try to get it from BookBean
					if (!bookName && bookBean.bookName) {
						bookName = bookBean.bookName;
						bookSlug = FileUtils.slugify(bookName);
						await StreamLogger.log(`[LearningProcessor.process] Got book name from BookBean: ${bookName}`);
					}
				}
			}

			// If we still don't have book metadata, try ReadNoteBean
			if (!bookName) {
				const readNoteBeanFile = allFiles.find(f => f.endsWith('_ReadNoteBean.json'));
				if (readNoteBeanFile) {
					await StreamLogger.log(`[LearningProcessor.process] Getting metadata from ReadNoteBean...`);
					const annotations = await StreamingZipUtils.extractJson<ReadNoteBean[]>(
						zipReader,
						readNoteBeanFile
					);
					if (annotations && annotations.length > 0) {
						bookName = annotations[0].bookName;
						bookSlug = FileUtils.slugify(bookName);
						// ReadNoteBean doesn't have pageCount, use 0 as fallback
						totalPages = 0;
						await StreamLogger.log(`[LearningProcessor.process] Got book metadata from ReadNoteBean:`, {
							bookName,
							totalPages
						});
					}
				}
			}

			// If we still don't have metadata, fail
			if (!bookName) {
				await StreamLogger.error("No book metadata found - no highlights, BookBean, or ReadNoteBean data available");
				errors.push("No book metadata found in note file");
				return { success: false, createdFiles, errors };
			}

			await StreamLogger.log(`[LearningProcessor.process] Book info:`, {
				bookName,
				bookSlug,
				totalPages,
				bookPath
			});

			// Extract EPUB file if configured and enabled in module settings (preserve if exists to allow user modifications)
			let epubPath = "";
			if (epubFile && config.sourcesFolder && config.downloadSourceFiles !== false) {
				await StreamLogger.log(`[LearningProcessor.process] Extracting EPUB file: ${epubFile}`);
				const epubData = await StreamingZipUtils.extractFile(zipReader, epubFile);
				if (epubData) {
					epubPath = FileUtils.joinPath(config.sourcesFolder, `${bookSlug}.epub`);
					await StreamLogger.log(`[LearningProcessor.process] Creating folder: ${config.sourcesFolder}`);
					await FileUtils.ensurePath(context.vault, config.sourcesFolder);

					// Only write if file doesn't exist (preserve user modifications)
					const existingEpub = context.vault.getAbstractFileByPath(epubPath);
					if (!existingEpub) {
						await context.vault.createBinary(epubPath, new Uint8Array(epubData.buffer));
						createdFiles.push(epubPath);
						await StreamLogger.log(`[LearningProcessor.process] Saved EPUB file: ${epubPath}`);
					} else {
						await StreamLogger.log(`[LearningProcessor.process] Preserving existing EPUB: ${epubPath}`);
					}
				}
			}

			// Generate highlight for each annotation (only if highlights exist)
			if (highlights && highlights.length > 0) {
				await StreamLogger.log(`[LearningProcessor.process] Creating highlights folder: ${config.highlightsFolder}`);
				await FileUtils.ensurePath(context.vault, config.highlightsFolder);

				await StreamLogger.log(`[LearningProcessor.process] Processing ${highlights.length} highlights...`);
				for (let i = 0; i < highlights.length; i++) {
					const highlight = highlights[i];
					await StreamLogger.log(`[LearningProcessor.process] Processing highlight ${i + 1}/${highlights.length}`);
					const dateHighlighted = new Date(highlight.createTime * 1000);

					// Build location string
					const location = highlight.rootChapterName
						? `${highlight.rootChapterName} → ${highlight.chapterName}`
						: highlight.chapterName;

					// Build EPUB link or info text
					const epubLink = epubPath
						? `${epubPath}#${highlight.chapterLinkUri}`
						: highlight.chapterLinkUri;

					// Build source info - either link to downloaded EPUB or link to original bookPath
					let sourceInfo: string;
					if (epubPath) {
						sourceInfo = `[${bookName}](${epubLink})`;
					} else if (bookPath) {
						// Use bookName as link title, create file:// link to original bookPath
						sourceInfo = `[${bookName}](file://${bookPath})`;
					} else {
						sourceInfo = metadata.name;
					}

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
						sourceInfo: sourceInfo,
						highlightText: highlight.rawText,
					};

					const defaultTemplate = `## {{bookName}}

**Location:** {{location}}
**Page:** {{pageNumber}}/{{totalPages}}
**Date highlighted:** {{dateHighlighted}}
**Source:** {{sourceInfo}}

---

> {{highlightText}}

### Notes

*Add your thoughts here*

---
#highlight #book #{{bookSlug}} #{{date}}
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
						await StreamLogger.log(`[LearningProcessor.process] Creating EPUB highlight file`, {
							highlightsFolder: config.highlightsFolder,
							filename,
							fullPath: filepath,
							contentLength: content.length
						});
						await context.vault.create(filepath, content);
						createdFiles.push(filepath);
						await StreamLogger.log(`[LearningProcessor.process] EPUB highlight file created: ${filepath}`);
					} else {
						console.log(`Preserving existing highlight: ${filename}`);
						await StreamLogger.log(`[LearningProcessor.process] Preserving existing highlight: ${filepath}`);
					}
				}
			}

			// Process annotations from ReadNoteBean
			if (config.processAnnotations !== false) {
				const readNoteBeanFile = allFiles.find(f => f.endsWith('_ReadNoteBean.json'));

				if (readNoteBeanFile) {
					await StreamLogger.log(`[LearningProcessor.process] Found ReadNoteBean file: ${readNoteBeanFile}`);
					const annotations = await StreamingZipUtils.extractJson<ReadNoteBean[]>(
						zipReader,
						readNoteBeanFile
					);

					if (annotations && annotations.length > 0) {
						await StreamLogger.log(`[LearningProcessor.process] Processing ${annotations.length} annotations...`);

						for (const annotation of annotations) {
							const files = await AnnotationProcessor.processAnnotation(
								zipReader,
								annotation,
								bookName,  // Use bookName from highlights instead of annotation.bookName
								bookSlug,
								totalPages,
								epubPath,
								bookPath || metadata.name,  // Use bookPath from BookBean, fallback to metadata.name
								config,
								context
							);
							createdFiles.push(...files);
						}
					}
				} else {
					await StreamLogger.log(`[LearningProcessor.process] No ReadNoteBean file found, skipping annotations`);
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
				errors: [`Failed to process Learning module note: ${err.message}`],
			};
		}
	}
}
