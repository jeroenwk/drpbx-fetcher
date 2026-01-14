import { ZipReader } from "@zip.js/zip.js";
import { TFile } from "obsidian";
import { FileUtils } from "../../../utils/FileUtils";
import { StreamingZipUtils } from "../../../utils/StreamingZipUtils";
import { StreamLogger } from "../../../utils/StreamLogger";
import { TemplateEngine } from "../../templates/TemplateEngine";
import { ProcessorContext, ProcessorResult, FileMetadata } from "../../types";
import { FileTypeMapping } from "../../../models/Settings";
import {
	PaperModuleConfig,
	NoteFileInfo,
	PageListFileInfo,
	PageResource,
	ResourceType,
	DailyModuleConfig,
	ViwoodsProcessorConfig,
	getViwoodsAttachmentsFolder
} from "../ViwoodsTypes";
import { TemplateDefaults } from "../TemplateDefaults";
import { ImageCacheBuster } from "../../../utils/ImageCacheBuster";
import { MarkdownMerger, ImageUpdateMapping } from "../utils/MarkdownMerger";
import { ContentPreserver } from "../utils/ContentPreserver";
import { MetadataManager } from "../utils/MetadataManager";
import { NoteRenameHandler } from "../utils/NoteRenameHandler";
import { CrossReferenceManager } from "../utils/CrossReferenceManager";

/**
 * Handles processing of Paper module notes (handwritten notes)
 */
export class PaperProcessor {
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
	 * Process Paper module handwritten notes
	 */
	public static async process(
		zipReader: ZipReader<Blob>,
		fileData: Uint8Array,
		originalPath: string,
		metadata: FileMetadata,
		config: PaperModuleConfig,
		context: ProcessorContext,
		metadataManager: MetadataManager,
		viwoodsConfig: ViwoodsProcessorConfig
	): Promise<ProcessorResult> {
		StreamLogger.log(`[PaperProcessor.process] Starting Paper module processing`);
		const createdFiles: string[] = [];
		const errors: string[] = [];
		const warnings: string[] = [];

		try {
			// Find JSON files
			const allFiles = await StreamingZipUtils.listFiles(zipReader);
			StreamLogger.log(`[PaperProcessor.process] Files in ZIP:`, { count: allFiles.length });
			StreamLogger.log(`[PaperProcessor.process] All files in ZIP:`, { files: allFiles });

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
			StreamLogger.log(`[PaperProcessor.process] Extracting NoteFileInfo: ${noteFileInfoFile}`);
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

			StreamLogger.log(`[PaperProcessor.process] Note info:`, {
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
					StreamLogger.log(`[PaperProcessor.process] Preserving folder structure: ${noteOutputFolder}`);
				}
			}

			// Ensure output folders exist
			await FileUtils.ensurePath(context.vault, noteOutputFolder);

			// Use Viwoods attachments folder (with fallback to global)
			const attachmentsFolder = getViwoodsAttachmentsFolder(config, viwoodsConfig, context);
			await FileUtils.ensurePath(context.vault, attachmentsFolder);
			const resourcesFolder = attachmentsFolder; // Alias for compatibility with existing code

			// Extract pages metadata
			const pages = pageListFile
				? await StreamingZipUtils.extractJson<PageListFileInfo[]>(zipReader, pageListFile)
				: [];
			const resources = pageResourceFile
				? await StreamingZipUtils.extractJson<PageResource[]>(zipReader, pageResourceFile)
				: [];

			const totalPages = pages?.length || 0;
			StreamLogger.log(`[PaperProcessor.process] Found ${totalPages} pages and ${resources?.length || 0} resources`);

			// Get note identifiers
			const noteId = noteInfo.id; // Viwoods internal note ID (stable across renames)
			const dropboxFileId = metadata.id; // Dropbox file ID (changes on rename)

			StreamLogger.log(`[PaperProcessor.process] Note identifiers:`, {
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
					StreamLogger.log(`[PaperProcessor.process] Detected renamed note`, {
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
						StreamLogger.log(`[PaperProcessor.process] Rename successful, will continue to update content/images`, {
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
						StreamLogger.warn(`[PaperProcessor.process] Rename failed, will create new file`, {
							errors: renameResult.errors,
						});
						if (renameResult.errors) {
							warnings.push(...renameResult.errors);
						}
					}
				} else {
					// Same path - just an update to existing note
					StreamLogger.log(`[PaperProcessor.process] Note exists at expected path, will merge updates`, {
						notePath: existingNote.metadata.notePath,
					});
				}
			}

			// Process each page and collect screenshot paths and image update mappings
			const screenshotPaths: string[] = [];
			const imageUpdates: ImageUpdateMapping[] = [];
			const pageImagePaths: Array<{ pageNumber: number; imagePath: string; imageId: number; pageId: string }> = [];

			if (pages && pages.length > 0) {
				for (let i = 0; i < pages.length; i++) {
					const page = pages[i];
					const pageNum = i + 1;

					try {
						StreamLogger.log(`[PaperProcessor.process] Processing page ${pageNum}/${totalPages}`);

						// Find resources for this page
						const pageResources = resources?.filter(r => r.pid === page.id) || [];
						StreamLogger.log(`[PaperProcessor.process] Found ${pageResources.length} resources for page ${pageNum}`);

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
									StreamLogger.log(`[PaperProcessor.process] Updated screenshot: ${result.oldPath} -> ${result.newPath}`);
								} else if (oldImageFromMetadata && oldImageFromMetadata !== result.newPath) {
									// ImageCacheBuster didn't find the old file (slug mismatch after rename)
									// But we have it from metadata - add manual update mapping
									imageUpdates.push({
										pageNumber: pageNum,
										oldPath: oldImageFromMetadata,
										newPath: result.newPath,
									});
									StreamLogger.log(`[PaperProcessor.process] Image update from metadata: ${oldImageFromMetadata} -> ${result.newPath}`);

									// Clean up the old image file
									try {
										const oldImageFile = context.vault.getAbstractFileByPath(oldImageFromMetadata);
										if (oldImageFile instanceof TFile) {
											await context.vault.delete(oldImageFile);
											StreamLogger.log(`[PaperProcessor.process] Deleted old image: ${oldImageFromMetadata}`);
										}
									} catch (err) {
										StreamLogger.warn(`[PaperProcessor.process] Could not delete old image: ${oldImageFromMetadata}`, err);
									}
								} else {
									StreamLogger.log(`[PaperProcessor.process] Created new screenshot: ${result.newPath}`);
								}

								// Track page metadata for frontmatter
								const blockId = `${this.hashToNumericString(dropboxFileId)}-${pageNum}`;
								pageImagePaths.push({
									pageNumber: pageNum,
									imagePath: result.newPath,
									imageId: result.timestamp,
									pageId: blockId,
								});
							}
						}
					} catch (pageError) {
						const err = pageError as Error;
						errors.push(`Error processing page ${pageNum}: ${err.message}`);
						StreamLogger.error(`[PaperProcessor.process] Error on page ${pageNum}:`, err);
					}
				}
			}

			// Extract audio files from the .note file
			const audioFiles: Array<{ fileName: string; path: string; timestamp?: number }> = [];

			// First, try to use PageResource.json to identify audio resources (note-level audio has pid = noteId)
			const audioResources = resources?.filter(
				r => r.resourceType === ResourceType.AUDIO && r.pid === noteId
			) || [];

			StreamLogger.log(`[PaperProcessor.process] Found ${audioResources.length} audio resources in PageResource.json`);

			// Extract audio files based on resource metadata
			const audioFilesInZip: string[] = [];
			if (audioResources.length > 0) {
				// Use resource metadata to find audio files
				for (const audioResource of audioResources) {
					audioFilesInZip.push(`audio/${audioResource.fileName}`);
				}
				StreamLogger.log(`[PaperProcessor.process] Audio files from resources:`, { audioFilesInZip });
			} else {
				// Fallback: scan audio/ folder (backward compatibility)
				const scannedAudioFiles = allFiles.filter(f => f.startsWith("audio/") && (f.endsWith(".mp4") || f.endsWith(".mp3") || f.endsWith(".m4a") || f.endsWith(".wav")));
				audioFilesInZip.push(...scannedAudioFiles);
				StreamLogger.log(`[PaperProcessor.process] Audio files from folder scan (fallback):`, { audioFilesInZip });
			}

			for (const audioFilePath of audioFilesInZip) {
				try {
					// Extract just the filename from the path (e.g., "audio/audio_1768309494844.mp4" -> "audio_1768309494844.mp4")
					const pathParts = audioFilePath.split("/");
					const audioFileName = pathParts[pathParts.length - 1];
					StreamLogger.log(`[PaperProcessor.process] Processing audio file: ${audioFilePath} -> ${audioFileName}`);

					const audioData = await StreamingZipUtils.extractFile(zipReader, audioFilePath);

					if (audioData) {
						StreamLogger.log(`[PaperProcessor.process] Audio data extracted, size: ${audioData.byteLength} bytes`);
						// Use the audio filename (without the audio/ prefix)
						const targetFileName = audioFileName;
						const targetPath = FileUtils.joinPath(attachmentsFolder, targetFileName);

						StreamLogger.log(`[PaperProcessor.process] Target audio path: ${targetPath}`);

						const result = await ImageCacheBuster.updateImageWithCacheBust(
							context.vault,
							targetPath,
							new Uint8Array(audioData.buffer)
						);

						StreamLogger.log(`[PaperProcessor.process] ImageCacheBuster result:`, { oldPath: result.oldPath, newPath: result.newPath });

						createdFiles.push(result.newPath);
						audioFiles.push({
							fileName: audioFileName,
							path: result.newPath,
						});

						StreamLogger.log(`[PaperProcessor.process] Extracted audio file: ${audioFileName} -> ${result.newPath}`);
					} else {
						StreamLogger.warn(`[PaperProcessor.process] Failed to extract audio data for: ${audioFilePath}`);
					}
				} catch (audioError) {
					const err = audioError as Error;
					warnings.push(`Failed to extract audio file ${audioFilePath}: ${err.message}`);
					StreamLogger.warn(`[PaperProcessor.process] Failed to extract audio:`, err);
				}
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
					lastModified: noteInfo.lastModifiedTime,
					folderPath,
					pages: pageImagePaths,
					audioFiles,
				},
				createTime,
				modifiedTime,
				pageImagePaths,
				imageUpdates,
				metadataManager,
				viwoodsConfig
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
			StreamLogger.error(`[PaperProcessor.process] Fatal error:`, err);
			return {
				success: false,
				createdFiles,
				errors: [`Failed to process Paper module note: ${err.message}`],
			};
		}
	}

	/**
	 * Generate or merge note file
	 *
	 * Two processing paths:
	 * 1. NEW FILES: Use template with loops (explicit structure)
	 * 2. EXISTING FILES: Use ContentPreserver to preserve user content
	 *
	 * ContentPreserver approach:
	 * - Generate fresh content from template (as if creating new)
	 * - Compare with existing file to identify user additions
	 * - Merge YAML frontmatter (preserving user-added properties)
	 * - Append user-added content at bottom under "## Your Notes" section
	 */
	private static async generateOrMergeNoteFile(
		context: ProcessorContext,
		config: PaperModuleConfig,
		outputFolder: string,
		_resourcesFolder: string,
		data: Record<string, unknown>,
		createTime: Date,
		_modifiedTime: Date,
		pageImagePaths: Array<{ pageNumber: number; imagePath: string; imageId: number }>,
		_imageUpdates: ImageUpdateMapping[],
		metadataManager: MetadataManager,
		viwoodsConfig?: ViwoodsProcessorConfig
	): Promise<string | null> {
		try {
			// Use the note name as filename
			const filename = `${data.noteName}.md`;
			const filepath = FileUtils.joinPath(outputFolder, filename);

			// Generate metadata key for settings
			const metadataKey = MarkdownMerger.getMetadataKey(filepath);

			// Extract audio files from data
			const audioFiles = data.audioFiles as Array<{ fileName: string; path: string }> || [];

			// Create metadata object
			const metadata = {
				noteId: data.noteId as string,
				dropboxFileId: data.dropboxFileId as string,
				lastModified: data.lastModified as number,
				creationTime: createTime.getTime(), // Track creation time for cross-referencing
				notePath: filepath,
				pages: pageImagePaths.map(p => ({
					page: p.pageNumber,
					image: p.imagePath,
				})),
				audioFiles: audioFiles,
			};

			StreamLogger.log(`[PaperProcessor.generateOrMergeNoteFile] Created metadata for ${filepath}`, {
				key: metadataKey,
				pageImagePathsCount: pageImagePaths.length,
				audioFilesCount: audioFiles.length,
				pageImagePaths: pageImagePaths,
				metadataPages: metadata.pages
			});

			// Check if file exists
			const existingFile = context.vault.getAbstractFileByPath(filepath);

			// Load template (used for both new and existing files)
			const defaultTemplate = await TemplateDefaults.load("viwoods-paper-note.md");
			const template = await context.templateResolver.resolve(config.noteTemplate, defaultTemplate);

			if (existingFile instanceof TFile) {
				// File exists - use ContentPreserver strategy
				StreamLogger.log(`[PaperProcessor.generateOrMergeNoteFile] Using ContentPreserver for existing file: ${filepath}`, {
					pageCount: pageImagePaths.length,
					audioFilesCount: audioFiles.length,
				});

				// Read existing content
				const existingContent = await context.vault.read(existingFile);

				// Generate fresh content from template (as if creating new)
				const freshContent = await TemplateEngine.render(template, data, context, {
					createTime: createTime
				});

				// Get Viwoods attachments folder for attachment detection
				const attachmentsFolder = viwoodsConfig
					? getViwoodsAttachmentsFolder(config, viwoodsConfig, context)
					: context.pluginSettings.attachmentsFolder || "Attachments";

				// Use ContentPreserver to merge
				const result = ContentPreserver.preserve(
					existingContent,
					freshContent,
					attachmentsFolder
				);

				await context.vault.modify(existingFile, result.content);
				StreamLogger.log(`[PaperProcessor.generateOrMergeNoteFile] ContentPreserver merged note file`, {
					preservedTextBlocks: result.preservedTextBlocks,
					preservedAttachments: result.preservedAttachments,
					mergedYamlProperties: result.mergedYamlProperties
				});
			} else {
				// New file - generate from template
				StreamLogger.log(`[PaperProcessor.generateOrMergeNoteFile] Creating new note file: ${filepath}`);
				const content = await TemplateEngine.render(template, data, context, {
					createTime: createTime
				});
				await context.vault.create(filepath, content);
			}

			// Save metadata to separate file
			metadataManager.set(metadataKey, metadata);
			// Note: metadata will be saved by ViwoodsProcessor after processing

			// Incremental update: add link to daily note if it exists
			try {
				const creationDate = new Date(createTime);
				const viwoodsConfigFromSettings = context.pluginSettings.fileTypeMappings
					.find((m: FileTypeMapping) => m.processorType === 'viwoods')?.config;

				const dailyConfig = (viwoodsConfigFromSettings as Record<string, unknown>)?.daily as DailyModuleConfig | undefined;
				if (dailyConfig && dailyConfig.enabled) {
					const dailyNotePath = CrossReferenceManager.getDailyNotePath(
						creationDate,
						dailyConfig.dailyNotesFolder
					);

					if (await context.vault.adapter.exists(dailyNotePath)) {
						await CrossReferenceManager.addLinkToDailyNote(
							context.vault,
							dailyNotePath,
							{
								path: filepath,
								name: data.noteName as string,
								module: 'paper'
							}
						);
						StreamLogger.log(`[PaperProcessor.generateOrMergeNoteFile] Added link to daily note: ${dailyNotePath}`);
					}
				}
			} catch (error) {
				// Non-fatal - log but don't fail processing
				StreamLogger.warn(`[PaperProcessor.generateOrMergeNoteFile] Failed to update daily note:`, error);
			}

			StreamLogger.log(`[PaperProcessor.generateOrMergeNoteFile] Note file saved: ${filepath}`);
			return filepath;
		} catch (error) {
			StreamLogger.error("[PaperProcessor.generateOrMergeNoteFile] Failed to generate/merge note file:", error);
			return null;
		}
	}

	/**
	 * Process non-.note files for Paper module
	 * Audio files in Paper/Audio File/ are skipped - only audio files inside .note files are processed
	 */
	public static async processNonNoteFile(
		_fileData: Uint8Array,
		originalPath: string,
		_metadata: FileMetadata,
		_config: PaperModuleConfig,
		_context: ProcessorContext,
		_viwoodsConfig: ViwoodsProcessorConfig
	): Promise<ProcessorResult> {
		StreamLogger.log(`[PaperProcessor.processNonNoteFile] Skipping non-note file: ${originalPath}`);

		// Skip all non-.note files for Paper module
		// Audio files are only processed when extracted from inside .note files
		return {
			success: false,
			createdFiles: [],
			warnings: [`Paper module only processes .note files. Audio files in 'Paper/Audio File/' are skipped - only audio files inside .note files are processed.`],
		};
	}
}
