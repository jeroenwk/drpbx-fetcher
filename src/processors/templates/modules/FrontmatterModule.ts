import { parseYaml } from "obsidian";

/**
 * Frontmatter module for Templater
 * Provides access to YAML frontmatter properties via dynamic property access
 *
 * Example:
 * - tp.frontmatter.author → Gets the "author" property from frontmatter
 * - tp.frontmatter.tags → Gets the "tags" array from frontmatter
 * - tp.frontmatter["property name"] → Gets property with spaces in name
 */
export class FrontmatterModule {
	private frontmatterData: Record<string, unknown> = {};

	constructor(content?: string, variables?: Record<string, unknown>) {
		// Try to parse frontmatter from content first
		if (content) {
			this.parseFrontmatter(content);
		}

		// Merge in any frontmatter from variables (takes precedence)
		if (variables) {
			this.frontmatterData = { ...this.frontmatterData, ...variables };
		}
	}

	/**
	 * Parse YAML frontmatter from content
	 * @param content File content with potential frontmatter
	 */
	private parseFrontmatter(content: string): void {
		// Match frontmatter block at start of file
		const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
		if (!frontmatterMatch) {
			return;
		}

		try {
			const parsed = parseYaml(frontmatterMatch[1]);
			if (parsed && typeof parsed === "object") {
				this.frontmatterData = parsed as Record<string, unknown>;
			}
		} catch (error) {
			console.error("Error parsing frontmatter:", error);
		}
	}

	/**
	 * Get a frontmatter property by key
	 * @param key Property key
	 * @returns Property value or undefined
	 */
	get(key: string): unknown {
		return this.frontmatterData[key];
	}

	/**
	 * Create a Proxy to enable dynamic property access
	 * This allows: tp.frontmatter.propertyName
	 */
	static createProxy(content?: string, variables?: Record<string, unknown>): Record<string, unknown> {
		const module = new FrontmatterModule(content, variables);

		return new Proxy(module.frontmatterData, {
			get(target: Record<string, unknown>, prop: string | symbol): unknown {
				if (typeof prop === "string") {
					return target[prop];
				}
				return undefined;
			}
		});
	}
}
