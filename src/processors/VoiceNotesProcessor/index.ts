/**
 * Voice Notes Processor
 * Processes dictated markdown files, extracts note references using local LLM,
 * and converts them to Obsidian wiki-links using fuzzy filename matching.
 */

import { Notice, TFile, parseYaml, stringifyYaml } from "obsidian";
import { StreamLogger } from "../../utils/StreamLogger";
import { FileUtils } from "../../utils/FileUtils";
import {
	FileProcessor,
	ProcessorConfig,
	ProcessorContext,
	ProcessorResult,
	FileMetadata,
	ValidationResult,
	ConfigSchema,
	ButtonActionOptions,
} from "../types";
import {
	VoiceNotesProcessorConfig,
	DEFAULT_CONFIG,
	AVAILABLE_MODELS,
	isCloudModel,
	isOpenRouterModel,
} from "./VoiceNotesTypes";
import { WebLLMClient, getWebLLMClient, ModelProgressCallback } from "./services/WebLLMClient";
import { GeminiClient } from "./services/GeminiClient";
import { OpenRouterClient } from "./services/OpenRouterClient";
import { NoteFinder } from "./services/NoteFinder";
import { TextRewriter, LLMClient } from "./services/TextRewriter";

/**
 * Processor for voice-dictated markdown files
 * Uses WebLLM for local LLM inference or Gemini API for cloud inference
 */
export class VoiceNotesProcessor implements FileProcessor {
	readonly type = "voicenotes";
	readonly name = "Voice Notes";
	readonly description = "Process dictated notes with AI-powered link detection";
	readonly supportedExtensions = ["md"];

	private llmClient: LLMClient | null = null;
	private webLLMClient: WebLLMClient | null = null;
	private geminiClient: GeminiClient | null = null;
	private openRouterClient: OpenRouterClient | null = null;
	private noteFinder: NoteFinder | null = null;
	private isProcessing = false;
	// Track current Gemini reasoning settings to detect config changes
	private currentGeminiReasoning: { enabled: boolean; budget: number } | null = null;

	/**
	 * Process a voice note file
	 */
	async process(
		fileData: Uint8Array,
		originalPath: string,
		metadata: FileMetadata,
		config: ProcessorConfig,
		context: ProcessorContext
	): Promise<ProcessorResult> {
		const voiceConfig = config as VoiceNotesProcessorConfig;

		StreamLogger.log("[VoiceNotesProcessor] Starting processing", {
			fileName: metadata.name,
			filePath: originalPath,
			configEnabled: voiceConfig.enabled,
		});

		// Check if processor is enabled
		if (!voiceConfig.enabled) {
			return {
				success: false,
				createdFiles: [],
				errors: ["Voice Notes processor is disabled"],
			};
		}

		// Decode file content
		const decoder = new TextDecoder("utf-8");
		const content = decoder.decode(fileData);

		StreamLogger.log("[VoiceNotesProcessor] File content decoded", {
			contentLength: content.length,
			contentPreview: content.substring(0, 200),
		});

		// Check for dictation tag
		const hasDictationTag = this.hasDictationTag(content, voiceConfig.dictationTag);

		if (!hasDictationTag) {
			StreamLogger.log("[VoiceNotesProcessor] No dictation tag found, writing as-is", {
				expectedTag: voiceConfig.dictationTag,
			});

			// Write file without processing (no tag = not a voice note)
			return await this.writeUnprocessedFile(
				fileData,
				originalPath,
				metadata,
				voiceConfig,
				context
			);
		}

		StreamLogger.log("[VoiceNotesProcessor] Dictation tag found, processing with LLM", {
			tag: voiceConfig.dictationTag,
		});

		// Prevent concurrent processing
		if (this.isProcessing) {
			return {
				success: false,
				createdFiles: [],
				errors: ["Voice note processing already in progress. Please wait."],
			};
		}

		this.isProcessing = true;

		try {
			// Get the note name without extension to exclude from linking
			const currentNoteName = metadata.name.replace(/\.md$/i, "");

			// Process the voice note
			let processedContent = await this.processVoiceNote(content, voiceConfig, context, currentNoteName);

			// Ensure dropbox_file_id is in the YAML frontmatter
			const dropboxFileId = (metadata as { id: string }).id;
			processedContent = this.ensureDropboxFileId(processedContent, dropboxFileId);

			// Write the processed file
			const outputPath = this.getOutputPath(originalPath, metadata, voiceConfig, context);

			await FileUtils.ensurePath(context.vault, FileUtils.getParentPath(outputPath));

			const existingFile = context.vault.getAbstractFileByPath(outputPath);
			if (existingFile instanceof TFile) {
				await context.vault.modify(existingFile, processedContent);
			} else {
				await context.vault.create(outputPath, processedContent);
			}

			StreamLogger.log("[VoiceNotesProcessor] File written successfully", {
				outputPath,
				processedLength: processedContent.length,
			});

			return {
				success: true,
				createdFiles: [outputPath],
			};
		} catch (error) {
			const err = error as Error;
			StreamLogger.error("[VoiceNotesProcessor] Processing failed", error);

			// If LLM fails, fall back to writing unprocessed
			StreamLogger.warn("[VoiceNotesProcessor] Falling back to unprocessed write");

			const fallbackResult = await this.writeUnprocessedFile(
				fileData,
				originalPath,
				metadata,
				voiceConfig,
				context
			);

			return {
				...fallbackResult,
				warnings: [`LLM processing failed (${err.message}), file written without link detection`],
			};
		} finally {
			this.isProcessing = false;
		}
	}

	/**
	 * Check if content contains the dictation tag
	 */
	private hasDictationTag(content: string, tag: string): boolean {
		const tagWithHash = `#${tag}`;

		// Check in frontmatter tags array
		const frontmatterMatch = content.match(/^---\s*\n([\s\S]*?)\n---/);
		if (frontmatterMatch) {
			const frontmatter = frontmatterMatch[1];
			// Check for tag in YAML tags array
			if (frontmatter.match(new RegExp(`tags:.*${tag}`, "i"))) {
				return true;
			}
			// Check for tag in tags list format
			if (frontmatter.match(new RegExp(`-\\s*${tag}\\s*$`, "mi"))) {
				return true;
			}
		}

		// Check for inline hashtag
		if (content.includes(tagWithHash)) {
			return true;
		}

		return false;
	}

	/**
	 * Ensure dropbox_file_id is present in the YAML frontmatter
	 * If no frontmatter exists, creates one with dropbox_file_id
	 */
	private ensureDropboxFileId(content: string, dropboxFileId: string): string {
		StreamLogger.log("[VoiceNotesProcessor.ensureDropboxFileId] Ensuring dropbox_file_id in frontmatter", {
			dropboxFileId,
		});

		// Check if content has frontmatter
		const frontmatterMatch = content.match(/^---\s*\n([\s\S]*?)\n---/);

		if (!frontmatterMatch) {
			// No frontmatter exists, create one with dropbox_file_id
			const yamlContent = stringifyYaml({ dropbox_file_id: dropboxFileId }).trim();
			return `---\n${yamlContent}\n---\n\n${content}`;
		}

		// Parse existing frontmatter
		const yamlContent = frontmatterMatch[1];
		let frontmatter: Record<string, unknown>;
		try {
			frontmatter = parseYaml(yamlContent) as Record<string, unknown> || {};
		} catch (error) {
			StreamLogger.warn("[VoiceNotesProcessor.ensureDropboxFileId] Failed to parse YAML, creating new frontmatter", error);
			frontmatter = {};
		}

		// Add or update dropbox_file_id
		frontmatter.dropbox_file_id = dropboxFileId;

		// Rebuild content with updated frontmatter
		const newYaml = stringifyYaml(frontmatter).trim();
		const bodyContent = content.substring(frontmatterMatch[0].length);

		return `---\n${newYaml}\n---\n${bodyContent}`;
	}

	/**
	 * Process voice note content with LLM
	 * Uses TextRewriter for smart link placement
	 *
	 * @param content The note content to process
	 * @param config Processor configuration
	 * @param context Processing context
	 * @param currentNoteName Name of the current note (to exclude from linking)
	 */
	private async processVoiceNote(
		content: string,
		config: VoiceNotesProcessorConfig,
		context: ProcessorContext,
		currentNoteName: string
	): Promise<string> {
		StreamLogger.log("[VoiceNotesProcessor.processVoiceNote] Starting LLM processing with smart link placement", {
			currentNoteName,
		});

		// Initialize LLM client if needed
		await this.ensureLLMInitialized(config, context);

		if (!this.llmClient) {
			throw new Error("Failed to initialize WebLLM client");
		}

		// Initialize note finder
		if (!this.noteFinder) {
			this.noteFinder = new NoteFinder(context.app, config.matching);
		} else {
			this.noteFinder.updateConfig(config.matching);
		}

		// Use TextRewriter for smart link placement
		const rewriter = new TextRewriter(this.llmClient, this.noteFinder, config.createMissingLinks);
		const rewriteResult = await rewriter.rewriteWithLinks(content, config.llm.temperature, currentNoteName);

		StreamLogger.log("[VoiceNotesProcessor.processVoiceNote] Processing complete", {
			originalLength: content.length,
			processedLength: rewriteResult.rewrittenContent.length,
			linksAdded: rewriteResult.linksAdded,
		});

		return rewriteResult.rewrittenContent;
	}

	/**
	 * Ensure the LLM client is initialized
	 */
	private async ensureLLMInitialized(
		config: VoiceNotesProcessorConfig,
		context: ProcessorContext
	): Promise<void> {
		const modelId = config.llm.model;
		const isCloud = isCloudModel(modelId);
		const isOpenRouter = isOpenRouterModel(modelId);

		StreamLogger.log("[VoiceNotesProcessor.ensureLLMInitialized] Checking LLM initialization", {
			modelId,
			isCloud,
			isOpenRouter,
		});

		if (isOpenRouter) {
			// OpenRouter model (e.g., amazon/nova-lite-v1)
			if (!config.llm.openRouterApiKey) {
				throw new Error("OpenRouter API key is required for OpenRouter models. Please add your API key in settings.");
			}

			// Check if we already have a working OpenRouter client for this model
			if (
				this.openRouterClient &&
				this.openRouterClient.isReady() &&
				this.openRouterClient.getCurrentModel() === modelId
			) {
				StreamLogger.log("[VoiceNotesProcessor.ensureLLMInitialized] OpenRouter client already initialized");
				this.llmClient = this.openRouterClient;
				return;
			}

			// Create new OpenRouter client
			StreamLogger.log("[VoiceNotesProcessor.ensureLLMInitialized] Creating OpenRouter client");
			this.openRouterClient = new OpenRouterClient(config.llm.openRouterApiKey, modelId);
			this.llmClient = this.openRouterClient;

			new Notice("✓ OpenRouter API client ready", 3000);
		} else if (isCloud) {
			// Gemini cloud model
			if (!config.llm.geminiApiKey) {
				throw new Error("Gemini API key is required for Gemini models. Please add your API key in settings.");
			}

			// Get current reasoning settings
			const enableReasoning = config.llm.enableReasoning ?? true;
			const reasoningBudget = config.llm.reasoningBudget ?? 1024;

			// Check if we already have a working Gemini client for this model AND settings haven't changed
			const reasoningChanged =
				!this.currentGeminiReasoning ||
				this.currentGeminiReasoning.enabled !== enableReasoning ||
				this.currentGeminiReasoning.budget !== reasoningBudget;

			if (
				!reasoningChanged &&
				this.geminiClient &&
				this.geminiClient.isReady() &&
				this.geminiClient.getCurrentModel() === modelId
			) {
				StreamLogger.log("[VoiceNotesProcessor.ensureLLMInitialized] Gemini client already initialized with current settings");
				this.llmClient = this.geminiClient;
				return;
			}

			// Create new Gemini client (settings changed or first initialization)
			if (reasoningChanged && this.geminiClient) {
				StreamLogger.log("[VoiceNotesProcessor.ensureLLMInitialized] Reasoning settings changed, recreating Gemini client", {
					previousSettings: this.currentGeminiReasoning,
					newSettings: { enabled: enableReasoning, budget: reasoningBudget },
				});
			} else {
				StreamLogger.log("[VoiceNotesProcessor.ensureLLMInitialized] Creating Gemini client");
			}

			this.currentGeminiReasoning = { enabled: enableReasoning, budget: reasoningBudget };
			this.geminiClient = new GeminiClient(config.llm.geminiApiKey, modelId, enableReasoning, reasoningBudget);
			this.llmClient = this.geminiClient;

			new Notice("✓ Gemini API client ready", 3000);
		} else {
			// Local model - use WebLLM client
			if (!this.webLLMClient) {
				this.webLLMClient = getWebLLMClient();
			}

			// Check if we need to initialize or switch models
			if (this.webLLMClient.isReady() && this.webLLMClient.getCurrentModel() === modelId) {
				StreamLogger.log("[VoiceNotesProcessor.ensureLLMInitialized] WebLLM already initialized");
				this.llmClient = this.webLLMClient;
				return;
			}

			// Show loading notice
			const notice = new Notice(`⏳ Loading AI model: ${modelId}...`, 0);

			const progressCallback: ModelProgressCallback = (progress, status) => {
				const percent = Math.round(progress * 100);
				notice.setMessage(`⏳ Loading AI model: ${percent}%\n${status}`);
			};

			try {
				await this.webLLMClient.initialize(modelId, progressCallback);
				notice.hide();
				new Notice("✓ AI model loaded successfully", 3000);
				this.llmClient = this.webLLMClient;
			} catch (error) {
				notice.hide();
				new Notice(`❌ Failed to load AI model: ${(error as Error).message}`, 8000);
				throw error;
			}
		}
	}

	/**
	 * Write file without processing
	 */
	private async writeUnprocessedFile(
		fileData: Uint8Array,
		originalPath: string,
		metadata: FileMetadata,
		config: VoiceNotesProcessorConfig,
		context: ProcessorContext
	): Promise<ProcessorResult> {
		const outputPath = this.getOutputPath(originalPath, metadata, config, context);

		await FileUtils.ensurePath(context.vault, FileUtils.getParentPath(outputPath));

		const decoder = new TextDecoder("utf-8");
		let content = decoder.decode(fileData);

		// Ensure dropbox_file_id is in the YAML frontmatter
		const dropboxFileId = (metadata as { id: string }).id;
		content = this.ensureDropboxFileId(content, dropboxFileId);

		const existingFile = context.vault.getAbstractFileByPath(outputPath);
		if (existingFile instanceof TFile) {
			await context.vault.modify(existingFile, content);
		} else {
			await context.vault.create(outputPath, content);
		}

		return {
			success: true,
			createdFiles: [outputPath],
		};
	}

	/**
	 * Get the output path for a file
	 */
	private getOutputPath(
		originalPath: string,
		metadata: FileMetadata,
		config: VoiceNotesProcessorConfig,
		context: ProcessorContext
	): string {
		const filename = FileUtils.sanitizeFilename(metadata.name);

		// Use basePath from context if set (from folder mapping), otherwise use config outputFolder
		const basePath = context.basePath || config.outputFolder;

		return FileUtils.joinPath(basePath, filename);
	}

	/**
	 * Validate processor configuration
	 */
	validateConfig(config: ProcessorConfig): ValidationResult {
		const voiceConfig = config as VoiceNotesProcessorConfig;
		const errors: string[] = [];

		if (voiceConfig.enabled) {
			if (!voiceConfig.dictationTag || voiceConfig.dictationTag.trim() === "") {
				errors.push("Dictation tag must be specified");
			}

			if (!voiceConfig.llm?.model) {
				errors.push("LLM model must be selected");
			}

			// Check if API key is required for cloud models
			if (voiceConfig.llm?.model) {
				const modelId = voiceConfig.llm.model;
				if (isOpenRouterModel(modelId)) {
					// OpenRouter model requires OpenRouter API key
					if (!voiceConfig.llm.openRouterApiKey || voiceConfig.llm.openRouterApiKey.trim() === "") {
						errors.push("OpenRouter API key is required for OpenRouter models");
					}
				} else if (isCloudModel(modelId)) {
					// Gemini cloud model requires Gemini API key
					if (!voiceConfig.llm.geminiApiKey || voiceConfig.llm.geminiApiKey.trim() === "") {
						errors.push("Gemini API key is required for Gemini cloud models");
					}
				}
			}

			if (
				voiceConfig.matching?.similarityThreshold !== undefined &&
				(voiceConfig.matching.similarityThreshold < 0 ||
					voiceConfig.matching.similarityThreshold > 1)
			) {
				errors.push("Similarity threshold must be between 0 and 1");
			}
		}

		return {
			valid: errors.length === 0,
			errors: errors.length > 0 ? errors : undefined,
		};
	}

	/**
	 * Get default configuration
	 */
	getDefaultConfig(): VoiceNotesProcessorConfig {
		return { ...DEFAULT_CONFIG };
	}

	/**
	 * Get default templates (none for this processor)
	 */
	getDefaultTemplates(): Record<string, string> {
		return {};
	}

	/**
	 * Get configuration schema for settings UI
	 */
	getConfigSchema(): ConfigSchema {
		return {
			fields: [
				{
					key: "enabled",
					label: "Enable Voice Notes Processing",
					description: "Process dictated notes with AI-powered link detection",
					type: "boolean",
					defaultValue: true,
				},
				{
					key: "outputFolder",
					label: "Output Folder",
					description: "Folder for processed voice notes (if not using folder mapping)",
					type: "folder",
					required: false,
					defaultValue: "Voice Notes",
				},
				{
					key: "dictationTag",
					label: "Dictation Tag",
					description: "Tag to identify voice-dictated notes (without #)",
					type: "text",
					required: true,
					defaultValue: "dictation",
					placeholder: "dictation",
				},
				{
					key: "llm.model",
					label: "AI Model",
					description: "Select an AI model for reference extraction. Local models run on your device, cloud models require an API key.",
					type: "select",
					required: true,
					defaultValue: "Phi-3-mini-4k-instruct-q4f16_1-MLC",
					options: AVAILABLE_MODELS.map((m) => ({
						value: m.value,
						label: m.label,
					})),
				},
				{
					key: "llm.geminiApiKey",
					label: "Gemini API Key",
					description: "API key for Gemini cloud models (get from Google AI Studio: https://aistudio.google.com/)",
					type: "text",
					required: false,
					placeholder: "Enter your Gemini API key",
				},
				{
					key: "llm.openRouterApiKey",
					label: "OpenRouter API Key",
					description: "API key for OpenRouter models (get from https://openrouter.ai/)",
					type: "text",
					required: false,
					placeholder: "Enter your OpenRouter API key",
				},
				{
					key: "llm.enableReasoning",
					label: "Enable Reasoning",
					description: "Enable reasoning/thinking mode for Gemini 2.5+ models (improves quality but slower)",
					type: "boolean",
					defaultValue: true,
				},
				{
					key: "llm.reasoningBudget",
					label: "Reasoning Budget",
					description: "Token budget for reasoning (1-24576, default 1024). Higher = better quality but slower/costlier",
					type: "number",
					required: false,
					defaultValue: 1024,
					placeholder: "1024",
				},
				{
					key: "llm.temperature",
					label: "LLM Temperature",
					description: "Generation temperature (0.0 = deterministic, 1.0 = creative)",
					type: "number",
					required: false,
					defaultValue: 0.1,
					placeholder: "0.1",
				},
				{
					key: "matching.similarityThreshold",
					label: "Match Threshold",
					description: "Minimum similarity (0.0-1.0) for note matching",
					type: "number",
					required: false,
					defaultValue: 0.6,
					placeholder: "0.6",
				},
				{
					key: "matching.fuzzyMatching",
					label: "Enable Fuzzy Matching",
					description: "Use fuzzy matching algorithm (if disabled, requires exact match)",
					type: "boolean",
					defaultValue: true,
				},
				{
					key: "matching.excludeFolders",
					label: "Exclude Folders",
					description: "Folders to exclude from note search (comma-separated)",
					type: "text",
					required: false,
					defaultValue: "Templates, Attachments, .obsidian",
					placeholder: "Templates, Attachments",
				},
				{
					key: "createMissingLinks",
					label: "Create Broken Links",
					description: "Create wiki-links even when no matching note is found",
					type: "boolean",
					defaultValue: true,
				},
				{
					key: "cachedModelsInfo",
					label: "Downloaded Models",
					description: "Shows which AI models are currently downloaded to your device",
					type: "info",
				},
				{
					key: "downloadModel",
					label: "Download AI Model",
					description: "Download the selected AI model to your device (required before first use)",
					type: "progress",
					buttonText: "Download Model",
					buttonAction: "downloadModel",
					progressSourceKey: "llm.model",
				},
				{
					key: "deleteModel",
					label: "Delete Downloaded Model",
					description: "Delete the currently selected AI model from IndexedDB to free up space",
					type: "button",
					buttonText: "Delete Model",
					buttonAction: "deleteModel",
				},
				{
					key: "testLlm",
					label: "Test WebGPU",
					description: "Check if your browser supports WebGPU (required for AI processing)",
					type: "button",
					buttonText: "Test WebGPU",
					buttonAction: "testLlm",
				},
			],
		};
	}

	/**
	 * Handle button actions from settings UI
	 */
	async handleButtonAction(
		action: string,
		context: ProcessorContext,
		options?: ButtonActionOptions
	): Promise<void> {
		if (action === "testLlm") {
			await this.testLLMConnection(context);
		} else if (action === "downloadModel") {
			await this.downloadModel(context, options);
		} else if (action === "deleteModel") {
			await this.deleteModel(context, options);
		}
	}

	/**
	 * Download the selected AI model
	 */
	private async downloadModel(
		context: ProcessorContext,
		options?: ButtonActionOptions
	): Promise<void> {
		StreamLogger.log("[VoiceNotesProcessor.downloadModel] Starting download");

		// Get selected model from form values
		const formValues = options?.formValues as VoiceNotesProcessorConfig | undefined;
		const model = formValues?.llm?.model || DEFAULT_CONFIG.llm.model;

		// Check if this is a cloud model - no download needed
		if (isCloudModel(model)) {
			new Notice("ℹ️ Cloud models don't need to be downloaded.\n\nJust add your Gemini API key to use this model.", 5000);
			StreamLogger.log("[VoiceNotesProcessor.downloadModel] Cloud model, skipping download", { model });
			return;
		}

		// Check WebGPU first for local models
		const webGPUAvailable = await WebLLMClient.isWebGPUAvailable();
		if (!webGPUAvailable) {
			throw new Error(
				"WebGPU is not available. Voice Notes requires WebGPU support (Chrome 121+, Edge 121+, Safari 26+)."
			);
		}

		StreamLogger.log("[VoiceNotesProcessor.downloadModel] Downloading model", { model });

		// Initialize client
		if (!this.webLLMClient) {
			this.webLLMClient = getWebLLMClient();
		}

		// Check if model is already cached
		const isCached = await WebLLMClient.isModelCached(model);
		StreamLogger.log("[VoiceNotesProcessor.downloadModel] Model cache status", { model, isCached });

		// Progress callback - always called at least once to ensure UI updates
		let progressCalled = false;
		const progressCallback: ModelProgressCallback = (progress, status) => {
			progressCalled = true;
			StreamLogger.log("[VoiceNotesProcessor.downloadModel] Progress", {
				progress: (progress * 100).toFixed(1),
				status,
			});

			if (options?.onProgress) {
				options.onProgress(progress, status);
			}
		};

		// Report initial status
		if (options?.onProgress) {
			options.onProgress(0, isCached ? "Loading cached model..." : "Downloading model...");
		}

		// Initialize (download) the model
		await this.webLLMClient.initialize(model, progressCallback);

		// Ensure progress callback was called at least once (for cached models that load instantly)
		if (!progressCalled && options?.onProgress) {
			StreamLogger.log("[VoiceNotesProcessor.downloadModel] No progress events fired, reporting completion");
			options.onProgress(1, "Model loaded successfully");
		} else if (options?.onProgress) {
			// Ensure final progress is at 100%
			options.onProgress(1, "Model loaded successfully");
		}

		StreamLogger.log("[VoiceNotesProcessor.downloadModel] Download complete", { model });
	}

	/**
	 * Delete the cached AI model
	 */
	private async deleteModel(
		context: ProcessorContext,
		options?: ButtonActionOptions
	): Promise<void> {
		StreamLogger.log("[VoiceNotesProcessor.deleteModel] Starting delete");

		// Get selected model from form values
		const formValues = options?.formValues as VoiceNotesProcessorConfig | undefined;
		const model = formValues?.llm?.model || DEFAULT_CONFIG.llm.model;

		// Check if this is a cloud model - nothing to delete
		if (isCloudModel(model)) {
			new Notice("ℹ️ Cloud models don't store data locally.\n\nNothing to delete.", 5000);
			StreamLogger.log("[VoiceNotesProcessor.deleteModel] Cloud model, skipping delete", { model });
			return;
		}

		StreamLogger.log("[VoiceNotesProcessor.deleteModel] Deleting model", { model });

		// Initialize client
		if (!this.webLLMClient) {
			this.webLLMClient = getWebLLMClient();
		}

		// Check if model is cached
		const isCached = await WebLLMClient.isModelCached(model);

		if (!isCached) {
			new Notice(`ℹ️ Model "${model}" is not downloaded.\n\nNo need to delete.`, 5000);
			StreamLogger.log("[VoiceNotesProcessor.deleteModel] Model not cached, nothing to delete");
			return;
		}

		// Delete the model from cache
		await this.webLLMClient.deleteCachedModel(model);

		StreamLogger.log("[VoiceNotesProcessor.deleteModel] Model deleted successfully", { model });

		new Notice(`✓ Model "${model}" deleted successfully!\n\nThe model has been removed from IndexedDB.`, 5000);
	}

	/**
	 * Test WebGPU availability
	 */
	private async testLLMConnection(context: ProcessorContext): Promise<void> {
		StreamLogger.log("[VoiceNotesProcessor.testLLMConnection] Starting test");

		// Check WebGPU availability
		const webGPUAvailable = await WebLLMClient.isWebGPUAvailable();

		if (!webGPUAvailable) {
			new Notice(
				"❌ WebGPU not available\n\nVoice Notes processing requires WebGPU support.\n" +
				"Supported browsers: Chrome 121+, Edge 121+, Safari 26+",
				10000
			);
			return;
		}

		new Notice("✓ WebGPU is available!\n\nYour browser supports local AI processing.", 5000);

		StreamLogger.log("[VoiceNotesProcessor.testLLMConnection] WebGPU available, test passed");
	}

	/**
	 * Check if processor should skip a file
	 */
	shouldSkipFile(
		filePath: string,
		metadata: FileMetadata,
		config: ProcessorConfig
	): { shouldSkip: boolean; reason?: string } {
		const voiceConfig = config as VoiceNotesProcessorConfig;

		if (!voiceConfig.enabled) {
			return { shouldSkip: true, reason: "Voice Notes processor is disabled" };
		}

		return { shouldSkip: false };
	}
}

// Export types
export * from "./VoiceNotesTypes";
