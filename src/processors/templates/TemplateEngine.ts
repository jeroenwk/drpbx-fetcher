import { moment } from "obsidian";

/**
 * Simple template engine supporting Obsidian-style template syntax
 * Supports:
 * - {{variable}} - Simple variable replacement
 * - {{date:FORMAT}} - Formatted current date
 * - {{time:FORMAT}} - Formatted current time
 */
export class TemplateEngine {
	/**
	 * Render a template with provided variables
	 * @param template Template string
	 * @param variables Variables to replace in template
	 * @param date Optional date to use for date/time formatting (defaults to now)
	 * @returns Rendered template
	 */
	static render(
		template: string,
		variables: Record<string, any>,
		date?: Date
	): string {
		const renderDate = date || new Date();
		let result = template;

		// Replace {{date:FORMAT}} and {{date}}
		result = result.replace(/\{\{date(?::([^}]+))?\}\}/g, (match, format) => {
			if (format) {
				return moment(renderDate).format(format);
			}
			return moment(renderDate).format("YYYY-MM-DD");
		});

		// Replace {{time:FORMAT}} and {{time}}
		result = result.replace(/\{\{time(?::([^}]+))?\}\}/g, (match, format) => {
			if (format) {
				return moment(renderDate).format(format);
			}
			return moment(renderDate).format("HH:mm");
		});

		// Replace {{variable}} with values from variables object
		result = result.replace(/\{\{([a-zA-Z0-9_-]+)\}\}/g, (match, key) => {
			if (key === "date" || key === "time") {
				// Already handled above
				return match;
			}

			const value = variables[key];
			if (value === undefined || value === null) {
				return ""; // Replace with empty string if not found
			}

			// Convert to string
			if (typeof value === "object") {
				return JSON.stringify(value, null, 2);
			}

			return String(value);
		});

		return result;
	}

	/**
	 * Format a date using moment.js format string
	 * @param date Date to format
	 * @param format Moment.js format string
	 * @returns Formatted date string
	 */
	static formatDate(date: Date | string, format: string): string {
		return moment(date).format(format);
	}

	/**
	 * Escape markdown special characters
	 * @param text Text to escape
	 * @returns Escaped text
	 */
	static escapeMarkdown(text: string): string {
		return text.replace(/([*_`[\]()#+\-.!])/g, "\\$1");
	}

	/**
	 * Truncate text to maximum length
	 * @param text Text to truncate
	 * @param maxLength Maximum length
	 * @param suffix Suffix to add if truncated
	 * @returns Truncated text
	 */
	static truncate(text: string, maxLength: number, suffix = "..."): string {
		if (text.length <= maxLength) {
			return text;
		}
		return text.substring(0, maxLength - suffix.length) + suffix;
	}
}
