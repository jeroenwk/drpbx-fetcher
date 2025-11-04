import { StreamLogger } from "../../../utils/StreamLogger";

/**
 * Represents a page section in the markdown file
 */
export interface PageSection {
	pageNumber: number;
	imageEmbed: string;  // The ![[...]] wiki link
	userContent: string; // Everything after the image until next page or end
}

/**
 * Result of parsing a markdown file
 */
export interface ParsedMarkdown {
	header: string;  // Content before first page section
	pages: PageSection[];
	footer: string;  // Content after last page section (if any)
}

/**
 * Mapping of old image path to new image path for updates
 */
export interface ImageUpdateMapping {
	pageNumber: number;
	oldPath: string;
	newPath: string;
}

/**
 * Utility for merging updated Viwoods paper notes while preserving user edits
 */
export class MarkdownMerger {
	/**
	 * Parse existing markdown file into structured sections
	 */
	static parseMarkdown(content: string): ParsedMarkdown {
		const lines = content.split("\n");

		// Find all page sections by looking for image embeds in tables or standalone
		// Pattern: | ![[resources/...]] | notes | or ![[...]]
		const imageEmbedPattern = /^!\[\[(.+?)\]\]\s*$/;
		const tableRowPattern = /^\|\s*!\[\[(.+?)\]\]\s*\|\s*(.+?)\s*\|$/;
		const pages: PageSection[] = [];
		let header = "";
		let footer = "";
		let currentPage: PageSection | null = null;
		const headerLines: string[] = [];
		let isInHeader = true;

		for (let i = 0; i < lines.length; i++) {
			const line = lines[i];
			const match = line.match(imageEmbedPattern);
			const tableMatch = line.match(tableRowPattern);

			if (tableMatch) {
				// Found a table row with image - this is a page section
				if (currentPage) {
					// Save previous page
					pages.push(currentPage);
				}

				// Extract image path and user content from table
				const imagePath = tableMatch[1];
				const userContent = tableMatch[2]
					.replace(/<br\s*\/?>/gi, '\n') // Convert <br> to newlines
					.trim();

				currentPage = {
					pageNumber: pages.length + 1,
					imageEmbed: `![[${imagePath}]]`,
					userContent: userContent,
				};
				isInHeader = false;
			} else if (match) {
				// Found standalone image embed - this starts a new page section
				if (currentPage) {
					// Save previous page
					pages.push(currentPage);
				}

				// Start new page (match[1] contains the image path but we store full embed)
				currentPage = {
					pageNumber: pages.length + 1,
					imageEmbed: line,
					userContent: "",
				};
				isInHeader = false;
			} else if (currentPage && !line.startsWith("___") && line.trim() !== "") {
				// We're in a page section - accumulate user content (skip separator lines)
				currentPage.userContent += (currentPage.userContent ? "\n" : "") + line;
			} else if (isInHeader) {
				// Before first page - this is header
				headerLines.push(line);
			}
		}

		// Save last page if any
		if (currentPage) {
			pages.push(currentPage);
		}

		// Everything before first page is header
		header = headerLines.join("\n");

		// No footer for now (pages go to end of file)
		footer = "";

		StreamLogger.log("[MarkdownMerger] Parsed markdown", {
			headerLines: headerLines.length,
			pageCount: pages.length,
		});

		return {
			header,
			pages,
			footer,
		};
	}

	/**
	 * Update header metadata with new modified time and page count
	 */
	private static updateHeader(header: string, modifiedTime: Date, totalPages: number): string {
		const lines = header.split('\n');
		const updatedLines = lines.map(line => {
			// Update Modified date
			if (line.startsWith('**Modified:**')) {
				const formatted = modifiedTime.toISOString()
					.replace('T', ' ')
					.replace(/:\d{2}\.\d{3}Z$/, '')
					.substring(0, 16);
				return `**Modified:** ${formatted}`;
			}
			// Update Total Pages
			if (line.startsWith('**Total Pages:**')) {
				return `**Total Pages:** ${totalPages}`;
			}
			return line;
		});
		return updatedLines.join('\n');
	}

	/**
	 * Merge updated page data into existing markdown while preserving user content
	 *
	 * @param existingContent Current markdown content
	 * @param newPages Array of new/updated page image paths
	 * @param imageUpdates Optional mappings for updated images
	 * @param modifiedTime Optional new modified time to update in header
	 * @returns Merged markdown content
	 */
	static merge(
		existingContent: string,
		newPages: Array<{ pageNumber: number; imagePath: string }>,
		imageUpdates?: ImageUpdateMapping[],
		modifiedTime?: Date
	): string {
		StreamLogger.log("[MarkdownMerger] Starting merge", {
			newPageCount: newPages.length,
			hasImageUpdates: !!imageUpdates?.length,
		});

		const parsed = this.parseMarkdown(existingContent);
		const updateMap = new Map(imageUpdates?.map(u => [u.pageNumber, u]) || []);

		// Build merged pages
		const mergedPages: PageSection[] = [];

		for (const newPage of newPages) {
			const existingPage = parsed.pages.find(p => p.pageNumber === newPage.pageNumber);
			const update = updateMap.get(newPage.pageNumber);

			if (existingPage) {
				// Page exists - update image link if needed, preserve user content
				const imageEmbed = update
					? `![[${update.newPath}]]`
					: existingPage.imageEmbed;

				mergedPages.push({
					pageNumber: newPage.pageNumber,
					imageEmbed,
					userContent: existingPage.userContent,
				});

				StreamLogger.log("[MarkdownMerger] Merged existing page", {
					pageNumber: newPage.pageNumber,
					hadUpdate: !!update,
					preservedContentLength: existingPage.userContent.length,
				});
			} else {
				// New page - add with default placeholder
				mergedPages.push({
					pageNumber: newPage.pageNumber,
					imageEmbed: `![[${newPage.imagePath}]]`,
					userContent: "### Notes\n\n*Add your notes here*",
				});

				StreamLogger.log("[MarkdownMerger] Added new page", {
					pageNumber: newPage.pageNumber,
				});
			}
		}

		// Update header if modified time provided
		const finalHeader = modifiedTime
			? this.updateHeader(parsed.header, modifiedTime, mergedPages.length)
			: parsed.header;

		// Reconstruct markdown
		return this.buildMarkdown(finalHeader, mergedPages, parsed.footer);
	}

	/**
	 * Build markdown content from structured sections
	 */
	private static buildMarkdown(
		header: string,
		pages: PageSection[],
		footer: string
	): string {
		const parts: string[] = [];

		// Add header (if not empty)
		if (header.trim()) {
			parts.push(header.trim());
			parts.push("");
		}

		// Add page sections with table layout
		for (const page of pages) {
			// Convert user content to single line with <br> for line breaks
			let userContent = page.userContent.trim();
			if (!userContent) {
				userContent = "### Notes<br><br>*Add your notes here*";
			} else {
				// Replace newlines with <br> for table cell
				userContent = userContent.replace(/\n/g, '<br>');
			}

			// Create table row
			parts.push(`| ${page.imageEmbed} | ${userContent} |`);
			parts.push("");
			parts.push("___");
			parts.push("");
		}

		// Add footer (if not empty)
		if (footer.trim()) {
			parts.push(footer.trim());
		}

		return parts.join("\n");
	}

	/**
	 * Extract the relative image path from a wiki-style embed
	 * Example: "![[resources/note-page-1.png]]" -> "resources/note-page-1.png"
	 */
	static extractImagePath(embed: string): string | null {
		const match = embed.match(/!\[\[(.+?)\]\]/);
		return match ? match[1] : null;
	}

	/**
	 * Generate metadata key from note file path
	 * This is used as the key in settings.viwoodsNoteMetadata
	 * Example: "Viwoods/Paper/how are you.md" -> "Viwoods/Paper/how are you.md"
	 */
	static getMetadataKey(notePath: string): string {
		return notePath;
	}
}
