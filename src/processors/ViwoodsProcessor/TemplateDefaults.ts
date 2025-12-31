// Import template files directly as text (esbuild will bundle them)
import highlightTemplate from "./modules/learning/Highlight Template.md";
import epubAnnotationTemplate from "./modules/learning/EPUB Annotation Template.md";
import paperNoteTemplate from "./modules/paper/Note Template.md";
import dailyTemplate from "./modules/daily/Daily Template.md";
import meetingTemplate from "./modules/meeting/Meeting Template.md";
import pickingTemplate from "./modules/picking/Picking Template.md";
import memoTemplate from "./modules/memo/Memo Template.md";

/**
 * Default templates for viwoods processor
 * Using Templater syntax (<% %>) for template commands
 * Templates are loaded from .md files in module folders and bundled at build time
 */
export class TemplateDefaults {
	// Map of template keys to their content
	private static templates: Record<string, string> = {
		// Learning module templates
		"viwoods-highlight.md": highlightTemplate,
		"viwoods-epub-annotation.md": epubAnnotationTemplate,

		// Paper module templates
		"viwoods-paper-note.md": paperNoteTemplate,

		// Daily module templates
		"viwoods-daily-note.md": dailyTemplate,

		// Meeting module templates
		"viwoods-meeting-note.md": meetingTemplate,

		// Picking module templates
		"viwoods-picking-capture.md": pickingTemplate,

		// Memo module templates
		"viwoods-memo.md": memoTemplate,
	};

	/**
	 * Load a template by name
	 */
	public static load(name: string): Promise<string> {
		return Promise.resolve(this.templates[name] || "");
	}

	/**
	 * Get all templates as a record
	 * Used by ViwoodsProcessor.getDefaultTemplates()
	 */
	public static getAll(): Record<string, string> {
		return { ...this.templates };
	}
}
