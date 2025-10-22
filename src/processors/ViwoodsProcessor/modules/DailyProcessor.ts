import { ZipReader } from "@zip.js/zip.js";
import { FileUtils } from "../../../utils/FileUtils";
import { StreamingZipUtils } from "../../../utils/StreamingZipUtils";
import { StreamLogger } from "../../../utils/StreamLogger";
import { TemplateEngine } from "../../templates/TemplateEngine";
import { ProcessorContext, ProcessorResult, FileMetadata } from "../../types";
import { FileTypeMapping } from "../../../models/Settings";
import { DailyModuleConfig, NotesBean, NoteListEntry, ViwoodsProcessorConfig } from "../ViwoodsTypes";
import { TemplateDefaults } from "../TemplateDefaults";
import { ImageCacheBuster } from "../../../utils/ImageCacheBuster";
import { MarkdownMerger, ImageUpdateMapping } from "../utils/MarkdownMerger";
import { CrossReferenceManager } from "../../../utils/CrossReferenceManager";

/**
 * Handles processing of Daily module notes (daily journal)
 */
export class DailyProcessor {
	/**
	 * Process Daily module journal notes
	 */
	public static async process(
		zipReader: ZipReader<Blob>,
		_fileData: Uint8Array,
		_originalPath: string,
		metadata: FileMetadata,
		config: DailyModuleConfig,
		context: ProcessorContext
	): Promise<ProcessorResult> {
		StreamLogger.log(`[DailyProcessor.process] Starting Daily module processing`);
		const createdFiles: string[] = [];
		const errors: string[] = [];
		const warnings: string[] = [];

		try {
			// Find JSON files
			const allFiles = await StreamingZipUtils.listFiles(zipReader);
			StreamLogger.log(`[DailyProcessor.process] Files in ZIP:`, { count: allFiles.length });

			const notesBeanFile = allFiles.find(f => f.endsWith("_NotesBean.json"));
			const noteListFile = allFiles.find(f => f.endsWith("_NoteList.json"));

			if (!notesBeanFile) {
				errors.push("No NotesBean.json found - not a valid Daily module note");
				return { success: false, createdFiles, errors };
			}

			// Extract NotesBean
			StreamLogger.log(`[DailyProcessor.process] Extracting NotesBean: ${notesBeanFile}`);
			const notesBean = await StreamingZipUtils.extractJson<NotesBean>(zipReader, notesBeanFile);

			if (!notesBean) {
				errors.push("Failed to parse NotesBean.json");
				return { success: false, createdFiles, errors };
			}

			// Extract date from NotesBean
			const year = notesBean.year;
			const month = notesBean.month;
			const day = notesBean.day;

			if (!year || !month || !day) {
				errors.push("NotesBean.json missing date fields (year, month, day)");
				return { success: false, createdFiles, errors };
			}

			// Create date object and formatted string
			const date = new Date(year, month - 1, day); // month is 1-indexed in NotesBean
			const dateString = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
			const dateSlug = `${year}${String(month).padStart(2, '0')}${String(day).padStart(2, '0')}`;

			const createTime = notesBean.creationTime || Date.now();
			const modifiedTime = notesBean.lastModifiedTime || createTime;

			StreamLogger.log(`[DailyProcessor.process] Daily note date: ${dateString}`, {
				year,
				month,
				day,
				createTime,
				modifiedTime,
				lastTab: notesBean.lastTab
			});

			// Determine output folder and paths
			const dailyNotesFolder = config.dailyNotesFolder;
			await FileUtils.ensurePath(context.vault, dailyNotesFolder);

			// Create resources subfolder
			const resourcesFolder = FileUtils.joinPath(dailyNotesFolder, "resources");
			await FileUtils.ensurePath(context.vault, resourcesFolder);

			// Extract note list (page images)
			const noteList = noteListFile
				? await StreamingZipUtils.extractJson<NoteListEntry[]>(zipReader, noteListFile)
				: [];

			const totalPages = noteList?.length || 0;
			StreamLogger.log(`[DailyProcessor.process] Found ${totalPages} pages`);

			// Process page images
			const pageImages: string[] = [];
			const timestamp = Date.now(); // Single timestamp for cache-busting

			if (noteList && noteList.length > 0) {
				// Sort by page order
				const sortedPages = noteList.sort((a, b) => a.pageOrder - b.pageOrder);

				for (const [index, entry] of sortedPages.entries()) {
					try {
						// Extract image from ZIP
						const imageName = `${entry.id}.png`;
						const imageData = await StreamingZipUtils.extractFile(zipReader, imageName);

						if (!imageData) {
							warnings.push(`Failed to extract page image: ${entry.id}`);
							continue;
						}

						// Generate output filename
						const outputName = `${dateSlug}-page-${index + 1}.png`;
						const resourcePath = FileUtils.joinPath(resourcesFolder, outputName);

						// Save image
						await context.vault.adapter.writeBinary(resourcePath, imageData.buffer as ArrayBuffer);

						// Add with query parameter cache-busting for template
						const cacheBustedPath = `resources/${outputName}?t=${timestamp}`;
						pageImages.push(`![[${cacheBustedPath}]]`);

						StreamLogger.log(`[DailyProcessor.process] Extracted page ${index + 1}: ${outputName}`);
					} catch (error) {
						StreamLogger.error(`[DailyProcessor.process] Failed to extract page image ${entry.id}:`, error);
						warnings.push(`Failed to extract page image: ${entry.id}`);
					}
				}
			}

			// Find related notes from other modules
			StreamLogger.log(`[DailyProcessor.process] Finding related notes for ${dateString}...`);
			const viwoodsConfig = context.pluginSettings.fileTypeMappings
				.find((m: FileTypeMapping) => m.processorType === 'viwoods')?.config;

			let relatedNotesData = {
				hasRelatedNotes: false,
				relatedPaper: '',
				relatedMeeting: '',
				relatedMemo: '',
				relatedLearning: '',
				relatedPicking: ''
			};

			if (viwoodsConfig) {
				const relatedNotes = await CrossReferenceManager.findNotesByDate(
					date,
					context.vault,
					viwoodsConfig as ViwoodsProcessorConfig
				);
				relatedNotesData = CrossReferenceManager.formatRelatedNotes(relatedNotes);
			}

			// Prepare template variables
			const variables = {
				date: dateString,
				dateSlug: dateSlug,
				createTime: new Date(createTime).toLocaleString(),
				modifiedTime: new Date(modifiedTime).toLocaleString(),
				lastTab: notesBean.lastTab || '',
				pageImages: pageImages.join('\n\n') || '*No journal pages*',
				...relatedNotesData
			};

			// Get template
			const defaultTemplate = await TemplateDefaults.load("viwoods-daily-note.md");
			const template = await context.templateResolver.resolve(config.template, defaultTemplate);

			// Check if daily note already exists
			const notePath = FileUtils.joinPath(dailyNotesFolder, `${dateString}.md`);
			const noteExists = await context.vault.adapter.exists(notePath);

			if (noteExists) {
				// Existing note - merge preserving user content
				StreamLogger.log(`[DailyProcessor.process] Merging with existing daily note: ${notePath}`);

				const existingContent = await context.vault.adapter.read(notePath);
				const newContent = await TemplateEngine.render(template, variables, date);

				// Build image update mappings for cache-busting
				const imageUpdates: ImageUpdateMapping[] = [];
				const oldImagePattern = /resources\/(\d+)-page-(\d+)\.png\?t=(\d+)/g;
				let match;
				while ((match = oldImagePattern.exec(existingContent)) !== null) {
					const pageNum = parseInt(match[2]);
					const oldPath = `resources/${dateSlug}-page-${pageNum}.png?t=${match[3]}`;
					const newPath = `resources/${dateSlug}-page-${pageNum}.png?t=${timestamp}`;
					imageUpdates.push({
						pageNumber: pageNum,
						oldPath,
						newPath
					});
				}

				// Merge, preserving user content but regenerating "Related Notes" section
				// Note: MarkdownMerger.merge expects pageImagePaths array, but we're using a different approach
				// for daily notes. We'll do a simple merge manually
				let merged = existingContent;

				// Update image paths with new cache-busting timestamps
				for (const imageUpdate of imageUpdates) {
					merged = merged.replace(imageUpdate.oldPath, imageUpdate.newPath);
				}

				// Replace "Related Notes" section with new content
				const relatedNotesStart = merged.indexOf('## Related Notes');
				const nextSectionStart = merged.indexOf('\n---\n', relatedNotesStart);

				if (relatedNotesStart !== -1 && nextSectionStart !== -1) {
					const newRelatedNotesStart = newContent.indexOf('## Related Notes');
					const newNextSectionStart = newContent.indexOf('\n---\n', newRelatedNotesStart);

					if (newRelatedNotesStart !== -1 && newNextSectionStart !== -1) {
						const newRelatedNotesSection = newContent.substring(newRelatedNotesStart, newNextSectionStart + 5); // Include "---\n"
						merged = merged.substring(0, relatedNotesStart) + newRelatedNotesSection + merged.substring(nextSectionStart + 5);
					}
				}

				await context.vault.adapter.write(notePath, merged);
				StreamLogger.log(`[DailyProcessor.process] Updated existing daily note`);
			} else {
				// New note - render fresh from template
				const content = await TemplateEngine.render(template, variables, date);
				await context.vault.adapter.write(notePath, content);
				StreamLogger.log(`[DailyProcessor.process] Created new daily note: ${notePath}`);
			}

			createdFiles.push(notePath);

			return {
				success: true,
				createdFiles,
				errors: errors.length > 0 ? errors : undefined,
				warnings: warnings.length > 0 ? warnings : undefined,
			};
		} catch (error: unknown) {
			const err = error as Error;
			StreamLogger.error(`[DailyProcessor.process] Error:`, error);
			return {
				success: false,
				createdFiles,
				errors: [`Failed to process daily note: ${err.message}`],
			};
		}
	}
}
