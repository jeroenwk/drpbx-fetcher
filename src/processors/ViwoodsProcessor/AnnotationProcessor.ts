import { ZipReader } from "@zip.js/zip.js";
import { FileUtils } from "../../utils/FileUtils";
import { StreamingZipUtils } from "../../utils/StreamingZipUtils";
import { StreamLogger } from "../../utils/StreamLogger";
import { TemplateEngine } from "../templates/TemplateEngine";
import { ProcessorContext } from "../types";
import { getViwoodsAttachmentsFolder } from "./ViwoodsTypes";
import { LearningModuleConfig, ReadNoteBean, ViwoodsProcessorConfig } from "./ViwoodsTypes";
import { ImageCompositor } from "./ImageCompositor";
import { TemplateDefaults } from "./TemplateDefaults";

/**
 * Handles processing of annotations from ReadNoteBean
 */
export class AnnotationProcessor {
	/**
	 * Process a single annotation from ReadNoteBean
	 */
	public static async processAnnotation(
		zipReader: ZipReader<Blob>,
		annotation: ReadNoteBean,
		bookName: string,
		bookSlug: string,
		totalPages: number,
		epubPath: string,
		originalFilename: string,
		config: LearningModuleConfig,
		context: ProcessorContext,
		viwoodsConfig: ViwoodsProcessorConfig
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
			const compositeImage = await ImageCompositor.createCompositeImage(
				jpgData,
				pngData,
				config.createCompositeImages !== false
			);

			// 4. Save composite image to Viwoods attachments folder (with fallback to global)
			const imageFolder = getViwoodsAttachmentsFolder(config, viwoodsConfig, context);
			await FileUtils.ensurePath(context.vault, imageFolder);

			const pageStr = String(annotation.pageIndex).padStart(3, '0');
			const imageName = `${bookSlug}-p${pageStr}-annotation-${annotation.id}.png`;
			const imagePath = FileUtils.joinPath(imageFolder, imageName);

			// Only write if file doesn't exist (preserve user modifications)
			const existingImage = context.vault.getAbstractFileByPath(imagePath);
			if (!existingImage) {
				const imageBuffer = await compositeImage.arrayBuffer();
				await context.vault.createBinary(imagePath, new Uint8Array(imageBuffer));
				createdFiles.push(imagePath);
				await StreamLogger.log(`[processAnnotation] Saved composite image: ${imagePath}`);
			} else {
				await StreamLogger.log(`[processAnnotation] Preserving existing image: ${imagePath}`);
			}

			// 5. Generate markdown file
			const mdPath = await this.generateAnnotationMarkdown(
				annotation,
				bookName,
				bookSlug,
				totalPages,
				epubPath,
				originalFilename,
				imagePath,
				config,
				context
			);

			if (mdPath) {
				createdFiles.push(mdPath);
				await StreamLogger.log(`[processAnnotation] Saved markdown file: ${mdPath}`);
			}

			return createdFiles;
		} catch (error: Error | unknown) {
			const err = error as Error;
			await StreamLogger.error(`Failed to process annotation ${annotation.id}: ${err.message}`);
			return createdFiles;
		}
	}

	/**
	 * Generate markdown file for annotation from ReadNoteBean
	 */
	private static async generateAnnotationMarkdown(
		annotation: ReadNoteBean,
		bookName: string,
		bookSlug: string,
		totalPages: number,
		epubPath: string,
		originalFilename: string,
		imagePath: string,
		config: LearningModuleConfig,
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

			// Build source info - either link to downloaded EPUB or link to original bookPath
			let sourceInfo: string;
			if (epubPath) {
				sourceInfo = `[${bookName}](${sourceLink})`;
			} else {
				// originalFilename contains bookPath from BookBean, use bookName as link title
				sourceInfo = `[${bookName}](file://${originalFilename})`;
			}

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
				sourceInfo: sourceInfo,
				annotationImagePath: imagePath,
				dateAnnotated: TemplateEngine.formatDate(dateAnnotated, "YYYY-MM-DD"),
				annotationId: annotation.id,
			};

			// Load template
			const defaultTemplate = await TemplateDefaults.load("viwoods-epub-annotation.md");
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
				await StreamLogger.log(`[AnnotationProcessor.generateAnnotationMarkdown] Creating EPUB annotation file`, {
					annotationsFolder: config.annotationsFolder,
					filename,
					fullPath: filepath,
					contentLength: content.length
				});
				await FileUtils.ensurePath(context.vault, config.annotationsFolder);
				await context.vault.create(filepath, content);
				await StreamLogger.log(`[AnnotationProcessor.generateAnnotationMarkdown] EPUB annotation file created: ${filepath}`);
				return filepath;
			} else {
				await StreamLogger.log(`[AnnotationProcessor.generateAnnotationMarkdown] Preserving existing annotation: ${filepath}`);
				return null;
			}
		} catch (error: Error | unknown) {
			const err = error as Error;
			await StreamLogger.error(`Failed to generate annotation markdown: ${err.message}`);
			return null;
		}
	}
}
