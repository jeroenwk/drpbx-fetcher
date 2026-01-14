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
		context?: ProcessorContext,
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

		// Build combined code that accumulates output in tR variable
		// This allows execution blocks to span multiple tokens and maintain scope
		let combinedCode = 'let tR = "";\n';

		for (const token of tokens) {
			switch (token.type) {
				case "text": {
					// Escape special characters for template literal
					const escaped = token.content
						.replace(/\\/g, '\\\\')
						.replace(/`/g, '\\`')
						.replace(/\$/g, '\\$');
					combinedCode += `tR += \`${escaped}\`;\n`;
					break;
				}

				case "dynamic":
					// Dynamic commands: execute and append result to tR
					combinedCode += `tR += String(${token.content});\n`;
					break;

				case "execution":
					// Execution commands: execute as-is (can modify tR directly)
					combinedCode += token.content + '\n';
					break;

				case "comment":
					// Comments are ignored
					break;
			}
		}

		combinedCode += 'return tR;';

		// Execute the combined code once with shared scope
		const output = await executor.executeCombined(combinedCode, templaterContext);
		return output;
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
}
