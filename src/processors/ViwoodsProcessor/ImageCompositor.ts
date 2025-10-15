/**
 * Utility class for compositing annotation images
 */
export class ImageCompositor {
	/**
	 * Create composite annotation image from JPG page and PNG overlay
	 */
	public static async createCompositeImage(
		jpgData: Uint8Array,
		pngData: Uint8Array,
		shouldComposite: boolean
	): Promise<Blob> {
		// If composition disabled, return PNG only
		if (!shouldComposite) {
			return new Blob([pngData], { type: 'image/png' });
		}

		// Create blobs for image loading
		const jpgBlob = new Blob([jpgData], { type: 'image/jpeg' });
		const pngBlob = new Blob([pngData], { type: 'image/png' });

		const jpgUrl = URL.createObjectURL(jpgBlob);
		const pngUrl = URL.createObjectURL(pngBlob);

		try {
			// Load both images
			const jpgImg = await this.loadImage(jpgUrl);
			const pngImg = await this.loadImage(pngUrl);

			// Create canvas with JPG dimensions
			const canvas = document.createElement('canvas');
			canvas.width = jpgImg.width;
			canvas.height = jpgImg.height;

			const ctx = canvas.getContext('2d');
			if (!ctx) {
				throw new Error('Failed to get canvas context');
			}

			// Draw JPG background
			ctx.drawImage(jpgImg, 0, 0);

			// Draw PNG overlay
			ctx.drawImage(pngImg, 0, 0);

			// Convert to blob
			return new Promise<Blob>((resolve, reject) => {
				canvas.toBlob((blob) => {
					if (blob) {
						resolve(blob);
					} else {
						reject(new Error('Failed to create blob from canvas'));
					}
				}, 'image/png');
			});
		} finally {
			// Cleanup object URLs
			URL.revokeObjectURL(jpgUrl);
			URL.revokeObjectURL(pngUrl);
		}
	}

	/**
	 * Load an image from a URL
	 */
	private static loadImage(url: string): Promise<HTMLImageElement> {
		return new Promise((resolve, reject) => {
			const img = new Image();
			img.onload = () => resolve(img);
			img.onerror = () => reject(new Error(`Failed to load image: ${url}`));
			img.src = url;
		});
	}
}
