/**
 * Types for VoiceNotesProcessor
 * Handles dictated markdown files with note reference extraction
 */

import { ProcessorConfig } from "../types";

/**
 * Configuration for LLM model selection and parameters
 */
export interface LLMConfig {
	/** WebLLM model identifier (e.g., "Phi-3-mini-4k-instruct-q4f16_1-MLC") */
	model: string;
	/** Temperature for generation (0.0 = deterministic, 1.0 = creative) */
	temperature: number;
}

/**
 * Configuration for fuzzy matching behavior
 */
export interface MatchingConfig {
	/** Minimum similarity threshold (0.0-1.0) for a match to be accepted */
	similarityThreshold: number;
	/** Enable fuzzy matching algorithm */
	fuzzyMatching: boolean;
	/** Folders to exclude from note search */
	excludeFolders: string[];
}

/**
 * Configuration for VoiceNotesProcessor
 */
export interface VoiceNotesProcessorConfig extends ProcessorConfig {
	/** Whether the processor is enabled */
	enabled: boolean;
	/** Output folder for processed voice notes */
	outputFolder: string;
	/** Tag to detect dictated notes (without #) */
	dictationTag: string;
	/** LLM configuration */
	llm: LLMConfig;
	/** Matching configuration */
	matching: MatchingConfig;
	/** Always create wiki-links even when no match found (creates broken links) */
	createMissingLinks: boolean;
}

/**
 * Reference extracted from voice note text
 */
export interface ExtractedReference {
	/** The exact text phrase containing the reference */
	text: string;
	/** The extracted note name from the phrase */
	noteName: string;
	/** Confidence score (0.0-1.0) */
	confidence: number;
}

/**
 * Result from LLM reference extraction
 * @deprecated Use TextRewriteResult instead - kept for backward compatibility
 */
export interface ReferenceExtractionResult {
	/** List of extracted references */
	references: ExtractedReference[];
	/** Raw LLM response for debugging */
	rawResponse?: string;
}

/**
 * Result from LLM text rewriting with smart link placement
 */
export interface TextRewriteResult {
	/** The rewritten content with wiki-links placed naturally */
	rewrittenContent: string;
	/** Raw LLM response for debugging */
	rawResponse?: string;
	/** Number of links added */
	linksAdded: number;
}

/**
 * A note found in the vault
 */
export interface VaultNote {
	/** Full path in vault (e.g., "folder/subfolder/note.md") */
	path: string;
	/** Note name without extension */
	name: string;
	/** Note name normalized for matching (lowercase, trimmed) */
	normalizedName: string;
}

/**
 * Match result from fuzzy search
 */
export interface NoteMatch {
	/** The matched note */
	note: VaultNote;
	/** Similarity score (0.0-1.0) */
	score: number;
}

/**
 * Replacement to be made in the document
 */
export interface LinkReplacement {
	/** Original text to replace */
	originalText: string;
	/** Wiki-link to insert (e.g., "[[Note Name]]") */
	wikiLink: string;
	/** The matched note path (if any) */
	matchedPath?: string;
	/** Whether this creates a broken link */
	isBrokenLink: boolean;
}

/**
 * WebLLM model options available for selection
 */
export const AVAILABLE_MODELS = [
	{
		value: "Phi-3-mini-4k-instruct-q4f16_1-MLC",
		label: "Phi-3 Mini (1.4GB) - Recommended",
		size: "1.4GB",
	},
	{
		value: "Qwen2.5-0.5B-Instruct-q4f16_1-MLC",
		label: "Qwen2.5 0.5B (300MB) - Lightweight",
		size: "300MB",
	},
	{
		value: "Llama-3.2-1B-Instruct-q4f16_1-MLC",
		label: "Llama 3.2 1B (650MB)",
		size: "650MB",
	},
	{
		value: "gemma-2-2b-it-q4f16_1-MLC",
		label: "Gemma 2 2B (1.3GB)",
		size: "1.3GB",
	},
	{
		value: "Mistral-Small-24B-Instruct-v0.1-q4f16_1-MLC",
		label: "Mistral Small 3.1 (16GB) - High Quality",
		size: "16GB",
	},
] as const;

/**
 * Default configuration values
 */
export const DEFAULT_CONFIG: VoiceNotesProcessorConfig = {
	enabled: true,
	outputFolder: "Voice Notes",
	dictationTag: "dictation",
	llm: {
		model: "Phi-3-mini-4k-instruct-q4f16_1-MLC",
		temperature: 0.1,
	},
	matching: {
		similarityThreshold: 0.6,
		fuzzyMatching: true,
		excludeFolders: ["Templates", "Attachments", ".obsidian"],
	},
	createMissingLinks: true,
};
