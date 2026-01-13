import { TemplaterParser } from "./TemplaterParser";
import { TemplaterContextBuilder } from "./TemplaterContext";
import { TemplaterExecutor } from "./TemplaterExecutor";
import type { ProcessorContext } from "../types";

/**
 * Templater-compatible template engine
 *
 * Supports:
 * - Dynamic commands: <% code %> - Outputs result of code execution
 * - Execution commands: <%* code %> - Executes code, outputs via tR variable
 * - Comments: <%# comment %> - Ignored
 *
 * Template API (tp object):
 * - tp.date - Date functions (now, tomorrow, yesterday, weekday)
 * - tp.file - File operations and metadata
 * - tp.frontmatter - YAML frontmatter property access
 * - tp.app - Direct Obsidian App API access
 * - tp.obsidian - Full Obsidian API namespace
 * - tp.config - Template execution configuration
 * - tp.user - Custom variables from render() call
 *
 * Example:
 * ```
 * const template = `
 * ---
 * created: <% tp.date.now("YYYY-MM-DD") %>
 * author: <% tp.user.authorName %>
 * ---
 *
 * # <% tp.user.title %>
 *
 * <%* if (tp.user.includeMetadata) { %>
 * **Created:** <% tp.date.now("MMMM DD, YYYY") %>
 * <%* } %>
 * `;
 *
 * const result = await TemplateEngine.render(
 *   template,
 *   { authorName: "John Doe", title: "My Note", includeMetadata: true },
 *   context,
 *   { filePath: "MyNote.md", createTime: new Date() }
 * );
 * ```
 */
export class TemplateEngine {
	/**
	 * Render a template with Templater syntax
	 *
	 * @param template Template string with Templater commands
	 * @param variables Custom variables accessible via tp.user
	 * @param context Processor context (vault, app, etc.)
	 * @param metadata Optional file metadata (path, content, dates)
	 * @returns Rendered template string
	 */
	static async render(
		template: string,
		variables: Record<string, unknown>,
		context: ProcessorContext,
		metadata?: {
			filePath?: string;
			content?: string;
			createTime?: Date;
			modifiedTime?: Date;
			dropboxFileId?: string;
		}
	): Promise<string> {
		// Parse template into tokens
		const parser = new TemplaterParser();
		const tokens = parser.parse(template);

		// Build execution context with tp object
		const templaterContext = TemplaterContextBuilder.build(
			context,
			variables,
			metadata
		);

		// Create executor
		const executor = new TemplaterExecutor();

		// Process each token and collect output
		const outputs: string[] = [];

		for (const token of tokens) {
			switch (token.type) {
				case "text":
					// Text tokens: output as-is
					outputs.push(token.content);
					break;

				case "comment":
					// Comment tokens: skip (don't output anything)
					break;

				case "dynamic":
					// Dynamic commands: execute and output result
					{
						const result = await executor.executeDynamic(
							token.content,
							templaterContext
						);
						outputs.push(result);
					}
					break;

				case "execution":
					// Execution commands: execute and output tR value
					{
						const result = await executor.executeScript(
							token.content,
							templaterContext
						);
						outputs.push(result);
					}
					break;
			}
		}

		// Join all outputs to create final rendered template
		return outputs.join("");
	}

	/**
	 * Check if a template contains Templater commands
	 * @param template Template string to check
	 * @returns True if template contains Templater commands
	 */
	static hasCommands(template: string): boolean {
		const parser = new TemplaterParser();
		return parser.hasCommands(template);
	}

	/**
	 * Utility: Format a date using moment.js format string
	 * Used by processors to pre-format dates before passing to templates
	 */
	static formatDate(date: Date | string, format: string): string {
		// eslint-disable-next-line @typescript-eslint/no-var-requires
		const { moment } = require("obsidian");
		return moment(date).format(format);
	}

	/**
	 * Utility: Escape markdown special characters
	 * This is kept for compatibility with old TemplateEngine API
	 * @deprecated Perform escaping in templates using JavaScript if needed
	 */
	static escapeMarkdown(text: string): string {
		console.warn(
			"[Templater] TemplateEngine.escapeMarkdown() is deprecated. Use JavaScript string operations in templates instead."
		);
		return text.replace(/([*_`[\]()#+\-.!])/g, "\\$1");
	}

	/**
	 * Utility: Truncate text to maximum length
	 * This is kept for compatibility with old TemplateEngine API
	 * @deprecated Perform truncation in templates using JavaScript if needed
	 */
	static truncate(text: string, maxLength: number, suffix = "..."): string {
		console.warn(
			"[Templater] TemplateEngine.truncate() is deprecated. Use JavaScript string operations in templates instead."
		);
		if (text.length <= maxLength) {
			return text;
		}
		return text.substring(0, maxLength - suffix.length) + suffix;
	}
}
