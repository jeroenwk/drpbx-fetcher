import { Vault } from "obsidian";
import { FileUtils } from "../../../../utils/FileUtils";
import { StreamLogger } from "../../../../utils/StreamLogger";
import { ProcessorContext } from "../../../types";
import { DailyModuleConfig } from "../../ViwoodsTypes";

export class NoteFileManager {
	public static async ensureFolderStructure(
		vault: Vault,
		dailyNotesFolder: string
	): Promise<void> {
		await FileUtils.ensurePath(vault, dailyNotesFolder);
	}

	public static async writeDailyNote(
		context: ProcessorContext,
		config: DailyModuleConfig,
		dateString: string,
		content: string
	): Promise<{ notePath: string; wasExisting: boolean }> {
		const dailyNotesFolder = config.dailyNotesFolder;
		const notePath = FileUtils.joinPath(dailyNotesFolder, `Daily note ${dateString}.md`);
		const noteExists = await context.vault.adapter.exists(notePath);

		if (noteExists) {
			// Existing note - merge preserving user content
			StreamLogger.log(`[NoteFileManager.writeDailyNote] Merging with existing daily note: ${notePath}`);
			const mergedContent = await this.mergeWithExistingNote(context, notePath, content);
			await context.vault.adapter.write(notePath, mergedContent);
			StreamLogger.log(`[NoteFileManager.writeDailyNote] Updated existing daily note`);
		} else {
			// New note - write fresh content
			await context.vault.adapter.write(notePath, content);
			StreamLogger.log(`[NoteFileManager.writeDailyNote] Created new daily note: ${notePath}`);
		}

		return {
			notePath,
			wasExisting: noteExists
		};
	}

	private static async mergeWithExistingNote(
		context: ProcessorContext,
		notePath: string,
		newContent: string
	): Promise<string> {
		try {
			const existingContent = await context.vault.adapter.read(notePath);

			// Daily notes don't need merge logic for images since ImageCacheBuster handles it
			// Just regenerate the Tasks & Notes section (specifically the related notes list)
			let merged = existingContent;

			// Replace "Tasks & Notes" section with new content
			const tasksNotesStart = merged.indexOf('## Tasks & Notes');
			const nextSectionStart = merged.indexOf('\n---\n', tasksNotesStart);

			if (tasksNotesStart !== -1 && nextSectionStart !== -1) {
				const newTasksNotesStart = newContent.indexOf('## Tasks & Notes');
				const newNextSectionStart = newContent.indexOf('\n---\n', newTasksNotesStart);

				if (newTasksNotesStart !== -1 && newNextSectionStart !== -1) {
					const newTasksNotesSection = newContent.substring(newTasksNotesStart, newNextSectionStart + 5); // Include "---\n"
					merged = merged.substring(0, tasksNotesStart) + newTasksNotesSection + merged.substring(nextSectionStart + 5);
				}
			}

			return merged;

		} catch (error: unknown) {
			StreamLogger.error(`[NoteFileManager.mergeWithExistingNote] Error merging note:`, error);
			// If merging fails, return the new content to avoid data loss
			return newContent;
		}
	}
}