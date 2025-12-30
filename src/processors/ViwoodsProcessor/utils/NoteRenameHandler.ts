import { Vault, TFile } from "obsidian";
import { ViwoodsNoteMetadata } from "../ViwoodsTypes";
import { MetadataManager } from "./MetadataManager";
import { StreamLogger } from "../../../utils/StreamLogger";
import { FileUtils } from "../../../utils/FileUtils";

/**
 * Result of rename operation
 */
export interface RenameResult {
	success: boolean;
	oldNotePath: string;
	newNotePath: string;
	updatedImagePaths: Array<{ oldPath: string; newPath: string }>;
	errors?: string[];
}

/**
 * Handles renaming of Viwoods notes when detected via noteId matching
 */
export class NoteRenameHandler {
	/**
	 * Handle a detected rename operation
	 *
	 * @param vault Obsidian Vault instance
	 * @param existingMetadata Metadata of the existing note (old name)
	 * @param newNoteName New note name
	 * @param newNoteSlug New note slug for file paths
	 * @param newDropboxFileId New Dropbox file ID
	 * @param outputFolder Output folder for the note
	 * @param metadataManager Metadata manager instance
	 * @returns Rename result with paths and errors
	 */
	static async handleRename(
		vault: Vault,
		existingMetadata: ViwoodsNoteMetadata,
		newNoteName: string,
		newNoteSlug: string,
		newDropboxFileId: string,
		outputFolder: string,
		metadataManager: MetadataManager
	): Promise<RenameResult> {
		StreamLogger.log("[NoteRenameHandler] Detected renamed note", {
			oldPath: existingMetadata.notePath,
			newName: newNoteName,
			noteId: existingMetadata.noteId,
			oldDropboxFileId: existingMetadata.dropboxFileId,
			newDropboxFileId: newDropboxFileId,
		});

		const errors: string[] = [];
		const updatedImagePaths: Array<{ oldPath: string; newPath: string }> = [];

		try {
			// 1. Get old file reference
			const oldFile = vault.getAbstractFileByPath(existingMetadata.notePath);
			if (!(oldFile instanceof TFile)) {
				errors.push(`Old note file not found: ${existingMetadata.notePath}`);
				return {
					success: false,
					oldNotePath: existingMetadata.notePath,
					newNotePath: "",
					updatedImagePaths,
					errors,
				};
			}

			// 2. Determine new note path
			const newNotePath = FileUtils.joinPath(outputFolder, `${newNoteName}.md`);

			// 3. Extract old slug from old path
			const oldNoteFilename = existingMetadata.notePath.split('/').pop()?.replace('.md', '') || '';
			const oldNoteSlug = oldNoteFilename;

			StreamLogger.log("[NoteRenameHandler] Slug comparison", {
				oldSlug: oldNoteSlug,
				newSlug: newNoteSlug,
				requiresImageRename: oldNoteSlug !== newNoteSlug,
			});

			// 4. Rename images if slug changed
			if (oldNoteSlug !== newNoteSlug) {
				for (const page of existingMetadata.pages) {
					const oldImagePath = page.image;

					// Check if this image follows paper pattern: {folder}/{slug}-page-{N}-{timestamp}.png
					const paperImageMatch = oldImagePath.match(/^(.+\/)([^/]+)-page-(\d+)-(\d+)(\.\w+)$/);
					if (paperImageMatch) {
						const [, dir, slug, pageNum, timestamp, ext] = paperImageMatch;

						// Only rename if the slug in the path matches the old note slug
						if (slug === oldNoteSlug) {
							const newImagePath = `${dir}${newNoteSlug}-page-${pageNum}-${timestamp}${ext}`;

							try {
								const oldImageFile = vault.getAbstractFileByPath(oldImagePath);
								if (oldImageFile instanceof TFile) {
									await vault.rename(oldImageFile, newImagePath);
									updatedImagePaths.push({
										oldPath: oldImagePath,
										newPath: newImagePath,
									});
									StreamLogger.log("[NoteRenameHandler] Renamed paper image", {
										old: oldImagePath,
										new: newImagePath,
									});
								} else {
									StreamLogger.warn("[NoteRenameHandler] Paper image file not found, skipping rename", {
										path: oldImagePath,
									});
								}
							} catch (error) {
								const err = error as Error;
								errors.push(`Failed to rename paper image ${oldImagePath}: ${err.message}`);
								StreamLogger.error("[NoteRenameHandler] Paper image rename error", error);
							}
						}
					}

					// Check if this image follows memo pattern: {folder}/{slug}-image-{timestamp}.png
					const memoImageMatch = oldImagePath.match(/^(.+\/)([^/]+)-image-(\d+)(\.\w+)$/);
					if (memoImageMatch) {
						const [, dir, slug, timestamp, ext] = memoImageMatch;

						// Only rename if the slug in the path matches the old note slug
						if (slug === oldNoteSlug) {
							const newImagePath = `${dir}${newNoteSlug}-image-${timestamp}${ext}`;

							try {
								const oldImageFile = vault.getAbstractFileByPath(oldImagePath);
								if (oldImageFile instanceof TFile) {
									await vault.rename(oldImageFile, newImagePath);
									updatedImagePaths.push({
										oldPath: oldImagePath,
										newPath: newImagePath,
									});
									StreamLogger.log("[NoteRenameHandler] Renamed memo image", {
										old: oldImagePath,
										new: newImagePath,
									});
								} else {
									StreamLogger.warn("[NoteRenameHandler] Memo image file not found, skipping rename", {
										path: oldImagePath,
									});
								}
							} catch (error) {
								const err = error as Error;
								errors.push(`Failed to rename memo image ${oldImagePath}: ${err.message}`);
								StreamLogger.error("[NoteRenameHandler] Memo image rename error", error);
							}
						}
					}
				}
			}

			// 5. Read markdown content
			const content = await vault.read(oldFile);

			// 6. Update image embeds in content if any images were renamed
			let updatedContent = content;
			if (updatedImagePaths.length > 0) {
				for (const { oldPath, newPath } of updatedImagePaths) {
					// Update wiki-style embeds
					const oldEmbed = `![[${oldPath}]]`;
					const newEmbed = `![[${newPath}]]`;
					updatedContent = updatedContent.replace(new RegExp(this.escapeRegex(oldEmbed), 'g'), newEmbed);
				}
				StreamLogger.log("[NoteRenameHandler] Updated image embeds in content", {
					updateCount: updatedImagePaths.length,
				});
			}

			// 7. Rename the markdown file
			await vault.rename(oldFile, newNotePath);
			StreamLogger.log("[NoteRenameHandler] Renamed note file", {
				old: existingMetadata.notePath,
				new: newNotePath,
			});

			// 8. Write updated content (if images were renamed)
			if (updatedImagePaths.length > 0) {
				const newFile = vault.getAbstractFileByPath(newNotePath);
				if (newFile instanceof TFile) {
					await vault.modify(newFile, updatedContent);
				}
			}

			// 9. Update metadata
			const oldMetadataKey = existingMetadata.notePath;
			const newMetadataKey = newNotePath;

			// Remove old metadata entry
			metadataManager.delete(oldMetadataKey);

			// Create updated metadata with new paths
			const updatedMetadata: ViwoodsNoteMetadata = {
				...existingMetadata,
				dropboxFileId: newDropboxFileId,
				notePath: newNotePath,
				pages: existingMetadata.pages.map((page) => {
					const update = updatedImagePaths.find((u) => u.oldPath === page.image);
					return {
						page: page.page,
						image: update ? update.newPath : page.image,
					};
				}),
			};

			// Set new metadata entry
			metadataManager.set(newMetadataKey, updatedMetadata);

			StreamLogger.log("[NoteRenameHandler] Updated metadata", {
				oldKey: oldMetadataKey,
				newKey: newMetadataKey,
			});

			// 10. Clean up old cache-busted images for memo notes
			await this.cleanupOldMemoImages(vault, existingMetadata.pages, updatedImagePaths);

			return {
				success: errors.length === 0,
				oldNotePath: existingMetadata.notePath,
				newNotePath,
				updatedImagePaths,
				errors: errors.length > 0 ? errors : undefined,
			};
		} catch (error) {
			const err = error as Error;
			errors.push(`Rename operation failed: ${err.message}`);
			StreamLogger.error("[NoteRenameHandler] Fatal error during rename", error);

			return {
				success: false,
				oldNotePath: existingMetadata.notePath,
				newNotePath: "",
				updatedImagePaths,
				errors,
			};
		}
	}

	/**
	 * Clean up old cache-busted memo images after successful rename
	 * @param vault Obsidian Vault instance
	 * @param pages Original page metadata
	 * @param updatedImagePaths Array of renamed image paths
	 */
	private static async cleanupOldMemoImages(
		vault: Vault,
		pages: Array<{ page: number; image: string }>,
		updatedImagePaths: Array<{ oldPath: string; newPath: string }>
	): Promise<void> {
		const renamedBasePaths = new Set<string>();

		// Collect base paths of renamed memo images
		for (const { oldPath } of updatedImagePaths) {
			const memoImageMatch = oldPath.match(/^(.+\/)([^/]+)-image-(\d+)(\.\w+)$/);
			if (memoImageMatch) {
				const [, dir, slug] = memoImageMatch;
				const basePath = `${dir}${slug}-image`;
				renamedBasePaths.add(basePath);
			}
		}

		// For each renamed memo image, clean up old variants
		for (const basePath of renamedBasePaths) {
			await this.cleanupOldImageVariants(vault, basePath);
		}
	}

	/**
	 * Clean up old timestamped variants of a memo image
	 * @param vault Obsidian Vault instance
	 * @param basePath Base path without timestamp (e.g., "Attachments/image")
	 */
	private static async cleanupOldImageVariants(
		vault: Vault,
		basePath: string
	): Promise<void> {
		try {
			// Extract directory and base name
			const lastSlash = basePath.lastIndexOf("/");
			const dir = lastSlash >= 0 ? basePath.substring(0, lastSlash) : "";
			const baseName = lastSlash >= 0 ? basePath.substring(lastSlash + 1) : basePath;

			const parentFolder = dir
				? vault.getAbstractFileByPath(dir)
				: vault.getRoot();

			if (!parentFolder || !("children" in parentFolder)) return;

			// Find all files matching the pattern: {baseName}-{timestamp}.png
			const timestampRegex = new RegExp(
				`^${this.escapeRegex(baseName)}-\\d+\\.\\w+$`
			);

			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			const children = (parentFolder as any).children as unknown[];
			const filesToDelete = children.filter(
				(child: unknown) => child instanceof TFile && timestampRegex.test(child.name)
			) as TFile[];

			for (const file of filesToDelete) {
				await vault.delete(file);
				StreamLogger.log("[NoteRenameHandler] Cleaned up old image variant", {
					deletedFile: file.path,
				});
			}
		} catch (error) {
			StreamLogger.warn("[NoteRenameHandler] Failed to clean up old image variants", error);
		}
	}

	/**
	 * Escape special regex characters
	 */
	private static escapeRegex(str: string): string {
		return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
	}
}
