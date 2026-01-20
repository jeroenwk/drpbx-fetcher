/**
 * Text Rewriter
 * Uses LLM to intelligently rewrite voice-transcribed text with wiki-links placed naturally
 */

import { StreamLogger } from "../../../utils/StreamLogger";
import { NoteFinder } from "./NoteFinder";
import { TextRewriteResult } from "../VoiceNotesTypes";

/**
 * Generic interface for LLM clients (WebLLM and Gemini)
 * Both clients implement this interface for interoperability
 */
export interface LLMClient {
	isReady(): boolean;
	getCurrentModel(): string | null;
	generate(prompt: string, temperature?: number): Promise<string>;
}

/**
 * Build the rewrite prompt with the available notes list
 */
function buildRewritePrompt(noteNames: string[]): string {
	const noteListStr = noteNames.length > 0
		? noteNames.slice(0, 50).map(n => `- ${n}`).join("\n")
		: "(No notes in vault)";

	return `
You are a text editor with the sole purpose to insert links to notes.

## WORKFLOW
- Find phrases that refer to links: "link to X" or "see my note on X" or "Refer to ..." etc.
- Remember those exact phrases and the topic (X)
- Search in the text around it for words that match X.
- Link those words with [[name_of_note|captured_words]]
- Remove phrase that only contains the link information.

## RULES
- NEVER touch YAML blocks (between --- markers) - copy it exactly as-is
- NEVER summarize information or add information that doesn't exist in the original note.
- NEVER change formatting, line breaks, headers or structure
- ONLY the edited note, nothing else.

## NOTES THAT CAN BE LINKED TO
${noteListStr}

NOW EDIT THIS NOTE:

`;
}

/**
 * Service for rewriting voice notes with intelligently placed wiki-links
 */
export class TextRewriter {
	private client: LLMClient;
	private noteFinder: NoteFinder;
	private createMissingLinks: boolean;

	constructor(client: LLMClient, noteFinder: NoteFinder, createMissingLinks: boolean) {
		this.client = client;
		this.noteFinder = noteFinder;
		this.createMissingLinks = createMissingLinks;
	}

	/**
	 * Rewrite the content with wiki-links placed at logical positions
	 *
	 * @param content The text content to rewrite
	 * @param temperature LLM temperature (lower = more deterministic)
	 * @param excludeNoteName Name of the current note to exclude from linking (prevents self-links)
	 * @returns Rewrite result with processed text
	 */
	async rewriteWithLinks(content: string, temperature = 0.1, excludeNoteName?: string): Promise<TextRewriteResult> {
		StreamLogger.log("[TextRewriter.rewriteWithLinks] Starting rewrite", {
			contentLength: content.length,
			temperature,
			excludeNoteName,
		});

		if (!this.client.isReady()) {
			throw new Error("LLM client is not ready. Initialize the model first.");
		}

		// Get list of available notes for the LLM to use
		const notes = this.noteFinder.getAllNotes();

		// Filter out the current note to prevent self-linking
		const filteredNotes = excludeNoteName
			? notes.filter(n => n.name !== excludeNoteName)
			: notes;
		const noteNames = filteredNotes.map(n => n.name);

		StreamLogger.log("[TextRewriter.rewriteWithLinks] Available notes", {
			noteCount: noteNames.length,
			excludedNote: excludeNoteName,
			sampleNotes: noteNames.slice(0, 10),
		});

		// Build the full prompt
		const prompt = buildRewritePrompt(noteNames);
		const fullPrompt = prompt + content;

		StreamLogger.log("[TextRewriter.rewriteWithLinks] ===== FULL PROMPT =====");
		StreamLogger.log("[TextRewriter.rewriteWithLinks] PROMPT_START>>>" + fullPrompt + "<<<PROMPT_END");
		StreamLogger.log("[TextRewriter.rewriteWithLinks] Sending to LLM", {
			promptLength: fullPrompt.length,
		});

		try {
			// Generate response from LLM
			const rawResponse = await this.client.generate(fullPrompt, temperature);

			StreamLogger.log("[TextRewriter.rewriteWithLinks] ===== FULL LLM RESPONSE =====");
			StreamLogger.log("[TextRewriter.rewriteWithLinks] RESPONSE_START>>>" + rawResponse + "<<<RESPONSE_END");
			StreamLogger.log("[TextRewriter.rewriteWithLinks] Raw LLM response", {
				responseLength: rawResponse.length,
			});

			// Clean up and validate the response
			const rewrittenContent = this.processResponse(rawResponse, content);

			// Post-process: fix note names using fuzzy matching
			const finalContent = this.postProcessLinks(rewrittenContent);

			StreamLogger.log("[TextRewriter.rewriteWithLinks] Rewrite complete", {
				originalLength: content.length,
				rewrittenLength: finalContent.length,
				linksFound: this.countLinks(finalContent),
			});

			return {
				rewrittenContent: finalContent,
				rawResponse,
				linksAdded: this.countLinks(finalContent),
			};
		} catch (error) {
			StreamLogger.error("[TextRewriter.rewriteWithLinks] Rewrite failed", error);
			throw error;
		}
	}

	/**
	 * Process the LLM response to extract the rewritten content
	 */
	private processResponse(response: string, originalContent: string): string {
		StreamLogger.log("[TextRewriter.processResponse] Processing response", {
			responseLength: response.length,
		});

		// Clean up the response - trim whitespace
		let cleaned = response.trim();

		// If the response is empty or too short, return original
		if (cleaned.length < 10) {
			StreamLogger.warn("[TextRewriter.processResponse] Response too short, returning original");
			return originalContent;
		}

		// If the LLM added unwanted prefixes, remove them
		const unwantedPrefixes = [
			"Here is the rewritten text:",
			"Here's the rewritten text:",
			"Rewritten text:",
			"Output:",
			"Result:",
		];

		for (const prefix of unwantedPrefixes) {
			if (cleaned.toLowerCase().startsWith(prefix.toLowerCase())) {
				cleaned = cleaned.substring(prefix.length).trim();
			}
		}

		// Remove markdown code blocks if the LLM wrapped it
		if (cleaned.startsWith("```") && cleaned.endsWith("```")) {
			cleaned = cleaned.slice(3, -3);
			// Also remove language specifier if present
			const firstNewline = cleaned.indexOf("\n");
			if (firstNewline > 0 && firstNewline < 15) {
				const firstLine = cleaned.substring(0, firstNewline).trim();
				if (firstLine === "markdown" || firstLine === "md" || firstLine === "") {
					cleaned = cleaned.substring(firstNewline + 1);
				}
			}
			cleaned = cleaned.trim();
		}

		StreamLogger.log("[TextRewriter.processResponse] Cleaned response", {
			cleanedLength: cleaned.length,
		});

		return cleaned;
	}

	/**
	 * Post-process to fix note names in links using fuzzy matching
	 * This ensures links use correct note names from the vault
	 */
	private postProcessLinks(content: string): string {
		StreamLogger.log("[TextRewriter.postProcessLinks] Post-processing links");

		// Find all wiki-links in the content
		const linkRegex = /\[\[([^\]]+)\]\]/g;
		let match;
		const replacements: Array<{ original: string; replacement: string }> = [];

		while ((match = linkRegex.exec(content)) !== null) {
			const fullLink = match[0];
			const linkContent = match[1];

			// Split into note name and alias (if present)
			// [[note|alias]] or [[note]]
			let noteName = linkContent;
			let alias: string | null = null;

			const pipeIndex = linkContent.indexOf('|');
			if (pipeIndex !== -1) {
				noteName = linkContent.substring(0, pipeIndex);
				alias = linkContent.substring(pipeIndex + 1);
			}

			// Try to find a matching note using the note name part only
			const bestMatch = this.noteFinder.findBestMatch(noteName);

			if (bestMatch) {
				// Found a match - use the correct note name, preserving alias if present
				let correctLink: string;
				if (alias) {
					correctLink = `[[${bestMatch.note.name}|${alias}]]`;
				} else {
					correctLink = `[[${bestMatch.note.name}]]`;
				}

				if (correctLink !== fullLink) {
					replacements.push({ original: fullLink, replacement: correctLink });
					StreamLogger.log("[TextRewriter.postProcessLinks] Correcting link", {
						original: linkContent,
						corrected: bestMatch.note.name,
						aliasPreserved: alias,
						score: bestMatch.score.toFixed(3),
					});
				}
			} else if (!this.createMissingLinks) {
				// No match and we don't want broken links - remove the link syntax
				replacements.push({ original: fullLink, replacement: alias || noteName });
				StreamLogger.log("[TextRewriter.postProcessLinks] Removing broken link", {
					linkContent,
				});
			}
			// If createMissingLinks is true and no match, keep the link as-is
		}

		// Apply replacements
		let result = content;
		for (const { original, replacement } of replacements) {
			result = result.replace(original, replacement);
		}

		StreamLogger.log("[TextRewriter.postProcessLinks] Post-processing complete", {
			replacementsMade: replacements.length,
		});

		return result;
	}

	/**
	 * Count the number of wiki-links in the content
	 */
	private countLinks(content: string): number {
		const matches = content.match(/\[\[[^\]]+\]\]/g);
		return matches ? matches.length : 0;
	}
}
