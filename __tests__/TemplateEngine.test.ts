import { TemplateEngine } from '../src/processors/templates/TemplateEngine';

describe('TemplateEngine', () => {
	describe('render - Basic Template Tests', () => {
		it('should render plain text without commands', async () => {
			const template = 'Hello World';
			const result = await TemplateEngine.render(template, {});

			expect(result).toBe('Hello World');
		});

		it('should render dynamic commands', async () => {
			const template = 'Hello <% "World" %>';
			const result = await TemplateEngine.render(template, {});

			expect(result).toBe('Hello World');
		});

		it('should render tp.user variables', async () => {
			const template = 'Hello <% tp.user.name %>';
			const data = { name: 'John' };
			const result = await TemplateEngine.render(template, data);

			expect(result).toBe('Hello John');
		});
	});

	describe('render - Execution Block Tests', () => {
		it('should handle simple execution block', async () => {
			const template = '<%* tR += "Hello" %>';
			const result = await TemplateEngine.render(template, {});

			expect(result).toBe('Hello');
		});

		it('should handle execution block with forEach', async () => {
			const template = `<%* ["a", "b", "c"].forEach(x => { %>
Item: <% x %>
<%* }) %>`;

			const result = await TemplateEngine.render(template, {});

			expect(result).toContain('Item: a');
			expect(result).toContain('Item: b');
			expect(result).toContain('Item: c');
		});

		it('should handle execution block with tp.user array', async () => {
			const template = `<%* tp.user.items.forEach(item => { %>
- <% item %>
<%* }) %>`;

			const data = { items: ['apple', 'banana', 'cherry'] };
			const result = await TemplateEngine.render(template, data);

			expect(result).toContain('- apple');
			expect(result).toContain('- banana');
			expect(result).toContain('- cherry');
		});
	});

	describe('render - Paper Template Structure', () => {
		it('should render Paper template with pages loop', async () => {
			const template = `---
created: <% tp.user.createTime %>
total_pages: <% tp.user.totalPages %>
---

<%*
tp.user.pages.forEach((page, index) => {
-%>
<%* if (index > 0) { -%>
___

<%* } -%>
![[<% page.imagePath %>]]

### Notes

*Add your notes here*

<%* }) -%>`;

			const data = {
				createTime: '2026-01-10 18:19',
				totalPages: 2,
				pages: [
					{ pageNumber: 1, imagePath: 'Attachments/page1.png' },
					{ pageNumber: 2, imagePath: 'Attachments/page2.png' },
				],
			};

			const result = await TemplateEngine.render(template, data);

			// Verify frontmatter
			expect(result).toContain('created: 2026-01-10 18:19');
			expect(result).toContain('total_pages: 2');

			// Verify first page (no page break before)
			expect(result).toContain('![[Attachments/page1.png]]');
			expect(result).toContain('### Notes');

			// Verify page break before second page
			expect(result).toContain('___');

			// Verify second page
			expect(result).toContain('![[Attachments/page2.png]]');
		});

		it('should render Paper template with audio section', async () => {
			const template = `<%*
tp.user.pages.forEach((page, index) => {
-%>
![[<% page.imagePath %>]]

<%* }) -%>
<%*
if (tp.user.audioFiles && tp.user.audioFiles.length > 0) {
-%>

## Audio Recordings

<%* tp.user.audioFiles.forEach(audio => { -%>
![[<% audio.path %>]]
<%* }) -%>
<%* } -%>`;

			const data = {
				pages: [
					{ pageNumber: 1, imagePath: 'page1.png' },
				],
				audioFiles: [
					{ fileName: 'audio1.mp3', path: 'Attachments/audio1.mp3' },
					{ fileName: 'audio2.mp3', path: 'Attachments/audio2.mp3' },
				],
			};

			const result = await TemplateEngine.render(template, data);

			expect(result).toContain('![[page1.png]]');
			expect(result).toContain('## Audio Recordings');
			expect(result).toContain('![[Attachments/audio1.mp3]]');
			expect(result).toContain('![[Attachments/audio2.mp3]]');
		});

		it('should not render audio section when no audio files', async () => {
			const template = `![[image.png]]

<%*
if (tp.user.audioFiles && tp.user.audioFiles.length > 0) {
-%>

## Audio Recordings

<%* tp.user.audioFiles.forEach(audio => { -%>
![[<% audio.path %>]]
<%* }) -%>
<%* } -%>`;

			const data = {
				audioFiles: [],
			};

			const result = await TemplateEngine.render(template, data);

			expect(result).toContain('![[image.png]]');
			expect(result).not.toContain('## Audio Recordings');
		});
	});

	describe('render - Special Characters', () => {
		it('should handle backticks in text', async () => {
			const template = 'Code: `console.log("test")`';
			const result = await TemplateEngine.render(template, {});

			expect(result).toBe('Code: `console.log("test")`');
		});

		it('should handle dollar signs in text', async () => {
			const template = 'Price: $100';
			const result = await TemplateEngine.render(template, {});

			expect(result).toBe('Price: $100');
		});

		it('should handle backslashes in text', async () => {
			const template = 'Path: C:\\Users\\test';
			const result = await TemplateEngine.render(template, {});

			expect(result).toBe('Path: C:\\Users\\test');
		});

		it('should handle mixed special characters', async () => {
			const template = 'Markdown: `$var` = 100\\n';
			const result = await TemplateEngine.render(template, {});

			expect(result).toBe('Markdown: `$var` = 100\\n');
		});
	});

	describe('render - Complex Nested Structures', () => {
		it('should handle nested loops', async () => {
			const template = `<%* tp.user.sections.forEach(section => { %>
## <% section.title %>

<%* section.items.forEach(item => { %>
- <% item %>
<%* }) %>
<%* }) %>`;

			const data = {
				sections: [
					{ title: 'Fruits', items: ['apple', 'banana'] },
					{ title: 'Vegetables', items: ['carrot', 'broccoli'] },
				],
			};

			const result = await TemplateEngine.render(template, data);

			expect(result).toContain('## Fruits');
			expect(result).toContain('- apple');
			expect(result).toContain('- banana');
			expect(result).toContain('## Vegetables');
			expect(result).toContain('- carrot');
			expect(result).toContain('- broccoli');
		});

		it('should handle conditional within loop', async () => {
			const template = `<%* tp.user.items.forEach(item => { %>
<%* if (item.visible) { %>
- <% item.name %> (<% item.count %>)
<%* } %>
<%* }) %>`;

			const data = {
				items: [
					{ name: 'apple', count: 5, visible: true },
					{ name: 'banana', count: 3, visible: false },
					{ name: 'cherry', count: 7, visible: true },
				],
			};

			const result = await TemplateEngine.render(template, data);

			expect(result).toContain('- apple (5)');
			expect(result).not.toContain('banana');
			expect(result).toContain('- cherry (7)');
		});
	});

	describe('render - Comment Handling', () => {
		it('should ignore comment blocks', async () => {
			const template = 'Before<%# This is a comment %>After';
			const result = await TemplateEngine.render(template, {});

			expect(result).toBe('BeforeAfter');
		});

		it('should ignore multi-line comments', async () => {
			const template = `Before
<%#
This is a
multi-line comment
%>
After`;
			const result = await TemplateEngine.render(template, {});

			expect(result).toContain('Before');
			expect(result).toContain('After');
			expect(result).not.toContain('multi-line comment');
		});
	});

	describe('render - Right-trim Support', () => {
		it('should handle right-trim in execution blocks', async () => {
			const template = `<%* tp.user.items.forEach(item => { -%>
- <% item %>
<%* }) -%>`;

			const data = { items: ['a', 'b'] };
			const result = await TemplateEngine.render(template, data);

			// Right-trim should remove trailing newlines from execution blocks
			expect(result).toContain('- a');
			expect(result).toContain('- b');
		});
	});

	describe('hasCommands', () => {
		it('should detect dynamic commands', () => {
			expect(TemplateEngine.hasCommands('<% test %>')).toBe(true);
		});

		it('should detect execution commands', () => {
			expect(TemplateEngine.hasCommands('<%* test %>')).toBe(true);
		});

		it('should detect comment commands', () => {
			expect(TemplateEngine.hasCommands('<%# test %>')).toBe(true);
		});

		it('should return false for plain text', () => {
			expect(TemplateEngine.hasCommands('plain text')).toBe(false);
		});

		it('should return false for incomplete commands', () => {
			expect(TemplateEngine.hasCommands('< % test % >')).toBe(false);
		});
	});

	describe('formatDate', () => {
		it('should format date with YYYY-MM-DD', () => {
			const date = new Date('2026-01-13T15:30:00');
			const result = TemplateEngine.formatDate(date, 'YYYY-MM-DD');
			expect(result).toBe('2026-01-13');
		});

		it('should format date with time', () => {
			const date = new Date('2026-01-13T15:30:45');
			const result = TemplateEngine.formatDate(date, 'YYYY-MM-DD HH:mm:ss');
			expect(result).toBe('2026-01-13 15:30:45');
		});
	});
});
