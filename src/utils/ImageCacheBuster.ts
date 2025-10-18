import { Vault, TFile } from "obsidian";

/**
 * Utility for updating image files while forcing Obsidian to invalidate its cache.
 *
 * Obsidian aggressively caches images for performance. When an image file is updated,
 * even with proper Vault API methods, the visual display doesn't refresh without restart.
 *
 * This utility works around the caching issue by using a timestamp-based filename strategy:
 * - Original: image.png
 * - Timestamped: image-1234567890.png
 *
 * On each update, it renames the file with a new timestamp suffix, forcing Obsidian to treat
 * it as a "new" file and invalidate the cache. Old timestamped variants are cleaned up.
 */
export class ImageCacheBuster {
	private static readonly TIMESTAMP_PATTERN = /-\d+$/;

	/**
	 * Update an image file with cache-busting via timestamp-based renaming.
	 *
	 * @param vault Obsidian Vault instance
	 * @param basePath Original file path (without timestamp, e.g., "folder/image.png")
	 * @param imageData New image data to write
	 * @returns Object with newPath and oldPath (if an old version existed)
	 */
	static async updateImageWithCacheBust(
		vault: Vault,
		basePath: string,
		imageData: Uint8Array
	): Promise<{ newPath: string; oldPath: string | null }> {
		// Extract path components
		const lastSlash = basePath.lastIndexOf("/");
		const dir = lastSlash >= 0 ? basePath.substring(0, lastSlash) : "";
		const fullName = lastSlash >= 0 ? basePath.substring(lastSlash + 1) : basePath;

		// Split filename and extension
		const lastDot = fullName.lastIndexOf(".");
		const name = lastDot >= 0 ? fullName.substring(0, lastDot) : fullName;
		const ext = lastDot >= 0 ? fullName.substring(lastDot) : "";

		// Generate new timestamped path
		const timestamp = Date.now();
		const newPath = dir
			? `${dir}/${name}-${timestamp}${ext}`
			: `${name}-${timestamp}${ext}`;

		// Find any old variants before cleaning up
		const baseNamePattern = dir ? `${dir}/${name}` : name;
		const oldPath = await this.findExistingVariant(vault, baseNamePattern, ext);

		// Clean up any old variants with timestamps
		await this.cleanupOldVariants(vault, baseNamePattern, ext);

		// Create the new timestamped file
		await vault.createBinary(newPath, imageData.buffer as ArrayBuffer);

		return { newPath, oldPath };
	}

	/**
	 * Find an existing variant of an image file (base or timestamped).
	 *
	 * @param vault Obsidian Vault instance
	 * @param baseNamePattern Base path + filename without extension (e.g., "folder/image")
	 * @param extension File extension (e.g., ".png")
	 * @returns Path to existing file, or null if none found
	 */
	private static async findExistingVariant(
		vault: Vault,
		baseNamePattern: string,
		extension: string
	): Promise<string | null> {
		// Check for base file without timestamp
		const basePath = `${baseNamePattern}${extension}`;
		const baseFile = vault.getAbstractFileByPath(basePath);
		if (baseFile instanceof TFile) {
			return basePath;
		}

		// Find timestamped variant
		const dir = baseNamePattern.includes("/")
			? baseNamePattern.substring(0, baseNamePattern.lastIndexOf("/"))
			: "";
		const baseName = baseNamePattern.includes("/")
			? baseNamePattern.substring(baseNamePattern.lastIndexOf("/") + 1)
			: baseNamePattern;

		const parentFolder = dir
			? vault.getAbstractFileByPath(dir)
			: vault.getRoot();

		if (!parentFolder || !("children" in parentFolder)) return null;

		// Find files matching the pattern: baseName-<timestamp>.ext
		const timestampRegex = new RegExp(
			`^${this.escapeRegex(baseName)}-\\d+${this.escapeRegex(extension)}$`
		);

		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const children = (parentFolder as any).children as unknown[];
		const matchingFile = children.find(
			(child: unknown) => child instanceof TFile && timestampRegex.test(child.name)
		) as TFile | undefined;

		if (matchingFile) {
			return dir ? `${dir}/${matchingFile.name}` : matchingFile.name;
		}

		return null;
	}

	/**
	 * Remove old timestamped variants of an image file.
	 *
	 * @param vault Obsidian Vault instance
	 * @param baseNamePattern Base path + filename without extension (e.g., "folder/image")
	 * @param extension File extension (e.g., ".png")
	 */
	private static async cleanupOldVariants(
		vault: Vault,
		baseNamePattern: string,
		extension: string
	): Promise<void> {
		// Check for base file without timestamp
		const basePath = `${baseNamePattern}${extension}`;
		const baseFile = vault.getAbstractFileByPath(basePath);
		if (baseFile instanceof TFile) {
			await vault.delete(baseFile);
		}

		// Find and delete timestamped variants
		const dir = baseNamePattern.includes("/")
			? baseNamePattern.substring(0, baseNamePattern.lastIndexOf("/"))
			: "";
		const baseName = baseNamePattern.includes("/")
			? baseNamePattern.substring(baseNamePattern.lastIndexOf("/") + 1)
			: baseNamePattern;

		const parentFolder = dir
			? vault.getAbstractFileByPath(dir)
			: vault.getRoot();

		if (!parentFolder || !("children" in parentFolder)) return;

		// Find all files matching the pattern: baseName-<timestamp>.ext
		const timestampRegex = new RegExp(
			`^${this.escapeRegex(baseName)}-\\d+${this.escapeRegex(extension)}$`
		);

		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const children = (parentFolder as any).children as unknown[];
		const filesToDelete = children.filter(
			(child: unknown) => child instanceof TFile && timestampRegex.test(child.name)
		) as TFile[];

		for (const file of filesToDelete) {
			await vault.delete(file);
		}
	}

	/**
	 * Escape special regex characters in a string.
	 *
	 * @param str String to escape
	 * @returns Escaped string safe for use in RegExp
	 */
	private static escapeRegex(str: string): string {
		return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
	}

	/**
	 * Check if a path is a timestamped cache-bust variant.
	 *
	 * @param path File path to check
	 * @returns true if path contains timestamp suffix
	 */
	static isCacheBustPath(path: string): boolean {
		// Extract filename without extension
		const lastSlash = path.lastIndexOf("/");
		const fullName = lastSlash >= 0 ? path.substring(lastSlash + 1) : path;
		const lastDot = fullName.lastIndexOf(".");
		const nameWithoutExt = lastDot >= 0 ? fullName.substring(0, lastDot) : fullName;

		// Check if name ends with timestamp pattern
		return this.TIMESTAMP_PATTERN.test(nameWithoutExt);
	}

	/**
	 * Get the base path from a timestamped cache-bust path.
	 * Removes the timestamp suffix if present.
	 *
	 * @param path File path (may or may not have timestamp suffix)
	 * @returns Base path without timestamp suffix
	 */
	static getBasePath(path: string): string {
		const lastSlash = path.lastIndexOf("/");
		const dir = lastSlash >= 0 ? path.substring(0, lastSlash) : "";
		const fullName = lastSlash >= 0 ? path.substring(lastSlash + 1) : path;

		// Split filename and extension
		const lastDot = fullName.lastIndexOf(".");
		const name = lastDot >= 0 ? fullName.substring(0, lastDot) : fullName;
		const ext = lastDot >= 0 ? fullName.substring(lastDot) : "";

		// Remove timestamp if present
		const baseName = name.replace(this.TIMESTAMP_PATTERN, "");

		return dir ? `${dir}/${baseName}${ext}` : `${baseName}${ext}`;
	}
}
