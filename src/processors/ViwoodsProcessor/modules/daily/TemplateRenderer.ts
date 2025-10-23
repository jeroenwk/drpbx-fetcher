import { StreamLogger } from "../../../../utils/StreamLogger";
import { TemplateEngine } from "../../../templates/TemplateEngine";
import { TemplateDefaults } from "../../TemplateDefaults";
import { DailyModuleConfig, NotesBean } from "../../ViwoodsTypes";
import { ProcessorContext } from "../../../types";

export interface TemplateVariables extends Record<string, unknown> {
	date: string;
	dateSlug: string;
	createTime: string;
	modifiedTime: string;
	lastTabLine: string;
	pageImages: string;
	relatedNotesContent: string;
}

export class TemplateRenderer {
	public static async renderDailyNoteTemplate(
		context: ProcessorContext,
		config: DailyModuleConfig,
		notesBean: NotesBean,
		dateString: string,
		dateSlug: string,
		createTime: number,
		modifiedTime: number,
		pageImages: string[],
		relatedNotesContent: string,
		date: Date
	): Promise<string> {
		try {
			StreamLogger.log(`[TemplateRenderer.renderDailyNoteTemplate] Starting template rendering`);

			// Build last tab line
			const lastTabLine = notesBean.lastTab ? `**Last Tab:** ${notesBean.lastTab}` : '';

			// Prepare template variables
			const variables: TemplateVariables = {
				date: dateString,
				dateSlug: dateSlug,
				createTime: new Date(createTime).toLocaleString(),
				modifiedTime: new Date(modifiedTime).toLocaleString(),
				lastTabLine: lastTabLine,
				pageImages: pageImages.join('\n\n') || '*No journal pages*',
				relatedNotesContent: relatedNotesContent
			};

			// Get template
			const defaultTemplate = await TemplateDefaults.load("viwoods-daily-note.md");
			const template = await context.templateResolver.resolve(config.template, defaultTemplate);

			// Render template
			const content = await TemplateEngine.render(template, variables, date);

			StreamLogger.log(`[TemplateRenderer.renderDailyNoteTemplate] Template rendered successfully`);

			return content;

		} catch (error: unknown) {
			const err = error as Error;
			StreamLogger.error(`[TemplateRenderer.renderDailyNoteTemplate] Error:`, error);
			throw new Error(`Failed to render daily note template: ${err.message}`);
		}
	}
}