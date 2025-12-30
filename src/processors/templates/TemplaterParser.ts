/**
 * Template token types for Templater syntax
 */
export type TokenType = 'dynamic' | 'execution' | 'comment' | 'text';

/**
 * Represents a parsed token from a template
 */
export interface TemplateToken {
	/** Type of token */
	type: TokenType;
	/** Content of the token (for commands: the code; for text: the raw text) */
	content: string;
	/** Start position in original template */
	startPos: number;
	/** End position in original template */
	endPos: number;
}

/**
 * Parser for Templater-style template syntax
 *
 * Supports:
 * - Dynamic commands: <% code %> - Outputs the result of code execution
 * - Execution commands: <%* code %> - Executes code, outputs via tR variable
 * - Comments: <%# comment %> - Ignored during execution
 * - Text: Everything else is treated as literal text
 *
 * Examples:
 * - <% tp.date.now("YYYY-MM-DD") %> - Dynamic command
 * - <%* if (condition) { tR += "text"; } %> - Execution command
 * - <%# This is a comment %> - Comment
 */
export class TemplaterParser {
	/**
	 * Parse a template string into tokens
	 * @param template Template string to parse
	 * @returns Array of tokens representing the parsed template
	 */
	parse(template: string): TemplateToken[] {
		const tokens: TemplateToken[] = [];

		// Regex to match Templater commands: <% ... %>, <%* ... %>, <%# ... %>
		// Captures: ([*#]?) - command type marker (*, #, or empty)
		//           ([\s\S]+?) - command content (non-greedy, includes newlines)
		const commandRegex = /<%\s*([*#]?)\s*([\s\S]+?)\s*%>/g;

		let lastIndex = 0;
		let match: RegExpExecArray | null;

		while ((match = commandRegex.exec(template)) !== null) {
			const matchStart = match.index;
			const matchEnd = commandRegex.lastIndex;
			const marker = match[1]; // *, #, or empty string
			const content = match[2]; // The code/comment content

			// Add any text before this command as a text token
			if (matchStart > lastIndex) {
				const textContent = template.substring(lastIndex, matchStart);
				tokens.push({
					type: 'text',
					content: textContent,
					startPos: lastIndex,
					endPos: matchStart
				});
			}

			// Determine token type based on marker
			let tokenType: TokenType;
			if (marker === '*') {
				tokenType = 'execution';
			} else if (marker === '#') {
				tokenType = 'comment';
			} else {
				tokenType = 'dynamic';
			}

			// Add the command token
			tokens.push({
				type: tokenType,
				content: content,
				startPos: matchStart,
				endPos: matchEnd
			});

			lastIndex = matchEnd;
		}

		// Add any remaining text after the last command
		if (lastIndex < template.length) {
			const textContent = template.substring(lastIndex);
			tokens.push({
				type: 'text',
				content: textContent,
				startPos: lastIndex,
				endPos: template.length
			});
		}

		// If no commands found and template is not empty, return single text token
		if (tokens.length === 0 && template.length > 0) {
			tokens.push({
				type: 'text',
				content: template,
				startPos: 0,
				endPos: template.length
			});
		}

		return tokens;
	}

	/**
	 * Check if a template contains any Templater commands
	 * @param template Template string to check
	 * @returns True if template contains Templater commands
	 */
	hasCommands(template: string): boolean {
		return /<%\s*[*#]?\s*[\s\S]+?\s*%>/g.test(template);
	}
}
