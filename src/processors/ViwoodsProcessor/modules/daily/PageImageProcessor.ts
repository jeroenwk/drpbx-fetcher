import { ZipReader } from "@zip.js/zip.js";
import { Vault } from "obsidian";
import { FileUtils } from "../../../../utils/FileUtils";
import { StreamingZipUtils } from "../../../../utils/StreamingZipUtils";
import { StreamLogger } from "../../../../utils/StreamLogger";
import { ImageCacheBuster } from "../../../../utils/ImageCacheBuster";
import { NoteListEntry, DailyModuleConfig, ViwoodsProcessorConfig, getViwoodsAttachmentsFolder } from "../../ViwoodsTypes";

export interface PageImageData {
	pageImages: string[];
	warnings: string[];
}

export class PageImageProcessor {
	/**
	 * Add white background to PNG image data (similar to MemoProcessor)
	 */
	private static async addWhiteBackground(imageData: Uint8Array): Promise<Uint8Array> {
		try {
			// Create image from binary data
			const blob = new Blob([imageData], { type: 'image/png' });
			const img = new Image();

			await new Promise((resolve, reject) => {
				img.onload = resolve;
				img.onerror = reject;
				img.src = URL.createObjectURL(blob);
			});

			// Create canvas with white background
			const canvas = document.createElement('canvas');
			canvas.width = img.width;
			canvas.height = img.height;

			const ctx = canvas.getContext('2d');
			if (!ctx) {
				throw new Error('Could not get canvas context');
			}

			// Fill with white background
			ctx.fillStyle = 'white';
			ctx.fillRect(0, 0, canvas.width, canvas.height);

			// Draw original image on top
			ctx.drawImage(img, 0, 0);

			// Convert back to PNG
			const processedBlob = await new Promise<Blob>((resolve) => {
				canvas.toBlob((blob) => {
					resolve(blob!);
				}, 'image/png');
			});

			// Clean up
			URL.revokeObjectURL(img.src);

			return new Uint8Array(await processedBlob.arrayBuffer());
		} catch (error) {
			StreamLogger.warn('[PageImageProcessor.addWhiteBackground] Failed to add white background, using original image', error);
			return imageData; // Return original if processing fails
		}
	}

	public static async processPageImages(
		zipReader: ZipReader<Blob>,
		vault: Vault,
		dailyNotesFolder: string,
		dateSlug: string,
		noteList: NoteListEntry[],
		config: DailyModuleConfig,
		viwoodsConfig: ViwoodsProcessorConfig
	): Promise<PageImageData> {
		const pageImages: string[] = [];
		const warnings: string[] = [];

		try {
			StreamLogger.log(`[PageImageProcessor.processPageImages] Starting page image processing`);

			// Use Viwoods attachments folder for binary images
			const attachmentsFolder = getViwoodsAttachmentsFolder(config, viwoodsConfig, { vault } as any);
			await FileUtils.ensurePath(vault, attachmentsFolder);
			const resourcesFolder = attachmentsFolder; // Alias for compatibility with existing code

			const totalPages = noteList?.length || 0;
			StreamLogger.log(`[PageImageProcessor.processPageImages] Found ${totalPages} pages`);

			if (noteList && noteList.length > 0) {
				// Sort by page order
				const sortedPages = noteList.sort((a, b) => a.pageOrder - b.pageOrder);

				for (const [index, entry] of sortedPages.entries()) {
					try {
						const result = await this.processSinglePageImage(
							zipReader,
							vault,
							entry,
							index,
							resourcesFolder,
							dateSlug,
							dailyNotesFolder
						);

						if (result.success) {
							pageImages.push(result.imageLink || '');
							StreamLogger.log(`[PageImageProcessor.processPageImages] Extracted page ${index + 1}: ${result.imagePath}`);
						} else {
							warnings.push(result.error || 'Unknown error');
						}
					} catch (error) {
						StreamLogger.error(`[PageImageProcessor.processPageImages] Failed to extract page image ${entry.id}:`, error);
						warnings.push(`Failed to extract page image: ${entry.id}`);
					}
				}
			}

			StreamLogger.log(`[PageImageProcessor.processPageImages] Processed ${pageImages.length} page images`);

			return {
				pageImages,
				warnings
			};

		} catch (error: unknown) {
			const err = error as Error;
			StreamLogger.error(`[PageImageProcessor.processPageImages] Error:`, error);
			return {
				pageImages,
				warnings: [`Failed to process page images: ${err.message}`]
			};
		}
	}

	private static async processSinglePageImage(
		zipReader: ZipReader<Blob>,
		vault: Vault,
		entry: NoteListEntry,
		index: number,
		resourcesFolder: string,
		dateSlug: string,
		dailyNotesFolder: string
	): Promise<{ success: boolean; imagePath?: string; imageLink?: string; error?: string }> {
		try {
			// Extract image from ZIP
			const imageName = `${entry.id}.png`;
			let imageData = await StreamingZipUtils.extractFile(zipReader, imageName);

			if (!imageData) {
				return {
					success: false,
					error: `Failed to extract page image: ${entry.id}`
				};
			}

			// Add white background to the image
			imageData = await this.addWhiteBackground(imageData);

			// Generate output filename (base path without timestamp)
			const outputName = `${dateSlug}-page-${index + 1}.png`;
			const resourcePath = FileUtils.joinPath(resourcesFolder, outputName);

			// Save image with cache-busting using ImageCacheBuster
			const result = await ImageCacheBuster.updateImageWithCacheBust(
				vault,
				resourcePath,
				imageData
			);

			// Use full path for wiki-style links (now in attachments folder)
			const imageLink = `![[${result.newPath}]]`;

			return {
				success: true,
				imagePath: result.newPath,
				imageLink
			};

		} catch (error: unknown) {
			const err = error as Error;
			return {
				success: false,
				error: `Failed to process page image ${entry.id}: ${err.message}`
			};
		}
	}
}