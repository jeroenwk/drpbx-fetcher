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

			// Daily notes: only replace the "## Related Notes" section
			// This preserves user content in "## Tasks & Notes" section
			let merged = existingContent;

			// Find the "## Related Notes" section in existing content
			const relatedNotesStart = merged.indexOf('## Related Notes');
			const nextSectionStart = merged.indexOf('\n## ', relatedNotesStart + 1); // Find next ## heading

			if (relatedNotesStart !== -1 && nextSectionStart !== -1) {
				// Find the same section in new content
				const newRelatedNotesStart = newContent.indexOf('## Related Notes');
				const newNextSectionStart = newContent.indexOf('\n## ', newRelatedNotesStart + 1);

				if (newRelatedNotesStart !== -1 && newNextSectionStart !== -1) {
					// Extract the new Related Notes section (including the heading, up to but not including next heading)
					const newRelatedNotesSection = newContent.substring(newRelatedNotesStart, newNextSectionStart);
					// Replace old section with new section
					merged = merged.substring(0, relatedNotesStart) + newRelatedNotesSection + merged.substring(nextSectionStart);
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