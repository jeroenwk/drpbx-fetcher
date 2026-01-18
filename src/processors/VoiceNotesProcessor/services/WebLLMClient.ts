/**
 * WebLLM Client
 * Wrapper around WebLLM for local in-browser LLM inference
 * Loads WebLLM dynamically from CDN to avoid bundling issues
 */

import { StreamLogger } from "../../../utils/StreamLogger";

/**
 * WebGPU type declarations for navigator.gpu
 * These are needed because TypeScript's DOM lib doesn't include WebGPU by default
 */
interface WebGPUNavigator extends Navigator {
	gpu?: {
		requestAdapter(): Promise<GPUAdapter | null>;
	};
}

interface GPUAdapter {
	readonly name: string;
}

/**
 * Progress callback for model initialization
 */
export type ModelProgressCallback = (progress: number, status: string) => void;

/**
 * WebLLM types (minimal interface for what we use)
 * These match the actual WebLLM API but allow us to work without bundling the types
 */
interface WebLLMModule {
	MLCEngine: new () => MLCEngineInstance;
}

interface MLCEngineInstance {
	setInitProgressCallback(callback: (progress: { progress: number; text?: string }) => void): void;
	reload(model: string): Promise<void>;
	chat: {
		completions: {
			create(options: {
				messages: Array<{ role: string; content: string }>;
				temperature?: number;
				max_tokens?: number;
			}): Promise<{
				choices: Array<{
					message: { content: string };
					finish_reason?: string;
				}>;
			}>;
		};
	};
	unload(): Promise<void>;
}

/** CDN URL for WebLLM */
const WEBLLM_CDN_URL = "https://esm.run/@mlc-ai/web-llm";

/** Cached WebLLM module */
let webllmModule: WebLLMModule | null = null;

/**
 * Dynamically load WebLLM from CDN
 * This avoids bundling issues with esbuild and Node.js APIs
 */
async function loadWebLLMFromCDN(): Promise<WebLLMModule> {
	if (webllmModule) {
		return webllmModule;
	}

	StreamLogger.log("[WebLLMClient] Loading WebLLM from CDN...", { url: WEBLLM_CDN_URL });

	try {
		// Use dynamic import from CDN URL
		// This works because Obsidian runs in a browser context
		const module = await import(/* webpackIgnore: true */ WEBLLM_CDN_URL);

		webllmModule = module as WebLLMModule;
		StreamLogger.log("[WebLLMClient] WebLLM loaded successfully from CDN");

		return webllmModule;
	} catch (error) {
		StreamLogger.error("[WebLLMClient] Failed to load WebLLM from CDN", error);
		throw new Error(
			`Failed to load WebLLM library from CDN. ` +
			`Please check your internet connection. Error: ${(error as Error).message}`
		);
	}
}

/**
 * WebLLM client for local LLM inference
 * Uses WebGPU for hardware acceleration
 */
export class WebLLMClient {
	private engine: MLCEngineInstance | null = null;
	private currentModel: string | null = null;
	private isInitializing = false;
	private cachedModels: Set<string> = new Set();

	/** IndexedDB database name for WebLLM cache */
	private static readonly INDEXED_DB_NAME = "web-llm-model-cache";

	/**
	 * Check if WebGPU is available in the current environment
	 */
	static async isWebGPUAvailable(): Promise<boolean> {
		try {
			const webGPUNavigator = navigator as WebGPUNavigator;
			if (typeof navigator === "undefined" || !webGPUNavigator.gpu) {
				StreamLogger.log("[WebLLMClient] WebGPU not available: navigator.gpu is undefined");
				return false;
			}
			const adapter = await webGPUNavigator.gpu.requestAdapter();
			const available = adapter !== null;
			StreamLogger.log("[WebLLMClient] WebGPU availability check", { available });
			return available;
		} catch (error) {
			StreamLogger.error("[WebLLMClient] WebGPU check failed", error);
			return false;
		}
	}

	/**
	 * Initialize the WebLLM engine with the specified model
	 * Model will be downloaded and cached in IndexedDB on first use
	 *
	 * @param model Model identifier (e.g., "Phi-3-mini-4k-instruct-q4f16_1-MLC")
	 * @param onProgress Progress callback for download status
	 */
	async initialize(model: string, onProgress?: ModelProgressCallback): Promise<void> {
		StreamLogger.log("[WebLLMClient.initialize] Starting initialization", { model });

		if (this.isInitializing) {
			StreamLogger.warn("[WebLLMClient.initialize] Already initializing, waiting...");
			// Wait for existing initialization to complete
			while (this.isInitializing) {
				await new Promise((resolve) => setTimeout(resolve, 100));
			}
			if (this.engine && this.currentModel === model) {
				StreamLogger.log("[WebLLMClient.initialize] Engine already initialized with same model");
				return;
			}
		}

		// If already initialized with same model, skip
		if (this.engine && this.currentModel === model) {
			StreamLogger.log("[WebLLMClient.initialize] Engine already initialized with same model");
			return;
		}

		// Check WebGPU availability first
		const webGPUAvailable = await WebLLMClient.isWebGPUAvailable();
		if (!webGPUAvailable) {
			throw new Error(
				"WebGPU is not available in this browser. " +
				"Voice Notes processing requires a browser with WebGPU support " +
				"(Chrome 121+, Edge 121+, Safari 26+)."
			);
		}

		this.isInitializing = true;

		try {
			// Load WebLLM from CDN
			StreamLogger.log("[WebLLMClient.initialize] Loading WebLLM from CDN...");
			if (onProgress) {
				onProgress(0, "Loading WebLLM library...");
			}

			const webllm = await loadWebLLMFromCDN();

			// If switching models, unload the old one first
			if (this.engine && this.currentModel !== model) {
				StreamLogger.log("[WebLLMClient.initialize] Unloading previous model", {
					previousModel: this.currentModel
				});
				await this.unload();
			}

			// Create the engine
			StreamLogger.log("[WebLLMClient.initialize] Creating MLCEngine...");
			this.engine = new webllm.MLCEngine();

			// Set up progress callback
			this.engine.setInitProgressCallback((progress) => {
				const progressPercent = progress.progress * 100;
				const status = progress.text || "Loading model...";

				StreamLogger.log("[WebLLMClient.initialize] Progress update", {
					progress: progressPercent.toFixed(1),
					status,
				});

				if (onProgress) {
					onProgress(progress.progress, status);
				}
			});

			// Load the model
			StreamLogger.log("[WebLLMClient.initialize] Loading model...", { model });
			await this.engine.reload(model);

			this.currentModel = model;
			StreamLogger.log("[WebLLMClient.initialize] Engine initialized successfully", { model });
		} catch (error) {
			StreamLogger.error("[WebLLMClient.initialize] Failed to initialize engine", error);
			this.engine = null;
			this.currentModel = null;
			throw error;
		} finally {
			this.isInitializing = false;
		}
	}

	/**
	 * Check if the engine is ready for inference
	 */
	isReady(): boolean {
		return this.engine !== null && !this.isInitializing;
	}

	/**
	 * Get the currently loaded model
	 */
	getCurrentModel(): string | null {
		return this.currentModel;
	}

	/**
	 * Get list of cached models from IndexedDB
	 * Returns a list of model IDs that have been downloaded
	 * Static method - can be called without instantiating the client
	 */
	static async getCachedModels(): Promise<string[]> {
		StreamLogger.log("[WebLLMClient.getCachedModels] Checking IndexedDB for cached models");

		return new Promise((resolve) => {
			const request = indexedDB.open(WebLLMClient.INDEXED_DB_NAME, 1);

			request.onerror = () => {
				StreamLogger.warn("[WebLLMClient.getCachedModels] Could not open IndexedDB", {
					error: request.error,
				});
				resolve([]);
			};

			request.onsuccess = () => {
				const db = request.result;
				if (!db.objectStoreNames.contains("models")) {
					StreamLogger.log("[WebLLMClient.getCachedModels] No models store found in IndexedDB");
					db.close();
					resolve([]);
					return;
				}

				const transaction = db.transaction(["models"], "readonly");
				const objectStore = transaction.objectStore("models");
				const getAllKeysRequest = objectStore.getAllKeys();

				getAllKeysRequest.onsuccess = () => {
					const keys = getAllKeysRequest.result as string[];
					StreamLogger.log("[WebLLMClient.getCachedModels] Found cached models", {
						count: keys.length,
						models: keys,
					});
					db.close();
					resolve(keys);
				};

				getAllKeysRequest.onerror = () => {
					StreamLogger.warn("[WebLLMClient.getCachedModels] Error getting keys from IndexedDB");
					db.close();
					resolve([]);
				};
			};

			request.onblocked = () => {
				StreamLogger.warn("[WebLLMClient.getCachedModels] IndexedDB request blocked");
				resolve([]);
			};
		});
	}

	/**
	 * Check if a specific model is cached (downloaded)
	 * Static method - can be called without instantiating the client
	 */
	static async isModelCached(model: string): Promise<boolean> {
		const cachedModels = await WebLLMClient.getCachedModels();
		const isCached = cachedModels.includes(model);
		StreamLogger.log("[WebLLMClient.isModelCached] Checking if model is cached", {
			model,
			isCached,
		});
		return isCached;
	}

	/**
	 * Delete a specific model from IndexedDB cache
	 * Also unloads the model if it's currently loaded
	 */
	async deleteCachedModel(model: string): Promise<void> {
		StreamLogger.log("[WebLLMClient.deleteCachedModel] Deleting model from cache", { model });

		// Unload the model if it's currently loaded
		if (this.currentModel === model) {
			StreamLogger.log("[WebLLMClient.deleteCachedModel] Unloading currently active model");
			await this.unload();
		}

		return new Promise((resolve, reject) => {
			const request = indexedDB.open(WebLLMClient.INDEXED_DB_NAME, 1);

			request.onerror = () => {
				const error = request.error;
				StreamLogger.error("[WebLLMClient.deleteCachedModel] Could not open IndexedDB", error);
				reject(new Error(`Failed to open IndexedDB: ${error?.message}`));
			};

			request.onsuccess = () => {
				const db = request.result;
				if (!db.objectStoreNames.contains("models")) {
					StreamLogger.log("[WebLLMClient.deleteCachedModel] No models store found, nothing to delete");
					db.close();
					resolve();
					return;
				}

				const transaction = db.transaction(["models"], "readwrite");
				const objectStore = transaction.objectStore("models");
				const deleteRequest = objectStore.delete(model);

				deleteRequest.onsuccess = () => {
					StreamLogger.log("[WebLLMClient.deleteCachedModel] Model deleted successfully", { model });
					db.close();
					resolve();
				};

				deleteRequest.onerror = () => {
					const error = deleteRequest.error;
					StreamLogger.error("[WebLLMClient.deleteCachedModel] Failed to delete model", error);
					db.close();
					reject(new Error(`Failed to delete model: ${error?.message}`));
				};

				transaction.onerror = () => {
					const error = transaction.error;
					StreamLogger.error("[WebLLMClient.deleteCachedModel] Transaction error", error);
					db.close();
					reject(new Error(`Transaction failed: ${error?.message}`));
				};
			};

			request.onblocked = () => {
				StreamLogger.warn("[WebLLMClient.deleteCachedModel] IndexedDB request blocked");
				reject(new Error("IndexedDB request blocked - close other tabs using this feature"));
			};
		});
	}

	/**
	 * Generate text completion using the loaded model
	 *
	 * @param prompt The prompt to send to the model
	 * @param temperature Temperature for sampling (0.0-1.0)
	 * @returns Generated text response
	 */
	async generate(prompt: string, temperature = 0.1): Promise<string> {
		if (!this.engine) {
			throw new Error("WebLLM engine not initialized. Call initialize() first.");
		}

		StreamLogger.log("[WebLLMClient.generate] Starting generation", {
			promptLength: prompt.length,
			temperature,
		});

		try {
			const response = await this.engine.chat.completions.create({
				messages: [
					{
						role: "user",
						content: prompt,
					},
				],
				temperature,
				max_tokens: 1024,
			});

			const content = response.choices[0]?.message?.content || "";

			StreamLogger.log("[WebLLMClient.generate] Generation complete", {
				responseLength: content.length,
				finishReason: response.choices[0]?.finish_reason,
			});

			return content;
		} catch (error) {
			StreamLogger.error("[WebLLMClient.generate] Generation failed", error);
			throw error;
		}
	}

	/**
	 * Unload the current model and free resources
	 */
	async unload(): Promise<void> {
		if (this.engine) {
			StreamLogger.log("[WebLLMClient.unload] Unloading model", { model: this.currentModel });
			try {
				await this.engine.unload();
			} catch (error) {
				StreamLogger.error("[WebLLMClient.unload] Error during unload", error);
			}
			this.engine = null;
			this.currentModel = null;
		}
	}
}

// Singleton instance for shared use across the processor
let clientInstance: WebLLMClient | null = null;

/**
 * Get the shared WebLLM client instance
 */
export function getWebLLMClient(): WebLLMClient {
	if (!clientInstance) {
		clientInstance = new WebLLMClient();
	}
	return clientInstance;
}
