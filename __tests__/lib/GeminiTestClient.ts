/**
 * Gemini API client for terminal-based testing
 * Uses Google's Gemini API for LLM inference
 */

/** Gemini API base URL */
const GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1beta/models";

/**
 * Interface for Gemini API response
 */
interface GeminiResponse {
	candidates?: Array<{
		content?: {
			parts?: Array<{
				text?: string;
			}>;
		};
		finishReason?: string;
	}>;
	error?: {
		code: number;
		message: string;
		status: string;
	};
}

/**
 * Gemini API client for testing purposes
 */
export class GeminiTestClient {
	private apiKey: string;
	public model: string;
	private enableReasoning: boolean;
	private reasoningBudget: number;

	constructor(
		apiKey: string,
		model: string = "gemini-2.5-flash-lite-preview-09-2025",
		enableReasoning: boolean = true,
		reasoningBudget: number = 1024
	) {
		this.apiKey = apiKey;
		this.model = model;
		this.enableReasoning = enableReasoning;
		this.reasoningBudget = reasoningBudget;
	}

	/**
	 * Generate text from a prompt
	 */
	async generate(prompt: string, temperature: number = 0.1, verbose: boolean = true): Promise<string> {
		const url = `${GEMINI_API_URL}/${this.model}:generateContent?key=${this.apiKey.substring(0, 10)}...`;
		const urlWithKey = `${GEMINI_API_URL}/${this.model}:generateContent?key=${this.apiKey}`;

		// Build generation config
		const generationConfig: Record<string, unknown> = {
			temperature,
			maxOutputTokens: 2048,
		};

		// Add thinking config if reasoning is enabled
		if (this.enableReasoning && this.reasoningBudget > 0) {
			generationConfig.thinkingConfig = {
				thinkingBudget: this.reasoningBudget,
			};
		}

		const requestBody = {
			contents: [
				{
					parts: [
						{
							text: prompt,
						},
					],
				},
			],
			generationConfig,
		};

		// Output API request details if verbose
		if (verbose) {
			console.log('\n' + '='.repeat(60));
			console.log('GEMINI API REQUEST:');
			console.log('='.repeat(60));
			console.log(`URL: ${url}`);
			console.log(`Method: POST`);
			console.log(`Headers: { "Content-Type": "application/json" }`);
			console.log(`\nGeneration Config:`);
			console.log(JSON.stringify(generationConfig, null, 2));
			console.log('='.repeat(60) + '\n');
		}

		try {
			const response = await fetch(urlWithKey, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify(requestBody),
			});

			if (!response.ok) {
				const errorText = await response.text();
				throw new Error(`HTTP ${response.status}: ${errorText}`);
			}

			const data = (await response.json()) as GeminiResponse;

			// Check for API errors
			if (data.error) {
				throw new Error(`Gemini API error: ${data.error.message}`);
			}

			// Extract text from response
			const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "";

			return text;
		} catch (error) {
			throw new Error(
				`Gemini generation failed: ${error instanceof Error ? error.message : String(error)}`
			);
		}
	}

	/**
	 * Check if client is ready (always true for API client)
	 */
	isReady(): boolean {
		return !!this.apiKey;
	}
}
