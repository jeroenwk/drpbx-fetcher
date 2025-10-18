import { parseYaml, stringifyYaml } from "obsidian";
import { StreamLogger } from "../../../utils/StreamLogger";

/**
 * Metadata stored in frontmatter for tracking Viwoods paper notes
 */
export interface ViwoodsNoteMetadata {
	"viwoods-file-id": string;
	"viwoods-last-modified": number;
	"viwoods-pages": Array<{
		page: number;
		image: string;
	}>;
}

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
	frontmatter: ViwoodsNoteMetadata | null;
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
		let frontmatter: ViwoodsNoteMetadata | null = null;
		let currentIndex = 0;

		// Extract frontmatter if present
		if (lines[0]?.trim() === "---") {
			const endIndex = lines.findIndex((line, i) => i > 0 && line.trim() === "---");
			if (endIndex > 0) {
				const yamlContent = lines.slice(1, endIndex).join("\n");
				try {
					frontmatter = parseYaml(yamlContent) as ViwoodsNoteMetadata;
					currentIndex = endIndex + 1;
				} catch (error) {
					StreamLogger.warn("[MarkdownMerger] Failed to parse frontmatter", error);
				}
			}
		}

		// Find all page sections by looking for image embeds
		// Pattern: ![[resources/...]] or ![[anything]]
		const imageEmbedPattern = /^!\[\[(.+?)\]\]\s*$/;
		const pages: PageSection[] = [];
		let header = "";
		let footer = "";
		let currentPage: PageSection | null = null;
		const headerLines: string[] = [];
		let isInHeader = true;

		for (let i = currentIndex; i < lines.length; i++) {
			const line = lines[i];
			const match = line.match(imageEmbedPattern);

			if (match) {
				// Found an image embed - this starts a new page section
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
			} else if (currentPage) {
				// We're in a page section - accumulate user content
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
			hasFrontmatter: !!frontmatter,
			headerLines: headerLines.length,
			pageCount: pages.length,
		});

		return {
			frontmatter,
			header,
			pages,
			footer,
		};
	}

	/**
	 * Merge updated page data into existing markdown while preserving user content
	 *
	 * @param existingContent Current markdown content
	 * @param fileId Dropbox file ID
	 * @param modifiedTime Last modified timestamp
	 * @param newPages Array of new/updated page image paths
	 * @param imageUpdates Optional mappings for updated images
	 * @returns Merged markdown content
	 */
	static merge(
		existingContent: string,
		fileId: string,
		modifiedTime: number,
		newPages: Array<{ pageNumber: number; imagePath: string }>,
		imageUpdates?: ImageUpdateMapping[]
	): string {
		StreamLogger.log("[MarkdownMerger] Starting merge", {
			fileId,
			modifiedTime,
			newPageCount: newPages.length,
			hasImageUpdates: !!imageUpdates?.length,
		});

		const parsed = this.parseMarkdown(existingContent);
		const updateMap = new Map(imageUpdates?.map(u => [u.pageNumber, u]) || []);

		// Update or create frontmatter
		const frontmatter: ViwoodsNoteMetadata = {
			"viwoods-file-id": fileId,
			"viwoods-last-modified": modifiedTime,
			"viwoods-pages": newPages.map(p => ({
				page: p.pageNumber,
				image: p.imagePath,
			})),
		};

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
					userContent: "\n\n### Notes\n\n*Add your notes here*\n\n---",
				});

				StreamLogger.log("[MarkdownMerger] Added new page", {
					pageNumber: newPage.pageNumber,
				});
			}
		}

		// Reconstruct markdown
		return this.buildMarkdown(frontmatter, parsed.header, mergedPages, parsed.footer);
	}

	/**
	 * Build markdown content from structured sections
	 */
	private static buildMarkdown(
		frontmatter: ViwoodsNoteMetadata,
		header: string,
		pages: PageSection[],
		footer: string
	): string {
		const parts: string[] = [];

		// Add frontmatter
		parts.push("---");
		parts.push(stringifyYaml(frontmatter).trim());
		parts.push("---");
		parts.push("");

		// Add header (if not empty)
		if (header.trim()) {
			parts.push(header.trim());
			parts.push("");
		}

		// Add page sections
		for (const page of pages) {
			parts.push(page.imageEmbed);
			if (page.userContent.trim()) {
				parts.push(page.userContent);
			}
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
	 * Check if content has Viwoods frontmatter
	 */
	static hasViwoodsFrontmatter(content: string): boolean {
		const parsed = this.parseMarkdown(content);
		return parsed.frontmatter !== null &&
			"viwoods-file-id" in parsed.frontmatter;
	}
}
