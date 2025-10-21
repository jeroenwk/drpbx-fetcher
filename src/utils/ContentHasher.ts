/**
 * Utility for generating content hashes to detect renamed Viwoods notes
 *
 * When a note is renamed in Dropbox, it gets a new file.id but the content
 * remains the same. We use a hash of stable content properties to detect renames.
 */
export class ContentHasher {
	/**
	 * Generate a content hash for a Viwoods Paper note
	 *
	 * The hash is based on properties that remain constant when a note is renamed:
	 * - Creation time (doesn't change on rename)
	 * - Total page count (structure remains the same)
	 * - Folder path (unless moved, which is a different operation)
	 *
	 * @param creationTime Creation timestamp in milliseconds
	 * @param totalPages Number of pages in the note
	 * @param folderPath Parent folder path (e.g., "Léna", "Unclassified Notes")
	 * @returns Content hash string
	 */
	static generatePaperNoteHash(
		creationTime: number,
		totalPages: number,
		folderPath: string
	): string {
		// Create a stable string representation
		const content = `${creationTime}|${totalPages}|${folderPath}`;

		// Use simple hash function (we don't need cryptographic security)
		return this.simpleHash(content);
	}

	/**
	 * Simple hash function (FNV-1a variant)
	 * Fast and sufficient for our use case of detecting duplicate content
	 *
	 * @param str String to hash
	 * @returns Hash as hexadecimal string
	 */
	private static simpleHash(str: string): string {
		let hash = 2166136261; // FNV offset basis

		for (let i = 0; i < str.length; i++) {
			hash ^= str.charCodeAt(i);
			hash = Math.imul(hash, 16777619); // FNV prime
		}

		// Convert to unsigned 32-bit and then to hex
		return (hash >>> 0).toString(16).padStart(8, '0');
	}

	/**
	 * Validate if a content hash matches the expected format
	 *
	 * @param hash Hash string to validate
	 * @returns True if valid hash format
	 */
	static isValidHash(hash: string): boolean {
		return /^[0-9a-f]{8}$/.test(hash);
	}
}
