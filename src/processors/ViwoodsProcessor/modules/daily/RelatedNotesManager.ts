import { StreamLogger } from "../../../../utils/StreamLogger";
import { CrossReferenceManager } from "../../../../utils/CrossReferenceManager";
import { ProcessorContext } from "../../../types";
import { FileTypeMapping } from "../../../../models/Settings";
import { ViwoodsProcessorConfig } from "../../ViwoodsTypes";

export interface RelatedNotesData {
	hasRelatedNotes: boolean;
	relatedPaper: string;
	relatedMeeting: string;
	relatedMemo: string;
	relatedLearning: string;
	relatedPicking: string;
}

export class RelatedNotesManager {
	public static async findAndFormatRelatedNotes(
		date: Date,
		context: ProcessorContext
	): Promise<string> {
		try {
			const dateString = date.toISOString().split('T')[0];
			StreamLogger.log(`[RelatedNotesManager.findAndFormatRelatedNotes] Finding related notes for ${dateString}...`);

			const viwoodsConfig = this.getViwoodsConfig(context);
			StreamLogger.log(`[RelatedNotesManager.findAndFormatRelatedNotes] Viwoods config found: ${!!viwoodsConfig}`);

			if (!viwoodsConfig) {
				StreamLogger.log(`[RelatedNotesManager.findAndFormatRelatedNotes] No Viwoods config found, using default data`);
				return this.formatRelatedNotesContent(this.getDefaultRelatedNotesData());
			}

			const relatedNotesData = await this.findRelatedNotes(date, context, viwoodsConfig);
			StreamLogger.log(`[RelatedNotesManager.findAndFormatRelatedNotes] Found ${relatedNotesData.hasRelatedNotes ? 'some' : 'no'} related notes for ${dateString}`);
			StreamLogger.log(`[RelatedNotesManager.findAndFormatRelatedNotes] Related data:`, JSON.stringify(relatedNotesData, null, 2));

			return this.formatRelatedNotesContent(relatedNotesData);

		} catch (error: unknown) {
			StreamLogger.error(`[RelatedNotesManager.findAndFormatRelatedNotes] Error:`, error);
			return '*Error finding related notes*';
		}
	}

	private static getViwoodsConfig(context: ProcessorContext): ViwoodsProcessorConfig | undefined {
		const config = context.pluginSettings.fileTypeMappings
			.find((m: FileTypeMapping) => m.processorType === 'viwoods')?.config as ViwoodsProcessorConfig;

		StreamLogger.log(`[RelatedNotesManager.getViwoodsConfig] File type mappings found: ${context.pluginSettings.fileTypeMappings.length}`);
		StreamLogger.log(`[RelatedNotesManager.getViwoodsConfig] Viwoods config found: ${!!config}`);

		if (config) {
			StreamLogger.log(`[RelatedNotesManager.getViwoodsConfig] Paper enabled: ${config.paper.enabled}`);
			StreamLogger.log(`[RelatedNotesManager.getViwoodsConfig] Meeting enabled: ${config.meeting.enabled}`);
			StreamLogger.log(`[RelatedNotesManager.getViwoodsConfig] Memo enabled: ${config.memo.enabled}`);
			StreamLogger.log(`[RelatedNotesManager.getViwoodsConfig] Learning enabled: ${config.learning.enabled}`);
			StreamLogger.log(`[RelatedNotesManager.getViwoodsConfig] Picking enabled: ${config.picking.enabled}`);
		}

		return config;
	}

	private static async findRelatedNotes(
		date: Date,
		context: ProcessorContext,
		viwoodsConfig: ViwoodsProcessorConfig
	): Promise<RelatedNotesData> {
		const relatedNotes = await CrossReferenceManager.findNotesByDate(
			date,
			context.vault,
			viwoodsConfig
		);

		return CrossReferenceManager.formatRelatedNotes(relatedNotes);
	}

	private static getDefaultRelatedNotesData(): RelatedNotesData {
		return {
			hasRelatedNotes: false,
			relatedPaper: '',
			relatedMeeting: '',
			relatedMemo: '',
			relatedLearning: '',
			relatedPicking: ''
		};
	}

	private static formatRelatedNotesContent(relatedNotesData: RelatedNotesData): string {
		if (!relatedNotesData.hasRelatedNotes) {
			return '*No related notes found for this date*';
		}

		let content = '';

		if (relatedNotesData.relatedPaper) {
			content += `### Paper Notes\n\n${relatedNotesData.relatedPaper}\n\n`;
		}
		if (relatedNotesData.relatedMeeting) {
			content += `### Meeting Notes\n\n${relatedNotesData.relatedMeeting}\n\n`;
		}
		if (relatedNotesData.relatedMemo) {
			content += `### Memos\n\n${relatedNotesData.relatedMemo}\n\n`;
		}
		if (relatedNotesData.relatedLearning) {
			content += `### Learning Notes\n\n${relatedNotesData.relatedLearning}\n\n`;
		}
		if (relatedNotesData.relatedPicking) {
			content += `### Quick Captures\n\n${relatedNotesData.relatedPicking}\n\n`;
		}

		return content;
	}
}