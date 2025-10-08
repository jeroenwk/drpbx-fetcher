import JSZip from "jszip";

/**
 * Utility functions for working with ZIP files
 */
export class ZipUtils {
	/**
	 * Load a ZIP archive from binary data
	 * @param data Binary data of ZIP file
	 * @returns JSZip instance
	 */
	static async loadZip(data: Uint8Array): Promise<JSZip> {
		const zip = new JSZip();
		return await zip.loadAsync(data);
	}

	/**
	 * Extract a specific file from ZIP as binary
	 * @param zip JSZip instance
	 * @param path File path within ZIP
	 * @returns File data as Uint8Array, or null if not found
	 */
	static async extractFile(zip: JSZip, path: string): Promise<Uint8Array | null> {
		const file = zip.file(path);
		if (!file) {
			return null;
		}
		const arrayBuffer = await file.async("arraybuffer");
		return new Uint8Array(arrayBuffer);
	}

	/**
	 * Extract a specific file from ZIP as text
	 * @param zip JSZip instance
	 * @param path File path within ZIP
	 * @returns File content as string, or null if not found
	 */
	static async extractText(zip: JSZip, path: string): Promise<string | null> {
		const file = zip.file(path);
		if (!file) {
			return null;
		}
		return await file.async("string");
	}

	/**
	 * Extract a JSON file from ZIP
	 * @param zip JSZip instance
	 * @param path File path within ZIP
	 * @returns Parsed JSON object, or null if not found or invalid JSON
	 */
	static async extractJson<T = any>(zip: JSZip, path: string): Promise<T | null> {
		const text = await this.extractText(zip, path);
		if (!text) {
			return null;
		}
		try {
			return JSON.parse(text) as T;
		} catch (error) {
			console.error(`Failed to parse JSON from ${path}:`, error);
			return null;
		}
	}

	/**
	 * List all files in ZIP
	 * @param zip JSZip instance
	 * @returns Array of file paths
	 */
	static listFiles(zip: JSZip): string[] {
		const files: string[] = [];
		zip.forEach((relativePath, file) => {
			if (!file.dir) {
				files.push(relativePath);
			}
		});
		return files;
	}

	/**
	 * Check if file exists in ZIP
	 * @param zip JSZip instance
	 * @param path File path within ZIP
	 * @returns True if file exists
	 */
	static fileExists(zip: JSZip, path: string): boolean {
		return zip.file(path) !== null;
	}

	/**
	 * Extract all files matching a pattern
	 * @param zip JSZip instance
	 * @param pattern RegExp pattern to match file paths
	 * @returns Map of file paths to binary data
	 */
	static async extractMatching(
		zip: JSZip,
		pattern: RegExp
	): Promise<Map<string, Uint8Array>> {
		const results = new Map<string, Uint8Array>();
		const files = this.listFiles(zip).filter((path) => pattern.test(path));

		for (const path of files) {
			const data = await this.extractFile(zip, path);
			if (data) {
				results.set(path, data);
			}
		}

		return results;
	}
}
