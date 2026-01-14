import { ContentPreserver } from '../src/processors/ViwoodsProcessor/utils/ContentPreserver';

// Mock StreamLogger
jest.mock('../src/utils/StreamLogger', () => ({
	StreamLogger: {
		log: jest.fn(),
		warn: jest.fn(),
		error: jest.fn(),
	}
}));

// Mock obsidian module
jest.mock('obsidian', () => ({
	parseYaml: (yaml: string) => {
		// Simple YAML parser for tests
		const result: Record<string, unknown> = {};
		const lines = yaml.split('\n');
		let currentKey = '';
		let inArray = false;
		let arrayItems: string[] = [];

		for (const line of lines) {
			const trimmed = line.trim();
			if (!trimmed) continue;

			// Check for array continuation
			if (trimmed.startsWith('- ')) {
				if (inArray && currentKey) {
					arrayItems.push(trimmed.substring(2).trim());
				}
				continue;
			}

			// Save previous array if any
			if (inArray && currentKey) {
				result[currentKey] = arrayItems;
				arrayItems = [];
				inArray = false;
			}

			// Parse key-value
			const colonIndex = trimmed.indexOf(':');
			if (colonIndex > 0) {
				currentKey = trimmed.substring(0, colonIndex);
				const value = trimmed.substring(colonIndex + 1).trim();

				if (value === '') {
					// Could be start of array
					inArray = true;
					arrayItems = [];
				} else {
					result[currentKey] = value;
				}
			}
		}

		// Save last array if any
		if (inArray && currentKey) {
			result[currentKey] = arrayItems;
		}

		return result;
	},
	stringifyYaml: (obj: Record<string, unknown>) => {
		const lines: string[] = [];
		for (const [key, value] of Object.entries(obj)) {
			if (Array.isArray(value)) {
				lines.push(`${key}:`);
				for (const item of value) {
					lines.push(`  - ${item}`);
				}
			} else {
				lines.push(`${key}: ${value}`);
			}
		}
		return lines.join('\n');
	}
}));

describe('ContentPreserver', () => {
	describe('parseYamlFrontmatter', () => {
		it('should parse valid frontmatter', () => {
			const content = `---
created: 2025-01-01 10:00
modified: 2025-01-01 10:00
total_pages: 2
---

Body content here`;

			const result = ContentPreserver.parseYamlFrontmatter(content);

			expect(result.parsed['created']).toBe('2025-01-01 10:00');
			expect(result.parsed['modified']).toBe('2025-01-01 10:00');
			expect(result.parsed['total_pages']).toBe('2');
			expect(result.endIndex).toBeGreaterThan(0);
		});

		it('should return empty result for content without frontmatter', () => {
			const content = 'No frontmatter here\nJust regular content';

			const result = ContentPreserver.parseYamlFrontmatter(content);

			expect(result.parsed).toEqual({});
			expect(result.endIndex).toBe(0);
		});

		it('should handle frontmatter with tags array', () => {
			const content = `---
tags:
  - scribbling
  - 2025-01-01
  - custom-tag
---

Body`;

			const result = ContentPreserver.parseYamlFrontmatter(content);

			expect(Array.isArray(result.parsed['tags'])).toBe(true);
			expect(result.parsed['tags']).toContain('scribbling');
			expect(result.parsed['tags']).toContain('2025-01-01');
			expect(result.parsed['tags']).toContain('custom-tag');
		});
	});

	describe('mergeYamlFrontmatter', () => {
		it('should use fresh values for system properties', () => {
			const existing = ContentPreserver.parseYamlFrontmatter(`---
created: 2025-01-01 10:00
modified: 2025-01-01 10:00
total_pages: 2
---`);

			const fresh = ContentPreserver.parseYamlFrontmatter(`---
created: 2025-01-01 10:00
modified: 2025-01-14 15:30
total_pages: 3
---`);

			const { merged } = ContentPreserver.mergeYamlFrontmatter(existing, fresh);

			expect(merged['modified']).toBe('2025-01-14 15:30');
			expect(merged['total_pages']).toBe('3');
		});

		it('should preserve user-added properties', () => {
			const existing = ContentPreserver.parseYamlFrontmatter(`---
created: 2025-01-01 10:00
my_custom_property: user_value
another_property: another_value
---`);

			const fresh = ContentPreserver.parseYamlFrontmatter(`---
created: 2025-01-01 10:00
modified: 2025-01-14 15:30
---`);

			const { merged, preservedProperties } = ContentPreserver.mergeYamlFrontmatter(existing, fresh);

			expect(merged['my_custom_property']).toBe('user_value');
			expect(merged['another_property']).toBe('another_value');
			expect(preservedProperties).toContain('my_custom_property');
			expect(preservedProperties).toContain('another_property');
		});

		it('should merge tags with date tag replacement', () => {
			const existing = ContentPreserver.parseYamlFrontmatter(`---
tags:
  - scribbling
  - 2025-01-01
  - project-alpha
  - important
---`);

			const fresh = ContentPreserver.parseYamlFrontmatter(`---
tags:
  - scribbling
  - 2025-01-14
---`);

			const { merged, preservedProperties } = ContentPreserver.mergeYamlFrontmatter(existing, fresh);

			const tags = merged['tags'] as string[];
			expect(tags).toContain('scribbling');
			expect(tags).toContain('2025-01-14');
			expect(tags).not.toContain('2025-01-01'); // Old date tag should be removed
			expect(tags).toContain('project-alpha');
			expect(tags).toContain('important');
			expect(preservedProperties).toContain('tags.project-alpha');
			expect(preservedProperties).toContain('tags.important');
		});
	});

	describe('isViwoodsAttachment', () => {
		it('should identify Viwoods attachments', () => {
			expect(ContentPreserver.isViwoodsAttachment(
				'Viwoods/Attachments/note-page-1.png',
				'Viwoods/Attachments'
			)).toBe(true);

			expect(ContentPreserver.isViwoodsAttachment(
				'viwoods/attachments/note-page-1.png',
				'Viwoods/Attachments'
			)).toBe(true);
		});

		it('should identify non-Viwoods attachments', () => {
			expect(ContentPreserver.isViwoodsAttachment(
				'My Screenshots/diagram.png',
				'Viwoods/Attachments'
			)).toBe(false);

			expect(ContentPreserver.isViwoodsAttachment(
				'Documents/meeting-notes.pdf',
				'Viwoods/Attachments'
			)).toBe(false);
		});
	});

	describe('getAttachmentType', () => {
		it('should identify image types', () => {
			expect(ContentPreserver.getAttachmentType('file.png')).toBe('image');
			expect(ContentPreserver.getAttachmentType('file.jpg')).toBe('image');
			expect(ContentPreserver.getAttachmentType('file.jpeg')).toBe('image');
			expect(ContentPreserver.getAttachmentType('file.gif')).toBe('image');
			expect(ContentPreserver.getAttachmentType('file.webp')).toBe('image');
			expect(ContentPreserver.getAttachmentType('file.svg')).toBe('image');
		});

		it('should identify audio types', () => {
			expect(ContentPreserver.getAttachmentType('file.mp3')).toBe('audio');
			expect(ContentPreserver.getAttachmentType('file.mp4')).toBe('audio');
			expect(ContentPreserver.getAttachmentType('file.m4a')).toBe('audio');
			expect(ContentPreserver.getAttachmentType('file.wav')).toBe('audio');
		});

		it('should identify file types', () => {
			expect(ContentPreserver.getAttachmentType('file.pdf')).toBe('file');
			expect(ContentPreserver.getAttachmentType('file.docx')).toBe('file');
			expect(ContentPreserver.getAttachmentType('file.xlsx')).toBe('file');
		});

		it('should identify links for unknown types', () => {
			expect(ContentPreserver.getAttachmentType('some-note')).toBe('link');
			expect(ContentPreserver.getAttachmentType('folder/note')).toBe('link');
		});
	});

	describe('findUserAddedContent', () => {
		it('should detect user-added text', () => {
			const existingBody = `![[Viwoods/Attachments/note-page-1.png]]

### Notes

This is my custom note that I added.

*Add your notes here*`;

			const freshBody = `![[Viwoods/Attachments/note-page-1.png]]

### Notes

*Add your notes here*`;

			const result = ContentPreserver.findUserAddedContent(
				existingBody,
				freshBody,
				'Viwoods/Attachments'
			);

			expect(result.textBlocks.length).toBe(1);
			expect(result.textBlocks[0]).toContain('This is my custom note');
		});

		it('should detect user-added attachments', () => {
			const existingBody = `![[Viwoods/Attachments/note-page-1.png]]

### Notes

![[My Screenshots/diagram.png]]

*Add your notes here*`;

			const freshBody = `![[Viwoods/Attachments/note-page-1.png]]

### Notes

*Add your notes here*`;

			const result = ContentPreserver.findUserAddedContent(
				existingBody,
				freshBody,
				'Viwoods/Attachments'
			);

			expect(result.attachments.length).toBe(1);
			expect(result.attachments[0].path).toBe('My Screenshots/diagram.png');
			expect(result.attachments[0].type).toBe('image');
		});

		it('should not preserve Viwoods attachments', () => {
			const existingBody = `![[Viwoods/Attachments/old-note-page-1.png]]

### Notes

*Add your notes here*`;

			const freshBody = `![[Viwoods/Attachments/new-note-page-1.png]]

### Notes

*Add your notes here*`;

			const result = ContentPreserver.findUserAddedContent(
				existingBody,
				freshBody,
				'Viwoods/Attachments'
			);

			// Old Viwoods attachment should not be preserved
			expect(result.attachments.length).toBe(0);
		});

		it('should skip template placeholder text', () => {
			const existingBody = `![[Viwoods/Attachments/note-page-1.png]]

### Notes

*Add your notes here*`;

			const freshBody = `![[Viwoods/Attachments/note-page-1.png]]

### Notes

*Add your notes here*`;

			const result = ContentPreserver.findUserAddedContent(
				existingBody,
				freshBody,
				'Viwoods/Attachments'
			);

			expect(result.textBlocks.length).toBe(0);
		});
	});

	describe('buildMergedContent', () => {
		it('should build content without user additions', () => {
			const mergedYaml = {
				created: '2025-01-01 10:00',
				modified: '2025-01-14 15:30'
			};

			const freshBody = `![[image.png]]

### Notes

*Add your notes here*`;

			const userAdditions = {
				textBlocks: [],
				attachments: []
			};

			const result = ContentPreserver.buildMergedContent(mergedYaml, freshBody, userAdditions);

			expect(result).toContain('---');
			expect(result).toContain('created: 2025-01-01 10:00');
			expect(result).toContain('![[image.png]]');
			expect(result).not.toContain('## Your Notes');
		});

		it('should add Your Notes section when user content exists', () => {
			const mergedYaml = {
				created: '2025-01-01 10:00'
			};

			const freshBody = `![[image.png]]`;

			const userAdditions = {
				textBlocks: ['My custom note content'],
				attachments: []
			};

			const result = ContentPreserver.buildMergedContent(mergedYaml, freshBody, userAdditions);

			expect(result).toContain('## Your Notes');
			expect(result).toContain('My custom note content');
		});

		it('should add Your Attachments section when user attachments exist', () => {
			const mergedYaml = {
				created: '2025-01-01 10:00'
			};

			const freshBody = `![[image.png]]`;

			const userAdditions = {
				textBlocks: [],
				attachments: [{
					type: 'image' as const,
					path: 'My Screenshots/diagram.png',
					fullMatch: '![[My Screenshots/diagram.png]]'
				}]
			};

			const result = ContentPreserver.buildMergedContent(mergedYaml, freshBody, userAdditions);

			expect(result).toContain('## Your Notes');
			expect(result).toContain('### Your Attachments');
			expect(result).toContain('![[My Screenshots/diagram.png]]');
		});
	});

	describe('preserve (integration)', () => {
		it('should preserve user content when updating a note', () => {
			const existingContent = `---
created: 2025-01-01 10:00
modified: 2025-01-01 10:00
total_pages: 1
tags:
  - scribbling
  - 2025-01-01
  - my-custom-tag
my_property: user_value
---

![[Viwoods/Attachments/note-page-1.png]]

### Notes

This is my important note about page 1.

![[My Screenshots/diagram.png]]

*Add your notes here*`;

			const freshContent = `---
created: 2025-01-01 10:00
modified: 2025-01-14 15:30
total_pages: 1
tags:
  - scribbling
  - 2025-01-14
---

![[Viwoods/Attachments/note-page-1-12345.png]]

### Notes

*Add your notes here*`;

			const result = ContentPreserver.preserve(
				existingContent,
				freshContent,
				'Viwoods/Attachments'
			);

			// Check YAML preservation
			expect(result.content).toContain('modified: 2025-01-14 15:30');
			expect(result.content).toContain('my_property: user_value');
			expect(result.content).toContain('my-custom-tag');
			// Old date tag should be removed (check tags section specifically)
			const tagsSection = result.content.match(/tags:\n([\s\S]*?)(?=\n\w|---|\n$)/)?.[1] || '';
			expect(tagsSection).not.toContain('2025-01-01'); // Old date tag removed from tags
			expect(tagsSection).toContain('2025-01-14'); // New date tag present

			// Check fresh content
			expect(result.content).toContain('note-page-1-12345.png');

			// Check user content preservation
			expect(result.content).toContain('## Your Notes');
			expect(result.content).toContain('This is my important note');
			expect(result.content).toContain('### Your Attachments');
			expect(result.content).toContain('My Screenshots/diagram.png');

			// Check counts
			expect(result.preservedTextBlocks).toBe(1);
			expect(result.preservedAttachments).toBe(1);
			expect(result.mergedYamlProperties).toContain('my_property');
		});

		it('should handle note with no user additions', () => {
			const existingContent = `---
created: 2025-01-01 10:00
modified: 2025-01-01 10:00
---

![[Viwoods/Attachments/note.png]]

### Notes

*Add your notes here*`;

			const freshContent = `---
created: 2025-01-01 10:00
modified: 2025-01-14 15:30
---

![[Viwoods/Attachments/note-updated.png]]

### Notes

*Add your notes here*`;

			const result = ContentPreserver.preserve(
				existingContent,
				freshContent,
				'Viwoods/Attachments'
			);

			expect(result.content).not.toContain('## Your Notes');
			expect(result.preservedTextBlocks).toBe(0);
			expect(result.preservedAttachments).toBe(0);
		});

		it('should not duplicate Your Notes section on re-preservation', () => {
			// Simulate existing content that already has a "## Your Notes" section from previous preservation
			const existingContent = `---
created: 2025-01-01 10:00
modified: 2025-01-10 12:00
---

![[Viwoods/Attachments/note-page-1.png]]

### Notes

*Add your notes here*

---

## Your Notes

So I've added something here
And then something more

### Your Attachments

![[My Screenshots/diagram.png]]
`;

			const freshContent = `---
created: 2025-01-01 10:00
modified: 2025-01-14 15:30
---

![[Viwoods/Attachments/note-page-1-updated.png]]

### Notes

*Add your notes here*`;

			const result = ContentPreserver.preserve(
				existingContent,
				freshContent,
				'Viwoods/Attachments'
			);

			// Should have exactly ONE "## Your Notes" section
			const yourNotesCount = (result.content.match(/## Your Notes/g) || []).length;
			expect(yourNotesCount).toBe(1);

			// User content should still be preserved
			expect(result.content).toContain("So I've added something here");
			expect(result.content).toContain("And then something more");
			expect(result.content).toContain("My Screenshots/diagram.png");

			// Should use the updated image
			expect(result.content).toContain("note-page-1-updated.png");
		});
	});
});
