import { ZipReader } from "@zip.js/zip.js";
import { TFile } from "obsidian";
import { FileUtils } from "../../../utils/FileUtils";
import { StreamingZipUtils } from "../../../utils/StreamingZipUtils";
import { StreamLogger } from "../../../utils/StreamLogger";
import { TemplateEngine } from "../../templates/TemplateEngine";
import { ProcessorContext, ProcessorResult, FileMetadata } from "../../types";
import {
	PaperModuleConfig,
	NoteFileInfo,
	PageListFileInfo,
	PageResource,
	ResourceType
} from "../ViwoodsTypes";
import { TemplateDefaults } from "../TemplateDefaults";
import { ImageCacheBuster } from "../../../utils/ImageCacheBuster";

/**
 * Handles processing of Paper module notes (handwritten notes)
 */
export class PaperProcessor {
	/**
	 * Process Paper module handwritten notes
	 */
	public static async process(
		zipReader: ZipReader<Blob>,
		fileData: Uint8Array,
		originalPath: string,
		metadata: FileMetadata,
		config: PaperModuleConfig,
		context: ProcessorContext
	): Promise<ProcessorResult> {
		await StreamLogger.log(`[PaperProcessor.process] Starting Paper module processing`);
		const createdFiles: string[] = [];
		const errors: string[] = [];
		const warnings: string[] = [];

		try {
			// Find JSON files
			const allFiles = await StreamingZipUtils.listFiles(zipReader);
			await StreamLogger.log(`[PaperProcessor.process] Files in ZIP:`, { count: allFiles.length });

			const noteFileInfoFile = allFiles.find(f => f.endsWith("_NoteFileInfo.json"));
			const pageListFile = allFiles.find(f => f.endsWith("_PageListFileInfo.json"));
			const pageResourceFile = allFiles.find(f => f.endsWith("_PageResource.json"));
			// headerInfoFile not needed for Paper module processing
			// const headerInfoFile = allFiles.find(f => f.endsWith("_HeaderInfo.json"));

			if (!noteFileInfoFile) {
				errors.push("No NoteFileInfo.json found - not a valid Paper module note");
				return { success: false, createdFiles, errors };
			}

			// Extract NoteFileInfo
			await StreamLogger.log(`[PaperProcessor.process] Extracting NoteFileInfo: ${noteFileInfoFile}`);
			const noteInfo = await StreamingZipUtils.extractJson<NoteFileInfo>(zipReader, noteFileInfoFile);

			if (!noteInfo) {
				errors.push("Failed to parse NoteFileInfo.json");
				return { success: false, createdFiles, errors };
			}

			// Extract basic info
			const noteName = noteInfo.fileName || FileUtils.getBasename(metadata.name);
			const noteSlug = FileUtils.slugify(noteName);
			const folderPath = noteInfo.fileParentName || "";
			const createTime = new Date(noteInfo.creationTime);
			const modifiedTime = new Date(noteInfo.lastModifiedTime);

			await StreamLogger.log(`[PaperProcessor.process] Note info:`, {
				noteName,
				noteSlug,
				folderPath,
				createTime,
				modifiedTime
			});

			// Determine output folder based on folder structure preservation
			let noteOutputFolder = config.notesFolder;
			if (config.preserveFolderStructure && folderPath) {
				// Extract folder from original path (e.g., "Paper/Papers/Léna")
				const pathMatch = originalPath.match(/Paper\/Papers\/([^/]+)/);
				if (pathMatch && pathMatch[1] !== "Unclassified Notes") {
					noteOutputFolder = FileUtils.joinPath(config.notesFolder, pathMatch[1]);
					await StreamLogger.log(`[PaperProcessor.process] Preserving folder structure: ${noteOutputFolder}`);
				}
			}

			// Ensure output folders exist
			await FileUtils.ensurePath(context.vault, noteOutputFolder);

			// Create resources subfolder inside the note folder
			const resourcesFolder = FileUtils.joinPath(noteOutputFolder, "resources");
			await FileUtils.ensurePath(context.vault, resourcesFolder);

			// Extract pages metadata
			const pages = pageListFile
				? await StreamingZipUtils.extractJson<PageListFileInfo[]>(zipReader, pageListFile)
				: [];
			const resources = pageResourceFile
				? await StreamingZipUtils.extractJson<PageResource[]>(zipReader, pageResourceFile)
				: [];

			const totalPages = pages?.length || 0;
			await StreamLogger.log(`[PaperProcessor.process] Found ${totalPages} pages and ${resources?.length || 0} resources`);

			// Process each page and collect screenshot paths
			const screenshotPaths: string[] = [];
			if (pages && pages.length > 0) {
				for (let i = 0; i < pages.length; i++) {
					const page = pages[i];
					const pageNum = i + 1;

					try {
						await StreamLogger.log(`[PaperProcessor.process] Processing page ${pageNum}/${totalPages}`);

						// Find resources for this page
						const pageResources = resources?.filter(r => r.pid === page.id) || [];
						await StreamLogger.log(`[PaperProcessor.process] Found ${pageResources.length} resources for page ${pageNum}`);

						// Extract screenshot if available
						const screenshot = pageResources.find(r => r.resourceType === ResourceType.SCREENSHOT);

						if (screenshot && config.extractImages) {
							const screenshotData = await StreamingZipUtils.extractFile(zipReader, screenshot.fileName);
							if (screenshotData) {
								const screenshotPath = FileUtils.joinPath(
									resourcesFolder,
									`${noteSlug}-page-${pageNum}.png`
								);
								const finalPath = await ImageCacheBuster.updateImageWithCacheBust(
									context.vault,
									screenshotPath,
									new Uint8Array(screenshotData.buffer)
								);
								createdFiles.push(finalPath);
								screenshotPaths.push(finalPath);
								await StreamLogger.log(`[PaperProcessor.process] Saved screenshot: ${finalPath}`);
							}
						}
					} catch (pageError) {
						const err = pageError as Error;
						errors.push(`Error processing page ${pageNum}: ${err.message}`);
						await StreamLogger.error(`[PaperProcessor.process] Error on page ${pageNum}:`, err);
					}
				}
			}

			// Build screenshot sections manually
			let screenshotSections = "";
			for (const screenshotPath of screenshotPaths) {
				// Get just the filename with resources/ prefix for wiki-style links
				const relativePath = screenshotPath.split("/").slice(-2).join("/");
				screenshotSections += `![[${relativePath}]]\n\n### Notes\n\n*Add your notes here*\n\n---\n\n`;
			}

			// Generate single note file with all screenshots
			const notePath = await this.generateNoteFile(
				context,
				config,
				noteOutputFolder,
				{
					noteName,
					noteSlug,
					totalPages,
					createTime: TemplateEngine.formatDate(createTime, "YYYY-MM-DD HH:mm"),
					modifiedTime: TemplateEngine.formatDate(modifiedTime, "YYYY-MM-DD HH:mm"),
					folderPath,
					screenshotSections,
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
			await StreamLogger.error(`[PaperProcessor.process] Fatal error:`, err);
			return {
				success: false,
				createdFiles,
				errors: [`Failed to process Paper module note: ${err.message}`],
			};
		}
	}

	private static async generateNoteFile(
		context: ProcessorContext,
		config: PaperModuleConfig,
		outputFolder: string,
		data: Record<string, unknown>,
		createTime: Date
	): Promise<string | null> {
		try {
			const defaultTemplate = await TemplateDefaults.load("viwoods-paper-note.md");
			const template = await context.templateResolver.resolve(config.noteTemplate, defaultTemplate);
			const content = TemplateEngine.render(template, data, createTime);

			// Use the note name as filename
			const filename = `${data.noteName}.md`;
			const filepath = FileUtils.joinPath(outputFolder, filename);

			// Check if file exists and use appropriate method
			const existingFile = context.vault.getAbstractFileByPath(filepath);
			if (existingFile instanceof TFile) {
				// Use modify to trigger Obsidian's file change detection
				await context.vault.modify(existingFile, content);
			} else {
				await context.vault.create(filepath, content);
			}
			await StreamLogger.log(`[PaperProcessor.generateNoteFile] Created note file: ${filepath}`);
			return filepath;
		} catch (error) {
			await StreamLogger.error("[PaperProcessor.generateNoteFile] Failed to generate note file:", error);
			return null;
		}
	}
}
