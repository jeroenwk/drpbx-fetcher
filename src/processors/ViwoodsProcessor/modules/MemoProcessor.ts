import { ZipReader } from "@zip.js/zip.js";
import { TFile } from "obsidian";
import { StreamLogger } from "../../../utils/StreamLogger";
import { TemplateEngine } from "../../templates/TemplateEngine";
import { ProcessorContext, ProcessorResult, FileMetadata } from "../../types";
import { FileTypeMapping } from "../../../models/Settings";
import {
	MemoModuleConfig,
	DailyModuleConfig,
	ViwoodsProcessorConfig,
	ViwoodsNoteMetadata,
	getViwoodsAttachmentsFolder
} from "../ViwoodsTypes";
import { StreamingZipUtils } from "../../../utils/StreamingZipUtils";
import { FileUtils } from "../../../utils/FileUtils";
import { TemplateDefaults } from "../TemplateDefaults";
import { ImageCacheBuster } from "../../../utils/ImageCacheBuster";
import { MetadataManager } from "../utils/MetadataManager";
import { NoteRenameHandler } from "../utils/NoteRenameHandler";
import { MarkdownMerger } from "../utils/MarkdownMerger";
import { CrossReferenceManager } from "../utils/CrossReferenceManager";

interface MemoNotesBean {
	counter: number;
	creationTime: number;
	deleteTime: number;
	fileName: string;
	fileStatus: number;
	fileType: number;
	hasRecognition: number;
	hasRemind: number;
	id: string;
	isCollect: boolean;
	isDelete: boolean;
	isOpen: number;
	isTodo: number;
	isTodoFinished: number;
	isTop: boolean;
	lastModifiedTime: number;
	lastPageIndex: number;
	pageCount: number;
	penWidth: number;
	recordingDuration: number;
	remindTime: number;
	requestCode: number;
	templateId: number;
	userId: string;
}

interface MemoNoteListEntry {
	id: string;
	fileId: string;
	order: number;
	pageFileName: string;
	pageShotFileName: string;
	width: number;
	height: number;
	creationTime: number;
	lastModifiedTime: number;
	pageType: number;
	pageStatus: number;
	templateId: number;
	bottomY: number;
	isHasAudioRecord: boolean;
	isHasToDo: boolean;
	userId: string;
}

interface MemoTemplateVariables extends Record<string, unknown> {
	noteSlug: string;
	created: string;
	modified: string;
	memoType: string;
	reminderLine: string;
	memoContent: string;
	todoTag: string;
	memoImagePath?: string;
}

/**
 * Simple memo merger to preserve user content when updating memo files
 */
class MemoMerger {
	/**
	 * Merge existing memo content with new template data, preserving user edits
	 * Only updates the image path and modified timestamp, preserves everything else
	 */
	static mergeMemo(
		existingContent: string,
		newImageDataPath: string | null,
		modifiedTime: Date
	): string {
		const lines = existingContent.split('\n');
		const result: string[] = [];

		let imageUpdated = false;

		for (let i = 0; i < lines.length; i++) {
			const line = lines[i];

			// Update the modified timestamp
			if (line.startsWith('**Modified:**')) {
				result.push(`**Modified:** ${modifiedTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit', year: 'numeric' })}`);
				continue;
			}

			// Update the image path if we have a new image
			if (newImageDataPath && line.startsWith('![[') && line.endsWith(']]')) {
				result.push(`![[${newImageDataPath}]]`);
				imageUpdated = true;
				continue;
			}

			// Keep everything else exactly as is
			result.push(line);
		}

		// If we didn't find an image to update but have a new image, add it after the first empty line after metadata
		if (newImageDataPath && !imageUpdated) {
			const insertIndex = result.findIndex(line => line.trim() === '' && result.indexOf(line) > 2);
			if (insertIndex > 0) {
				// Insert after the empty line
				result.splice(insertIndex + 1, 0, '## Content', '', `![[${newImageDataPath}]]`);
			}
		}

		return result.join('\n');
	}
}

/**
 * Handles processing of Memo module notes (text memos with todo integration)
 */
export class MemoProcessor {
	/**
	 * Add white background to PNG image data
	 */
	private static async addWhiteBackground(imageData: Uint8Array): Promise<Uint8Array> {
		try {
			// Create image from binary data
			const blob = new Blob([imageData], { type: 'image/png' });
			const img = new Image();

			await new Promise((resolve, reject) => {
				img.onload = resolve;
				img.onerror = reject;
				img.src = URL.createObjectURL(blob);
			});

			// Create canvas with white background
			const canvas = document.createElement('canvas');
			canvas.width = img.width;
			canvas.height = img.height;

			const ctx = canvas.getContext('2d');
			if (!ctx) {
				throw new Error('Could not get canvas context');
			}

			// Fill with white background
			ctx.fillStyle = 'white';
			ctx.fillRect(0, 0, canvas.width, canvas.height);

			// Draw original image on top
			ctx.drawImage(img, 0, 0);

			// Convert back to PNG
			const processedBlob = await new Promise<Blob>((resolve) => {
				canvas.toBlob((blob) => {
					resolve(blob!);
				}, 'image/png');
			});

			// Clean up
			URL.revokeObjectURL(img.src);

			return new Uint8Array(await processedBlob.arrayBuffer());
		} catch (error) {
			StreamLogger.warn('[MemoProcessor.addWhiteBackground] Failed to add white background, using original image', error);
			return imageData; // Return original if processing fails
		}
	}
	/**
	 * Process Memo module text notes
	 */
	public static async process(
		zipReader: ZipReader<Blob>,
		_fileData: Uint8Array,
		originalPath: string,
		metadata: FileMetadata,
		config: MemoModuleConfig,
		context: ProcessorContext,
		metadataManager: MetadataManager,
		viwoodsConfig: ViwoodsProcessorConfig
	): Promise<ProcessorResult> {
		StreamLogger.log(`[MemoProcessor.process] Starting memo processing for ${metadata.name}`);

		const createdFiles: string[] = [];
		const errors: string[] = [];
		const warnings: string[] = [];

		try {
			// Find JSON files
			const allFiles = await StreamingZipUtils.listFiles(zipReader);
			StreamLogger.log(`[MemoProcessor.process] Files in ZIP:`, { count: allFiles.length });

			const headerInfoFile = allFiles.find(f => f.endsWith("_HeaderInfo.json"));
			const notesBeanFile = allFiles.find(f => f.endsWith("_NotesBean.json"));
			const noteListFile = allFiles.find(f => f.endsWith("_NoteList.json"));

			if (!headerInfoFile || !notesBeanFile || !noteListFile) {
				errors.push("Missing required metadata files in memo note");
				return { success: false, createdFiles, errors };
			}

			// Extract metadata files
			const headerInfo = await StreamingZipUtils.extractJson<any>(zipReader, headerInfoFile);
			const notesBean = await StreamingZipUtils.extractJson<MemoNotesBean>(zipReader, notesBeanFile);
			const noteList = await StreamingZipUtils.extractJson<MemoNoteListEntry[]>(zipReader, noteListFile);

			if (!headerInfo || !notesBean || !noteList) {
				throw new Error("Failed to parse memo metadata files");
			}

			// Verify this is a memo module
			if (headerInfo.packageName !== "com.wisky.memo") {
				throw new Error(`Invalid package name for memo module: ${headerInfo.packageName}`);
			}

			StreamLogger.log(`[MemoProcessor.process] Processing memo: ${notesBean.fileName} (Todo: ${notesBean.isTodo === 1}, Finished: ${notesBean.isTodoFinished === 1})`);

			// Extract basic info
			const noteName = notesBean.fileName || FileUtils.getBasename(metadata.name);
			const noteSlug = FileUtils.slugify(noteName);
			const createTime = new Date(notesBean.creationTime);
			const modifiedTime = new Date(notesBean.lastModifiedTime);

			// Get note identifiers for rename detection
			const noteId = notesBean.id; // Viwoods internal note ID (stable across renames)
			const dropboxFileId = metadata.id; // Dropbox file ID (changes on rename)

			StreamLogger.log(`[MemoProcessor.process] Note identifiers:`, {
				noteId,
				dropboxFileId,
			});

			// Determine initial output folder
			let noteOutputFolder = config.memosFolder;

			// Check if this note already exists (by noteId) - if so, it might be renamed
			const existingNote = metadataManager.findByNoteId(noteId);

			if (existingNote) {
				// Check if the current file path matches the expected path
				const expectedNotePath = FileUtils.joinPath(noteOutputFolder, `${noteName}.md`);

				if (existingNote.metadata.notePath !== expectedNotePath) {
					// File path doesn't match - note was renamed
					StreamLogger.log(`[MemoProcessor.process] Detected renamed memo`, {
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
						StreamLogger.log(`[MemoProcessor.process] Rename successful, will continue to update content/images`, {
							oldPath: renameResult.oldNotePath,
							newPath: renameResult.newNotePath,
						});

						// Update the output folder to the new location
						noteOutputFolder = FileUtils.getParentPath(renameResult.newNotePath) || noteOutputFolder;
					} else {
						StreamLogger.error(`[MemoProcessor.process] Rename failed:`, renameResult.errors);
						errors.push(`Failed to rename memo: ${renameResult.errors?.join(', ') || 'Unknown error'}`);
					}
				}
			}

			// Ensure output folders exist
			await FileUtils.ensurePath(context.vault, noteOutputFolder);

			// Use Viwoods attachments folder (with fallback to global)
			const attachmentsFolder = getViwoodsAttachmentsFolder(config, viwoodsConfig, context);
			await FileUtils.ensurePath(context.vault, attachmentsFolder);
			const resourcesFolder = attachmentsFolder; // Alias for compatibility with existing code

			// Process main image resource only
			const mainImagePath = `${resourcesFolder}/${noteName}-image.png`;

			// Extract main image with cache-busting
			let mainImageData = await StreamingZipUtils.extractFile(zipReader, `${noteList[0]?.id}.png`);
			let finalImagePath: string | null = null;

			if (mainImageData) {
				// Add white background to the image
				mainImageData = await this.addWhiteBackground(mainImageData);

				// Use ImageCacheBuster to handle image updates properly
				const imageResult = await ImageCacheBuster.updateImageWithCacheBust(
					context.vault,
					mainImagePath,
					mainImageData
				);

				finalImagePath = imageResult.newPath;
				createdFiles.push(finalImagePath);
				StreamLogger.log(`[MemoProcessor.process] Extracted and processed main image with cache-busting: ${finalImagePath}`);
			} else {
				warnings.push("Main image not found in memo note");
			}

			// Prepare template variables
			const templateVariables: MemoTemplateVariables = {
				noteSlug,
				created: createTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit', year: 'numeric' }),
				modified: modifiedTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit', year: 'numeric' }),
				memoType: notesBean.isTodo === 1 ? 'Todo Item' : 'Memo',
				reminderLine: notesBean.hasRemind === 1 && notesBean.remindTime > 0 ?
					`**Reminder:** ${new Date(notesBean.remindTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit', year: 'numeric' })}` : '',
				memoContent: notesBean.isTodo === 1 ?
					`\n\n## Todo Status\n\n- [${notesBean.isTodoFinished === 1 ? 'x' : ' '}] ${noteName}` :
					'',
				todoTag: notesBean.isTodo === 1 ? ' #todo' : '',
			};

			// Write markdown file with merge support
			const markdownPath = `${noteOutputFolder}/${noteName}.md`;
			const existingFile = context.vault.getAbstractFileByPath(markdownPath);

			if (existingFile instanceof TFile) {
				// File exists - merge to preserve user content
				StreamLogger.log(`[MemoProcessor.process] Merging existing memo file: ${markdownPath}`);

				const existingContent = await context.vault.read(existingFile);

				// Get relative image path for the memo file
				const relativeImagePath = finalImagePath ?
					finalImagePath.replace(`${noteOutputFolder}/`, '') : '';

				// Merge content while preserving user edits
				const mergedContent = MemoMerger.mergeMemo(
					existingContent,
					relativeImagePath,
					modifiedTime
				);

				await context.vault.modify(existingFile, mergedContent);
				StreamLogger.log(`[MemoProcessor.process] Merged memo file with user edits preserved`);
			} else {
				// New file - generate from template
				StreamLogger.log(`[MemoProcessor.process] Creating new memo file: ${markdownPath}`);

				// Add image path to template variables
				templateVariables.memoImagePath = finalImagePath ?
					finalImagePath.replace(`${noteOutputFolder}/`, '') : '';

				const templateContent = config.memoTemplate || await TemplateDefaults.load("viwoods-memo.md");
				const markdownContent = await TemplateEngine.render(templateContent, templateVariables, context, {
					createTime: createTime
				});

				await context.vault.create(markdownPath, markdownContent);
				StreamLogger.log(`[MemoProcessor.process] Created new memo markdown: ${markdownPath}`);
			}
			createdFiles.push(markdownPath);

			// Track metadata for rename detection
			const memoMetadata: ViwoodsNoteMetadata = {
				noteId,
				dropboxFileId,
				lastModified: modifiedTime.getTime(),
				creationTime: createTime.getTime(), // Track creation time for cross-referencing
				notePath: markdownPath,
				pages: finalImagePath ? [{
					page: 1,
					image: finalImagePath.replace(`${FileUtils.getParentPath(markdownPath) || ''}/`, '')
				}] : [],
			};

			metadataManager.set(MarkdownMerger.getMetadataKey(markdownPath), memoMetadata);
			StreamLogger.log(`[MemoProcessor.process] Tracked memo metadata for rename detection`, {
				noteId,
				notePath: markdownPath,
				hasImage: !!finalImagePath,
			});

			// Incremental update: add link to daily note if it exists
			try {
				const viwoodsConfig = context.pluginSettings.fileTypeMappings
					.find((m: FileTypeMapping) => m.processorType === 'viwoods')?.config;

				const dailyConfig = (viwoodsConfig as Record<string, unknown>)?.daily as DailyModuleConfig | undefined;
				if (dailyConfig && dailyConfig.enabled) {
					const dailyNotePath = CrossReferenceManager.getDailyNotePath(
						createTime,
						dailyConfig.dailyNotesFolder
					);

					if (await context.vault.adapter.exists(dailyNotePath)) {
						await CrossReferenceManager.addLinkToDailyNote(
							context.vault,
							dailyNotePath,
							{
								path: markdownPath,
								name: notesBean.fileName || "Memo",
								module: 'memo'
							}
						);
						StreamLogger.log(`[MemoProcessor.process] Added link to daily note: ${dailyNotePath}`);
					}
				}
			} catch (error) {
				// Non-fatal - log but don't fail processing
				StreamLogger.warn(`[MemoProcessor.process] Failed to update daily note:`, error);
			}

			return {
				success: true,
				createdFiles,
				errors,
				warnings,
			};

		} catch (error) {
			const errorMessage = `Failed to process memo note: ${error instanceof Error ? error.message : String(error)}`;
			StreamLogger.log(`[MemoProcessor.process] ${errorMessage}`);
			errors.push(errorMessage);

			return {
				success: false,
				createdFiles,
				errors,
				warnings,
			};
		}
	}
}
