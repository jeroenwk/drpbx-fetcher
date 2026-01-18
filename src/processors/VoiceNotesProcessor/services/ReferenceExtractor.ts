/**
 * Reference Extractor
 * Uses LLM to extract note references from voice-transcribed text
 *
 * @deprecated This service has been replaced by TextRewriter which provides
 * smarter link placement by having the LLM directly rewrite the text with
 * wiki-links placed at logical positions. Kept for reference.
 */

import { StreamLogger } from "../../../utils/StreamLogger";
import { WebLLMClient } from "./WebLLMClient";
import { ExtractedReference, ReferenceExtractionResult } from "../VoiceNotesTypes";

/**
 * Prompt template for extracting note references
 * Instructs the LLM to find natural language references to other notes
 */
const EXTRACTION_PROMPT = `You are an expert at analyzing voice-transcribed notes. Your task is to extract references to other notes that the speaker mentions.

Look for phrases where the speaker references another note, document, or topic they've written about, such as:
- "link to [note name]"
- "see my note on [topic]"
- "see my note called [name]"
- "reference my document about [subject]"
- "in my [topic] note"
- "check my [topic] notes"
- "as I mentioned in [note name]"
- "related to my [topic] document"

Important rules:
1. Only extract explicit references where the speaker clearly indicates they want to link to another note
2. Do NOT extract general topic mentions or keywords
3. Extract the note name as the speaker said it (they may use partial names or informal titles)
4. Assign confidence based on how clearly the speaker indicated a reference (0.0-1.0)

Return ONLY a valid JSON object with this exact structure (no other text):
{
  "references": [
    {"text": "exact phrase from text", "noteName": "extracted note name", "confidence": 0.9}
  ]
}

If no references are found, return:
{"references": []}

TEXT TO ANALYZE:
`;

/**
 * Service for extracting note references using WebLLM
 */
export class ReferenceExtractor {
	private client: WebLLMClient;

	constructor(client: WebLLMClient) {
		this.client = client;
	}

	/**
	 * Extract note references from the given text content
	 *
	 * @param content The text content to analyze
	 * @param temperature LLM temperature (lower = more deterministic)
	 * @returns Extraction result with references
	 */
	async extractReferences(content: string, temperature = 0.1): Promise<ReferenceExtractionResult> {
		StreamLogger.log("[ReferenceExtractor.extractReferences] Starting extraction", {
			contentLength: content.length,
			temperature,
		});

		if (!this.client.isReady()) {
			throw new Error("WebLLM client is not ready. Initialize the model first.");
		}

		// Build the full prompt
		const fullPrompt = EXTRACTION_PROMPT + content;

		StreamLogger.log("[ReferenceExtractor.extractReferences] ===== FULL PROMPT =====");
		StreamLogger.log("[ReferenceExtractor.extractReferences] PROMPT_START>>>" + fullPrompt + "<<<PROMPT_END");
		StreamLogger.log("[ReferenceExtractor.extractReferences] Sending to LLM", {
			promptLength: fullPrompt.length,
		});

		try {
			// Generate response from LLM
			const rawResponse = await this.client.generate(fullPrompt, temperature);

			StreamLogger.log("[ReferenceExtractor.extractReferences] ===== FULL LLM RESPONSE =====");
			StreamLogger.log("[ReferenceExtractor.extractReferences] RESPONSE_START>>>" + rawResponse + "<<<RESPONSE_END");
			StreamLogger.log("[ReferenceExtractor.extractReferences] Raw LLM response", {
				responseLength: rawResponse.length,
			});

			// Parse the JSON response
			const references = this.parseResponse(rawResponse);

			StreamLogger.log("[ReferenceExtractor.extractReferences] Extraction complete", {
				referenceCount: references.length,
			});

			return {
				references,
				rawResponse,
			};
		} catch (error) {
			StreamLogger.error("[ReferenceExtractor.extractReferences] Extraction failed", error);
			throw error;
		}
	}

	/**
	 * Parse the LLM response to extract references
	 * Handles various response formats and edge cases
	 */
	private parseResponse(response: string): ExtractedReference[] {
		StreamLogger.log("[ReferenceExtractor.parseResponse] Parsing response", {
			responseLength: response.length,
		});

		try {
			// Try to find JSON in the response (LLM might add extra text)
			const jsonMatch = response.match(/\{[\s\S]*"references"[\s\S]*\}/);
			if (!jsonMatch) {
				StreamLogger.warn("[ReferenceExtractor.parseResponse] No JSON found in response");
				return [];
			}

			const jsonStr = jsonMatch[0];
			StreamLogger.log("[ReferenceExtractor.parseResponse] Found JSON", {
				jsonLength: jsonStr.length,
			});

			const parsed = JSON.parse(jsonStr) as { references?: unknown[] };

			if (!parsed.references || !Array.isArray(parsed.references)) {
				StreamLogger.warn("[ReferenceExtractor.parseResponse] Invalid response structure");
				return [];
			}

			// Validate and normalize each reference
			const references: ExtractedReference[] = [];

			for (const ref of parsed.references) {
				if (!this.isValidReference(ref)) {
					StreamLogger.warn("[ReferenceExtractor.parseResponse] Skipping invalid reference", { ref });
					continue;
				}

				const typedRef = ref as { text: string; noteName: string; confidence?: number };

				references.push({
					text: String(typedRef.text).trim(),
					noteName: String(typedRef.noteName).trim(),
					confidence: typeof typedRef.confidence === "number" ? typedRef.confidence : 0.5,
				});
			}

			StreamLogger.log("[ReferenceExtractor.parseResponse] Parsed references", {
				count: references.length,
				references: references.map((r) => ({ noteName: r.noteName, confidence: r.confidence })),
			});

			return references;
		} catch (error) {
			StreamLogger.error("[ReferenceExtractor.parseResponse] JSON parse error", error);
			return [];
		}
	}

	/**
	 * Validate that an object is a valid reference structure
	 */
	private isValidReference(ref: unknown): boolean {
		if (!ref || typeof ref !== "object") {
			return false;
		}

		const r = ref as Record<string, unknown>;

		// Must have text and noteName strings
		if (typeof r.text !== "string" || typeof r.noteName !== "string") {
			return false;
		}

		// Must have non-empty values
		if (!r.text.trim() || !r.noteName.trim()) {
			return false;
		}

		return true;
	}
}
