import { Vault } from "obsidian";
import { FileUtils } from "../../../../utils/FileUtils";
import { StreamLogger } from "../../../../utils/StreamLogger";
import { ProcessorContext } from "../../../types";
import { DailyModuleConfig, ViwoodsProcessorConfig } from "../../ViwoodsTypes";
import { ContentPreserver } from "../../utils/ContentPreserver";
import { getViwoodsAttachmentsFolder } from "../../ViwoodsTypes";

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
		viwoodsConfig: ViwoodsProcessorConfig,
		dateString: string,
		content: string
	): Promise<{ notePath: string; wasExisting: boolean }> {
		const dailyNotesFolder = config.dailyNotesFolder;
		const notePath = FileUtils.joinPath(dailyNotesFolder, `Daily note ${dateString}.md`);
		const noteExists = await context.vault.adapter.exists(notePath);

		// Get Viwoods attachments folder for ContentPreserver
		const attachmentsFolder = getViwoodsAttachmentsFolder(config, viwoodsConfig, context);

		if (noteExists) {
			// Existing note - merge preserving user content using ContentPreserver
			StreamLogger.log(`[NoteFileManager.writeDailyNote] Merging with existing daily note: ${notePath}`);
			const existingContent = await context.vault.adapter.read(notePath);

			const result = ContentPreserver.preserve(
				existingContent,
				content,
				attachmentsFolder
			);

			await context.vault.adapter.write(notePath, result.content);
			StreamLogger.log(`[NoteFileManager.writeDailyNote] Updated existing daily note`, {
				preservedTextBlocks: result.preservedTextBlocks,
				preservedAttachments: result.preservedAttachments,
				preservedCalloutBlocks: result.preservedCalloutBlocks,
			});
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
}
