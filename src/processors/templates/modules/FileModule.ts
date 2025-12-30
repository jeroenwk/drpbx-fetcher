import { App, TFile, Vault, parseYaml } from "obsidian";
import { moment } from "obsidian";

/**
 * File module for Templater
 * Provides access to file properties and operations
 */
export class FileModule {
	private vault: Vault;
	private app: App;
	private filePath?: string;
	private fileContent?: string;
	private creationDate?: Date;
	private modifiedDate?: Date;

	constructor(
		vault: Vault,
		app: App,
		metadata?: {
			filePath?: string;
			content?: string;
			createTime?: Date;
			modifiedTime?: Date;
		}
	) {
		this.vault = vault;
		this.app = app;
		this.filePath = metadata?.filePath;
		this.fileContent = metadata?.content;
		this.creationDate = metadata?.createTime;
		this.modifiedDate = metadata?.modifiedTime;
	}

	/**
	 * Get the title of the current file (filename without extension)
	 */
	get title(): string {
		if (!this.filePath) {
			return "";
		}

		const fileName = this.filePath.split("/").pop() || "";
		// Remove extension
		return fileName.replace(/\.[^/.]+$/, "");
	}

	/**
	 * Get the path of the current file
	 * @param relative If true, return relative path; if false, return absolute path
	 * @returns File path
	 */
	path(relative = false): string {
		if (!this.filePath) {
			return "";
		}

		if (relative) {
			return this.filePath;
		}

		// Absolute path would be vault path + file path
		// For now, return the file path (Obsidian uses vault-relative paths)
		return this.filePath;
	}

	/**
	 * Get the folder containing the current file
	 * @param absolute If true, return absolute path; if false, return folder name only
	 * @returns Folder name or path
	 */
	folder(absolute = false): string {
		if (!this.filePath) {
			return "";
		}

		const pathParts = this.filePath.split("/");
		pathParts.pop(); // Remove filename

		if (absolute || pathParts.length > 1) {
			return pathParts.join("/");
		}

		// Return just the immediate parent folder name
		return pathParts[pathParts.length - 1] || "";
	}

	/**
	 * Get the content of the current file
	 */
	get content(): string {
		return this.fileContent || "";
	}

	/**
	 * Get the creation date of the file
	 * @param format Moment.js format string (default: "YYYY-MM-DD HH:mm")
	 * @returns Formatted creation date
	 */
	creation_date(format?: string): string {
		const formatString = format || "YYYY-MM-DD HH:mm";

		if (this.creationDate) {
			return moment(this.creationDate).format(formatString);
		}

		// Fallback to current date if not available
		return moment().format(formatString);
	}

	/**
	 * Get the last modified date of the file
	 * @param format Moment.js format string (default: "YYYY-MM-DD HH:mm")
	 * @returns Formatted modification date
	 */
	last_modified_date(format?: string): string {
		const formatString = format || "YYYY-MM-DD HH:mm";

		if (this.modifiedDate) {
			return moment(this.modifiedDate).format(formatString);
		}

		// Fallback to current date if not available
		return moment().format(formatString);
	}

	/**
	 * Get tags from the file's frontmatter
	 * @returns Array of tags (empty array if no tags found)
	 */
	get tags(): string[] {
		if (!this.fileContent) {
			return [];
		}

		// Extract frontmatter
		const frontmatterMatch = this.fileContent.match(/^---\n([\s\S]*?)\n---/);
		if (!frontmatterMatch) {
			return [];
		}

		try {
			const frontmatter = parseYaml(frontmatterMatch[1]);
			if (frontmatter && frontmatter.tags) {
				if (Array.isArray(frontmatter.tags)) {
					return frontmatter.tags;
				} else if (typeof frontmatter.tags === "string") {
					return [frontmatter.tags];
				}
			}
		} catch (error) {
			console.error("Error parsing frontmatter for tags:", error);
		}

		return [];
	}

	/**
	 * Find a file in the vault by name
	 * @param filename Filename to search for (with or without extension)
	 * @returns TFile object if found, null otherwise
	 */
	async find_tfile(filename: string): Promise<TFile | null> {
		const files = this.vault.getFiles();

		// Try exact match first
		let found = files.find(f => f.name === filename);

		if (!found) {
			// Try matching without extension
			const nameWithoutExt = filename.replace(/\.[^/.]+$/, "");
			found = files.find(f => f.basename === nameWithoutExt);
		}

		if (!found) {
			// Try partial path match
			found = files.find(f => f.path.endsWith(filename));
		}

		return found || null;
	}

	/**
	 * Check if a file exists in the vault
	 * @param filepath Path to the file (relative to vault root)
	 * @returns True if file exists, false otherwise
	 */
	async exists(filepath: string): Promise<boolean> {
		const file = this.vault.getAbstractFileByPath(filepath);
		return file !== null && file instanceof TFile;
	}
}
