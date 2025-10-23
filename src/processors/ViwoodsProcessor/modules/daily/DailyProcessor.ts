import { ZipReader } from "@zip.js/zip.js";
import { StreamingZipUtils } from "../../../../utils/StreamingZipUtils";
import { StreamLogger } from "../../../../utils/StreamLogger";
import { ProcessorContext, ProcessorResult, FileMetadata } from "../../../types";
import { DailyModuleConfig } from "../../ViwoodsTypes";
import { NotesBeanHandler } from "./NotesBeanHandler";
import { PageImageProcessor } from "./PageImageProcessor";
import { RelatedNotesManager } from "./RelatedNotesManager";
import { TemplateRenderer } from "./TemplateRenderer";
import { NoteFileManager } from "./NoteFileManager";

/**
 * Handles processing of Daily module notes (daily journal)
 * Refactored into logical components for better maintainability
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
			// Step 1: Extract and validate NotesBean
			const notesBeanResult = await NotesBeanHandler.extractAndValidate(zipReader);
			if (!notesBeanResult.success) {
				errors.push(notesBeanResult.error || 'Unknown error');
				return { success: false, createdFiles, errors };
			}

			const notesBeanData = notesBeanResult.data;
			if (!notesBeanData) {
				errors.push('NotesBean data is null');
				return { success: false, createdFiles, errors };
			}
			const { notesBean, date, dateString, dateSlug, createTime, modifiedTime } = notesBeanData;

			// Step 2: Ensure folder structure
			await NoteFileManager.ensureFolderStructure(context.vault, config.dailyNotesFolder);

			// Step 3: Extract and process page images
			const noteList = await this.extractNoteList(zipReader);
			const pageImageData = await PageImageProcessor.processPageImages(
				zipReader,
				context.vault,
				config.dailyNotesFolder,
				dateSlug,
				noteList
			);

			warnings.push(...pageImageData.warnings);

			// Step 4: Find related notes
			const relatedNotesContent = await RelatedNotesManager.findAndFormatRelatedNotes(date, context);

			// Step 5: Render template
			const content = await TemplateRenderer.renderDailyNoteTemplate(
				context,
				config,
				notesBean,
				dateString,
				dateSlug,
				createTime,
				modifiedTime,
				pageImageData.pageImages,
				relatedNotesContent,
				date
			);

			// Step 6: Write daily note file
			const fileResult = await NoteFileManager.writeDailyNote(
				context,
				config,
				dateString,
				content
			);

			createdFiles.push(fileResult.notePath);

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

	private static async extractNoteList(zipReader: ZipReader<Blob>): Promise<any[]> {
		try {
			const allFiles = await StreamingZipUtils.listFiles(zipReader);
			const noteListFile = allFiles.find(f => f.endsWith("_NoteList.json"));

			if (noteListFile) {
				const result = await StreamingZipUtils.extractJson(zipReader, noteListFile);
				return (result as any[]) || [];
			}

			return [];
		} catch (error: unknown) {
			StreamLogger.error(`[DailyProcessor.extractNoteList] Error extracting note list:`, error);
			return [];
		}
	}
}