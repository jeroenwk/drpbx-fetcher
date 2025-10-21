import { Vault, TFile } from "obsidian";
import { ViwoodsNoteMetadata } from "../models/Settings";
import { MetadataManager } from "./MetadataManager";
import { StreamLogger } from "./StreamLogger";
import { FileUtils } from "./FileUtils";

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
 * Handles renaming of Viwoods notes when detected via content hash matching
 */
export class NoteRenameHandler {
	/**
	 * Handle a detected rename operation
	 *
	 * @param vault Obsidian Vault instance
	 * @param existingMetadata Metadata of the existing note (old name)
	 * @param newNoteName New note name
	 * @param newNoteSlug New note slug for file paths
	 * @param newFileId New Dropbox file ID
	 * @param outputFolder Output folder for the note
	 * @param metadataManager Metadata manager instance
	 * @returns Rename result with paths and errors
	 */
	static async handleRename(
		vault: Vault,
		existingMetadata: ViwoodsNoteMetadata,
		newNoteName: string,
		newNoteSlug: string,
		newFileId: string,
		outputFolder: string,
		metadataManager: MetadataManager
	): Promise<RenameResult> {
		StreamLogger.log("[NoteRenameHandler] Detected renamed note", {
			oldPath: existingMetadata.notePath,
			newName: newNoteName,
			oldFileId: existingMetadata.fileId,
			newFileId: newFileId,
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

					// Check if this image follows the expected pattern
					// Pattern: resources/{slug}-page-{N}-{timestamp}.png
					const imageMatch = oldImagePath.match(/^(.+\/)([^/]+)-page-(\d+)-(\d+)(\.\w+)$/);
					if (imageMatch) {
						const [, dir, slug, pageNum, timestamp, ext] = imageMatch;

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
									StreamLogger.log("[NoteRenameHandler] Renamed image", {
										old: oldImagePath,
										new: newImagePath,
									});
								} else {
									StreamLogger.warn("[NoteRenameHandler] Image file not found, skipping rename", {
										path: oldImagePath,
									});
								}
							} catch (error) {
								const err = error as Error;
								errors.push(`Failed to rename image ${oldImagePath}: ${err.message}`);
								StreamLogger.error("[NoteRenameHandler] Image rename error", error);
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
				fileId: newFileId,
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
	 * Escape special regex characters
	 */
	private static escapeRegex(str: string): string {
		return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
	}
}
