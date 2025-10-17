import { Vault, TFile } from "obsidian";

/**
 * Utility for updating image files while forcing Obsidian to invalidate its cache.
 *
 * Obsidian aggressively caches images for performance. When an image file is updated,
 * even with proper Vault API methods, the visual display doesn't refresh without restart.
 *
 * This utility works around the caching issue by using a "ping-pong" filename strategy:
 * - Original: image.png
 * - Alternate: image-cache-bust.png
 *
 * On each update, it renames the file to the alternate name, forcing Obsidian to treat
 * it as a "new" file and invalidate the cache.
 */
export class ImageCacheBuster {
	private static readonly CACHE_BUST_SUFFIX = "-cache-bust";

	/**
	 * Update an image file with cache-busting via filename alternation.
	 *
	 * @param vault Obsidian Vault instance
	 * @param basePath Original file path (without cache-bust suffix, e.g., "folder/image.png")
	 * @param imageData New image data to write
	 * @returns The actual path where the file was saved (may include cache-bust suffix)
	 */
	static async updateImageWithCacheBust(
		vault: Vault,
		basePath: string,
		imageData: Uint8Array
	): Promise<string> {
		// Extract path components
		const lastSlash = basePath.lastIndexOf("/");
		const dir = lastSlash >= 0 ? basePath.substring(0, lastSlash) : "";
		const fullName = lastSlash >= 0 ? basePath.substring(lastSlash + 1) : basePath;

		// Split filename and extension
		const lastDot = fullName.lastIndexOf(".");
		const name = lastDot >= 0 ? fullName.substring(0, lastDot) : fullName;
		const ext = lastDot >= 0 ? fullName.substring(lastDot) : "";

		// Generate alternate path
		const alternatePath = dir
			? `${dir}/${name}${this.CACHE_BUST_SUFFIX}${ext}`
			: `${name}${this.CACHE_BUST_SUFFIX}${ext}`;

		// Check which variant exists
		const baseFile = vault.getAbstractFileByPath(basePath);
		const alternateFile = vault.getAbstractFileByPath(alternatePath);

		let existingFile: TFile | null = null;
		let targetPath: string;

		if (baseFile instanceof TFile) {
			existingFile = baseFile;
			targetPath = alternatePath; // Switch to alternate
		} else if (alternateFile instanceof TFile) {
			existingFile = alternateFile;
			targetPath = basePath; // Switch back to base
		} else {
			// No existing file, create new one at base path
			await vault.createBinary(basePath, imageData);
			return basePath;
		}

		// Update content and rename to trigger cache invalidation
		await vault.modifyBinary(existingFile, imageData);
		await vault.rename(existingFile, targetPath);

		return targetPath;
	}

	/**
	 * Check if a path is a cache-bust variant.
	 *
	 * @param path File path to check
	 * @returns true if path contains cache-bust suffix
	 */
	static isCacheBustPath(path: string): boolean {
		return path.includes(this.CACHE_BUST_SUFFIX);
	}

	/**
	 * Get the base path from a cache-bust path.
	 * Removes the cache-bust suffix if present.
	 *
	 * @param path File path (may or may not have cache-bust suffix)
	 * @returns Base path without cache-bust suffix
	 */
	static getBasePath(path: string): string {
		return path.replace(this.CACHE_BUST_SUFFIX, "");
	}
}
