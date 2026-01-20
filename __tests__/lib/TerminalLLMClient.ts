/**
 * Terminal-compatible LLM client for testing
 * Uses Anthropic API instead of WebLLM (which requires browser environment)
 */

import Anthropic from '@anthropic-ai/sdk';

/**
 * Model mapping from WebLLM model names to Claude models
 */
const MODEL_MAPPING: Record<string, string> = {
	'phi-3-mini': 'claude-3-5-haiku-20241022',
	'Phi-3-mini-4k-instruct-q4f16_1-MLC': 'claude-3-5-haiku-20241022',
	'llama-3.2': 'claude-3-5-haiku-20241022',
	'Llama-3.2-1B-Instruct-q4f16_1-MLC': 'claude-3-5-haiku-20241022',
	'gemma-2': 'claude-3-5-sonnet-20241022',
	'mistral-small': 'claude-3-7-sonnet-20250219',
	'Mistral-Small-3.1-Instruct-q4f16_1-MLC': 'claude-3-7-sonnet-20250219',
};

/**
 * Terminal-compatible LLM client for testing purposes
 */
export class TerminalLLMClient {
	private client: Anthropic;
	public model: string;

	constructor(apiKey: string, model: string = 'claude-3-5-haiku-20241022') {
		this.client = new Anthropic({ apiKey });
		// Map WebLLM model names to Claude models
		this.model = MODEL_MAPPING[model] || model;
	}

	/**
	 * Generate text from a prompt
	 */
	async generate(prompt: string, temperature: number = 0.1): Promise<string> {
		try {
			const response = await this.client.messages.create({
				model: this.model,
				max_tokens: 2048,
				temperature: temperature,
				messages: [{
					role: 'user',
					content: prompt
				}]
			});

			// Extract text from response
			const textBlock = response.content.find(block => block.type === 'text');
			if (!textBlock || textBlock.type !== 'text') {
				throw new Error('No text content in response');
			}

			return textBlock.text;
		} catch (error) {
			throw new Error(`LLM generation failed: ${error instanceof Error ? error.message : String(error)}`);
		}
	}

	/**
	 * Check if client is ready (always true for API client)
	 */
	isReady(): boolean {
		return true;
	}
}
