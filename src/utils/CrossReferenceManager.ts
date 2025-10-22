import { Vault } from "obsidian";
import { StreamLogger } from "./StreamLogger";
import { MetadataManager } from "./MetadataManager";
import { ViwoodsNoteMetadata } from "../models/Settings";
import { ViwoodsProcessorConfig } from "../processors/ViwoodsProcessor/ViwoodsTypes";

/**
 * Related note information
 */
export interface RelatedNote {
	path: string;         // Full vault path
	name: string;         // Display name (without .md extension)
	creationTime: number; // Unix timestamp in milliseconds
}

/**
 * Related notes grouped by module type
 */
export interface RelatedNotes {
	paper: RelatedNote[];
	meeting: RelatedNote[];
	memo: RelatedNote[];
	learning: RelatedNote[];
	picking: RelatedNote[];
}

/**
 * Manages cross-references between daily notes and notes from other modules
 */
export class CrossReferenceManager {
	/**
	 * Find all notes created on a specific date across all modules
	 */
	public static async findNotesByDate(
		date: Date,
		vault: Vault,
		viwoodsConfig: ViwoodsProcessorConfig
	): Promise<RelatedNotes> {
		const related: RelatedNotes = {
			paper: [],
			meeting: [],
			memo: [],
			learning: [],
			picking: [],
		};

		// Get start and end of day for date matching
		const startOfDay = new Date(date);
		startOfDay.setHours(0, 0, 0, 0);

		const endOfDay = new Date(date);
		endOfDay.setHours(23, 59, 59, 999);

		await StreamLogger.log(`[CrossReferenceManager] Finding notes for date: ${date.toISOString().split('T')[0]}`);

		// Query Paper notes
		if (viwoodsConfig.paper.enabled) {
			const paperNotes = await this.queryModuleMetadata(
				vault,
				`${viwoodsConfig.paper.notesFolder}/resources/viwoodsNoteMetadata.md`,
				startOfDay,
				endOfDay,
				'paper'
			);
			related.paper = paperNotes;
		}

		// Query Meeting notes
		if (viwoodsConfig.meeting.enabled) {
			const meetingNotes = await this.queryModuleMetadata(
				vault,
				`${viwoodsConfig.meeting.meetingsFolder}/resources/viwoodsNoteMetadata.md`,
				startOfDay,
				endOfDay,
				'meeting'
			);
			related.meeting = meetingNotes;
		}

		// Query Memo notes
		if (viwoodsConfig.memo.enabled) {
			const memoNotes = await this.queryModuleMetadata(
				vault,
				`${viwoodsConfig.memo.memosFolder}/resources/viwoodsNoteMetadata.md`,
				startOfDay,
				endOfDay,
				'memo'
			);
			related.memo = memoNotes;
		}

		// Query Learning notes
		if (viwoodsConfig.learning.enabled) {
			const learningNotes = await this.queryModuleMetadata(
				vault,
				`${viwoodsConfig.learning.annotationsFolder}/resources/viwoodsNoteMetadata.md`,
				startOfDay,
				endOfDay,
				'learning'
			);
			related.learning = learningNotes;
		}

		// Query Picking notes
		if (viwoodsConfig.picking.enabled) {
			const pickingNotes = await this.queryModuleMetadata(
				vault,
				`${viwoodsConfig.picking.capturesFolder}/resources/viwoodsNoteMetadata.md`,
				startOfDay,
				endOfDay,
				'picking'
			);
			related.picking = pickingNotes;
		}

		const totalFound = related.paper.length + related.meeting.length + related.memo.length +
			related.learning.length + related.picking.length;
		await StreamLogger.log(`[CrossReferenceManager] Found ${totalFound} related notes`);

		return related;
	}

	/**
	 * Query metadata from a specific module
	 */
	private static async queryModuleMetadata(
		vault: Vault,
		metadataPath: string,
		startOfDay: Date,
		endOfDay: Date,
		moduleName: string
	): Promise<RelatedNote[]> {
		const notes: RelatedNote[] = [];

		try {
			// Check if metadata file exists
			if (!(await vault.adapter.exists(metadataPath))) {
				await StreamLogger.log(`[CrossReferenceManager] No metadata file found for ${moduleName}: ${metadataPath}`);
				return notes;
			}

			// Load metadata
			const content = await vault.adapter.read(metadataPath);
			const metadata = MetadataManager.fromMarkdown(content);

			if (!metadata) {
				await StreamLogger.log(`[CrossReferenceManager] Failed to parse metadata for ${moduleName}`);
				return notes;
			}

			// Filter by date
			for (const [notePath, noteMetadata] of Object.entries(metadata)) {
				const creationTime = noteMetadata.creationTime || noteMetadata.lastModified;

				if (!creationTime) {
					continue; // Skip notes without timestamps
				}

				// Check if creation time falls within the date range
				if (creationTime >= startOfDay.getTime() && creationTime <= endOfDay.getTime()) {
					const noteName = this.extractNoteName(notePath);
					notes.push({
						path: notePath,
						name: noteName,
						creationTime: creationTime,
					});
				}
			}

			await StreamLogger.log(`[CrossReferenceManager] Found ${notes.length} ${moduleName} notes for date`);
		} catch (error) {
			await StreamLogger.error(`[CrossReferenceManager] Error querying ${moduleName} metadata:`, error);
		}

		return notes;
	}

	/**
	 * Extract note name from vault path (remove .md extension)
	 */
	private static extractNoteName(path: string): string {
		const basename = path.split('/').pop() || path;
		return basename.replace(/\.md$/, '');
	}

	/**
	 * Format related notes as markdown sections
	 */
	public static formatRelatedNotes(related: RelatedNotes): {
		hasRelatedNotes: boolean;
		relatedPaper: string;
		relatedMeeting: string;
		relatedMemo: string;
		relatedLearning: string;
		relatedPicking: string;
	} {
		const hasRelatedNotes =
			related.paper.length > 0 ||
			related.meeting.length > 0 ||
			related.memo.length > 0 ||
			related.learning.length > 0 ||
			related.picking.length > 0;

		return {
			hasRelatedNotes,
			relatedPaper: this.formatNoteList(related.paper),
			relatedMeeting: this.formatNoteList(related.meeting),
			relatedMemo: this.formatNoteList(related.memo),
			relatedLearning: this.formatNoteList(related.learning),
			relatedPicking: this.formatNoteList(related.picking),
		};
	}

	/**
	 * Format a list of notes as markdown bullet points with wikilinks
	 */
	private static formatNoteList(notes: RelatedNote[]): string {
		if (notes.length === 0) {
			return '';
		}

		// Sort by creation time (oldest first)
		const sorted = notes.sort((a, b) => a.creationTime - b.creationTime);

		return sorted.map(note => `- [[${note.name}]]`).join('\n');
	}

	/**
	 * Get daily note path for a given date
	 */
	public static getDailyNotePath(date: Date, dailyNotesFolder: string): string {
		const year = date.getFullYear();
		const month = String(date.getMonth() + 1).padStart(2, '0');
		const day = String(date.getDate()).padStart(2, '0');
		const dateString = `${year}-${month}-${day}`;

		return `${dailyNotesFolder}/${dateString}.md`;
	}

	/**
	 * Add a link to an existing daily note (for incremental updates)
	 */
	public static async addLinkToDailyNote(
		vault: Vault,
		dailyNotePath: string,
		note: { path: string; name: string; module: string }
	): Promise<void> {
		try {
			// Check if daily note exists
			if (!(await vault.adapter.exists(dailyNotePath))) {
				await StreamLogger.log(`[CrossReferenceManager] Daily note does not exist: ${dailyNotePath}`);
				return;
			}

			// Read existing content
			const content = await vault.adapter.read(dailyNotePath);

			// Check if link already exists
			const linkPattern = `[[${note.name}]]`;
			if (this.linkExists(content, note.name)) {
				await StreamLogger.log(`[CrossReferenceManager] Link already exists in daily note: ${note.name}`);
				return;
			}

			// Determine section header based on module
			const sectionHeaders: Record<string, string> = {
				paper: '### Paper Notes',
				meeting: '### Meeting Notes',
				memo: '### Memos',
				learning: '### Learning Notes',
				picking: '### Quick Captures',
			};

			const sectionHeader = sectionHeaders[note.module];
			if (!sectionHeader) {
				await StreamLogger.warn(`[CrossReferenceManager] Unknown module type: ${note.module}`);
				return;
			}

			let updatedContent: string;

			// Check if section exists
			if (content.includes(sectionHeader)) {
				// Section exists - append link after the header
				// Find the header and insert after it
				const lines = content.split('\n');
				const headerIndex = lines.findIndex(line => line.trim() === sectionHeader);

				if (headerIndex !== -1) {
					// Insert link after header
					lines.splice(headerIndex + 1, 0, `- ${linkPattern}`);
					updatedContent = lines.join('\n');
				} else {
					updatedContent = content; // Shouldn't happen, but fallback
				}
			} else {
				// Section doesn't exist - create it in Related Notes section
				// Find "## Related Notes" and add new section
				if (content.includes('## Related Notes')) {
					// Find where to insert (after "No related notes" message or after last section)
					const noNotesPattern = /\*No related notes found for this date\*/;

					if (noNotesPattern.test(content)) {
						// Replace "no related notes" message with first section
						updatedContent = content.replace(
							noNotesPattern,
							`${sectionHeader}\n- ${linkPattern}`
						);
					} else {
						// Add after last existing section (before the next ## header or ---  separator)
						const relatedNotesIndex = content.indexOf('## Related Notes');
						const nextSectionIndex = content.indexOf('\n##', relatedNotesIndex + 1);
						const nextSeparatorIndex = content.indexOf('\n---', relatedNotesIndex + 1);

						const insertBeforeIndex = nextSectionIndex !== -1 ? nextSectionIndex :
							(nextSeparatorIndex !== -1 ? nextSeparatorIndex : content.length);

						const before = content.substring(0, insertBeforeIndex);
						const after = content.substring(insertBeforeIndex);

						updatedContent = `${before}\n\n${sectionHeader}\n- ${linkPattern}${after}`;
					}
				} else {
					// Related Notes section doesn't exist - shouldn't happen with template
					await StreamLogger.warn(`[CrossReferenceManager] Related Notes section not found in: ${dailyNotePath}`);
					return;
				}
			}

			// Write updated content
			await vault.adapter.write(dailyNotePath, updatedContent);
			await StreamLogger.log(`[CrossReferenceManager] Added link to daily note ${dailyNotePath}: ${note.name}`);
		} catch (error) {
			await StreamLogger.error(`[CrossReferenceManager] Error adding link to daily note:`, error);
		}
	}

	/**
	 * Check if a link to a note already exists in markdown content
	 */
	public static linkExists(content: string, noteName: string): boolean {
		const linkPattern = `[[${noteName}]]`;
		return content.includes(linkPattern);
	}
}
