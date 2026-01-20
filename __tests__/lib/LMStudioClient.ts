/**
 * LM Studio Client
 * Connects to LM Studio's local OpenAI-compatible API server
 */

interface ChatMessage {
	role: string;
	content: string;
}

interface ChatCompletionRequest {
	model: string;
	messages: ChatMessage[];
	temperature: number;
	max_tokens: number;
}

interface ChatCompletionResponse {
	choices: Array<{
		message: {
			content: string;
		};
	}>;
}

/**
 * Client for LM Studio local API
 */
export class LMStudioClient {
	public model: string;
	private baseUrl: string;

	constructor(model: string = 'local-model', baseUrl: string = 'http://localhost:1234/v1') {
		this.model = model;
		this.baseUrl = baseUrl;
	}

	/**
	 * Generate text from a prompt
	 */
	async generate(prompt: string, temperature: number = 0.1): Promise<string> {
		try {
			const response = await fetch(`${this.baseUrl}/chat/completions`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
				},
				body: JSON.stringify({
					model: this.model,
					messages: [
						{
							role: 'user',
							content: prompt
						}
					],
					temperature: temperature,
					max_tokens: 2048,
				} as ChatCompletionRequest)
			});

			if (!response.ok) {
				const errorText = await response.text();
				throw new Error(
					`LM Studio API error: ${response.status} ${response.statusText}\n` +
					`Response: ${errorText}\n` +
					`Note: Make sure a model is loaded in LM Studio`
				);
			}

			const data = await response.json() as ChatCompletionResponse;

			if (!data.choices || data.choices.length === 0) {
				throw new Error('No response from LM Studio');
			}

			return data.choices[0].message.content;
		} catch (error) {
			if (error instanceof Error && error.message.includes('fetch failed')) {
				throw new Error(
					'Could not connect to LM Studio. Make sure:\n' +
					'  1. LM Studio is running\n' +
					'  2. A model is loaded\n' +
					'  3. Local server is started (on port 1234)\n' +
					`  Original error: ${error.message}`
				);
			}
			throw error;
		}
	}

	/**
	 * Check if client is ready
	 */
	isReady(): boolean {
		return true; // LM Studio handles initialization
	}

	/**
	 * Test connection to LM Studio
	 */
	async testConnection(): Promise<boolean> {
		try {
			const response = await fetch(`${this.baseUrl}/models`);
			return response.ok;
		} catch {
			return false;
		}
	}
}
