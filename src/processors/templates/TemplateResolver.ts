import { Vault } from "obsidian";
import { TemplateResolver as ITemplateResolver } from "../types";

/**
 * Template resolver implementation
 * Loads templates from vault or uses defaults, with caching
 */
export class TemplateResolver implements ITemplateResolver {
	private vault: Vault;
	private cache: Map<string, string>;

	constructor(vault: Vault) {
		this.vault = vault;
		this.cache = new Map();
	}

	/**
	 * Resolve a template by path (custom) or use default
	 * @param customPath Optional custom template path in vault
	 * @param defaultTemplate Default template content
	 * @returns Template content
	 */
	async resolve(customPath: string | undefined, defaultTemplate: string): Promise<string> {
		// If no custom path provided, use default
		if (!customPath || customPath.trim().length === 0) {
			return defaultTemplate;
		}

		// Check cache first
		if (this.cache.has(customPath)) {
			// Safe: Map.get() is guaranteed to return a value after Map.has() check confirms key exists
			// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
			return this.cache.get(customPath)!;
		}

		// Try to load from vault
		try {
			const file = this.vault.getAbstractFileByPath(customPath);
			if (file && "extension" in file) {
				const content = await this.vault.read(file);
				this.cache.set(customPath, content);
				return content;
			}
		} catch (error) {
			console.warn(`Failed to load custom template from ${customPath}, using default`, error);
		}

		// Fall back to default
		return defaultTemplate;
	}

	/**
	 * Clear template cache
	 */
	clearCache(): void {
		this.cache.clear();
	}

	/**
	 * Pre-load a template into cache
	 * @param path Template path
	 * @param content Template content
	 */
	setCache(path: string, content: string): void {
		this.cache.set(path, content);
	}
}
