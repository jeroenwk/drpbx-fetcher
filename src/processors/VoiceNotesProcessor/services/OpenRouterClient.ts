/**
 * OpenRouter API Client
 * Cloud-based LLM client using OpenRouter's API for models like Amazon Nova Lite
 * Uses Obsidian's requestUrl for CORS-safe API calls
 */

import { requestUrl } from "obsidian";
import { StreamLogger } from "../../../utils/StreamLogger";

/** OpenRouter API base URL */
const OPENROUTER_API_URL = "https://openrouter.ai/api/v1/chat/completions";

/**
 * Interface for OpenRouter API response (OpenAI-compatible format)
 */
interface OpenRouterResponse {
	id?: string;
	choices?: Array<{
		message?: {
			role?: string;
			content?: string;
		};
		finish_reason?: string;
		index?: number;
	}>;
	error?: {
		message: string;
		code?: string;
		type?: string;
	};
	usage?: {
		prompt_tokens?: number;
		completion_tokens?: number;
		total_tokens?: number;
	};
}

/**
 * OpenRouter API client for cloud-based LLM inference
 * Implements the same interface as WebLLMClient and GeminiClient for interoperability
 */
export class OpenRouterClient {
	private apiKey: string;
	private model: string;

	/**
	 * Create a new OpenRouterClient
	 * @param apiKey OpenRouter API key from openrouter.ai
	 * @param model OpenRouter model identifier (e.g., "amazon/nova-lite-v1")
	 */
	constructor(apiKey: string, model: string) {
		this.apiKey = apiKey;
		this.model = model;
		StreamLogger.log("[OpenRouterClient] Initialized", { model, hasApiKey: !!apiKey });
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
	 * Generate text completion using the OpenRouter API
	 *
	 * @param prompt The prompt to send to the model
	 * @param temperature Temperature for sampling (0.0-1.0)
	 * @returns Generated text response
	 */
	async generate(prompt: string, temperature = 0.1): Promise<string> {
		if (!this.isReady()) {
			throw new Error("OpenRouter API key not configured. Please add your API key in settings.");
		}

		StreamLogger.log("[OpenRouterClient.generate] Starting generation", {
			model: this.model,
			promptLength: prompt.length,
			temperature,
		});

		try {
			const response = await requestUrl({
				url: OPENROUTER_API_URL,
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					"Authorization": `Bearer ${this.apiKey}`,
					"HTTP-Referer": "https://obsidian.md",
					"X-Title": "Obsidian Drpbx Fetcher",
				},
				body: JSON.stringify({
					model: this.model,
					messages: [
						{
							role: "user",
							content: prompt,
						},
					],
					temperature,
					max_tokens: 2048,
				}),
			});

			const data = response.json as OpenRouterResponse;

			// Check for API errors
			if (data.error) {
				StreamLogger.error("[OpenRouterClient.generate] API error", {
					message: data.error.message,
					code: data.error.code,
					type: data.error.type,
				});
				throw new Error(`OpenRouter API error: ${data.error.message}`);
			}

			// Extract text from response
			const text = data.choices?.[0]?.message?.content || "";

			StreamLogger.log("[OpenRouterClient.generate] Generation complete", {
				responseLength: text.length,
				finishReason: data.choices?.[0]?.finish_reason,
				usage: data.usage,
			});

			return text;
		} catch (error) {
			const err = error as Error;
			StreamLogger.error("[OpenRouterClient.generate] Generation failed", error);

			// Provide helpful error messages for common issues
			if (err.message.includes("401") || err.message.includes("Unauthorized")) {
				throw new Error("Invalid OpenRouter API key. Please check your API key in settings.");
			}
			if (err.message.includes("402") || err.message.includes("Payment Required")) {
				throw new Error("OpenRouter credits exhausted. Please add credits at openrouter.ai.");
			}
			if (err.message.includes("403") || err.message.includes("Forbidden")) {
				throw new Error("OpenRouter API access denied. Please ensure your API key has the correct permissions.");
			}
			if (err.message.includes("429") || err.message.includes("Too Many Requests")) {
				throw new Error("OpenRouter API rate limit exceeded. Please wait a moment and try again.");
			}
			if (err.message.includes("404")) {
				throw new Error(`OpenRouter model "${this.model}" not found. Please check the model ID.`);
			}

			throw error;
		}
	}
}
