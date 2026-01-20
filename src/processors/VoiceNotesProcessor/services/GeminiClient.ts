/**
 * Gemini API Client
 * Cloud-based LLM client using Google's Gemini API
 * Uses Obsidian's requestUrl for CORS-safe API calls
 */

import { requestUrl } from "obsidian";
import { StreamLogger } from "../../../utils/StreamLogger";

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
 * Gemini API client for cloud-based LLM inference
 * Implements the same interface as WebLLMClient for interoperability
 */
export class GeminiClient {
	private apiKey: string;
	private model: string;
	private enableReasoning: boolean;
	private reasoningBudget: number;

	/**
	 * Create a new GeminiClient
	 * @param apiKey Gemini API key from Google AI Studio
	 * @param model Gemini model identifier (e.g., "gemini-2.5-flash-lite-preview-06-25")
	 * @param enableReasoning Enable reasoning/thinking mode (default: true)
	 * @param reasoningBudget Token budget for reasoning (default: 1024, max: 24576)
	 */
	constructor(apiKey: string, model: string, enableReasoning = true, reasoningBudget = 1024) {
		this.apiKey = apiKey;
		this.model = model;
		this.enableReasoning = enableReasoning;
		this.reasoningBudget = Math.min(Math.max(reasoningBudget, 0), 24576);
		StreamLogger.log("[GeminiClient] Initialized", {
			model,
			hasApiKey: !!apiKey,
			enableReasoning: this.enableReasoning,
			reasoningBudget: this.reasoningBudget,
		});
	}

	/**
	 * Check if the client is ready for inference
	 * For cloud models, this checks if API key is configured
	 */
	isReady(): boolean {
		return !!this.apiKey && this.apiKey.trim().length > 0;
	}

	/**
	 * Get the current model identifier
	 */
	getCurrentModel(): string {
		return this.model;
	}

	/**
	 * Generate text completion using the Gemini API
	 *
	 * @param prompt The prompt to send to the model
	 * @param temperature Temperature for sampling (0.0-2.0 for Gemini)
	 * @returns Generated text response
	 */
	async generate(prompt: string, temperature = 0.1): Promise<string> {
		if (!this.isReady()) {
			throw new Error("Gemini API key not configured. Please add your API key in settings.");
		}

		const url = `${GEMINI_API_URL}/${this.model}:generateContent?key=${this.apiKey}`;

		StreamLogger.log("[GeminiClient.generate] Starting generation", {
			model: this.model,
			promptLength: prompt.length,
			temperature,
			thinkingEnabled: this.enableReasoning && this.reasoningBudget > 0,
			thinkingBudget: this.enableReasoning && this.reasoningBudget > 0 ? this.reasoningBudget : 0,
		});

		try {
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

			// Log the exact generationConfig being sent to Google
			StreamLogger.log("[GeminiClient.generate] Sending request to Google API", {
				url: `${GEMINI_API_URL}/${this.model}:generateContent`,
				generationConfig: JSON.stringify(generationConfig, null, 2),
			});

			const response = await requestUrl({
				url,
				method: "POST",
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify({
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
				}),
			});

			const data = response.json as GeminiResponse;

			// Check for API errors
			if (data.error) {
				StreamLogger.error("[GeminiClient.generate] API error", {
					code: data.error.code,
					message: data.error.message,
					status: data.error.status,
				});
				throw new Error(`Gemini API error: ${data.error.message}`);
			}

			// Extract text from response
			const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "";

			StreamLogger.log("[GeminiClient.generate] Generation complete", {
				responseLength: text.length,
				finishReason: data.candidates?.[0]?.finishReason,
			});

			return text;
		} catch (error) {
			const err = error as Error;
			StreamLogger.error("[GeminiClient.generate] Generation failed", error);

			// Provide helpful error messages for common issues
			if (err.message.includes("401") || err.message.includes("UNAUTHENTICATED")) {
				throw new Error("Invalid Gemini API key. Please check your API key in settings.");
			}
			if (err.message.includes("403") || err.message.includes("PERMISSION_DENIED")) {
				throw new Error("Gemini API access denied. Please ensure your API key has the correct permissions.");
			}
			if (err.message.includes("429") || err.message.includes("RESOURCE_EXHAUSTED")) {
				throw new Error("Gemini API rate limit exceeded. Please wait a moment and try again.");
			}
			if (err.message.includes("404")) {
				throw new Error(`Gemini model "${this.model}" not found. The model may not be available yet.`);
			}

			throw error;
		}
	}
}
