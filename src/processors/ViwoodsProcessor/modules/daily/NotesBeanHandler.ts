import { ZipReader } from "@zip.js/zip.js";
import { StreamingZipUtils } from "../../../../utils/StreamingZipUtils";
import { StreamLogger } from "../../../../utils/StreamLogger";
import { NotesBean } from "../../ViwoodsTypes";

export interface NotesBeanData {
	notesBean: NotesBean;
	date: Date;
	dateString: string;
	dateSlug: string;
	createTime: number;
	modifiedTime: number;
}

export class NotesBeanHandler {
	public static async extractAndValidate(
		zipReader: ZipReader<Blob>
	): Promise<{ success: boolean; data?: NotesBeanData; error?: string }> {
		try {
			StreamLogger.log(`[NotesBeanHandler.extractAndValidate] Starting NotesBean extraction`);

			// Find NotesBean file
			const allFiles = await StreamingZipUtils.listFiles(zipReader);
			const notesBeanFile = allFiles.find(f => f.endsWith("_NotesBean.json"));

			if (!notesBeanFile) {
				return {
					success: false,
					error: "No NotesBean.json found - not a valid Daily module note"
				};
			}

			// Extract NotesBean
			StreamLogger.log(`[NotesBeanHandler.extractAndValidate] Extracting NotesBean: ${notesBeanFile}`);
			const notesBean = await StreamingZipUtils.extractJson<NotesBean>(zipReader, notesBeanFile);

			if (!notesBean) {
				return {
					success: false,
					error: "Failed to parse NotesBean.json"
				};
			}

			// Validate required fields
			const validationResult = this.validateNotesBean(notesBean);
			if (!validationResult.isValid) {
				return {
					success: false,
					error: validationResult.error
				};
			}

			// Extract and process date information
			const dateData = this.processDateInfo(notesBean);

			StreamLogger.log(`[NotesBeanHandler.extractAndValidate] Successfully processed NotesBean`, {
				dateString: dateData.dateString,
				createTime: dateData.createTime,
				modifiedTime: dateData.modifiedTime,
				lastTab: notesBean.lastTab
			});

			return {
				success: true,
				data: {
					notesBean,
					...dateData
				}
			};

		} catch (error: unknown) {
			const err = error as Error;
			StreamLogger.error(`[NotesBeanHandler.extractAndValidate] Error:`, error);
			return {
				success: false,
				error: `Failed to extract NotesBean: ${err.message}`
			};
		}
	}

	private static validateNotesBean(notesBean: NotesBean): { isValid: boolean; error?: string } {
		const { year, month, day } = notesBean;

		if (!year || !month || !day) {
			return {
				isValid: false,
				error: "NotesBean.json missing date fields (year, month, day)"
			};
		}

		return { isValid: true };
	}

	private static processDateInfo(notesBean: NotesBean): {
		date: Date;
		dateString: string;
		dateSlug: string;
		createTime: number;
		modifiedTime: number;
	} {
		const { year, month, day } = notesBean;

		// Create date object and formatted string
		// Use UTC date to avoid timezone issues when matching dates
		const date = new Date(Date.UTC(year!, month! - 1, day!, 12, 0, 0)); // month is 1-indexed in NotesBean, set to noon UTC
		const dateString = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
		const dateSlug = `${year}${String(month).padStart(2, '0')}${String(day).padStart(2, '0')}`;

		const createTime = notesBean.creationTime || Date.now();
		const modifiedTime = notesBean.lastModifiedTime || createTime;

		return {
			date,
			dateString,
			dateSlug,
			createTime,
			modifiedTime
		};
	}
}