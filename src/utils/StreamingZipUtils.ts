import { BlobReader, ZipReader, Entry, Uint8ArrayWriter, configure } from "@zip.js/zip.js";
import { StreamLogger } from "./StreamLogger";

// Configure zip.js to NOT use native DecompressionStream API
// This is needed because Android doesn't support 'deflate-raw' compression format
// Using the fallback JavaScript implementation instead
configure({
	useWebWorkers: false,
	useCompressionStream: false
});

/**
 * Streaming ZIP utilities using zip.js for memory-efficient ZIP processing
 * Unlike JSZip which loads entire ZIP into memory, this streams data
 */
export class StreamingZipUtils {
	/**
	 * Load ZIP from Blob using zip.js BlobReader
	 * @param blob Blob containing ZIP data
	 * @returns ZipReader instance for streaming access
	 */
	static async loadZipFromBlob(blob: Blob): Promise<ZipReader<Blob>> {
		StreamLogger.log(`[StreamingZipUtils] Loading ZIP from Blob`, {
			size: blob.size
		});

		const blobReader = new BlobReader(blob);
		const zipReader = new ZipReader(blobReader);

		return zipReader;
	}

	/**
	 * Get all entries from ZIP
	 * @param zipReader ZipReader instance
	 * @returns Array of ZIP entries
	 */
	static async getEntries(zipReader: ZipReader<Blob>): Promise<Entry[]> {
		const entries = await zipReader.getEntries();
		StreamLogger.log(`[StreamingZipUtils] Found entries in ZIP`, {
			count: entries.length
		});
		return entries;
	}

	/**
	 * List all file names in ZIP
	 * @param zipReader ZipReader instance
	 * @returns Array of file names
	 */
	static async listFiles(zipReader: ZipReader<Blob>): Promise<string[]> {
		const entries = await zipReader.getEntries();
		return entries
			.filter(entry => !entry.directory)
			.map(entry => entry.filename);
	}

	/**
	 * Check if a file exists in ZIP
	 * @param zipReader ZipReader instance
	 * @param filename File name to check
	 * @returns True if file exists
	 */
	static async fileExists(zipReader: ZipReader<Blob>, filename: string): Promise<boolean> {
		const entries = await zipReader.getEntries();
		return entries.some(entry => entry.filename === filename && !entry.directory);
	}

	/**
	 * Extract a single file from ZIP as Uint8Array
	 * Memory-efficient: only loads this one file into memory
	 * @param zipReader ZipReader instance
	 * @param filename File name to extract
	 * @returns File data as Uint8Array, or null if not found
	 */
	static async extractFile(
		zipReader: ZipReader<Blob>,
		filename: string
	): Promise<Uint8Array | null> {
		StreamLogger.log(`[StreamingZipUtils] Extracting file from ZIP`, {
			filename
		});

		const entries = await zipReader.getEntries();
		const entry = entries.find(e => e.filename === filename && !e.directory);

		if (!entry) {
			StreamLogger.warn(`[StreamingZipUtils] File not found in ZIP`, { filename });
			return null;
		}

		// Directory entries don't have getData, this check ensures we have a file entry
		if (entry.directory || !entry.getData) {
			StreamLogger.error(`[StreamingZipUtils] Entry is a directory or has no getData method`, { filename });
			return null;
		}

		// Get data as Uint8Array
		const data = await entry.getData(new Uint8ArrayWriter());

		StreamLogger.log(`[StreamingZipUtils] File extracted`, {
			filename,
			size: data.length
		});

		return data;
	}

	/**
	 * Extract a JSON file from ZIP and parse it
	 * @param zipReader ZipReader instance
	 * @param filename File name to extract
	 * @returns Parsed JSON object, or null if not found
	 */
	static async extractJson<T>(
		zipReader: ZipReader<Blob>,
		filename: string
	): Promise<T | null> {
		const data = await this.extractFile(zipReader, filename);
		if (!data) {
			return null;
		}

		try {
			const text = new TextDecoder().decode(data);
			return JSON.parse(text) as T;
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error);
			StreamLogger.error(`[StreamingZipUtils] Failed to parse JSON`, {
				filename,
				error: errorMessage
			});
			return null;
		}
	}

	/**
	 * Close ZIP reader and free resources
	 * @param zipReader ZipReader instance
	 */
	static async close(zipReader: ZipReader<Blob>): Promise<void> {
		await zipReader.close();
		StreamLogger.log(`[StreamingZipUtils] ZIP reader closed`);
	}
}
