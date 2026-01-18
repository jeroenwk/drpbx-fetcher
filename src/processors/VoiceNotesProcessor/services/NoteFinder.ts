/**
 * Note Finder
 * Fuzzy search for notes in the Obsidian vault
 */

import { App } from "obsidian";
import { StreamLogger } from "../../../utils/StreamLogger";
import { VaultNote, NoteMatch, MatchingConfig } from "../VoiceNotesTypes";

/**
 * Service for finding notes in the vault using fuzzy matching
 */
export class NoteFinder {
	private app: App;
	private config: MatchingConfig;
	private cachedNotes: VaultNote[] | null = null;

	constructor(app: App, config: MatchingConfig) {
		this.app = app;
		this.config = config;
	}

	/**
	 * Update the matching configuration
	 */
	updateConfig(config: MatchingConfig): void {
		this.config = config;
		// Invalidate cache when config changes (excludeFolders might have changed)
		this.cachedNotes = null;
	}

	/**
	 * Find the best matching note for a given search term
	 *
	 * @param searchTerm The note name to search for
	 * @returns Best match or null if none above threshold
	 */
	findBestMatch(searchTerm: string): NoteMatch | null {
		StreamLogger.log("[NoteFinder.findBestMatch] Searching for note", { searchTerm });

		const notes = this.getAllNotes();

		if (notes.length === 0) {
			StreamLogger.warn("[NoteFinder.findBestMatch] No notes found in vault");
			return null;
		}

		const normalizedSearch = this.normalize(searchTerm);
		let bestMatch: NoteMatch | null = null;

		for (const note of notes) {
			const score = this.calculateSimilarity(normalizedSearch, note.normalizedName);

			if (score > (bestMatch?.score || 0)) {
				bestMatch = { note, score };
			}
		}

		StreamLogger.log("[NoteFinder.findBestMatch] Search result", {
			searchTerm,
			bestMatch: bestMatch
				? { name: bestMatch.note.name, score: bestMatch.score.toFixed(3) }
				: null,
			threshold: this.config.similarityThreshold,
		});

		// Return null if below threshold
		if (!bestMatch || bestMatch.score < this.config.similarityThreshold) {
			StreamLogger.log("[NoteFinder.findBestMatch] No match above threshold", {
				searchTerm,
				bestScore: bestMatch?.score.toFixed(3),
				threshold: this.config.similarityThreshold,
			});
			return null;
		}

		return bestMatch;
	}

	/**
	 * Find all matching notes above threshold, sorted by score
	 *
	 * @param searchTerm The note name to search for
	 * @param limit Maximum number of results
	 * @returns Array of matches sorted by score (descending)
	 */
	findMatches(searchTerm: string, limit = 5): NoteMatch[] {
		const notes = this.getAllNotes();
		const normalizedSearch = this.normalize(searchTerm);

		const matches: NoteMatch[] = [];

		for (const note of notes) {
			const score = this.calculateSimilarity(normalizedSearch, note.normalizedName);

			if (score >= this.config.similarityThreshold) {
				matches.push({ note, score });
			}
		}

		// Sort by score descending
		matches.sort((a, b) => b.score - a.score);

		StreamLogger.log("[NoteFinder.findMatches] Found matches", {
			searchTerm,
			matchCount: matches.length,
			topMatches: matches.slice(0, limit).map((m) => ({
				name: m.note.name,
				score: m.score.toFixed(3),
			})),
		});

		return matches.slice(0, limit);
	}

	/**
	 * Get all notes from the vault (cached)
	 */
	getAllNotes(): VaultNote[] {
		if (this.cachedNotes) {
			return this.cachedNotes;
		}

		StreamLogger.log("[NoteFinder.getAllNotes] Building note cache");

		const notes: VaultNote[] = [];
		const excludeFolders = new Set(
			this.config.excludeFolders.map((f) => f.toLowerCase())
		);

		const files = this.app.vault.getFiles();

		for (const file of files) {
			// Only include markdown files
			if (file.extension !== "md") {
				continue;
			}

			// Check if file is in an excluded folder
			if (this.isInExcludedFolder(file.path, excludeFolders)) {
				continue;
			}

			// Get note name without extension
			const name = file.basename;

			notes.push({
				path: file.path,
				name,
				normalizedName: this.normalize(name),
			});
		}

		this.cachedNotes = notes;

		StreamLogger.log("[NoteFinder.getAllNotes] Note cache built", {
			noteCount: notes.length,
		});

		return notes;
	}

	/**
	 * Clear the note cache (call when vault changes)
	 */
	clearCache(): void {
		this.cachedNotes = null;
		StreamLogger.log("[NoteFinder.clearCache] Note cache cleared");
	}

	/**
	 * Check if a path is inside an excluded folder
	 */
	private isInExcludedFolder(path: string, excludeFolders: Set<string>): boolean {
		const pathParts = path.toLowerCase().split("/");

		// Check each folder in the path
		for (let i = 0; i < pathParts.length - 1; i++) {
			// Check cumulative path for nested exclusions
			const folderPath = pathParts.slice(0, i + 1).join("/");
			if (excludeFolders.has(folderPath) || excludeFolders.has(pathParts[i])) {
				return true;
			}
		}

		return false;
	}

	/**
	 * Normalize text for matching (lowercase, remove extra whitespace)
	 */
	private normalize(text: string): string {
		return text
			.toLowerCase()
			.replace(/[^\w\s]/g, " ") // Replace punctuation with space
			.replace(/\s+/g, " ") // Collapse whitespace
			.trim();
	}

	/**
	 * Calculate similarity between two strings using combined Jaccard + Levenshtein
	 *
	 * @param search Normalized search term
	 * @param noteName Normalized note name
	 * @returns Similarity score (0.0-1.0)
	 */
	private calculateSimilarity(search: string, noteName: string): number {
		if (!this.config.fuzzyMatching) {
			// Exact match only
			return search === noteName ? 1.0 : 0.0;
		}

		// Get word sets for Jaccard similarity
		const wordsSearch = new Set(search.split(" ").filter((w) => w.length > 0));
		const wordsNote = new Set(noteName.split(" ").filter((w) => w.length > 0));

		// Calculate Jaccard similarity (word overlap)
		const intersection = [...wordsSearch].filter((w) => wordsNote.has(w)).length;
		const union = new Set([...wordsSearch, ...wordsNote]).size;
		const jaccard = union > 0 ? intersection / union : 0;

		// Calculate Levenshtein ratio (character similarity)
		const maxLen = Math.max(search.length, noteName.length);
		const editDist = this.levenshteinDistance(search, noteName);
		const levenshtein = maxLen > 0 ? 1 - editDist / maxLen : 1;

		// Weighted combination (60% word overlap, 40% character similarity)
		const combined = jaccard * 0.6 + levenshtein * 0.4;

		return combined;
	}

	/**
	 * Calculate Levenshtein distance between two strings
	 */
	private levenshteinDistance(a: string, b: string): number {
		if (a.length === 0) return b.length;
		if (b.length === 0) return a.length;

		// Create matrix
		const matrix: number[][] = [];

		// Initialize first column
		for (let i = 0; i <= b.length; i++) {
			matrix[i] = [i];
		}

		// Initialize first row
		for (let j = 0; j <= a.length; j++) {
			matrix[0][j] = j;
		}

		// Fill in the rest
		for (let i = 1; i <= b.length; i++) {
			for (let j = 1; j <= a.length; j++) {
				if (b.charAt(i - 1) === a.charAt(j - 1)) {
					matrix[i][j] = matrix[i - 1][j - 1];
				} else {
					matrix[i][j] = Math.min(
						matrix[i - 1][j - 1] + 1, // substitution
						matrix[i][j - 1] + 1, // insertion
						matrix[i - 1][j] + 1 // deletion
					);
				}
			}
		}

		return matrix[b.length][a.length];
	}
}
