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
		originalPath: string,
		metadata: FileMetadata,
		config: DailyModuleConfig,
		context: ProcessorContext
	): Promise<ProcessorResult> {
		StreamLogger.log(`[DailyProcessor.process] Starting Daily module processing`);
		StreamLogger.log(`[DailyProcessor.process] Original filename: ${originalPath}`);
		const createdFiles: string[] = [];
		const errors: string[] = [];
		const warnings: string[] = [];

		try {
			// Step 1: Extract date from filename (e.g., "day_2025_10_6.note")
			const dateFromFilename = this.parseDateFromFilename(originalPath);
			if (!dateFromFilename) {
				errors.push(`Unable to parse date from filename: ${originalPath}`);
				return { success: false, createdFiles, errors };
			}

			StreamLogger.log(`[DailyProcessor.process] Parsed date from filename: ${dateFromFilename.dateString}`);

			// Step 2: Extract and validate NotesBean
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
			const { notesBean, createTime, modifiedTime } = notesBeanData;

			// Override NotesBean dates with filename dates for consistency
			const date = dateFromFilename.date;
			const dateString = dateFromFilename.dateString;
			const dateSlug = dateFromFilename.dateSlug;

			// Step 3: Ensure folder structure
			await NoteFileManager.ensureFolderStructure(context.vault, config.dailyNotesFolder);

			// Step 4: Extract and process page images
			const noteList = await this.extractNoteList(zipReader);
			const pageImageData = await PageImageProcessor.processPageImages(
				zipReader,
				context.vault,
				config.dailyNotesFolder,
				dateSlug,
				noteList
			);

			warnings.push(...pageImageData.warnings);

			// Step 5: Find related notes
			const relatedNotesContent = await RelatedNotesManager.findAndFormatRelatedNotes(date, context);

			// Step 6: Render template
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

			// Step 7: Write daily note file
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

	private static parseDateFromFilename(filename: string): { date: Date; dateString: string; dateSlug: string } | null {
		try {
			// Extract filename from path
			const basename = filename.split('/').pop() || filename;

			// Match pattern: day_YYYY_M_D.note or day_YYYY_MM_DD.note
			const match = basename.match(/day_(\d{4})_(\d{1,2})_(\d{1,2})\.note$/);

			if (!match) {
				StreamLogger.error(`[DailyProcessor.parseDateFromFilename] Filename doesn't match expected pattern: ${basename}`);
				return null;
			}

			const year = parseInt(match[1]);
			const month = parseInt(match[2]);
			const day = parseInt(match[3]);

			// Validate date components
			if (month < 1 || month > 12 || day < 1 || day > 31) {
				StreamLogger.error(`[DailyProcessor.parseDateFromFilename] Invalid date components: year=${year}, month=${month}, day=${day}`);
				return null;
			}

			// Create date object (use UTC to avoid timezone issues)
			const date = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
			const dateString = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
			const dateSlug = `${year}${String(month).padStart(2, '0')}${String(day).padStart(2, '0')}`;

			StreamLogger.log(`[DailyProcessor.parseDateFromFilename] Successfully parsed date: ${dateString}`);

			return { date, dateString, dateSlug };

		} catch (error: unknown) {
			StreamLogger.error(`[DailyProcessor.parseDateFromFilename] Error parsing date from filename:`, error);
			return null;
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