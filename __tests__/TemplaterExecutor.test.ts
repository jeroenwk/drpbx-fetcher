import { TemplaterExecutor } from '../src/processors/templates/TemplaterExecutor';
import { TemplaterContext } from '../src/processors/templates/TemplaterContext';
import { DateModule } from '../src/processors/templates/modules/DateModule';
import { ConfigModule } from '../src/processors/templates/modules/ConfigModule';

describe('TemplaterExecutor', () => {
	let executor: TemplaterExecutor;
	let context: TemplaterContext;

	beforeEach(() => {
		executor = new TemplaterExecutor();

		// Create minimal context for testing
		const dateModule = new DateModule();
		const configModule = new ConfigModule({
			templateFile: 'test-template.md',
			activeFile: 'test-file.md',
			runMode: 'test',
		});

		// Create minimal mock vault and app
		const vault = {
			getFiles: () => [],
			getAbstractFileByPath: () => null,
		} as unknown as import('obsidian').Vault;

		const app = {} as unknown as import('obsidian').App;

		context = {
			tp: {
				date: dateModule,
				config: configModule,
				file: {} as never,
				frontmatter: {} as never,
				app: app,
				obsidian: {} as never,
				user: {},
			},
			variables: {},
			vault: vault,
			app: app,
		};
	});

	describe('executeCombined - Basic Tests', () => {
		it('should execute simple tR assignment', async () => {
			const code = 'let tR = "";\ntR += "Hello";\nreturn tR;';
			const result = await executor.executeCombined(code, context);
			expect(result).toBe('Hello');
		});

		it('should handle multiple tR assignments', async () => {
			const code = 'let tR = "";\ntR += "Hello";\ntR += " ";\ntR += "World";\nreturn tR;';
			const result = await executor.executeCombined(code, context);
			expect(result).toBe('Hello World');
		});

		it('should return empty string for empty tR', async () => {
			const code = 'let tR = "";\nreturn tR;';
			const result = await executor.executeCombined(code, context);
			expect(result).toBe('');
		});
	});

	describe('executeCombined - Loop Tests', () => {
		it('should handle simple forEach loop', async () => {
			const code = `
let tR = "";
["a", "b", "c"].forEach(x => {
	tR += x;
});
return tR;
`;
			const result = await executor.executeCombined(code, context);
			expect(result).toBe('abc');
		});

		it('should handle forEach with index', async () => {
			const code = `
let tR = "";
["a", "b"].forEach((x, i) => {
	if (i > 0) tR += ", ";
	tR += x;
});
return tR;
`;
			const result = await executor.executeCombined(code, context);
			expect(result).toBe('a, b');
		});

		it('should handle nested loops', async () => {
			const code = `
let tR = "";
[1, 2].forEach(outer => {
	["a", "b"].forEach(inner => {
		tR += outer + inner + " ";
	});
});
return tR;
`;
			const result = await executor.executeCombined(code, context);
			expect(result).toBe('1a 1b 2a 2b ');
		});
	});

	describe('executeCombined - Template Variable Tests', () => {
		it('should access tp.user variables in loops', async () => {
			context.tp.user = {
				items: ['apple', 'banana', 'cherry'],
			};

			const code = `
let tR = "";
tp.user.items.forEach(item => {
	tR += "- " + item + "\\n";
});
return tR;
`;
			const result = await executor.executeCombined(code, context);
			expect(result).toBe('- apple\n- banana\n- cherry\n');
		});

		it('should access object properties in loops', async () => {
			context.tp.user = {
				pages: [
					{ pageNumber: 1, imagePath: 'page1.png' },
					{ pageNumber: 2, imagePath: 'page2.png' },
				],
			};

			const code = `
let tR = "";
tp.user.pages.forEach((page, index) => {
	if (index > 0) tR += "___\\n";
	tR += "![[" + page.imagePath + "]]\\n";
});
return tR;
`;
			const result = await executor.executeCombined(code, context);
			expect(result).toBe('![[page1.png]]\n___\n![[page2.png]]\n');
		});
	});

	describe('executeCombined - Conditional Logic Tests', () => {
		it('should handle if statement', async () => {
			context.tp.user = { count: 5 };

			const code = `
let tR = "";
if (tp.user.count > 0) {
	tR += "Count: " + tp.user.count;
}
return tR;
`;
			const result = await executor.executeCombined(code, context);
			expect(result).toBe('Count: 5');
		});

		it('should handle if-else statement', async () => {
			context.tp.user = { count: 0 };

			const code = `
let tR = "";
if (tp.user.count > 0) {
	tR += "Has items";
} else {
	tR += "No items";
}
return tR;
`;
			const result = await executor.executeCombined(code, context);
			expect(result).toBe('No items');
		});

		it('should handle conditional in loop', async () => {
			context.tp.user = {
				items: [
					{ name: 'apple', visible: true },
					{ name: 'banana', visible: false },
					{ name: 'cherry', visible: true },
				],
			};

			const code = `
let tR = "";
tp.user.items.forEach(item => {
	if (item.visible) {
		tR += item.name + "\\n";
	}
});
return tR;
`;
			const result = await executor.executeCombined(code, context);
			expect(result).toBe('apple\ncherry\n');
		});
	});

	describe('executeCombined - Mixed Content Tests', () => {
		it('should handle mixed text and dynamic content', async () => {
			context.tp.user = { name: 'John' };

			const code = `
let tR = "";
tR += "Hello, ";
tR += String(tp.user.name);
tR += "!";
return tR;
`;
			const result = await executor.executeCombined(code, context);
			expect(result).toBe('Hello, John!');
		});

		it('should handle loop with text and dynamic content', async () => {
			context.tp.user = {
				pages: [
					{ imagePath: 'img1.png' },
					{ imagePath: 'img2.png' },
				],
			};

			const code = `
let tR = "";
tp.user.pages.forEach((page, index) => {
	if (index > 0) {
		tR += \`___\\n\\n\`;
	}
	tR += \`![[\`;
	tR += String(page.imagePath);
	tR += \`]]\\n\\n### Notes\\n\\n*Add your notes here*\\n\\n\`;
});
return tR;
`;
			const result = await executor.executeCombined(code, context);
			expect(result).toBe('![[img1.png]]\n\n### Notes\n\n*Add your notes here*\n\n___\n\n![[img2.png]]\n\n### Notes\n\n*Add your notes here*\n\n');
		});
	});

	describe('executeCombined - Paper Template Simulation', () => {
		it('should render Paper template structure', async () => {
			context.tp.user = {
				pages: [
					{ pageNumber: 1, imagePath: 'Attachments/Viwoods/paper-1-page-1.png' },
					{ pageNumber: 2, imagePath: 'Attachments/Viwoods/paper-1-page-2.png' },
				],
				audioFiles: [
					{ fileName: 'audio1.mp3', path: 'Attachments/Viwoods/audio1.mp3' },
				],
			};

			const code = `
let tR = "";
tp.user.pages.forEach((page, index) => {
	if (index > 0) {
		tR += \`___\\n\\n\`;
	}
	tR += \`![[\`;
	tR += String(page.imagePath);
	tR += \`]]\\n\\n### Notes\\n\\n*Add your notes here*\\n\\n\`;
});
if (tp.user.audioFiles && tp.user.audioFiles.length > 0) {
	tR += \`\\n## Audio Recordings\\n\\n\`;
	tp.user.audioFiles.forEach(audio => {
		tR += \`![[\`;
		tR += String(audio.path);
		tR += \`]]\\n\`;
	});
}
return tR;
`;
			const result = await executor.executeCombined(code, context);

			expect(result).toContain('![[Attachments/Viwoods/paper-1-page-1.png]]');
			expect(result).toContain('___');
			expect(result).toContain('![[Attachments/Viwoods/paper-1-page-2.png]]');
			expect(result).toContain('## Audio Recordings');
			expect(result).toContain('![[Attachments/Viwoods/audio1.mp3]]');
			expect(result).toContain('### Notes');
		});

		it('should handle Paper template with no audio', async () => {
			context.tp.user = {
				pages: [
					{ pageNumber: 1, imagePath: 'page1.png' },
				],
				audioFiles: [],
			};

			const code = `
let tR = "";
tp.user.pages.forEach((page, index) => {
	if (index > 0) {
		tR += \`___\\n\\n\`;
	}
	tR += \`![[\`;
	tR += String(page.imagePath);
	tR += \`]]\\n\\n### Notes\\n\\n*Add your notes here*\\n\\n\`;
});
if (tp.user.audioFiles && tp.user.audioFiles.length > 0) {
	tR += \`\\n## Audio Recordings\\n\\n\`;
	tp.user.audioFiles.forEach(audio => {
		tR += \`![[\`;
		tR += String(audio.path);
		tR += \`]]\\n\`;
	});
}
return tR;
`;
			const result = await executor.executeCombined(code, context);

			expect(result).toContain('![[page1.png]]');
			expect(result).not.toContain('## Audio Recordings');
			expect(result).not.toContain('___');
		});
	});

	describe('executeCombined - Error Handling', () => {
		it('should handle syntax errors gracefully', async () => {
			const code = 'let tR = "";\nthis is invalid syntax\nreturn tR;';
			const result = await executor.executeCombined(code, context);

			// Should return error comment
			expect(result).toContain('<!-- Templater Error:');
		});

		it('should handle undefined variable references', async () => {
			const code = 'let tR = "";\ntR += undefinedVar;\nreturn tR;';
			const result = await executor.executeCombined(code, context);

			// Should return error comment
			expect(result).toContain('<!-- Templater Error:');
		});
	});

	describe('executeCombined - Special Characters', () => {
		it('should handle backticks in template literals', async () => {
			const code = 'let tR = "";\ntR += `Text with backtick: \\``;\nreturn tR;';
			const result = await executor.executeCombined(code, context);
			expect(result).toBe('Text with backtick: `');
		});

		it('should handle backslashes', async () => {
			const code = 'let tR = "";\ntR += `Path: C:\\\\Users\\\\test`;\nreturn tR;';
			const result = await executor.executeCombined(code, context);
			expect(result).toBe('Path: C:\\Users\\test');
		});

		it('should handle dollar signs in template literals', async () => {
			const code = 'let tR = "";\ntR += `Price: \\$100`;\nreturn tR;';
			const result = await executor.executeCombined(code, context);
			expect(result).toBe('Price: $100');
		});
	});
});
