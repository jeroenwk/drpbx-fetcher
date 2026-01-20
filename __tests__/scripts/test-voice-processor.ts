#!/usr/bin/env ts-node
/**
 * Voice Processor Test Script
 * Tests different prompts and models against voice note samples
 */

import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';
import { TerminalLLMClient } from '../lib/TerminalLLMClient';
import { LocalLLMClient, LOCAL_MODELS } from '../lib/LocalLLMClient';
import { LMStudioClient } from '../lib/LMStudioClient';
import { GeminiTestClient } from '../lib/GeminiTestClient';

interface TestResult {
	inputFile: string;
	outputFile: string;
	model: string;
	prompt: string;
	expectedLinks: string[];
	actualLinks: string[];
	processingTime: number;
	rawResponse: string;
	processedContent: string;
	error?: string;
}

interface MarkdownParts {
	frontmatter: Record<string, unknown>;
	body: string;
}

/**
 * Main test class for voice processor
 */
class VoiceProcessorTester {
	private llmClient: TerminalLLMClient | LocalLLMClient | LMStudioClient | GeminiTestClient | null = null;
	private promptTemplate: string = '';
	private referenceNotes: string[] = [];
	private promptFile: string = '';
	private mode: 'api' | 'local' | 'lmstudio' | 'gemini' = 'api';
	private temperature: number = 0.1;
	private noteListFile: string | undefined;

	async initialize(model: string, promptFile: string, mode: 'api' | 'local' | 'lmstudio' | 'gemini' = 'api', temperature: number = 0.1, noteListFile?: string, enableThinking: boolean = true, thinkingBudget: number = 1024) {
		this.promptFile = promptFile;
		this.mode = mode;
		this.temperature = temperature;
		this.noteListFile = noteListFile;

		// Detect model family for prompt format
		const modelFamily = this.detectModelFamily(model, mode);
		console.log(`Detected model family: ${modelFamily}`);

		// Load prompt template from model-specific folder
		const promptPath = this.findPromptFile(promptFile, modelFamily);
		if (!promptPath) {
			throw new Error(
				`Prompt file not found: ${promptFile}\n` +
				`Looked in: prompts/${modelFamily}/ and prompts/generic/`
			);
		}
		console.log(`Using prompt: ${promptPath}`);
		this.promptTemplate = fs.readFileSync(promptPath, 'utf-8');

		// Initialize LLM client
		if (mode === 'gemini') {
			// Use Gemini API
			const apiKey = process.env.GEMINI_API_KEY;
			if (!apiKey) {
				throw new Error('GEMINI_API_KEY environment variable required');
			}
			this.llmClient = new GeminiTestClient(apiKey, model, enableThinking, thinkingBudget);
			console.log(`✓ Gemini client initialized (thinking: ${enableThinking}, budget: ${thinkingBudget})`);
		} else if (mode === 'lmstudio') {
			// Use LM Studio local server
			this.llmClient = new LMStudioClient(model);

			// Test connection
			console.log('Testing LM Studio connection...');
			const connected = await this.llmClient.testConnection();
			if (!connected) {
				throw new Error(
					'Cannot connect to LM Studio. Please:\n' +
					'  1. Open LM Studio\n' +
					'  2. Load a model (e.g., Phi-3 mini)\n' +
					'  3. Start the local server (Developer > Local Server)\n' +
					'  4. Make sure it\'s running on port 1234'
				);
			}
			console.log('✓ Connected to LM Studio');
		} else if (mode === 'local') {
			// Use local model via transformers.js (no API key needed)
			const localModel = (LOCAL_MODELS as Record<string, string>)[model] || model;
			this.llmClient = new LocalLLMClient(localModel);
			await this.llmClient.initialize();
		} else {
			// Use API-based model
			const apiKey = process.env.ANTHROPIC_API_KEY;
			if (!apiKey) {
				throw new Error('ANTHROPIC_API_KEY environment variable required');
			}
			this.llmClient = new TerminalLLMClient(apiKey, model);
		}

		// Load reference notes from test vault
		await this.loadReferenceNotes();
	}

	/**
	 * Detect model family for prompt format selection
	 */
	private detectModelFamily(model: string, mode: 'api' | 'local' | 'lmstudio' | 'gemini'): string {
		const modelLower = model.toLowerCase();

		// Gemini models use generic format
		if (mode === 'gemini') {
			return 'generic';
		}

		// LM Studio models
		if (mode === 'lmstudio') {
			if (modelLower.includes('phi-4') || modelLower.includes('phi4')) return 'phi-3'; // Phi-4 uses ChatML like Phi-3
			if (modelLower.includes('phi-3') || modelLower.includes('phi3')) return 'phi-3';
			if (modelLower.includes('llama')) return 'llama';
			if (modelLower.includes('mistral')) return 'llama'; // Uses same format
			if (modelLower.includes('gemma')) return 'generic';
		}

		// API models
		if (mode === 'api') {
			if (modelLower.includes('claude')) return 'claude';
			if (modelLower.includes('gpt')) return 'generic';
		}

		// Default
		return 'generic';
	}

	/**
	 * Find prompt file in model-specific or generic folder
	 */
	private findPromptFile(filename: string, modelFamily: string): string | null {
		// Try model-specific folder first
		const modelSpecific = path.join(__dirname, '../prompts', modelFamily, filename);
		if (fs.existsSync(modelSpecific)) {
			return modelSpecific;
		}

		// Fall back to generic
		const generic = path.join(__dirname, '../prompts/generic', filename);
		if (fs.existsSync(generic)) {
			return generic;
		}

		return null;
	}

	private async loadReferenceNotes() {
		// If a note list file is specified, load from that file
		if (this.noteListFile) {
			const noteListPath = path.join(__dirname, '../samples/note_lists', this.noteListFile);
			if (!fs.existsSync(noteListPath)) {
				throw new Error(`Note list file not found: ${noteListPath}`);
			}

			const content = fs.readFileSync(noteListPath, 'utf-8');
			// Parse lines that start with "- " and extract the note name
			this.referenceNotes = content
				.split('\n')
				.filter(line => line.trim().startsWith('- '))
				.map(line => line.trim().substring(2).trim());

			console.log(`Loaded ${this.referenceNotes.length} notes from ${this.noteListFile}`);
			return;
		}

		// Default: load from reference_notes directory
		const referenceDir = path.join(__dirname, '../samples/reference_notes');
		if (!fs.existsSync(referenceDir)) {
			console.warn('Reference notes directory not found, using empty list');
			this.referenceNotes = [];
			return;
		}

		const files = fs.readdirSync(referenceDir)
			.filter(f => f.endsWith('.md'))
			.map(f => path.basename(f, '.md'));

		this.referenceNotes = files;
		console.log(`Loaded ${files.length} reference notes`);
	}

	async processFile(inputPath: string, verbose: boolean = false): Promise<TestResult> {
		const startTime = Date.now();

		// Read input
		const content = fs.readFileSync(inputPath, 'utf-8');
		const { frontmatter, body } = this.parseMarkdown(content);

		// Extract expected links
		const expectedLinks = (frontmatter.expectedLinks as string[]) || [];

		// Build prompt
		const fullPrompt = this.buildPrompt(body);

		// Output prompt if single file (verbose mode)
		if (verbose) {
			console.log('\n' + '='.repeat(60));
			console.log('REQUEST TO MODEL:');
			console.log('='.repeat(60));
			console.log(fullPrompt);
			console.log('='.repeat(60) + '\n');
		}

		// Call LLM
		let rawResponse: string;
		let error: string | undefined;
		try {
			if (!this.llmClient) {
				throw new Error('LLM client not initialized');
			}
			rawResponse = await this.llmClient.generate(fullPrompt, this.temperature);
		} catch (e) {
			error = (e as Error).message;
			rawResponse = '';
		}

		// Output response if single file (verbose mode)
		if (verbose) {
			console.log('='.repeat(60));
			console.log('RESPONSE FROM MODEL:');
			console.log('='.repeat(60));
			console.log(rawResponse);
			console.log('='.repeat(60) + '\n');
		}

		// Post-process (fuzzy match links)
		const processedContent = rawResponse ? this.postProcessLinks(rawResponse) : content;

		// Extract actual links
		const actualLinks = this.extractLinks(processedContent);

		const processingTime = Date.now() - startTime;

		return {
			inputFile: inputPath,
			outputFile: '', // Set by caller
			model: this.llmClient?.model || 'unknown',
			prompt: this.promptFile,
			expectedLinks,
			actualLinks,
			processingTime,
			rawResponse,
			processedContent,
			error
		};
	}

	async processBatch(inputPattern: string): Promise<TestResult[]> {
		const inputDir = path.join(__dirname, '../samples/dictation_input');

		if (!fs.existsSync(inputDir)) {
			throw new Error(`Input directory not found: ${inputDir}`);
		}

		let files = fs.readdirSync(inputDir)
			.filter(f => f.endsWith('.md'))
			.map(f => path.join(inputDir, f));

		// Filter by input pattern if not wildcard
		if (inputPattern && inputPattern !== '*.md') {
			files = files.filter(f => path.basename(f) === inputPattern);
		}

		console.log(`Found ${files.length} test files`);

		const isSingleFile = files.length === 1;

		const results: TestResult[] = [];
		for (const file of files) {
			const basename = path.basename(file);
			console.log(`Processing: ${basename}...`);

			try {
				const result = await this.processFile(file, isSingleFile);
				results.push(result);

				// Save output
				this.saveOutput(result);
				console.log(`  ✓ Completed (${result.processingTime}ms, ${result.actualLinks.length} links)`);
			} catch (e) {
				console.error(`  ✗ Failed: ${(e as Error).message}`);
			}
		}

		return results;
	}

	private buildPrompt(content: string): string {
		// Build note list (first 50 notes)
		const noteList = this.referenceNotes.slice(0, 50).map(n => `- ${n}`).join('\n');

		// Combine template + note list + content
		return this.promptTemplate
			.replace('{{NOTE_LIST}}', noteList || '(No notes in vault)')
			.replace('{{CONTENT}}', content);
	}

	private postProcessLinks(content: string): string {
		// Extract [[...]] patterns and fuzzy match to actual note names
		const linkPattern = /\[\[([^\]]+)\]\]/g;
		let processed = content;

		const matches = Array.from(content.matchAll(linkPattern));
		for (const match of matches) {
			const linkText = match[1];
			// Fuzzy match to actual note names
			const bestMatch = this.findBestMatch(linkText);
			if (bestMatch) {
				processed = processed.replace(`[[${linkText}]]`, `[[${bestMatch}]]`);
			}
		}

		return processed;
	}

	private findBestMatch(text: string): string | null {
		// Simple fuzzy matching
		const normalized = text.toLowerCase();

		// Exact match first
		const exact = this.referenceNotes.find(n =>
			n.toLowerCase() === normalized
		);
		if (exact) return exact;

		// Partial match (note contains text or text contains note)
		const partial = this.referenceNotes.find(n =>
			n.toLowerCase().includes(normalized) ||
			normalized.includes(n.toLowerCase())
		);

		return partial || null;
	}

	private extractLinks(content: string): string[] {
		const linkPattern = /\[\[([^\]]+)\]\]/g;
		const matches = Array.from(content.matchAll(linkPattern));
		return matches.map(m => m[1]);
	}

	private saveOutput(result: TestResult) {
		const outputDir = path.join(__dirname, '../samples/dictation_output');
		fs.mkdirSync(outputDir, { recursive: true });

		const filename = path.basename(result.inputFile);
		const outputPath = path.join(outputDir, filename);

		// Build output with metadata
		const metadata: Record<string, unknown> = {
			testCase: path.basename(result.inputFile, '.md'),
			model: result.model,
			prompt: result.prompt,
			processingTime: `${result.processingTime}ms`,
			linksAdded: result.actualLinks.length,
			expectedLinks: result.expectedLinks,
			actualLinks: result.actualLinks,
		};

		if (result.error) {
			metadata.error = result.error;
		}

		if (result.rawResponse) {
			metadata.rawResponse = result.rawResponse;
		}

		const output = `---\n${yaml.dump(metadata)}---\n\n${result.processedContent}`;
		fs.writeFileSync(outputPath, output, 'utf-8');

		result.outputFile = outputPath;
	}

	private parseMarkdown(content: string): MarkdownParts {
		const match = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
		if (!match) {
			return { frontmatter: {}, body: content };
		}

		const frontmatter = yaml.load(match[1]) as Record<string, unknown>;
		const body = match[2];

		return { frontmatter, body };
	}
}

/**
 * Parse command line arguments
 */
function parseArgs(): { model: string; prompt: string; input: string; mode: 'api' | 'local' | 'lmstudio' | 'gemini'; temperature: number; noteList: string | undefined; thinking: boolean; thinkingBudget: number } {
	const args = process.argv.slice(2);

	let mode: 'api' | 'local' | 'lmstudio' | 'gemini' = 'api';
	if (args.includes('--gemini')) {
		mode = 'gemini';
	} else if (args.includes('--lmstudio')) {
		mode = 'lmstudio';
	} else if (args.includes('--local')) {
		mode = 'local';
	}

	// Parse thinking flag (default true, use --no-thinking to disable)
	const thinking = !args.includes('--no-thinking');

	return {
		model: getArg(args, '--model') || 'local-model',
		prompt: getArg(args, '--prompt') || 'baseline.txt',
		input: getArg(args, '--input') || '*.md',
		mode,
		temperature: parseFloat(getArg(args, '--temperature') || '0.1'),
		noteList: getArg(args, '--note-list'),
		thinking,
		thinkingBudget: parseInt(getArg(args, '--thinking-budget') || '1024', 10),
	};
}

function getArg(args: string[], flag: string): string | undefined {
	const index = args.indexOf(flag);
	return index >= 0 && index + 1 < args.length ? args[index + 1] : undefined;
}

/**
 * Main entry point
 */
async function main() {
	console.log('=== Voice Processor Test Runner ===\n');

	const args = parseArgs();
	console.log('Configuration:');
	console.log(`  Model: ${args.model}`);
	console.log(`  Prompt: ${args.prompt}`);
	console.log(`  Input: ${args.input}`);
	console.log(`  Temperature: ${args.temperature}`);
	console.log(`  Note list: ${args.noteList || '(from reference_notes directory)'}`);

	const modeDisplay = {
		'gemini': 'Gemini API (requires GEMINI_API_KEY)',
		'lmstudio': 'LM Studio (free, local)',
		'local': 'Transformers.js (free, local)',
		'api': 'Anthropic API (requires ANTHROPIC_API_KEY)'
	};
	console.log(`  Mode: ${modeDisplay[args.mode]}`);
	if (args.mode === 'gemini') {
		console.log(`  Thinking: ${args.thinking ? 'enabled' : 'disabled'}`);
		if (args.thinking) {
			console.log(`  Thinking budget: ${args.thinkingBudget}`);
		}
	}
	console.log('');

	const tester = new VoiceProcessorTester();

	console.log('Initializing test environment...');
	await tester.initialize(args.model, args.prompt, args.mode, args.temperature, args.noteList, args.thinking, args.thinkingBudget);

	console.log('\nProcessing test files...');
	const results = await tester.processBatch(args.input);

	console.log(`\n=== Summary ===`);
	console.log(`Processed: ${results.length} files`);
	console.log(`Success: ${results.filter(r => !r.error).length}`);
	console.log(`Failed: ${results.filter(r => r.error).length}`);
	console.log(`\nResults saved to: __tests__/samples/dictation_output/`);
	console.log(`\nNext: Run 'npm run analyze:voice-quality' to analyze results`);
}

// Run if called directly
if (require.main === module) {
	main().catch(error => {
		console.error('Test failed:', error);
		process.exit(1);
	});
}

export { VoiceProcessorTester };
