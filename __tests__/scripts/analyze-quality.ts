#!/usr/bin/env ts-node
/**
 * Quality Analysis Script
 * Analyzes test outputs and generates quality reports
 */

import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';

interface AnalysisResult {
	testCase: string;
	model: string;
	prompt: string;
	difficulty: string;
	metrics: {
		precision: number;
		recall: number;
		f1Score: number;
		yamlPreserved: boolean;
		contentPreserved: boolean;
		formattingPreserved: boolean;
		linkRequestsRemoved: number;
		totalScore: number;
	};
	expectedLinks: string[];
	actualLinks: string[];
	errors: string[];
}

interface LinkMetrics {
	precision: number;
	recall: number;
	f1: number;
}

interface PreservationMetrics {
	yamlPreserved: boolean;
	contentPreserved: boolean;
	formattingPreserved: boolean;
}

interface PromptAnalysis {
	prompt: string;
	totalScore: number;
	averageF1: number;
	testCount: number;
	failures: string[];
}

interface ModelAnalysis {
	model: string;
	totalScore: number;
	averageF1: number;
	testCount: number;
	averageTime: number;
}

interface QualityReport {
	summary: {
		totalFiles: number;
		averageScore: number;
		bestPrompt: string;
		bestModel: string;
	};
	byPrompt: Record<string, PromptAnalysis>;
	byModel: Record<string, ModelAnalysis>;
	detailedResults: AnalysisResult[];
	recommendations: string[];
}

interface MarkdownParts {
	frontmatter: Record<string, unknown>;
	body: string;
}

/**
 * Quality analyzer for voice processor test results
 */
class QualityAnalyzer {
	async analyzeOutputs(outputDir: string): Promise<QualityReport> {
		const outputFiles = fs.readdirSync(outputDir)
			.filter(f => f.endsWith('.md'))
			.map(f => path.join(outputDir, f));

		console.log(`Analyzing ${outputFiles.length} output files...`);

		const results: AnalysisResult[] = [];

		for (const outputFile of outputFiles) {
			const inputFile = outputFile.replace('/dictation_output/', '/dictation_input/');
			if (!fs.existsSync(inputFile)) {
				console.warn(`Input file not found: ${inputFile}`);
				continue;
			}

			const result = await this.analyzeFile(inputFile, outputFile);
			results.push(result);
		}

		return this.generateReport(results);
	}

	private async analyzeFile(inputPath: string, outputPath: string): Promise<AnalysisResult> {
		const input = fs.readFileSync(inputPath, 'utf-8');
		const output = fs.readFileSync(outputPath, 'utf-8');

		const { frontmatter: inputMeta, body: inputBody } = this.parseMarkdown(input);
		const { frontmatter: outputMeta, body: outputBody } = this.parseMarkdown(output);

		// Parse the processed content from the output body
		const { body: processedBody } = this.parseMarkdown(outputBody);

		// Calculate metrics
		const linkMetrics = this.compareLinks(
			(inputMeta.expectedLinks as string[]) || [],
			(outputMeta.actualLinks as string[]) || []
		);

		const preservation = this.checkPreservation(input, output);
		const cleanup = this.checkLinkRequestRemoval(inputBody, processedBody);

		const totalScore = this.calculateTotalScore({
			...linkMetrics,
			...preservation,
			cleanup
		});

		return {
			testCase: (inputMeta.testCase as string) || path.basename(inputPath, '.md'),
			model: (outputMeta.model as string) || 'unknown',
			prompt: (outputMeta.prompt as string) || 'unknown',
			difficulty: (inputMeta.difficulty as string) || 'medium',
			metrics: {
				precision: linkMetrics.precision,
				recall: linkMetrics.recall,
				f1Score: linkMetrics.f1,
				yamlPreserved: preservation.yamlPreserved,
				contentPreserved: preservation.contentPreserved,
				formattingPreserved: preservation.formattingPreserved,
				linkRequestsRemoved: cleanup,
				totalScore
			},
			expectedLinks: (inputMeta.expectedLinks as string[]) || [],
			actualLinks: (outputMeta.actualLinks as string[]) || [],
			errors: outputMeta.error ? [(outputMeta.error as string)] : []
		};
	}

	private compareLinks(expected: string[], actual: string[]): LinkMetrics {
		const expectedSet = new Set(expected);
		const actualSet = new Set(actual);

		const correctLinks = Array.from(actualSet).filter(link => expectedSet.has(link));

		const precision = actual.length > 0 ? correctLinks.length / actual.length : 1.0;
		const recall = expected.length > 0 ? correctLinks.length / expected.length : 1.0;
		const f1 = precision + recall > 0 ? 2 * (precision * recall) / (precision + recall) : 0;

		return { precision, recall, f1 };
	}

	private checkPreservation(input: string, output: string): PreservationMetrics {
		const inputParts = this.parseMarkdown(input);
		const outputParts = this.parseMarkdown(output);

		// Parse the output body again to get the embedded YAML + content
		const processedParts = this.parseMarkdown(outputParts.body);

		// Debug: log tags comparison
		if (process.env.DEBUG) {
			console.log('\n=== Debug ===');
			console.log('Output body starts with:', outputParts.body.substring(0, 100));
			console.log('Processed frontmatter:', processedParts.frontmatter);
			console.log('Input tags:', JSON.stringify(inputParts.frontmatter.tags));
			console.log('Processed tags:', JSON.stringify(processedParts.frontmatter.tags));
		}

		// YAML preserved (compare tags only, since output adds metadata)
		const yamlPreserved = JSON.stringify(inputParts.frontmatter.tags) ===
			JSON.stringify(processedParts.frontmatter.tags);

		// Content preserved (no additions/deletions, only link insertions)
		const inputWords = this.extractWords(inputParts.body);
		const outputWords = this.extractWords(processedParts.body);
		const contentPreserved = this.areWordsPreserved(inputWords, outputWords);

		// Formatting preserved (line breaks, lists, etc.)
		const formattingPreserved = this.checkFormatting(inputParts.body, processedParts.body);

		return { yamlPreserved, contentPreserved, formattingPreserved };
	}

	private extractWords(text: string): string[] {
		// Remove link syntax but keep the link text
		const withoutLinks = text.replace(/\[\[([^\]]+)\]\]/g, '$1');
		// Split into words and filter out empty strings
		return withoutLinks.split(/\s+/).filter(w => w.length > 0);
	}

	private areWordsPreserved(inputWords: string[], outputWords: string[]): boolean {
		// Filter out common link request phrases
		const linkPhrases = ['link', 'to', 'see', 'my', 'note', 'on', 'refer', 'also'];

		const inputFiltered = inputWords.map(w => w.toLowerCase())
			.filter(w => !linkPhrases.includes(w) || inputWords.filter(iw => iw.toLowerCase() === w).length > 1);

		// Check if all non-request words are preserved
		const missingWords = inputFiltered.filter(word => {
			const count = inputFiltered.filter(w => w === word).length;
			const outputCount = outputWords.filter(w => w.toLowerCase() === word).length;
			return outputCount < count;
		});

		return missingWords.length === 0;
	}

	private checkFormatting(inputBody: string, outputBody: string): boolean {
		// Count line breaks
		const inputLines = inputBody.split('\n').length;
		const outputLines = outputBody.split('\n').length;

		// Allow small variance (±3 lines for link additions/removals)
		if (Math.abs(inputLines - outputLines) > 3) {
			return false;
		}

		// Check for preserved formatting markers
		const formatMarkers = ['**', '*', '-', '```', '1.', '2.'];
		for (const marker of formatMarkers) {
			const inputCount = (inputBody.match(new RegExp('\\' + marker, 'g')) || []).length;
			const outputCount = (outputBody.match(new RegExp('\\' + marker, 'g')) || []).length;
			if (inputCount !== outputCount) {
				return false;
			}
		}

		return true;
	}

	private checkLinkRequestRemoval(inputBody: string, outputBody: string): number {
		const linkRequestPatterns = [
			/link to \w+\.?/gi,
			/see (?:my )?note (?:on|about) \w+\.?/gi,
			/refer to \w+\.?/gi,
		];

		let requestsInInput = 0;
		let requestsInOutput = 0;

		for (const pattern of linkRequestPatterns) {
			requestsInInput += (inputBody.match(pattern) || []).length;
			requestsInOutput += (outputBody.match(pattern) || []).length;
		}

		if (requestsInInput === 0) return 1.0; // No requests to remove
		return 1.0 - (requestsInOutput / requestsInInput);
	}

	private calculateTotalScore(metrics: {
		f1: number;
		yamlPreserved: boolean;
		contentPreserved: boolean;
		formattingPreserved: boolean;
		cleanup: number;
	}): number {
		// Weighted scoring (out of 80 points total)
		const f1Weight = 40;
		const preservationWeight = 30; // 10 each for YAML, content, formatting
		const cleanupWeight = 10;

		const score =
			(metrics.f1 * f1Weight) +
			((metrics.yamlPreserved ? 10 : 0) +
				(metrics.contentPreserved ? 10 : 0) +
				(metrics.formattingPreserved ? 10 : 0)) +
			(metrics.cleanup * cleanupWeight);

		return Math.round(score * 100) / 100;
	}

	private generateReport(results: AnalysisResult[]): QualityReport {
		// Group by prompt
		const byPrompt: Record<string, PromptAnalysis> = {};
		const byModel: Record<string, ModelAnalysis> = {};

		for (const result of results) {
			// By prompt
			if (!byPrompt[result.prompt]) {
				byPrompt[result.prompt] = {
					prompt: result.prompt,
					totalScore: 0,
					averageF1: 0,
					testCount: 0,
					failures: []
				};
			}
			byPrompt[result.prompt].totalScore += result.metrics.totalScore;
			byPrompt[result.prompt].averageF1 += result.metrics.f1Score;
			byPrompt[result.prompt].testCount++;

			if (result.metrics.totalScore < 50) {
				byPrompt[result.prompt].failures.push(result.testCase);
			}

			// By model
			if (!byModel[result.model]) {
				byModel[result.model] = {
					model: result.model,
					totalScore: 0,
					averageF1: 0,
					testCount: 0,
					averageTime: 0
				};
			}
			byModel[result.model].totalScore += result.metrics.totalScore;
			byModel[result.model].averageF1 += result.metrics.f1Score;
			byModel[result.model].testCount++;
		}

		// Calculate averages
		for (const prompt in byPrompt) {
			byPrompt[prompt].totalScore /= byPrompt[prompt].testCount;
			byPrompt[prompt].averageF1 /= byPrompt[prompt].testCount;
		}

		for (const model in byModel) {
			byModel[model].totalScore /= byModel[model].testCount;
			byModel[model].averageF1 /= byModel[model].testCount;
		}

		// Find best
		const promptEntries = Object.entries(byPrompt);
		const modelEntries = Object.entries(byModel);

		const bestPrompt = promptEntries.length > 0
			? promptEntries.reduce((a, b) => a[1].totalScore > b[1].totalScore ? a : b)[0]
			: 'none';

		const bestModel = modelEntries.length > 0
			? modelEntries.reduce((a, b) => a[1].totalScore > b[1].totalScore ? a : b)[0]
			: 'none';

		const averageScore = results.length > 0
			? results.reduce((sum, r) => sum + r.metrics.totalScore, 0) / results.length
			: 0;

		return {
			summary: {
				totalFiles: results.length,
				averageScore,
				bestPrompt,
				bestModel
			},
			byPrompt,
			byModel,
			detailedResults: results,
			recommendations: this.generateRecommendations(results, byPrompt)
		};
	}

	private generateRecommendations(results: AnalysisResult[], byPrompt: Record<string, PromptAnalysis>): string[] {
		const recommendations: string[] = [];

		// Low recall patterns
		const lowRecallCases = results.filter(r => r.metrics.recall < 0.5);
		if (lowRecallCases.length > 0) {
			recommendations.push(
				`Low recall detected in ${lowRecallCases.length} cases (${lowRecallCases.map(r => r.testCase).join(', ')}). ` +
				`Consider: (1) Adding more explicit examples, (2) Emphasizing natural language detection`
			);
		}

		// Low precision patterns
		const lowPrecisionCases = results.filter(r => r.metrics.precision < 0.5);
		if (lowPrecisionCases.length > 0) {
			recommendations.push(
				`Low precision detected in ${lowPrecisionCases.length} cases (${lowPrecisionCases.map(r => r.testCase).join(', ')}). ` +
				`Consider: (1) Stricter matching rules, (2) Better context understanding`
			);
		}

		// YAML not preserved
		const yamlIssues = results.filter(r => !r.metrics.yamlPreserved);
		if (yamlIssues.length > 0) {
			recommendations.push(
				`YAML frontmatter modified in ${yamlIssues.length} cases. ` +
				`Emphasize: "NEVER modify YAML block"`
			);
		}

		// Content not preserved
		const contentIssues = results.filter(r => !r.metrics.contentPreserved);
		if (contentIssues.length > 0) {
			recommendations.push(
				`Content modified in ${contentIssues.length} cases. ` +
				`Emphasize: "NEVER delete, summarize, or change any information"`
			);
		}

		// Best prompt
		const sortedPrompts = Object.entries(byPrompt).sort((a, b) => b[1].totalScore - a[1].totalScore);
		if (sortedPrompts.length > 1) {
			const best = sortedPrompts[0];
			const worst = sortedPrompts[sortedPrompts.length - 1];
			recommendations.push(
				`Best performing prompt: ${best[0]} (score: ${best[1].totalScore.toFixed(1)}). ` +
				`Worst: ${worst[0]} (score: ${worst[1].totalScore.toFixed(1)})`
			);
		}

		return recommendations;
	}

	private parseMarkdown(content: string): MarkdownParts {
		// Trim leading whitespace before matching
		const trimmed = content.trimStart();
		const match = trimmed.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
		if (!match) {
			return { frontmatter: {}, body: content };
		}

		const frontmatter = yaml.load(match[1]) as Record<string, unknown>;
		const body = match[2];

		return { frontmatter, body };
	}
}

/**
 * Generate markdown report
 */
function generateMarkdownReport(report: QualityReport): string {
	let md = '# Voice Notes Quality Analysis\n\n';

	md += `## Summary\n\n`;
	md += `- **Total Test Cases**: ${report.summary.totalFiles}\n`;
	md += `- **Average Score**: ${report.summary.averageScore.toFixed(1)}/80\n`;
	md += `- **Best Prompt**: ${report.summary.bestPrompt}\n`;
	md += `- **Best Model**: ${report.summary.bestModel}\n\n`;

	md += `## Recommendations\n\n`;
	if (report.recommendations.length > 0) {
		for (const rec of report.recommendations) {
			md += `- ${rec}\n`;
		}
	} else {
		md += `No recommendations - all tests passed!\n`;
	}
	md += '\n';

	md += `## By Prompt\n\n`;
	for (const [prompt, analysis] of Object.entries(report.byPrompt)) {
		md += `### ${prompt}\n\n`;
		md += `- **Average Score**: ${analysis.totalScore.toFixed(1)}/80\n`;
		md += `- **Average F1**: ${(analysis.averageF1 * 100).toFixed(1)}%\n`;
		md += `- **Test Count**: ${analysis.testCount}\n`;
		if (analysis.failures.length > 0) {
			md += `- **Failures**: ${analysis.failures.join(', ')}\n`;
		}
		md += '\n';
	}

	md += `## Detailed Results\n\n`;
	md += '| Test Case | Model | Prompt | F1 Score | Total Score | Issues |\n';
	md += '|-----------|-------|--------|----------|-------------|---------|\n';

	for (const result of report.detailedResults) {
		const issues: string[] = [];
		if (!result.metrics.yamlPreserved) issues.push('YAML');
		if (!result.metrics.contentPreserved) issues.push('Content');
		if (!result.metrics.formattingPreserved) issues.push('Format');
		if (result.metrics.linkRequestsRemoved < 0.8) issues.push('Cleanup');

		md += `| ${result.testCase} | ${result.model} | ${result.prompt} | `;
		md += `${(result.metrics.f1Score * 100).toFixed(0)}% | `;
		md += `${result.metrics.totalScore.toFixed(1)} | `;
		md += `${issues.join(', ') || '✓'} |\n`;
	}

	return md;
}

/**
 * Main entry point
 */
async function main() {
	console.log('=== Voice Processor Quality Analysis ===\n');

	const outputDir = path.join(__dirname, '../samples/dictation_output');

	if (!fs.existsSync(outputDir)) {
		console.error(`Output directory not found: ${outputDir}`);
		console.error('Run test-voice-processor.ts first to generate test outputs');
		process.exit(1);
	}

	const analyzer = new QualityAnalyzer();
	const report = await analyzer.analyzeOutputs(outputDir);

	// Save JSON report
	const jsonPath = path.join(__dirname, '../quality-report.json');
	fs.writeFileSync(jsonPath, JSON.stringify(report, null, 2));

	// Generate markdown summary
	const markdown = generateMarkdownReport(report);
	const mdPath = path.join(__dirname, '../quality-summary.md');
	fs.writeFileSync(mdPath, markdown);

	console.log(`\n=== Analysis Complete ===`);
	console.log(`JSON: ${jsonPath}`);
	console.log(`Summary: ${mdPath}`);
	console.log(`\n=== Results ===`);
	console.log(`Average Score: ${report.summary.averageScore.toFixed(1)}/80`);
	console.log(`Best Prompt: ${report.summary.bestPrompt}`);
	console.log(`Best Model: ${report.summary.bestModel}`);

	if (report.recommendations.length > 0) {
		console.log(`\n=== Recommendations ===`);
		for (const rec of report.recommendations) {
			console.log(`• ${rec}`);
		}
	}
}

// Run if called directly
if (require.main === module) {
	main().catch(error => {
		console.error('Analysis failed:', error);
		process.exit(1);
	});
}

export { QualityAnalyzer };
