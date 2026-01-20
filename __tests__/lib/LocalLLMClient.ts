/**
 * Local LLM client using Transformers.js
 * Runs models locally without API calls
 */

import { pipeline, env } from '@xenova/transformers';

// Configure transformers.js
env.allowLocalModels = false;
env.useBrowserCache = false;

/**
 * Local LLM client for running models like Phi-3 mini locally
 */
export class LocalLLMClient {
	public model: string;
	private generator: any = null;
	private ready: boolean = false;

	constructor(model: string = 'Xenova/Phi-3-mini-4k-instruct') {
		this.model = model;
	}

	/**
	 * Initialize the model (downloads on first use, caches locally)
	 */
	async initialize(): Promise<void> {
		if (this.ready) return;

		console.log(`Initializing local model: ${this.model}...`);
		console.log('This may take a few minutes on first run (downloading model)...');

		try {
			// Create text generation pipeline
			this.generator = await pipeline('text-generation', this.model);
			this.ready = true;
			console.log(`✓ Model ${this.model} ready`);
		} catch (error) {
			throw new Error(`Failed to initialize model: ${error instanceof Error ? error.message : String(error)}`);
		}
	}

	/**
	 * Generate text from a prompt
	 */
	async generate(prompt: string, temperature: number = 0.1): Promise<string> {
		if (!this.ready) {
			await this.initialize();
		}

		try {
			const output = await this.generator(prompt, {
				max_new_tokens: 1024,
				temperature: temperature,
				do_sample: temperature > 0,
				top_p: 0.9,
				repetition_penalty: 1.1,
			});

			// Extract generated text
			if (Array.isArray(output) && output.length > 0) {
				const generated = output[0].generated_text;
				// Remove the prompt from the response
				return generated.substring(prompt.length).trim();
			}

			return '';
		} catch (error) {
			throw new Error(`LLM generation failed: ${error instanceof Error ? error.message : String(error)}`);
		}
	}

	/**
	 * Check if client is ready
	 */
	isReady(): boolean {
		return this.ready;
	}
}

/**
 * Available local models (no API key needed)
 */
export const LOCAL_MODELS = {
	'phi-3-mini': 'Xenova/Phi-3-mini-4k-instruct',
	'phi-2': 'Xenova/phi-2',
	'gemma-2b': 'Xenova/gemma-2b-it',
	'tiny-llama': 'Xenova/TinyLlama-1.1B-Chat-v1.0',
};
