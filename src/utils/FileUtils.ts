import { Vault } from "obsidian";

/**
 * File utility functions
 */
export class FileUtils {
	/**
	 * Get file extension from filename (without dot)
	 * @param filename Filename to extract extension from
	 * @returns Extension without dot, or empty string if no extension
	 */
	static getExtension(filename: string): string {
		const lastDot = filename.lastIndexOf(".");
		if (lastDot === -1 || lastDot === filename.length - 1) {
			return "";
		}
		return filename.substring(lastDot + 1);
	}

	/**
	 * Get filename without extension
	 * @param filename Filename
	 * @returns Filename without extension
	 */
	static getBasename(filename: string): string {
		const lastDot = filename.lastIndexOf(".");
		if (lastDot === -1) {
			return filename;
		}
		return filename.substring(0, lastDot);
	}

	/**
	 * Sanitize filename to be safe for filesystem
	 * @param filename Filename to sanitize
	 * @returns Sanitized filename
	 */
	static sanitizeFilename(filename: string): string {
		// Replace invalid characters with underscore
		return filename.replace(/[<>:"|?*\\]/g, "_").replace(/\//g, "_");
	}

	/**
	 * Ensure a path exists in the vault, creating folders as needed
	 * @param vault Obsidian vault
	 * @param path Path to ensure exists
	 */
	static async ensurePath(vault: Vault, path: string): Promise<void> {
		const parts = path.split("/").filter((p) => p.length > 0);
		let currentPath = "";

		for (const part of parts) {
			currentPath = currentPath ? `${currentPath}/${part}` : part;
			try {
				await vault.createFolder(currentPath);
			} catch (error) {
				// Folder might already exist, that's okay
			}
		}
	}

	/**
	 * Generate a unique filename if file already exists
	 * @param vault Obsidian vault
	 * @param folderPath Folder path
	 * @param basename Base filename without extension
	 * @param extension File extension
	 * @returns Unique filename
	 */
	static async generateUniqueFilename(
		vault: Vault,
		folderPath: string,
		basename: string,
		extension: string
	): Promise<string> {
		let counter = 1;
		let filename = `${basename}.${extension}`;
		let fullPath = folderPath ? `${folderPath}/${filename}` : filename;

		while (vault.getAbstractFileByPath(fullPath)) {
			filename = `${basename}-${counter}.${extension}`;
			fullPath = folderPath ? `${folderPath}/${filename}` : filename;
			counter++;
		}

		return filename;
	}

	/**
	 * Join path segments
	 * @param segments Path segments
	 * @returns Joined path
	 */
	static joinPath(...segments: string[]): string {
		return segments
			.filter((s) => s && s.length > 0)
			.join("/")
			.replace(/\/+/g, "/"); // Remove duplicate slashes
	}

	/**
	 * Get parent directory path
	 * @param path File or folder path
	 * @returns Parent directory path
	 */
	static getParentPath(path: string): string {
		const lastSlash = path.lastIndexOf("/");
		if (lastSlash === -1) {
			return "";
		}
		return path.substring(0, lastSlash);
	}

	/**
	 * Slugify text for use in filenames or tags
	 * @param text Text to slugify
	 * @returns Slugified text
	 */
	static slugify(text: string): string {
		return text
			.toLowerCase()
			.replace(/[^a-z0-9]+/g, "-")
			.replace(/^-+|-+$/g, "");
	}
}
