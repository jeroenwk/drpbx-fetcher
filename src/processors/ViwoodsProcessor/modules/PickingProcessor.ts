import { ZipReader } from "@zip.js/zip.js";
import { TFile } from "obsidian";
import { FileUtils } from "../../../utils/FileUtils";
import { StreamingZipUtils } from "../../../utils/StreamingZipUtils";
import { StreamLogger } from "../../../utils/StreamLogger";
import { TemplateEngine } from "../../templates/TemplateEngine";
import { ProcessorContext, ProcessorResult, FileMetadata } from "../../types";
import { PickingModuleConfig, NotesBean, NoteList, ViwoodsProcessorConfig, getViwoodsAttachmentsFolder } from "../ViwoodsTypes";
import { TemplateDefaults } from "../TemplateDefaults";
import { ImageCompositor } from "../ImageCompositor";
import { ImageCacheBuster } from "../../../utils/ImageCacheBuster";
import { ContentPreserver } from "../utils/ContentPreserver";

/**
 * Handles processing of Picking module notes (quick captures)
 */
export class PickingProcessor {
	/**
	 * Hash a string to a numeric string using a simple hash algorithm
	 * Converts each character to its character code and sums them with bit shifting
	 */
	private static hashToNumericString(input: string): string {
		let hash = 0;
		for (let i = 0; i < input.length; i++) {
			const char = input.charCodeAt(i);
			hash = ((hash << 5) - hash) + char;
			hash = hash & hash; // Convert to 32-bit integer
		}
		return Math.abs(hash).toString();
	}

	/**
	 * Process Picking module quick capture notes
	 */
	public static async process(
		zipReader: ZipReader<Blob>,
		fileData: Uint8Array,
		originalPath: string,
		metadata: FileMetadata,
		config: PickingModuleConfig,
		context: ProcessorContext,
		viwoodsConfig: ViwoodsProcessorConfig
	): Promise<ProcessorResult> {
		await StreamLogger.log(`[PickingProcessor.process] Starting Picking module processing`);
		const createdFiles: string[] = [];
		const errors: string[] = [];
		const warnings: string[] = [];

		try {
			// Find JSON files
			const allFiles = await StreamingZipUtils.listFiles(zipReader);
			await StreamLogger.log(`[PickingProcessor.process] Files in ZIP:`, { count: allFiles.length });

			const notesBeanFile = allFiles.find(f => f.endsWith("_NotesBean.json"));
			const noteListFile = allFiles.find(f => f.endsWith("_NoteList.json"));

			if (!notesBeanFile) {
				errors.push("No NotesBean.json found - not a valid Picking module note");
				return { success: false, createdFiles, errors };
			}

			// Extract NotesBean
			await StreamLogger.log(`[PickingProcessor.process] Extracting NotesBean: ${notesBeanFile}`);
			const notesBean = await StreamingZipUtils.extractJson<NotesBean>(zipReader, notesBeanFile);

			if (!notesBean) {
				errors.push("Failed to parse NotesBean.json");
				return { success: false, createdFiles, errors };
			}

			// Extract basic info
			const noteName = notesBean.noteName || FileUtils.getBasename(metadata.name);
			const noteSlug = FileUtils.slugify(noteName);
			const createTime = new Date(notesBean.createTime || 0);
			const totalPages = notesBean.pageCount || 0;

			await StreamLogger.log(`[PickingProcessor.process] Note info:`, {
				noteName,
				noteSlug,
				createTime,
				totalPages
			});

			// Determine output folders
			// Notes go to outputFolder (Viwoods/Picking)
			// Resources (images) go to global attachments folder
			const notesFolder = config.outputFolder || "Viwoods/Picking";

			// Ensure output folders exist
			await FileUtils.ensurePath(context.vault, notesFolder);

			// Use Viwoods attachments folder (with fallback to global)
			const attachmentsFolder = getViwoodsAttachmentsFolder(config, viwoodsConfig, context);
			await FileUtils.ensurePath(context.vault, attachmentsFolder);
			const resourcesFolder = attachmentsFolder; // Alias for compatibility with existing code

			// Extract note list if available
			const noteList = noteListFile
				? await StreamingZipUtils.extractJson<NoteList[]>(zipReader, noteListFile)
				: [];

			await StreamLogger.log(`[PickingProcessor.process] Found ${noteList?.length || 0} note items`);

			// Process each note item and create composite images
			const compositePaths: string[] = [];
			if (noteList && noteList.length > 0 && config.extractImages) {
				for (let i = 0; i < noteList.length; i++) {
					const item = noteList[i];
					const itemNum = i + 1;

					try {
						await StreamLogger.log(`[PickingProcessor.process] Processing note item ${itemNum}/${noteList.length}`);

						// Find JPG and PNG files for this page
						// According to spec: {timestamp}.jpg and {pageId}.png
						const jpgFiles = allFiles.filter(f => f.endsWith('.jpg') && !f.includes('thumbnai'));
						const pngFiles = allFiles.filter(f => f.endsWith('.png') && !f.includes('Thumbnail'));

						// For simplicity, assume first JPG is the background and first PNG is the overlay
						// In a more complex implementation, we'd match by pageId from NoteList
						const jpgFile = jpgFiles[i];
						const pngFile = pngFiles[i];

						if (jpgFile && pngFile) {
							await StreamLogger.log(`[PickingProcessor.process] Found image pair`, {
								jpg: jpgFile,
								png: pngFile
							});

							// Extract both images
							const jpgData = await StreamingZipUtils.extractFile(zipReader, jpgFile);
							const pngData = await StreamingZipUtils.extractFile(zipReader, pngFile);

							if (jpgData && pngData) {
								// Create composite image
								const shouldComposite = config.createCompositeImages !== false;
								const compositeBlob = await ImageCompositor.createCompositeImage(
									jpgData,
									pngData,
									shouldComposite
								);

								// Convert blob to Uint8Array
								const compositeBuffer = await compositeBlob.arrayBuffer();
								const compositeData = new Uint8Array(compositeBuffer);

								// Save composite image
								const compositePath = FileUtils.joinPath(
									resourcesFolder,
									`${noteSlug}-item-${itemNum}.png`
								);
								const result = await ImageCacheBuster.updateImageWithCacheBust(
									context.vault,
									compositePath,
									compositeData
								);
								createdFiles.push(result.newPath);
								compositePaths.push(result.newPath);
								await StreamLogger.log(`[PickingProcessor.process] Saved composite image: ${result.newPath}`);
							}
						} else if (item.pageShotFilePath) {
							// Fallback: use pageShotFilePath if available
							const screenshotData = await StreamingZipUtils.extractFile(zipReader, item.pageShotFilePath);
							if (screenshotData) {
								const screenshotPath = FileUtils.joinPath(
									resourcesFolder,
									`${noteSlug}-item-${itemNum}.png`
								);
								const result = await ImageCacheBuster.updateImageWithCacheBust(
									context.vault,
									screenshotPath,
									screenshotData
								);
								createdFiles.push(result.newPath);
								compositePaths.push(result.newPath);
								await StreamLogger.log(`[PickingProcessor.process] Saved screenshot: ${result.newPath}`);
							}
						}
					} catch (itemError) {
						const err = itemError as Error;
						errors.push(`Error processing note item ${itemNum}: ${err.message}`);
						await StreamLogger.error(`[PickingProcessor.process] Error on item ${itemNum}:`, err);
					}
				}
			}

			// Build pages array for template with block IDs
			const dropboxFileId = metadata.id;
			const pages = compositePaths.map((imagePath, index) => ({
				pageNumber: index + 1,
				imagePath: imagePath,
				pageId: `${this.hashToNumericString(dropboxFileId)}-${index + 1}`,
			}));

			// Generate capture note file
			const notePath = await this.generateCaptureFile(
				context,
				config,
				notesFolder,
				resourcesFolder,
				viwoodsConfig,
				{
					noteName,
					noteSlug,
					totalPages: noteList?.length || 0,
					createTime: TemplateEngine.formatDate(createTime, "YYYY-MM-DD HH:mm"),
					pages,
				},
				createTime
			);
			if (notePath) {
				createdFiles.push(notePath);
			}

			return {
				success: errors.length === 0,
				createdFiles,
				errors: errors.length > 0 ? errors : undefined,
				warnings: warnings.length > 0 ? warnings : undefined,
			};
		} catch (error) {
			const err = error as Error;
			await StreamLogger.error(`[PickingProcessor.process] Fatal error:`, err);
			return {
				success: false,
				createdFiles,
				errors: [`Failed to process Picking module note: ${err.message}`],
			};
		}
	}

	private static async generateCaptureFile(
		context: ProcessorContext,
		config: PickingModuleConfig,
		outputFolder: string,
		resourcesFolder: string,
		viwoodsConfig: ViwoodsProcessorConfig,
		data: Record<string, unknown>,
		createTime: Date
	): Promise<string | null> {
		try {
			// Use the note name as filename
			const filename = `${data.noteName}.md`;
			const filepath = FileUtils.joinPath(outputFolder, filename);

			// Load and render template
			const defaultTemplate = await TemplateDefaults.load("viwoods-picking-capture.md");
			const template = await context.templateResolver.resolve(config.captureTemplate, defaultTemplate);
			const freshContent = await TemplateEngine.render(template, data, context, {
				createTime: createTime
			});

			// Check if file exists
			const existingFile = context.vault.getAbstractFileByPath(filepath);

			if (existingFile instanceof TFile) {
				// File exists - use ContentPreserver to merge
				StreamLogger.log(`[PickingProcessor.generateCaptureFile] Merging existing capture file: ${filepath}`);
				const existingContent = await context.vault.read(existingFile);

				// Get Viwoods attachments folder for attachment detection
				const attachmentsFolder = getViwoodsAttachmentsFolder(config, viwoodsConfig, context);

				// Use ContentPreserver to merge
				const result = ContentPreserver.preserve(
					existingContent,
					freshContent,
					attachmentsFolder
				);

				await context.vault.modify(existingFile, result.content);
				StreamLogger.log(`[PickingProcessor.generateCaptureFile] ContentPreserver merged capture file`, {
					preservedTextBlocks: result.preservedTextBlocks,
					preservedAttachments: result.preservedAttachments,
					preservedCalloutBlocks: result.preservedCalloutBlocks,
				});
			} else {
				// New file - create
				await context.vault.create(filepath, freshContent);
				StreamLogger.log(`[PickingProcessor.generateCaptureFile] Created new capture file: ${filepath}`);
			}

			return filepath;
		} catch (error) {
			await StreamLogger.error("[PickingProcessor.generateCaptureFile] Failed to generate capture file:", error);
			return null;
		}
	}

	/**
	 * Process non-.note files (images like screenshots)
	 * These are standalone files that should be copied to the appropriate folder
	 */
	public static async processNonNoteFile(
		fileData: Uint8Array,
		originalPath: string,
		metadata: FileMetadata,
		config: PickingModuleConfig,
		context: ProcessorContext
	): Promise<ProcessorResult> {
		await StreamLogger.log(`[PickingProcessor.processNonNoteFile] Processing non-.note file`, {
			fileName: metadata.name,
			path: originalPath,
			size: fileData.length
		});

		try {
			// Determine the file type and output folder
			const fileName = metadata.name;
			const fileExtension = fileName.split('.').pop()?.toLowerCase() || "";
			const pathLower = originalPath.toLowerCase();

			// Check if this is a screenshot (in /Picking/Screenshot/ folder)
			const isScreenshot = pathLower.includes("/picking/screenshot/");

			if (isScreenshot && (fileExtension === "jpg" || fileExtension === "jpeg" || fileExtension === "png")) {
				// Standalone screenshots go to capturesFolder (Viwoods/Picking/Captures)
				const capturesFolder = config.capturesFolder || "Viwoods/Picking/Captures";
				const outputPath = FileUtils.joinPath(capturesFolder, fileName);

				await StreamLogger.log(`[PickingProcessor.processNonNoteFile] Saving screenshot`, {
					fileName,
					outputPath
				});

				// Ensure output folder exists
				await FileUtils.ensurePath(context.vault, capturesFolder);

				// Write file to vault
				const result = await ImageCacheBuster.updateImageWithCacheBust(
					context.vault,
					outputPath,
					fileData
				);

				return {
					success: true,
					createdFiles: [result.newPath],
				};
			}

			// Unsupported file type for Picking module
			return {
				success: false,
				createdFiles: [],
				errors: [`Unsupported file type for Picking module: ${fileExtension}`],
			};

		} catch (error) {
			const err = error as Error;
			await StreamLogger.error(`[PickingProcessor.processNonNoteFile] Error processing file`, error);
			return {
				success: false,
				createdFiles: [],
				errors: [`Failed to process Picking file: ${err.message}`],
			};
		}
	}
}
