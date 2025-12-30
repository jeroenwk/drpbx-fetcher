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

			// Strategy: Replace Related Notes section, and replace images in Tasks & Notes while preserving user content
			let merged = existingContent;

			// 1. Replace ## Related Notes section
			const relatedNotesStart = merged.indexOf('## Related Notes');
			const tasksNotesStart = merged.indexOf('## Tasks & Notes', relatedNotesStart);

			const newRelatedNotesStart = newContent.indexOf('## Related Notes');
			const newTasksNotesStart = newContent.indexOf('## Tasks & Notes', newRelatedNotesStart);

			if (relatedNotesStart !== -1 && tasksNotesStart !== -1 && newRelatedNotesStart !== -1 && newTasksNotesStart !== -1) {
				// Replace Related Notes section
				const newRelatedNotesSection = newContent.substring(newRelatedNotesStart, newTasksNotesStart);
				merged = merged.substring(0, relatedNotesStart) + newRelatedNotesSection + merged.substring(tasksNotesStart);
			}

			// 2. Replace images in Tasks & Notes section (wiki-style image embeds)
			// Extract new images from new content
			const newImagesMatch = newContent.match(/!\[\[[^\]]+\.(png|jpg|jpeg|gif|webp)\]\]/gi);
			if (newImagesMatch && newImagesMatch.length > 0) {
				// Remove old images and surrounding blank lines from merged content
				merged = merged.replace(/!\[\[[^\]]+\.(png|jpg|jpeg|gif|webp)\]\](\n\n)?/gi, '');

				// Find the ## Tasks & Notes section and add new images at the end
				const finalTasksNotesStart = merged.indexOf('## Tasks & Notes');
				const finalSeparator = merged.indexOf('\n---\n', finalTasksNotesStart);

				if (finalTasksNotesStart !== -1 && finalSeparator !== -1) {
					// Clean up multiple consecutive newlines before inserting images
					let beforeSeparator = merged.substring(0, finalSeparator);
					// Replace 3 or more newlines with just 2 (one blank line)
					beforeSeparator = beforeSeparator.replace(/\n{3,}/g, '\n\n');

					// Insert images before the final separator
					const imagesText = '\n' + newImagesMatch.join('\n\n') + '\n';
					merged = beforeSeparator + imagesText + merged.substring(finalSeparator);
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