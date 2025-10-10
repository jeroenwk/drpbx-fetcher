import { Vault } from "obsidian";
import { StreamLogger } from "./StreamLogger";

/**
 * Manages temporary files for large file processing
 * Temp files are stored in .obsidian/plugins/drpbx-fetcher/temp/
 */
export class TempFileManager {
	private static readonly TEMP_DIR = ".obsidian/plugins/drpbx-fetcher/temp";
	private vault: Vault;

	constructor(vault: Vault) {
		this.vault = vault;
	}

	/**
	 * Ensure temp directory exists
	 */
	async ensureTempDir(): Promise<void> {
		try {
			await this.vault.createFolder(TempFileManager.TEMP_DIR);
			StreamLogger.log(`[TempFileManager] Created temp directory`, {
				path: TempFileManager.TEMP_DIR
			});
		} catch (error) {
			// Folder might already exist, that's okay
		}
	}

	/**
	 * Generate a unique temp file path
	 * @param prefix Optional prefix for the temp file
	 * @param extension Optional file extension
	 */
	getTempFilePath(prefix: string = "temp", extension: string = "tmp"): string {
		const timestamp = Date.now();
		const random = Math.random().toString(36).substring(2, 8);
		const filename = `${prefix}-${timestamp}-${random}.${extension}`;
		return `${TempFileManager.TEMP_DIR}/${filename}`;
	}

	/**
	 * Write data to temp file (creates or overwrites)
	 * @param tempPath Path to temp file
	 * @param data Binary data to write
	 */
	async write(tempPath: string, data: Uint8Array): Promise<void> {
		await this.vault.adapter.writeBinary(tempPath, data);
		StreamLogger.log(`[TempFileManager] Wrote to temp file`, {
			path: tempPath,
			bytes: data.length
		});
	}

	/**
	 * Append data to temp file
	 * @param tempPath Path to temp file
	 * @param data Binary data to append
	 */
	async append(tempPath: string, data: Uint8Array): Promise<void> {
		try {
			// Check if file exists
			const exists = await this.vault.adapter.exists(tempPath);

			if (!exists) {
				// File doesn't exist, create it
				await this.write(tempPath, data);
			} else {
				// File exists, read current content and append
				const existingData = await this.vault.adapter.readBinary(tempPath);
				const combined = new Uint8Array(existingData.byteLength + data.length);
				combined.set(new Uint8Array(existingData), 0);
				combined.set(data, existingData.byteLength);
				await this.vault.adapter.writeBinary(tempPath, combined);
			}
		} catch (error: any) {
			StreamLogger.error(`[TempFileManager] Failed to append to temp file`, {
				path: tempPath,
				error: error.message
			});
			throw error;
		}
	}

	/**
	 * Read temp file as binary
	 * @param tempPath Path to temp file
	 */
	async read(tempPath: string): Promise<Uint8Array> {
		const data = await this.vault.adapter.readBinary(tempPath);
		return new Uint8Array(data);
	}

	/**
	 * Read temp file as Blob for streaming processing
	 * @param tempPath Path to temp file
	 */
	async readAsBlob(tempPath: string): Promise<Blob> {
		const data = await this.read(tempPath);
		return new Blob([data]);
	}

	/**
	 * Delete temp file
	 * @param tempPath Path to temp file
	 */
	async delete(tempPath: string): Promise<void> {
		try {
			const exists = await this.vault.adapter.exists(tempPath);
			if (exists) {
				await this.vault.adapter.remove(tempPath);
				StreamLogger.log(`[TempFileManager] Deleted temp file`, {
					path: tempPath
				});
			}
		} catch (error: any) {
			StreamLogger.error(`[TempFileManager] Failed to delete temp file`, {
				path: tempPath,
				error: error.message
			});
		}
	}

	/**
	 * Clean up all temp files (run on plugin unload)
	 */
	async cleanupAll(): Promise<void> {
		try {
			const tempDirExists = await this.vault.adapter.exists(TempFileManager.TEMP_DIR);
			if (!tempDirExists) {
				return;
			}

			const files = await this.vault.adapter.list(TempFileManager.TEMP_DIR);
			let deletedCount = 0;

			for (const file of files.files) {
				try {
					await this.vault.adapter.remove(file);
					deletedCount++;
				} catch (error) {
					// Continue with other files even if one fails
				}
			}

			StreamLogger.log(`[TempFileManager] Cleaned up temp files`, {
				deletedCount
			});
		} catch (error: any) {
			StreamLogger.error(`[TempFileManager] Cleanup failed`, {
				error: error.message
			});
		}
	}

	/**
	 * Get the size of a temp file
	 * @param tempPath Path to temp file
	 */
	async getSize(tempPath: string): Promise<number> {
		try {
			const stat = await this.vault.adapter.stat(tempPath);
			return stat?.size || 0;
		} catch (error) {
			return 0;
		}
	}
}
