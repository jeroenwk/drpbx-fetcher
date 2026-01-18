/**
 * Link Replacer
 * Replaces note references with wiki-links in text content
 *
 * @deprecated This service has been replaced by TextRewriter which handles
 * link placement more intelligently by having the LLM directly rewrite
 * the text. Kept for reference.
 */

import { StreamLogger } from "../../../utils/StreamLogger";
import { ExtractedReference, LinkReplacement, NoteMatch } from "../VoiceNotesTypes";
import { NoteFinder } from "./NoteFinder";

/**
 * Service for replacing text references with wiki-links
 */
export class LinkReplacer {
	private noteFinder: NoteFinder;
	private createMissingLinks: boolean;

	constructor(noteFinder: NoteFinder, createMissingLinks: boolean) {
		this.noteFinder = noteFinder;
		this.createMissingLinks = createMissingLinks;
	}

	/**
	 * Build replacement map for all extracted references
	 *
	 * @param references Extracted references from the LLM
	 * @returns Array of replacements to make
	 */
	buildReplacements(references: ExtractedReference[]): LinkReplacement[] {
		StreamLogger.log("[LinkReplacer.buildReplacements] Building replacements", {
			referenceCount: references.length,
		});

		const replacements: LinkReplacement[] = [];
		const processedTexts = new Set<string>();

		for (const ref of references) {
			// Skip duplicates (same text might be extracted multiple times)
			if (processedTexts.has(ref.text)) {
				StreamLogger.log("[LinkReplacer.buildReplacements] Skipping duplicate", {
					text: ref.text,
				});
				continue;
			}
			processedTexts.add(ref.text);

			// Find matching note
			const match = this.noteFinder.findBestMatch(ref.noteName);

			const replacement = this.createReplacement(ref, match);
			if (replacement) {
				replacements.push(replacement);
			}
		}

		StreamLogger.log("[LinkReplacer.buildReplacements] Replacements built", {
			total: replacements.length,
			matched: replacements.filter((r) => !r.isBrokenLink).length,
			brokenLinks: replacements.filter((r) => r.isBrokenLink).length,
		});

		return replacements;
	}

	/**
	 * Apply replacements to content
	 *
	 * @param content Original content
	 * @param replacements Replacements to make
	 * @returns Modified content with wiki-links
	 */
	applyReplacements(content: string, replacements: LinkReplacement[]): string {
		StreamLogger.log("[LinkReplacer.applyReplacements] Applying replacements", {
			contentLength: content.length,
			replacementCount: replacements.length,
		});

		if (replacements.length === 0) {
			return content;
		}

		let result = content;

		// Sort replacements by text length descending to avoid partial replacement issues
		const sortedReplacements = [...replacements].sort(
			(a, b) => b.originalText.length - a.originalText.length
		);

		for (const replacement of sortedReplacements) {
			// Use case-insensitive replacement but preserve original text before link
			const escapedText = this.escapeRegex(replacement.originalText);
			const regex = new RegExp(escapedText, "gi");

			// Count replacements made
			const matchCount = (result.match(regex) || []).length;

			if (matchCount > 0) {
				result = result.replace(regex, replacement.wikiLink);

				StreamLogger.log("[LinkReplacer.applyReplacements] Replaced", {
					original: replacement.originalText,
					wikiLink: replacement.wikiLink,
					occurrences: matchCount,
				});
			} else {
				StreamLogger.warn("[LinkReplacer.applyReplacements] Text not found", {
					originalText: replacement.originalText,
				});
			}
		}

		StreamLogger.log("[LinkReplacer.applyReplacements] Replacements complete", {
			originalLength: content.length,
			newLength: result.length,
		});

		return result;
	}

	/**
	 * Create a single replacement entry
	 */
	private createReplacement(
		ref: ExtractedReference,
		match: NoteMatch | null
	): LinkReplacement | null {
		if (match) {
			// Found a match - create link to the note
			const wikiLink = `[[${match.note.name}]]`;

			StreamLogger.log("[LinkReplacer.createReplacement] Creating matched link", {
				searchTerm: ref.noteName,
				matchedNote: match.note.name,
				score: match.score.toFixed(3),
			});

			return {
				originalText: ref.text,
				wikiLink,
				matchedPath: match.note.path,
				isBrokenLink: false,
			};
		} else if (this.createMissingLinks) {
			// No match found - create a broken link with the extracted name
			// Clean up the note name for the link
			const cleanName = this.cleanNoteName(ref.noteName);
			const wikiLink = `[[${cleanName}]]`;

			StreamLogger.log("[LinkReplacer.createReplacement] Creating broken link", {
				searchTerm: ref.noteName,
				cleanName,
			});

			return {
				originalText: ref.text,
				wikiLink,
				isBrokenLink: true,
			};
		} else {
			// No match and not creating broken links - skip
			StreamLogger.log("[LinkReplacer.createReplacement] Skipping (no match, broken links disabled)", {
				searchTerm: ref.noteName,
			});
			return null;
		}
	}

	/**
	 * Clean up a note name for use in a wiki-link
	 */
	private cleanNoteName(name: string): string {
		return (
			name
				// Remove characters that can't be in wiki-links ([ ] | # ^)
				// eslint-disable-next-line no-useless-escape
				.replace(/[\[\]|#^]/g, "")
				// Collapse multiple spaces
				.replace(/\s+/g, " ")
				// Trim
				.trim()
				// Capitalize first letter of each word (title case)
				.replace(/\b\w/g, (c) => c.toUpperCase())
		);
	}

	/**
	 * Escape special regex characters in a string
	 */
	private escapeRegex(text: string): string {
		// eslint-disable-next-line no-useless-escape
		return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
	}
}
