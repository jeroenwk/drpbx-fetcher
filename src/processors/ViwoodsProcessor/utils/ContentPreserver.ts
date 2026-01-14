import { parseYaml, stringifyYaml } from "obsidian";
import { StreamLogger } from "../../../utils/StreamLogger";

/**
 * Parsed YAML frontmatter from a markdown file
 */
export interface ParsedFrontmatter {
	raw: string;                           // Original YAML string (without --- delimiters)
	parsed: Record<string, unknown>;       // Parsed YAML object
	endIndex: number;                      // Character index where frontmatter ends in content
}

/**
 * Reference to an attachment (image, audio, file, or link)
 */
export interface AttachmentReference {
	type: 'image' | 'audio' | 'file' | 'link';
	path: string;
	fullMatch: string;                     // The full ![[...]] or [[...]] string
}

/**
 * User-added content extracted from existing file
 */
export interface UserAddedContent {
	textBlocks: string[];                  // User-added text paragraphs/sections
	attachments: AttachmentReference[];    // User-added attachment references
}

/**
 * Content extracted from a callout block with a block ID
 */
export interface BlockContent {
	blockId: string;                       // The ^<id> identifier (without the ^)
	calloutType: string;                   // The callout type (e.g., "note")
	calloutTitle: string;                  // The callout title (e.g., "Page 1")
	calloutLines: string[];                // Lines within the callout (excluding header and block ID)
	fullMatch: string;                     // Full block text for reference
	containsEllipsis: boolean;             // Whether the block contains the "..." placeholder line
}

/**
 * Result of the content preservation operation
 */
export interface ContentPreserveResult {
	content: string;                       // Final merged content
	preservedTextBlocks: number;           // Count of preserved text blocks
	preservedAttachments: number;          // Count of preserved attachments
	preservedCalloutBlocks: number;        // Count of preserved callout blocks
	mergedYamlProperties: string[];        // List of user YAML properties preserved
}

/**
 * ContentPreserver - A simpler approach to updating markdown files while preserving user content
 *
 * Strategy:
 * 1. Generate fresh content from template (as if creating new)
 * 2. Compare with existing file content
 * 3. Preserve user-added content at bottom of file under "## Your Notes"
 * 4. Merge YAML frontmatter (existing user properties take precedence)
 */
export class ContentPreserver {
	// System-managed YAML properties - always use fresh values
	private static readonly SYSTEM_PROPERTIES = [
		'created',
		'modified',
		'total_pages',
		'dropbox_file_id'
	];

	// Date pattern for YYYY-MM-DD tags
	private static readonly DATE_TAG_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

	// Template placeholder text to ignore
	private static readonly TEMPLATE_PLACEHOLDERS = [
		'*Add your notes here*'
	];

	// ContentPreserver-generated section markers to handle specially
	private static readonly USER_NOTES_HEADER = '## Your Notes';
	private static readonly USER_ATTACHMENTS_HEADER = '### Your Attachments';

	// Regex patterns for callout block parsing
	private static readonly CALLOUT_BLOCK_PATTERN = /> \[!(\w+)\]([^\n]*)\n([\s\S]*?)\n> \^([^\n]+)/g;
	private static readonly ELLIPSIS_PATTERN = /^> \.\.\.$/;

	/**
	 * Main entry point: merge fresh template output with existing file
	 */
	static preserve(
		existingContent: string,
		freshContent: string,
		viwoodsAttachmentsFolder: string
	): ContentPreserveResult {
		StreamLogger.log("[ContentPreserver.preserve] Starting content preservation", {
			existingLength: existingContent.length,
			freshLength: freshContent.length,
			viwoodsAttachmentsFolder
		});

		// Parse frontmatter from both contents
		const existingFrontmatter = this.parseYamlFrontmatter(existingContent);
		const freshFrontmatter = this.parseYamlFrontmatter(freshContent);

		// Merge YAML frontmatter
		const { merged: mergedYaml, preservedProperties } = this.mergeYamlFrontmatter(
			existingFrontmatter,
			freshFrontmatter
		);

		// Extract body content (everything after frontmatter)
		const existingBody = this.extractBody(existingContent, existingFrontmatter.endIndex);
		const freshBody = this.extractBody(freshContent, freshFrontmatter.endIndex);

		// Extract callout blocks with block IDs from existing content
		const existingBlocks = this.extractCalloutBlocks(existingBody);
		StreamLogger.log("[ContentPreserver.preserve] Extracted callout blocks from existing content", {
			blockCount: existingBlocks.size,
			blockIds: Array.from(existingBlocks.keys())
		});

		// Find user-added content (non-block content)
		const userAdditions = this.findUserAddedContent(
			existingBody,
			freshBody,
			viwoodsAttachmentsFolder
		);

		// Merge callout blocks into fresh content
		const mergedBody = this.mergeCalloutBlocks(freshBody, existingBlocks);

		// Build final merged content
		const finalContent = this.buildMergedContent(
			mergedYaml,
			mergedBody,
			userAdditions
		);

		// Count preserved blocks (blocks that were found in both existing and fresh)
		const preservedBlockCount = this.countPreservedBlocks(existingBlocks, freshBody);

		StreamLogger.log("[ContentPreserver.preserve] Content preservation complete", {
			preservedTextBlocks: userAdditions.textBlocks.length,
			preservedAttachments: userAdditions.attachments.length,
			preservedCalloutBlocks: preservedBlockCount,
			preservedYamlProperties: preservedProperties.length
		});

		return {
			content: finalContent,
			preservedTextBlocks: userAdditions.textBlocks.length,
			preservedAttachments: userAdditions.attachments.length,
			preservedCalloutBlocks: preservedBlockCount,
			mergedYamlProperties: preservedProperties
		};
	}

	/**
	 * Parse and extract YAML frontmatter from markdown content
	 */
	static parseYamlFrontmatter(content: string): ParsedFrontmatter {
		const emptyResult: ParsedFrontmatter = {
			raw: '',
			parsed: {},
			endIndex: 0
		};

		// Check for frontmatter start
		if (!content.startsWith('---')) {
			return emptyResult;
		}

		// Find the closing ---
		const closingIndex = content.indexOf('\n---', 3);
		if (closingIndex === -1) {
			return emptyResult;
		}

		// Extract YAML content (without delimiters)
		const yamlContent = content.substring(4, closingIndex).trim();

		// Calculate end index (position after closing --- and newline)
		const endIndex = closingIndex + 4; // +4 for '\n---'

		try {
			const parsed = parseYaml(yamlContent) as Record<string, unknown> || {};
			return {
				raw: yamlContent,
				parsed,
				endIndex
			};
		} catch (error) {
			StreamLogger.warn("[ContentPreserver.parseYamlFrontmatter] Failed to parse YAML", error);
			return {
				raw: yamlContent,
				parsed: {},
				endIndex
			};
		}
	}

	/**
	 * Extract all callout blocks with block IDs from markdown content
	 * Returns a Map of blockId -> BlockContent for easy lookup
	 */
	static extractCalloutBlocks(body: string): Map<string, BlockContent> {
		const blocks = new Map<string, BlockContent>();
		const lines = body.split('\n');
		let i = 0;

		while (i < lines.length) {
			const line = lines[i];

			// Look for callout start: "> [!type]title"
			const calloutMatch = line.match(/^> \[!(\w+)\]([^\n]*)/);
			if (calloutMatch) {
				const calloutType = calloutMatch[1];
				const calloutTitle = calloutMatch[2].trim();

				// Collect all callout lines until we find a non-callout line or block ID
				const calloutLines: string[] = [];
				let blockId = '';
				let j = i + 1;
				let containsEllipsis = false;

				while (j < lines.length) {
					const checkLine = lines[j];

					// Check for block ID: "> ^id"
					const blockIdMatch = checkLine.match(/^> \^([^\n]+)$/);
					if (blockIdMatch) {
						blockId = blockIdMatch[1];
						j++; // Include the block ID line
						break;
					}

					// Check if line is still part of callout (starts with ">")
					if (checkLine.startsWith('>')) {
						calloutLines.push(checkLine);
						if (this.ELLIPSIS_PATTERN.test(checkLine)) {
							containsEllipsis = true;
						}
						j++;
					} else {
						// End of callout
						break;
					}
				}

				// If we found a block ID, store this block
				if (blockId) {
					const fullMatch = lines.slice(i, j).join('\n');
					blocks.set(blockId, {
						blockId,
						calloutType,
						calloutTitle,
						calloutLines,
						fullMatch,
						containsEllipsis
					});
				}

				i = j;
			} else {
				i++;
			}
		}

		return blocks;
	}

	/**
	 * Build a callout block string from components
	 */
	static buildCalloutBlock(
		type: string,
		title: string,
		content: string[],
		blockId: string
	): string {
		const parts: string[] = [];

		// Add callout header
		if (title) {
			parts.push(`> [!${type}] ${title}`);
		} else {
			parts.push(`> [!${type}]`);
		}

		// Add content lines
		for (const line of content) {
			parts.push(line);
		}

		// Add block ID
		parts.push(`> ^${blockId}`);

		return parts.join('\n');
	}

	/**
	 * Merge preserved callout blocks into fresh content
	 * For each callout block with a block ID in fresh content:
	 * - If we have preserved content for that block ID, replace the placeholder content
	 * - Otherwise, keep the fresh content as-is
	 */
	static mergeCalloutBlocks(freshBody: string, preservedBlocks: Map<string, BlockContent>): string {
		const lines = freshBody.split('\n');
		const result: string[] = [];
		let i = 0;

		while (i < lines.length) {
			const line = lines[i];

			// Look for callout start: "> [!type]title"
			const calloutMatch = line.match(/^> \[!(\w+)\]([^\n]*)/);
			if (calloutMatch) {
				const calloutType = calloutMatch[1];
				const calloutTitle = calloutMatch[2].trim();

				// Collect all callout lines until we find a block ID
				const calloutLines: string[] = [];
				let blockId = '';
				let j = i + 1;

				while (j < lines.length) {
					const checkLine = lines[j];

					// Check for block ID: "> ^id"
					const blockIdMatch = checkLine.match(/^> \^([^\n]+)$/);
					if (blockIdMatch) {
						blockId = blockIdMatch[1];
						j++; // Include the block ID line
						break;
					}

					// Check if line is still part of callout (starts with ">")
					if (checkLine.startsWith('>')) {
						calloutLines.push(checkLine);
						j++;
					} else {
						// End of callout (no block ID found - not a tracked block)
						break;
					}
				}

				// If we found a block ID, check if we have preserved content
				if (blockId && preservedBlocks.has(blockId)) {
					const preservedBlock = preservedBlocks.get(blockId);

					if (preservedBlock) {
						StreamLogger.log("[ContentPreserver.mergeCalloutBlocks] Preserving content for block", {
							blockId,
							lineCount: preservedBlock.calloutLines.length
						});

						// Rebuild block with preserved content
						result.push(this.buildCalloutBlock(
							calloutType,
							calloutTitle,
							preservedBlock.calloutLines,
							blockId
						));

						// Skip to end of original block
						i = j;
						continue;
					}
				}

				// No preserved content or no block ID - keep original
				result.push(line);
				for (let k = i + 1; k < j; k++) {
					result.push(lines[k]);
				}
				i = j;
			} else {
				result.push(line);
				i++;
			}
		}

		return result.join('\n');
	}

	/**
	 * Count how many blocks from existing content were preserved in fresh content
	 */
	static countPreservedBlocks(existingBlocks: Map<string, BlockContent>, freshBody: string): number {
		const freshBlockIds = new Set<string>();
		const lines = freshBody.split('\n');

		for (const line of lines) {
			const blockIdMatch = line.match(/^> \^([^\n]+)$/);
			if (blockIdMatch) {
				freshBlockIds.add(blockIdMatch[1]);
			}
		}

		let count = 0;
		for (const blockId of existingBlocks.keys()) {
			if (freshBlockIds.has(blockId)) {
				count++;
			}
		}

		return count;
	}

	/**
	 * Merge two YAML frontmatter objects
	 * - System properties: always use fresh values
	 * - User properties: preserve from existing
	 * - Tags: merge and deduplicate, replace old date tags with latest
	 */
	static mergeYamlFrontmatter(
		existing: ParsedFrontmatter,
		fresh: ParsedFrontmatter
	): { merged: Record<string, unknown>; preservedProperties: string[] } {
		const merged: Record<string, unknown> = {};
		const preservedProperties: string[] = [];

		const freshParsed = fresh.parsed;
		const existingParsed = existing.parsed;

		// Start with fresh values (system-generated, always up-to-date)
		for (const [key, value] of Object.entries(freshParsed)) {
			merged[key] = value;
		}

		// Process existing properties
		for (const [key, value] of Object.entries(existingParsed)) {
			if (this.SYSTEM_PROPERTIES.includes(key)) {
				// System property - skip, we already have fresh value
				continue;
			}

			if (key === 'tags') {
				// Special handling for tags
				const freshTags = Array.isArray(freshParsed['tags']) ? freshParsed['tags'] as string[] : [];
				const existingTags = Array.isArray(value) ? value as string[] : [];

				// Find the fresh date tag (if any)
				const freshDateTag = freshTags.find(tag => this.DATE_TAG_PATTERN.test(String(tag)));

				// Merge tags: fresh tags + existing non-date tags
				const mergedTags = [...freshTags];

				for (const tag of existingTags) {
					const tagStr = String(tag);
					// Skip if it's a date tag (we'll use fresh date tag) or already in merged
					if (this.DATE_TAG_PATTERN.test(tagStr)) {
						// Only skip old date tags if we have a fresh one
						if (freshDateTag) continue;
					}
					if (!mergedTags.includes(tagStr)) {
						mergedTags.push(tagStr);
						// Track user-added tags
						if (!freshTags.includes(tagStr)) {
							preservedProperties.push(`tags.${tagStr}`);
						}
					}
				}

				merged['tags'] = mergedTags;
			} else if (!(key in freshParsed)) {
				// User-added property not in fresh - preserve it
				merged[key] = value;
				preservedProperties.push(key);
			}
		}

		return { merged, preservedProperties };
	}

	/**
	 * Extract body content (everything after frontmatter)
	 */
	static extractBody(content: string, frontmatterEndIndex: number): string {
		if (frontmatterEndIndex === 0) {
			return content;
		}
		return content.substring(frontmatterEndIndex).trim();
	}

	/**
	 * Identify user-added content blocks (text and attachments not in fresh content)
	 * Note: Callout blocks with block IDs are handled separately and are excluded here
	 */
	static findUserAddedContent(
		existingBody: string,
		freshBody: string,
		viwoodsAttachmentsFolder: string
	): UserAddedContent {
		const result: UserAddedContent = {
			textBlocks: [],
			attachments: []
		};

		// First, remove callout blocks with block IDs (they're handled separately)
		const existingBodyWithoutBlocks = this.removeCalloutBlocks(existingBody);

		// Extract content from existing "## Your Notes" section if present
		// This is content we previously preserved - should be re-preserved
		const { mainContent, userNotesContent, userAttachments } = this.extractUserNotesSection(existingBodyWithoutBlocks);

		// Add previously preserved attachments
		result.attachments.push(...userAttachments);

		// Add previously preserved text content
		if (userNotesContent.trim().length > 0) {
			result.textBlocks.push(userNotesContent.trim());
		}

		// Create a set of normalized fresh lines for quick lookup
		const freshLines = new Set(
			freshBody.split('\n')
				.map(line => line.trim())
				.filter(line => line.length > 0)
		);

		// Extract all attachment paths from fresh content
		const freshAttachments = this.extractAttachments(freshBody);
		const freshAttachmentPaths = new Set(freshAttachments.map(a => a.path.toLowerCase()));

		// Process main content (excluding the "## Your Notes" section) line by line
		const existingLines = mainContent.split('\n');
		let currentBlock: string[] = [];
		let inUserBlock = false;

		for (const line of existingLines) {
			const trimmed = line.trim();

			// Skip template placeholder text
			if (this.TEMPLATE_PLACEHOLDERS.includes(trimmed)) {
				// End current block if any
				if (currentBlock.length > 0 && inUserBlock) {
					const blockText = currentBlock.join('\n').trim();
					if (blockText.length > 0) {
						result.textBlocks.push(blockText);
					}
					currentBlock = [];
					inUserBlock = false;
				}
				continue;
			}

			// Check for attachment references
			const attachmentMatch = line.match(/!\[\[([^\]]+)\]\]|\[\[([^\]]+)\]\]/);
			if (attachmentMatch) {
				const attachmentPath = attachmentMatch[1] || attachmentMatch[2];

				// End current text block before processing attachment
				if (currentBlock.length > 0 && inUserBlock) {
					const blockText = currentBlock.join('\n').trim();
					if (blockText.length > 0) {
						result.textBlocks.push(blockText);
					}
					currentBlock = [];
					inUserBlock = false;
				}

				// Check if attachment should be preserved
				const isInFresh = freshAttachmentPaths.has(attachmentPath.toLowerCase());
				const isViwoodsAttachment = this.isViwoodsAttachment(attachmentPath, viwoodsAttachmentsFolder);

				if (!isInFresh && !isViwoodsAttachment) {
					// User-added attachment - preserve it
					result.attachments.push({
						type: this.getAttachmentType(attachmentPath),
						path: attachmentPath,
						fullMatch: attachmentMatch[0]
					});
				}
				continue;
			}

			// Check if this line is in fresh content
			const isInFresh = freshLines.has(trimmed);

			if (!isInFresh && trimmed.length > 0) {
				// User-added text
				inUserBlock = true;
				currentBlock.push(line);
			} else if (inUserBlock && trimmed.length === 0) {
				// Empty line within user block - include it
				currentBlock.push(line);
			} else if (inUserBlock) {
				// Line exists in fresh content - end of user block
				if (currentBlock.length > 0) {
					const blockText = currentBlock.join('\n').trim();
					if (blockText.length > 0) {
						result.textBlocks.push(blockText);
					}
				}
				currentBlock = [];
				inUserBlock = false;
			}
		}

		// Don't forget the last block
		if (currentBlock.length > 0) {
			const blockText = currentBlock.join('\n').trim();
			if (blockText.length > 0) {
				result.textBlocks.push(blockText);
			}
		}

		return result;
	}

	/**
	 * Remove callout blocks with block IDs from content
	 * Returns content without tracked callout blocks (they're handled separately)
	 */
	private static removeCalloutBlocks(body: string): string {
		const lines = body.split('\n');
		const result: string[] = [];
		let i = 0;

		while (i < lines.length) {
			const line = lines[i];

			// Look for callout start: "> [!type]title"
			const calloutMatch = line.match(/^> \[!(\w+)\]([^\n]*)/);
			if (calloutMatch) {
				// Skip this callout block until we find a block ID or end of callout
				let j = i + 1;
				let foundBlockId = false;

				while (j < lines.length) {
					const checkLine = lines[j];

					// Check for block ID: "> ^id"
					if (checkLine.match(/^> \^([^\n]+)$/)) {
						foundBlockId = true;
						j++; // Include the block ID line
						break;
					}

					// Check if line is still part of callout
					if (checkLine.startsWith('>')) {
						j++;
					} else {
						// End of callout without block ID - include it
						break;
					}
				}

				// If we found a block ID, skip this entire block
				if (foundBlockId) {
					i = j;
					continue;
				}

				// No block ID - this is not a tracked block, include it
				result.push(line);
				for (let k = i + 1; k < j; k++) {
					result.push(lines[k]);
				}
				i = j;
			} else {
				result.push(line);
				i++;
			}
		}

		return result.join('\n');
	}

	/**
	 * Extract the "## Your Notes" section from existing content
	 * Returns the main content (without the section) and the user notes content
	 */
	private static extractUserNotesSection(body: string): {
		mainContent: string;
		userNotesContent: string;
		userAttachments: AttachmentReference[];
	} {
		const lines = body.split('\n');
		const mainLines: string[] = [];
		const userNotesLines: string[] = [];
		const userAttachments: AttachmentReference[] = [];

		let inUserNotesSection = false;
		let inUserAttachmentsSection = false;

		for (const line of lines) {
			const trimmed = line.trim();

			// Check for "## Your Notes" header
			if (trimmed === this.USER_NOTES_HEADER) {
				inUserNotesSection = true;
				inUserAttachmentsSection = false;
				continue;
			}

			// Check for "### Your Attachments" header
			if (trimmed === this.USER_ATTACHMENTS_HEADER) {
				inUserAttachmentsSection = true;
				continue;
			}

			// Check for end of user notes section (another ## header or end of document)
			if (inUserNotesSection && trimmed.startsWith('## ') && trimmed !== this.USER_NOTES_HEADER) {
				inUserNotesSection = false;
				inUserAttachmentsSection = false;
				mainLines.push(line);
				continue;
			}

			if (inUserNotesSection) {
				// Skip horizontal rules that we added
				if (trimmed === '---') {
					continue;
				}

				if (inUserAttachmentsSection) {
					// Extract attachments
					const attachmentMatch = line.match(/!\[\[([^\]]+)\]\]|\[\[([^\]]+)\]\]/);
					if (attachmentMatch) {
						const attachmentPath = attachmentMatch[1] || attachmentMatch[2];
						userAttachments.push({
							type: this.getAttachmentType(attachmentPath),
							path: attachmentPath,
							fullMatch: attachmentMatch[0]
						});
					}
				} else {
					// Regular user notes content
					userNotesLines.push(line);
				}
			} else {
				mainLines.push(line);
			}
		}

		return {
			mainContent: mainLines.join('\n'),
			userNotesContent: userNotesLines.join('\n'),
			userAttachments
		};
	}

	/**
	 * Check if an attachment reference is from the Viwoods attachments folder
	 */
	static isViwoodsAttachment(
		attachmentPath: string,
		viwoodsAttachmentsFolder: string
	): boolean {
		if (!viwoodsAttachmentsFolder) {
			return false;
		}

		// Normalize paths for comparison
		const normalizedPath = attachmentPath.toLowerCase();
		const normalizedFolder = viwoodsAttachmentsFolder.toLowerCase();

		// Check if attachment path starts with or contains the Viwoods folder
		return normalizedPath.startsWith(normalizedFolder + '/') ||
			normalizedPath.startsWith(normalizedFolder.split('/').pop() + '/') ||
			normalizedPath.includes('/' + normalizedFolder + '/');
	}

	/**
	 * Extract all attachment references from content
	 */
	static extractAttachments(content: string): AttachmentReference[] {
		const attachments: AttachmentReference[] = [];
		const regex = /!\[\[([^\]]+)\]\]|\[\[([^\]]+)\]\]/g;
		let match;

		while ((match = regex.exec(content)) !== null) {
			const path = match[1] || match[2];
			attachments.push({
				type: this.getAttachmentType(path),
				path: path,
				fullMatch: match[0]
			});
		}

		return attachments;
	}

	/**
	 * Determine attachment type from file path
	 */
	static getAttachmentType(path: string): 'image' | 'audio' | 'file' | 'link' {
		const lower = path.toLowerCase();
		if (/\.(png|jpg|jpeg|gif|webp|svg|bmp)$/.test(lower)) return 'image';
		if (/\.(mp3|mp4|m4a|wav|ogg|webm)$/.test(lower)) return 'audio';
		if (/\.(pdf|doc|docx|xls|xlsx|ppt|pptx|zip)$/.test(lower)) return 'file';
		return 'link';
	}

	/**
	 * Build final merged content
	 */
	static buildMergedContent(
		mergedYaml: Record<string, unknown>,
		freshBody: string,
		userAdditions: UserAddedContent
	): string {
		const parts: string[] = [];

		// Build YAML frontmatter
		parts.push('---');
		parts.push(stringifyYaml(mergedYaml).trim());
		parts.push('---');
		parts.push('');

		// Add fresh body content
		parts.push(freshBody);

		// Add user additions at bottom (if any)
		const hasUserContent = userAdditions.textBlocks.length > 0 || userAdditions.attachments.length > 0;

		if (hasUserContent) {
			parts.push('');
			parts.push('---');
			parts.push('');
			parts.push('## Your Notes');
			parts.push('');

			// Add preserved text blocks
			for (const block of userAdditions.textBlocks) {
				parts.push(block);
				parts.push('');
			}

			// Add preserved attachments
			if (userAdditions.attachments.length > 0) {
				parts.push('### Your Attachments');
				parts.push('');
				for (const attachment of userAdditions.attachments) {
					parts.push(attachment.fullMatch);
				}
				parts.push('');
			}
		}

		return parts.join('\n');
	}
}
