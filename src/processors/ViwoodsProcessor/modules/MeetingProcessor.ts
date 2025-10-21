import { ZipReader } from "@zip.js/zip.js";
import { TFile } from "obsidian";
import { FileUtils } from "../../../utils/FileUtils";
import { StreamingZipUtils } from "../../../utils/StreamingZipUtils";
import { StreamLogger } from "../../../utils/StreamLogger";
import { TemplateEngine } from "../../templates/TemplateEngine";
import { ProcessorContext, ProcessorResult, FileMetadata } from "../../types";
import {
	MeetingModuleConfig,
	NoteFileInfo,
	PageListFileInfo,
	PageResource,
	ResourceType
} from "../ViwoodsTypes";
import { TemplateDefaults } from "../TemplateDefaults";
import { ImageCacheBuster } from "../../../utils/ImageCacheBuster";
import { MarkdownMerger, ImageUpdateMapping } from "../utils/MarkdownMerger";
import { MetadataManager } from "../../../utils/MetadataManager";
import { NoteRenameHandler } from "../../../utils/NoteRenameHandler";

/**
 * Handles processing of Meeting module notes (meeting notes)
 */
export class MeetingProcessor {
	/**
	 * Process Meeting module notes
	 */
	public static async process(
		zipReader: ZipReader<Blob>,
		_fileData: Uint8Array,
		_originalPath: string,
		metadata: FileMetadata,
		config: MeetingModuleConfig,
		context: ProcessorContext,
		metadataManager: MetadataManager
	): Promise<ProcessorResult> {
		StreamLogger.log(`[MeetingProcessor.process] Starting Meeting module processing`);
		const createdFiles: string[] = [];
		const errors: string[] = [];
		const warnings: string[] = [];

		try {
			// Find JSON files
			const allFiles = await StreamingZipUtils.listFiles(zipReader);
			StreamLogger.log(`[MeetingProcessor.process] Files in ZIP:`, { count: allFiles.length });

			const noteFileInfoFile = allFiles.find(f => f.endsWith("_NoteFileInfo.json"));
			const pageListFile = allFiles.find(f => f.endsWith("_PageListFileInfo.json"));
			const pageResourceFile = allFiles.find(f => f.endsWith("_PageResource.json"));
			const headerInfoFile = allFiles.find(f => f.endsWith("_HeaderInfo.json"));

			if (!noteFileInfoFile) {
				errors.push("No NoteFileInfo.json found - not a valid Meeting module note");
				return { success: false, createdFiles, errors };
			}

			// Extract and verify HeaderInfo to ensure this is a meeting note
			if (headerInfoFile) {
				const headerInfo = await StreamingZipUtils.extractJson<Record<string, unknown>>(zipReader, headerInfoFile);
				if (!headerInfo || headerInfo.packageName !== "com.wisky.meeting") {
					errors.push(`Invalid package name for meeting module: ${(headerInfo?.packageName as string) || 'unknown'}`);
					return { success: false, createdFiles, errors };
				}
				StreamLogger.log(`[MeetingProcessor.process] Verified meeting module: ${headerInfo.packageName} v${headerInfo.appVersion}`);
			}

			// Extract NoteFileInfo
			StreamLogger.log(`[MeetingProcessor.process] Extracting NoteFileInfo: ${noteFileInfoFile}`);
			const noteInfo = await StreamingZipUtils.extractJson<NoteFileInfo>(zipReader, noteFileInfoFile);

			if (!noteInfo) {
				errors.push("Failed to parse NoteFileInfo.json");
				return { success: false, createdFiles, errors };
			}

			// Extract basic info
			const noteName = noteInfo.fileName || FileUtils.getBasename(metadata.name);
			const noteSlug = FileUtils.slugify(noteName);
			const createTime = new Date(noteInfo.creationTime);
			const modifiedTime = new Date(noteInfo.lastModifiedTime);

			StreamLogger.log(`[MeetingProcessor.process] Note info:`, {
				noteName,
				noteSlug,
				createTime,
				modifiedTime
			});

			// Determine output folder
			const noteOutputFolder = config.meetingsFolder;

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
			StreamLogger.log(`[MeetingProcessor.process] Found ${totalPages} pages and ${resources?.length || 0} resources`);

			// Get note identifiers
			const noteId = noteInfo.id; // Viwoods internal note ID (stable across renames)
			const dropboxFileId = metadata.id; // Dropbox file ID (changes on rename)

			StreamLogger.log(`[MeetingProcessor.process] Note identifiers:`, {
				noteId,
				dropboxFileId,
			});

			// Check if this note already exists (by noteId) - if so, it might be renamed
			const existingNote = metadataManager.findByNoteId(noteId);
			let wasRenamed = false;

			if (existingNote) {
				// Check if the current file path matches the expected path
				const expectedNotePath = FileUtils.joinPath(noteOutputFolder, `${noteName}.md`);

				if (existingNote.metadata.notePath !== expectedNotePath) {
					// File path doesn't match - note was renamed
					StreamLogger.log(`[MeetingProcessor.process] Detected renamed meeting note`, {
						oldPath: existingNote.metadata.notePath,
						newPath: expectedNotePath,
						noteId,
					});

					const renameResult = await NoteRenameHandler.handleRename(
						context.vault,
						existingNote.metadata,
						noteName,
						noteSlug,
						dropboxFileId,
						noteOutputFolder,
						metadataManager
					);

					if (renameResult.success) {
						StreamLogger.log(`[MeetingProcessor.process] Rename successful, will continue to update content/images`, {
							oldPath: renameResult.oldNotePath,
							newPath: renameResult.newNotePath,
							imagesRenamed: renameResult.updatedImagePaths.length,
						});

						wasRenamed = true;

						// Add any warnings from rename
						if (renameResult.errors && renameResult.errors.length > 0) {
							warnings.push(...renameResult.errors);
						}
					} else {
						// Rename failed - add errors and continue with normal processing
						StreamLogger.warn(`[MeetingProcessor.process] Rename failed, will create new file`, {
							errors: renameResult.errors,
						});
						if (renameResult.errors) {
							warnings.push(...renameResult.errors);
						}
					}
				} else {
					// Same path - just an update to existing note
					StreamLogger.log(`[MeetingProcessor.process] Note exists at expected path, will merge updates`, {
						notePath: existingNote.metadata.notePath,
					});
				}
			}

			// Process each page and collect screenshot paths and image update mappings
			const screenshotPaths: string[] = [];
			const imageUpdates: ImageUpdateMapping[] = [];
			const pageImagePaths: Array<{ pageNumber: number; imagePath: string }> = [];

			if (pages && pages.length > 0) {
				for (let i = 0; i < pages.length; i++) {
					const page = pages[i];
					const pageNum = i + 1;

					try {
						StreamLogger.log(`[MeetingProcessor.process] Processing page ${pageNum}/${totalPages}`);

						// Find resources for this page
						const pageResources = resources?.filter(r => r.pid === page.id) || [];
						StreamLogger.log(`[MeetingProcessor.process] Found ${pageResources.length} resources for page ${pageNum}`);

						// Extract screenshot if available
						const screenshot = pageResources.find(r => r.resourceType === ResourceType.SCREENSHOT);

						if (screenshot && config.extractImages) {
							const screenshotData = await StreamingZipUtils.extractFile(zipReader, screenshot.fileName);
							if (screenshotData) {
								const screenshotPath = FileUtils.joinPath(
									resourcesFolder,
									`${noteSlug}-page-${pageNum}.png`
								);
								const result = await ImageCacheBuster.updateImageWithCacheBust(
									context.vault,
									screenshotPath,
									new Uint8Array(screenshotData.buffer)
								);
								createdFiles.push(result.newPath);
								screenshotPaths.push(result.newPath);

								// If we have existing metadata, use it to track the old image path
								// This handles cases where the note was renamed and slug changed
								const oldImageFromMetadata = existingNote?.metadata.pages.find(p => p.page === pageNum)?.image;

								// Track image updates for merge
								if (result.oldPath) {
									imageUpdates.push({
										pageNumber: pageNum,
										oldPath: result.oldPath,
										newPath: result.newPath,
									});
									StreamLogger.log(`[MeetingProcessor.process] Updated screenshot: ${result.oldPath} -> ${result.newPath}`);
								} else if (oldImageFromMetadata && oldImageFromMetadata !== result.newPath) {
									// ImageCacheBuster didn't find the old file (slug mismatch after rename)
									// But we have it from metadata - add manual update mapping
									imageUpdates.push({
										pageNumber: pageNum,
										oldPath: oldImageFromMetadata,
										newPath: result.newPath,
									});
									StreamLogger.log(`[MeetingProcessor.process] Image update from metadata: ${oldImageFromMetadata} -> ${result.newPath}`);

									// Clean up the old image file
									try {
										const oldImageFile = context.vault.getAbstractFileByPath(oldImageFromMetadata);
										if (oldImageFile instanceof TFile) {
											await context.vault.delete(oldImageFile);
											StreamLogger.log(`[MeetingProcessor.process] Deleted old image: ${oldImageFromMetadata}`);
										}
									} catch (err) {
										StreamLogger.warn(`[MeetingProcessor.process] Could not delete old image: ${oldImageFromMetadata}`, err);
									}
								} else {
									StreamLogger.log(`[MeetingProcessor.process] Created new screenshot: ${result.newPath}`);
								}

								// Track page metadata for frontmatter
								pageImagePaths.push({
									pageNumber: pageNum,
									imagePath: result.newPath,
								});
							}
						}
					} catch (pageError) {
						const err = pageError as Error;
						errors.push(`Error processing page ${pageNum}: ${err.message}`);
						StreamLogger.error(`[MeetingProcessor.process] Error on page ${pageNum}:`, err);
					}
				}
			}

			// Build screenshot sections manually (for new files)
			let screenshotSections = "";
			for (let i = 0; i < screenshotPaths.length; i++) {
				const screenshotPath = screenshotPaths[i];
				const pageNum = i + 1;
				// Get just the filename with resources/ prefix for wiki-style links
				const relativePath = screenshotPath.split("/").slice(-2).join("/");
				screenshotSections += `## Page ${pageNum}

![[${relativePath}]]

### Notes

*Add your notes here*

---

`;
			}

			// Generate or merge note file
			const notePath = await this.generateOrMergeNoteFile(
				context,
				config,
				noteOutputFolder,
				resourcesFolder,
				{
					noteId: noteId,
					dropboxFileId: dropboxFileId,
					noteName,
					noteSlug,
					totalPages,
					createTime: TemplateEngine.formatDate(createTime, "YYYY-MM-DD HH:mm"),
					modifiedTime: TemplateEngine.formatDate(modifiedTime, "YYYY-MM-DD HH:mm"),
					meetingDate: TemplateEngine.formatDate(createTime, "YYYY-MM-DD"),
					lastModified: noteInfo.lastModifiedTime,
					screenshotSections,
				},
				createTime,
				modifiedTime,
				pageImagePaths,
				imageUpdates,
				metadataManager
			);
			// Only add to createdFiles if not already added during rename
			if (notePath && !wasRenamed) {
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
			StreamLogger.error(`[MeetingProcessor.process] Fatal error:`, err);
			return {
				success: false,
				createdFiles,
				errors: [`Failed to process Meeting module note: ${err.message}`],
			};
		}
	}

	private static async generateOrMergeNoteFile(
		context: ProcessorContext,
		config: MeetingModuleConfig,
		outputFolder: string,
		_resourcesFolder: string,
		data: Record<string, unknown>,
		createTime: Date,
		modifiedTime: Date,
		pageImagePaths: Array<{ pageNumber: number; imagePath: string }>,
		imageUpdates: ImageUpdateMapping[],
		metadataManager: MetadataManager
	): Promise<string | null> {
		try {
			// Use the note name as filename
			const filename = `${data.noteName}.md`;
			const filepath = FileUtils.joinPath(outputFolder, filename);

			// Generate metadata key for settings
			const metadataKey = MarkdownMerger.getMetadataKey(filepath);

			// Create metadata object
			const metadata = {
				noteId: data.noteId as string,
				dropboxFileId: data.dropboxFileId as string,
				lastModified: data.lastModified as number,
				notePath: filepath,
				pages: pageImagePaths.map(p => ({
					page: p.pageNumber,
					image: p.imagePath,
				})),
			};

			StreamLogger.log(`[MeetingProcessor.generateOrMergeNoteFile] Created metadata for ${filepath}`, {
				key: metadataKey,
				pageImagePathsCount: pageImagePaths.length,
				pageImagePaths: pageImagePaths,
				metadataPages: metadata.pages
			});

			// Check if file exists
			const existingFile = context.vault.getAbstractFileByPath(filepath);

			if (existingFile instanceof TFile) {
				// File exists - check if we have metadata
				const existingMetadata = metadataManager.get(metadataKey);

				// File exists - use merge strategy
				StreamLogger.log(`[MeetingProcessor.generateOrMergeNoteFile] Merging existing file: ${filepath}`, {
					pageCount: pageImagePaths.length,
					imageUpdates: imageUpdates.length,
					hasMetadata: !!existingMetadata,
				});

				const existingContent = await context.vault.read(existingFile);

				// Always merge to preserve user content and update metadata
				const mergedContent = MarkdownMerger.merge(
					existingContent,
					pageImagePaths,
					imageUpdates,
					modifiedTime
				);

				await context.vault.modify(existingFile, mergedContent);
				StreamLogger.log(`[MeetingProcessor.generateOrMergeNoteFile] Merged note file with user edits preserved and metadata updated`);
			} else {
				// New file - generate from template
				StreamLogger.log(`[MeetingProcessor.generateOrMergeNoteFile] Creating new note file: ${filepath}`);
				const defaultTemplate = await TemplateDefaults.load("viwoods-meeting-note.md");
				const template = await context.templateResolver.resolve(config.meetingTemplate, defaultTemplate);
				const content = TemplateEngine.render(template, data, createTime);
				await context.vault.create(filepath, content);
			}

			// Save metadata to separate file
			metadataManager.set(metadataKey, metadata);
			// Note: metadata will be saved by ViwoodsProcessor after processing

			StreamLogger.log(`[MeetingProcessor.generateOrMergeNoteFile] Note file saved: ${filepath}`);
			return filepath;
		} catch (error) {
			StreamLogger.error("[MeetingProcessor.generateOrMergeNoteFile] Failed to generate/merge note file:", error);
			return null;
		}
	}
}
