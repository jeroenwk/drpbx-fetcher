import { ViwoodsNoteMetadata } from "../models/Settings";
import { StreamLogger } from "./StreamLogger";

/**
 * Manages Viwoods note metadata in a separate file (viwoodsNoteMetadata.json)
 * This keeps metadata separate from the main plugin settings (data.json)
 */
export class MetadataManager {
	private metadata: Record<string, ViwoodsNoteMetadata> = {};
	private metadataFilePath: string;
	private loadDataFn: () => Promise<Record<string, ViwoodsNoteMetadata> | null>;
	private saveDataFn: (data: Record<string, ViwoodsNoteMetadata>) => Promise<void>;

	constructor(
		metadataFilePath: string,
		loadDataFn: () => Promise<Record<string, ViwoodsNoteMetadata> | null>,
		saveDataFn: (data: Record<string, ViwoodsNoteMetadata>) => Promise<void>
	) {
		this.metadataFilePath = metadataFilePath;
		this.loadDataFn = loadDataFn;
		this.saveDataFn = saveDataFn;
	}

	/**
	 * Load metadata from disk
	 */
	async load(): Promise<void> {
		try {
			const data = await this.loadDataFn();
			this.metadata = data || {};
			StreamLogger.log("[MetadataManager] Loaded metadata", {
				path: this.metadataFilePath,
				count: Object.keys(this.metadata).length,
			});
		} catch (error) {
			StreamLogger.warn("[MetadataManager] Failed to load metadata, using empty", error);
			this.metadata = {};
		}
	}

	/**
	 * Save metadata to disk
	 */
	async save(): Promise<void> {
		try {
			await this.saveDataFn(this.metadata);
			StreamLogger.log("[MetadataManager] Saved metadata", {
				path: this.metadataFilePath,
				count: Object.keys(this.metadata).length,
			});
		} catch (error) {
			StreamLogger.error("[MetadataManager] Failed to save metadata", error);
			throw error;
		}
	}

	/**
	 * Get metadata for a specific note
	 */
	get(key: string): ViwoodsNoteMetadata | undefined {
		return this.metadata[key];
	}

	/**
	 * Set metadata for a specific note
	 */
	set(key: string, value: ViwoodsNoteMetadata): void {
		this.metadata[key] = value;
	}

	/**
	 * Delete metadata for a specific note
	 */
	delete(key: string): void {
		delete this.metadata[key];
	}

	/**
	 * Get all metadata
	 */
	getAll(): Record<string, ViwoodsNoteMetadata> {
		return { ...this.metadata };
	}

	/**
	 * Clear all metadata
	 */
	clear(): void {
		this.metadata = {};
	}
}
