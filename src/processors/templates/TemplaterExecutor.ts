import type { TemplaterContext } from "./TemplaterContext";

/**
 * Executor for JavaScript code in templates
 * Handles both dynamic commands (<% %>) and execution commands (<%* %>)
 */
export class TemplaterExecutor {
	/**
	 * Execute a dynamic command and return the result
	 * Dynamic commands output their return value
	 *
	 * Example: <% tp.date.now("YYYY-MM-DD") %>
	 *
	 * @param code JavaScript code to execute
	 * @param context Templater context with tp object
	 * @returns Result of code execution (converted to string)
	 */
	async executeDynamic(code: string, context: TemplaterContext): Promise<string> {
		try {
			const result = await this.executeCode(code, context);
			return this.convertToString(result);
		} catch (error) {
			return this.handleError(error, code, "dynamic");
		}
	}

	/**
	 * Execute an execution command and return the tR output
	 * Execution commands use the tR variable to build output
	 *
	 * Example: <%* if (condition) { tR += "text"; } %>
	 *
	 * @param code JavaScript code to execute
	 * @param context Templater context with tp object
	 * @returns Value of tR variable after execution
	 */
	async executeScript(code: string, context: TemplaterContext): Promise<string> {
		try {
			// Provide tR variable for output accumulation
			const tR = "";

			// Create async function with tp and tR in scope
			// eslint-disable-next-line @typescript-eslint/no-implied-eval
			const AsyncFunction = Object.getPrototypeOf(async function () {
				// Empty function
			}).constructor;

			const fn = new AsyncFunction("tp", "tR", code);
			const result = await fn(context.tp, tR);

			// If code modified tR, use that; otherwise use return value
			if (typeof result === "string" && result !== tR) {
				return result;
			}

			return tR;
		} catch (error) {
			return this.handleError(error, code, "execution");
		}
	}

	/**
	 * Execute combined template code that builds output via tR variable
	 * This allows execution blocks to span multiple tokens and maintain scope
	 *
	 * @param code Complete template code (includes tR initialization)
	 * @param context Templater context
	 * @returns Final tR value
	 */
	async executeCombined(code: string, context: TemplaterContext): Promise<string> {
		try {
			// Create async function with tp in scope
			// eslint-disable-next-line @typescript-eslint/no-implied-eval
			const AsyncFunction = Object.getPrototypeOf(async function () {
				// Empty function
			}).constructor;

			// Execute code - tR is declared inside the code
			const fn = new AsyncFunction("tp", code);
			const result = await fn(context.tp);

			return result || "";
		} catch (error) {
			return this.handleError(error, code, "combined");
		}
	}

	/**
	 * Execute JavaScript code with tp context
	 * @param code JavaScript code to execute
	 * @param context Templater context
	 * @returns Result of execution
	 */
	private async executeCode(code: string, context: TemplaterContext): Promise<unknown> {
		// Create async function with tp in scope
		// eslint-disable-next-line @typescript-eslint/no-implied-eval
		const AsyncFunction = Object.getPrototypeOf(async function () {
			// Empty function
		}).constructor;

		const fn = new AsyncFunction("tp", `return (${code});`);
		return await fn(context.tp);
	}

	/**
	 * Convert a value to string for template output
	 * @param value Value to convert
	 * @returns String representation
	 */
	private convertToString(value: unknown): string {
		if (value === null || value === undefined) {
			return "";
		}

		if (typeof value === "string") {
			return value;
		}

		if (typeof value === "number" || typeof value === "boolean") {
			return String(value);
		}

		if (typeof value === "object") {
			try {
				return JSON.stringify(value, null, 2);
			} catch {
				return String(value);
			}
		}

		return String(value);
	}

	/**
	 * Handle execution errors
	 * @param error Error object
	 * @param code Code that caused the error
	 * @param commandType Type of command (for error message)
	 * @returns Error message to insert in template
	 */
	private handleError(error: unknown, code: string, commandType: string): string {
		const errorMsg = error instanceof Error ? error.message : String(error);

		// Log detailed error to console
		console.error(`[Templater] Error in ${commandType} command:`, {
			code: code.substring(0, 100) + (code.length > 100 ? "..." : ""),
			error: errorMsg,
			stack: error instanceof Error ? error.stack : undefined
		});

		// Return error marker comment for template
		// This makes errors visible but doesn't break the template rendering
		return `<!-- Templater Error: ${errorMsg} -->`;
	}
}
