import { App, Modal, Setting, Notice, TextComponent } from "obsidian";
import { FileProcessor, ProcessorConfig, ConfigField } from "../processors/types";
import type DrpbxFetcherPlugin from "../../main";

/**
 * Modal for configuring file processor settings
 * Dynamically generates form fields based on processor's ConfigSchema
 */
export class ProcessorConfigModal extends Modal {
	private processor: FileProcessor;
	private currentConfig: ProcessorConfig;
	private onSave: (newConfig: ProcessorConfig) => Promise<void>;
	private formValues: Record<string, unknown> = {};
	private validationErrors: string[] = [];
	private plugin: DrpbxFetcherPlugin;
	// Track module-level attachmentsFolder text components for dynamic placeholder updates
	private moduleAttachmentsFields: Array<{ fieldKey: string; textComponent: TextComponent; field: ConfigField }> = [];

	constructor(
		app: App,
		processor: FileProcessor,
		currentConfig: ProcessorConfig,
		onSave: (newConfig: ProcessorConfig) => Promise<void>,
		plugin: DrpbxFetcherPlugin
	) {
		super(app);
		this.processor = processor;
		this.currentConfig = currentConfig;
		this.onSave = onSave;
		this.plugin = plugin;

		// Get default config and merge with current config to handle new fields
		const defaultConfig = processor.getDefaultConfig();
		const mergedConfig = this.mergeConfigs(defaultConfig, currentConfig);

		// Initialize form values with deep copy of merged config
		this.formValues = JSON.parse(JSON.stringify(mergedConfig));
	}

	/**
	 * Merge default config with current config to handle newly added fields
	 * Current config values take precedence, but missing fields get defaults
	 */
	private mergeConfigs(defaultConfig: ProcessorConfig, currentConfig: ProcessorConfig): ProcessorConfig {
		const merged: Record<string, unknown> = { ...defaultConfig };

		const deepMerge = (target: Record<string, unknown>, source: Record<string, unknown>): void => {
			for (const key of Object.keys(source)) {
				if (key in target && typeof target[key] === 'object' && typeof source[key] === 'object' && !Array.isArray(target[key]) && !Array.isArray(source[key])) {
					deepMerge(target[key] as Record<string, unknown>, source[key] as Record<string, unknown>);
				} else {
					target[key] = source[key];
				}
			}
		};

		deepMerge(merged, currentConfig);
		return merged as ProcessorConfig;
	}

	onOpen(): void {
		const { contentEl } = this;
		contentEl.empty();

		// Modal title
		contentEl.createEl("h2", { text: `Configure ${this.processor.name}` });

		// Description
		if (this.processor.description) {
			contentEl.createEl("p", {
				text: this.processor.description,
				cls: "setting-item-description",
			});
		}

		// Generate form fields from schema
		const schema = this.processor.getConfigSchema();
		const formContainer = contentEl.createDiv("processor-config-form");

		// Group fields by their group property, but also track ungrouped fields
		const groupedFields = this.groupFields(schema.fields);
		const ungroupedFields = schema.fields.filter(f => !f.group);

		// Render ungrouped fields first (e.g., viwoodsAttachmentsFolder)
		for (const field of ungroupedFields) {
			this.renderField(formContainer, field);
		}

		// Then render grouped fields with collapsible sections
		for (const [groupName, fields] of groupedFields.entries()) {
			this.renderGroup(formContainer, groupName, fields);
		}

		// Validation errors container
		const errorsContainer = contentEl.createDiv("validation-errors");
		errorsContainer.style.color = "var(--text-error)";
		errorsContainer.style.marginTop = "1rem";
		errorsContainer.style.display = "none";

		// Buttons
		const buttonContainer = contentEl.createDiv("modal-button-container");
		buttonContainer.style.display = "flex";
		buttonContainer.style.justifyContent = "flex-end";
		buttonContainer.style.gap = "0.5rem";
		buttonContainer.style.marginTop = "1.5rem";

		// Cancel button
		const cancelButton = buttonContainer.createEl("button", { text: "Cancel" });
		cancelButton.addEventListener("click", () => {
			this.close();
		});

		// Save button
		const saveButton = buttonContainer.createEl("button", {
			text: "Save",
			cls: "mod-cta",
		});
		saveButton.addEventListener("click", async () => {
			await this.handleSave(errorsContainer);
		});
	}

	/**
	 * Get nested value from object using dot notation path
	 */
	private getNestedValue(obj: Record<string, unknown>, path: string): unknown {
		const keys = path.split('.');
		let value: unknown = obj;
		for (const key of keys) {
			if (value && typeof value === 'object') {
				value = (value as Record<string, unknown>)[key];
			} else {
				return undefined;
			}
		}
		return value;
	}

	/**
	 * Set nested value in object using dot notation path
	 */
	private setNestedValue(obj: Record<string, unknown>, path: string, value: unknown): void {
		const keys = path.split('.');
		let current: Record<string, unknown> = obj;

		for (let i = 0; i < keys.length - 1; i++) {
			const key = keys[i];
			if (!(key in current) || typeof current[key] !== 'object') {
				current[key] = {};
			}
			current = current[key] as Record<string, unknown>;
		}

		current[keys[keys.length - 1]] = value;
	}

	private groupFields(fields: ConfigField[]): Map<string, ConfigField[]> {
		const groups = new Map<string, ConfigField[]>();

		for (const field of fields) {
			if (field.group) {
				if (!groups.has(field.group)) {
					groups.set(field.group, []);
				}
				const groupFields = groups.get(field.group);
				if (groupFields) {
					groupFields.push(field);
				}
			}
		}

		return groups;
	}

	private renderGroup(container: HTMLElement, groupName: string, fields: ConfigField[]): void {
		// Create group container
		const groupContainer = container.createDiv("config-group");
		groupContainer.style.marginBottom = "1.5em";

		// Create simple group header (non-collapsible)
		const groupHeader = groupContainer.createDiv("config-group-header");
		groupHeader.style.padding = "0.5em 0";
		groupHeader.style.marginBottom = "0.5em";
		groupHeader.style.fontWeight = "600";
		groupHeader.style.fontSize = "1.1em";
		groupHeader.style.borderBottom = "1px solid var(--background-modifier-border)";
		groupHeader.textContent = groupName;

		// Render all fields in the group
		for (const field of fields) {
			this.renderField(groupContainer, field);
		}
	}

	private renderField(container: HTMLElement, field: ConfigField): void {
		const setting = new Setting(container).setName(field.label);

		if (field.description) {
			setting.setDesc(field.description);
		}

		// Get current value or default (using nested path)
		const currentValue = this.getNestedValue(this.formValues, field.key) ?? field.defaultValue;

		switch (field.type) {
			case "folder":
				this.renderFolderField(setting, field, currentValue as string);
				break;

			case "file":
				this.renderFileField(setting, field, currentValue as string);
				break;

			case "boolean":
				this.renderBooleanField(setting, field, currentValue as boolean);
				break;

			case "number":
				this.renderNumberField(setting, field, currentValue as number);
				break;

			case "select":
				this.renderSelectField(setting, field, currentValue as string);
				break;

			case "button":
				this.renderButtonField(setting, field);
				break;

			case "progress":
				this.renderProgressField(setting, field);
				break;

			case "info":
				this.renderInfoField(setting, field);
				break;

			case "text":
			default:
				this.renderTextField(setting, field, currentValue as string);
				break;
		}

		// Mark required fields
		if (field.required) {
			const nameEl = setting.nameEl;
			nameEl.createSpan({ text: " *", cls: "required-indicator" });
		}
	}

	private renderFolderField(
		setting: Setting,
		field: ConfigField,
		currentValue: string
	): void {
		// Determine placeholder based on field type
		let placeholder = field.placeholder || "Folder path";

		// Check if this is an attachmentsFolder field (module-level or processor-level)
		// Use case-insensitive check to handle both "attachmentsFolder" and "AttachmentsFolder"
		if (field.key.toLowerCase().endsWith('attachmentsfolder')) {
			// For attachmentsFolder fields, show the fallback value as placeholder
			// Hierarchy: module override > viwoodsAttachmentsFolder > global attachmentsFolder

			// If field is empty or has default value, show fallback as placeholder
			const isUsingDefault = currentValue === (field.defaultValue || "");
			const globalFolder = this.plugin.settings.attachmentsFolder || "Attachments";

			if (!currentValue || isUsingDefault) {
				if (field.key === 'viwoodsAttachmentsFolder') {
					// For the main viwoodsAttachmentsFolder field, show global attachments folder
					placeholder = globalFolder;
				} else {
					// For module-level overrides, show what they fall back to
					const viwoodsFolder = this.getNestedValue(this.formValues, 'viwoodsAttachmentsFolder') as string;
					if (viwoodsFolder && viwoodsFolder.trim()) {
						// Use viwoodsAttachmentsFolder value if set (even if it's the default)
						placeholder = viwoodsFolder;
					} else {
						// Fall back to global attachments folder only if viwoodsAttachmentsFolder is empty
						placeholder = globalFolder;
					}
				}
			} else {
				// Field has a custom value - show generic placeholder
				placeholder = "Folder path";
			}
		}

		setting.addText((text) => {
			text
				.setPlaceholder(placeholder)
				.setValue(currentValue || "")
				.onChange((value) => {
					this.setNestedValue(this.formValues, field.key, value);

					// If viwoodsAttachmentsFolder changed, update module-level placeholders
					if (field.key === 'viwoodsAttachmentsFolder') {
						this.updateModuleAttachmentsPlaceholders(value || undefined);
					}
				});

			// Add folder icon
			text.inputEl.style.paddingRight = "2rem";

			// Track module-level attachmentsFolder fields for dynamic placeholder updates
			// Use case-insensitive check to handle both "attachmentsFolder" and "AttachmentsFolder"
			if (field.key.toLowerCase().endsWith('attachmentsfolder') && field.key !== 'viwoodsAttachmentsFolder') {
				this.moduleAttachmentsFields.push({ fieldKey: field.key, textComponent: text, field });
			}
		});
	}

	/**
	 * Update placeholders on all module-level attachmentsFolder fields
	 * Called when viwoodsAttachmentsFolder value changes
	 */
	private updateModuleAttachmentsPlaceholders(viwoodsFolderValue: string | undefined): void {
		// Use viwoodsAttachmentsFolder value if set (even if it's the default)
		// Only fall back to global attachments folder if viwoodsAttachmentsFolder is empty
		let newPlaceholder: string;
		if (viwoodsFolderValue && viwoodsFolderValue.trim()) {
			newPlaceholder = viwoodsFolderValue;
		} else {
			newPlaceholder = this.plugin.settings.attachmentsFolder || "Attachments";
		}

		for (const { fieldKey, textComponent, field } of this.moduleAttachmentsFields) {
			// Only update if the field doesn't have a custom value set
			const currentValue = this.getNestedValue(this.formValues, fieldKey) as string;
			const isFieldUsingDefault = currentValue === (field.defaultValue || "");
			if (!currentValue || isFieldUsingDefault) {
				textComponent.setPlaceholder(newPlaceholder);
			}
		}
	}

	private renderFileField(
		setting: Setting,
		field: ConfigField,
		currentValue: string
	): void {
		setting.addText((text) => {
			text
				.setPlaceholder(field.placeholder || "File path")
				.setValue(currentValue || "")
				.onChange((value) => {
					this.setNestedValue(this.formValues, field.key, value);
				});
		});
	}

	private renderBooleanField(
		setting: Setting,
		field: ConfigField,
		currentValue: boolean
	): void {
		setting.addToggle((toggle) => {
			toggle.setValue(currentValue !== undefined ? currentValue : false);
			toggle.onChange((value) => {
				this.setNestedValue(this.formValues, field.key, value);
			});
		});
	}

	private renderNumberField(
		setting: Setting,
		field: ConfigField,
		currentValue: number
	): void {
		setting.addText((text) => {
			text
				.setPlaceholder(field.placeholder || "Enter number")
				.setValue(currentValue !== undefined ? String(currentValue) : "")
				.onChange((value) => {
					const numValue = parseFloat(value);
					this.setNestedValue(this.formValues, field.key, isNaN(numValue) ? undefined : numValue);
				});
			text.inputEl.type = "number";
		});
	}

	private renderSelectField(
		setting: Setting,
		field: ConfigField,
		currentValue: string
	): void {
		setting.addDropdown((dropdown) => {
			if (field.options) {
				field.options.forEach((option) => {
					dropdown.addOption(option.value, option.label);
				});
			}

			dropdown.setValue(currentValue || String(field.defaultValue || ""));
			dropdown.onChange((value) => {
				this.setNestedValue(this.formValues, field.key, value);
			});
		});
	}

	private renderTextField(
		setting: Setting,
		field: ConfigField,
		currentValue: string
	): void {
		setting.addText((text) => {
			text
				.setPlaceholder(field.placeholder || "Enter text")
				.setValue(currentValue || "")
				.onChange((value) => {
					this.setNestedValue(this.formValues, field.key, value);
				});
		});
	}

	private renderInfoField(setting: Setting, field: ConfigField): void {
		// Create a container for the info display
		const infoContainer = setting.controlEl.createDiv("info-field-container");
		infoContainer.style.display = "flex";
		infoContainer.style.flexDirection = "column";
		infoContainer.style.gap = "0.5rem";
		infoContainer.style.width = "100%";

		// Info text element (placeholder text that gets updated dynamically)
		const infoText = infoContainer.createDiv("info-field-text");
		infoText.style.fontSize = "0.9em";
		infoText.style.color = "var(--text-muted)";
		infoText.style.padding = "0.5rem";
		infoText.style.backgroundColor = "var(--background-secondary)";
		infoText.style.borderRadius = "4px";
		infoText.textContent = "Checking cached models...";

		// Check for cached models asynchronously
		this.updateInfoField(field, infoText);

		// Re-check when modal is opened (onOpen is called after constructor)
		setTimeout(() => {
			this.updateInfoField(field, infoText);
		}, 100);
	}

	/**
	 * Update info field with cached model information
	 */
	private async updateInfoField(field: ConfigField, infoText: HTMLElement): Promise<void> {
		// Only process for voice notes processor
		if (this.processor.type !== "voicenotes") {
			infoText.textContent = "Information not available";
			return;
		}

		// Import WebLLMClient dynamically
		try {
			const { WebLLMClient } = await import("../processors/VoiceNotesProcessor/services/WebLLMClient");

			// Get cached models
			const cachedModels = await WebLLMClient.getCachedModels();

			if (cachedModels.length === 0) {
				infoText.textContent = "No models downloaded yet. Click 'Download Model' to get started.";
				infoText.style.color = "var(--text-muted)";
			} else {
				// Get current selected model from form
				const selectedModel = this.getNestedValue(this.formValues, "llm.model") as string;

				// Check if selected model is cached
				const isSelectedCached = selectedModel && cachedModels.includes(selectedModel);

				// Format model list
				const modelList = cachedModels.map((m: string) => {
					const isCurrent = m === selectedModel ? " (selected)" : "";
					return `  • ${this.formatModelName(m)}${isCurrent}`;
				}).join("\n");

				infoText.innerHTML = `Cached models (${cachedModels.length}):\n${modelList}`;

				if (isSelectedCached) {
					infoText.style.color = "var(--text-success)";
				} else {
					infoText.style.color = "var(--text-muted)";
				}
			}
		} catch (error) {
			infoText.textContent = "Unable to check cached models.";
			infoText.style.color = "var(--text-error)";
			console.error("Error updating info field:", error);
		}
	}

	/**
	 * Format model ID for display (shorten technical model names)
	 */
	private formatModelName(modelId: string): string {
		// Map of model IDs to readable names
		const modelNames: Record<string, string> = {
			"Phi-3-mini-4k-instruct-q4f16_1-MLC": "Phi-3 Mini (1.4GB)",
			"Qwen2.5-0.5B-Instruct-q4f16_1-MLC": "Qwen2.5 0.5B (300MB)",
			"Llama-3.2-1B-Instruct-q4f16_1-MLC": "Llama 3.2 1B (650MB)",
			"gemma-2-2b-it-q4f16_1-MLC": "Gemma 2 2B (1.3GB)",
		};

		return modelNames[modelId] || modelId;
	}

	private renderButtonField(setting: Setting, field: ConfigField): void {
		setting.addButton((button) => {
			button
				.setButtonText(field.buttonText || "Click")
				.onClick(async () => {
					if (field.buttonAction && this.processor.handleButtonAction) {
						try {
							// Create context for button action
							const context = {
								vault: this.app.vault,
								app: this.app,
								templateResolver: {
									resolve: async () => "",
									clearCache: () => {},
								},
								pluginSettings: this.plugin.settings,
							};

							await this.processor.handleButtonAction(field.buttonAction, context, {
								formValues: this.formValues as ProcessorConfig,
							});

							// Refresh info field if this was a delete action
							if (field.buttonAction === "deleteModel") {
								const infoField = this.findInfoFieldElement();
								if (infoField) {
									await this.refreshInfoField(infoField);
								}
							}
						} catch (error) {
							const err = error as Error;
							new Notice(`Action failed: ${err.message}`);
							console.error(`Button action '${field.buttonAction}' failed:`, error);
						}
					}
				});
		});
	}

	private renderProgressField(setting: Setting, field: ConfigField): void {
		// Container for button
		const controlContainer = setting.controlEl.createDiv("progress-field-container");
		controlContainer.style.display = "flex";
		controlContainer.style.flexDirection = "column";
		controlContainer.style.gap = "0.5rem";
		controlContainer.style.width = "100%";

		// Create button
		const buttonEl = controlContainer.createEl("button", {
			text: field.buttonText || "Download",
			cls: "mod-cta",
		});
		buttonEl.style.minWidth = "150px";

		// Store reference to info field element for refresh after completion
		let infoFieldTextEl: HTMLElement | null = null;

		// Find the cachedModelsInfo field element if it exists
		const cachedInfoField = this.findInfoFieldElement();
		if (cachedInfoField) {
			infoFieldTextEl = cachedInfoField;
		}

		// Button click handler
		buttonEl.addEventListener("click", async () => {
			if (!field.buttonAction || !this.processor.handleButtonAction) {
				return;
			}

			const originalButtonText = field.buttonText || "Download";

			try {
				// Disable button and show initial status
				buttonEl.disabled = true;
				buttonEl.textContent = "0% - Starting...";

				// Create context
				const context = {
					vault: this.app.vault,
					app: this.app,
					templateResolver: {
						resolve: async () => "",
						clearCache: () => {},
					},
					pluginSettings: this.plugin.settings,
				};

				// Progress callback - updates button text with percentage
				const onProgress = (progress: number, status: string) => {
					const percent = Math.round(progress * 100);
					buttonEl.textContent = `${percent}% - ${status}`;
				};

				await this.processor.handleButtonAction(field.buttonAction, context, {
					onProgress,
					formValues: this.formValues as ProcessorConfig,
				});

				// Success
				buttonEl.textContent = "✓ Complete!";
				buttonEl.style.backgroundColor = "var(--text-success)";

				// Refresh info field to show updated cached models
				if (infoFieldTextEl) {
					await this.refreshInfoField(infoFieldTextEl);
				}

				// Reset button after delay
				setTimeout(() => {
					buttonEl.disabled = false;
					buttonEl.textContent = originalButtonText;
					buttonEl.style.backgroundColor = "";
				}, 3000);

			} catch (error) {
				buttonEl.textContent = `❌ Error`;
				buttonEl.style.backgroundColor = "var(--text-error)";
				buttonEl.disabled = false;

				// Reset after delay
				setTimeout(() => {
					buttonEl.textContent = originalButtonText;
					buttonEl.style.backgroundColor = "";
				}, 5000);

				console.error(`Progress action '${field.buttonAction}' failed:`, error);
			}
		});
	}

	/**
	 * Find the info field element for cached models display
	 */
	private findInfoFieldElement(): HTMLElement | null {
		const infoFields = this.contentEl.querySelectorAll(".info-field-text");
		return infoFields.length > 0 ? infoFields[0] as HTMLElement : null;
	}

	/**
	 * Refresh the info field with current cached models
	 */
	private async refreshInfoField(infoTextEl: HTMLElement): Promise<void> {
		if (this.processor.type !== "voicenotes") {
			return;
		}

		try {
			const { WebLLMClient } = await import("../processors/VoiceNotesProcessor/services/WebLLMClient");
			const cachedModels = await WebLLMClient.getCachedModels();

			if (cachedModels.length === 0) {
				infoTextEl.textContent = "No models downloaded yet. Click 'Download Model' to get started.";
				infoTextEl.style.color = "var(--text-muted)";
			} else {
				const selectedModel = this.getNestedValue(this.formValues, "llm.model") as string;
				const isSelectedCached = selectedModel && cachedModels.includes(selectedModel);

				const modelList = cachedModels.map((m: string) => {
					const isCurrent = m === selectedModel ? " (selected)" : "";
					return `  • ${this.formatModelName(m)}${isCurrent}`;
				}).join("\n");

				infoTextEl.innerHTML = `Cached models (${cachedModels.length}):\n${modelList}`;

				if (isSelectedCached) {
					infoTextEl.style.color = "var(--text-success)";
				} else {
					infoTextEl.style.color = "var(--text-muted)";
				}
			}
		} catch (error) {
			console.error("Error refreshing info field:", error);
		}
	}

	private async handleSave(errorsContainer: HTMLElement): Promise<void> {
		// Clear previous errors
		this.validationErrors = [];
		errorsContainer.empty();
		errorsContainer.style.display = "none";

		// Validate required fields (use getNestedValue for nested keys like "llm.model")
		const schema = this.processor.getConfigSchema();
		for (const field of schema.fields) {
			if (field.required) {
				const value = this.getNestedValue(this.formValues, field.key);
				if (value === undefined || value === null || value === "") {
					this.validationErrors.push(`${field.label} is required`);
				}
			}
		}

		// Check if template files exist (blocking validation)
		for (const field of schema.fields) {
			if (field.type === "file") {
				const templatePath = this.formValues[field.key] as string;
				if (templatePath && templatePath.trim().length > 0) {
					const file = this.app.vault.getAbstractFileByPath(templatePath);
					if (!file) {
						this.validationErrors.push(`${field.label}: File '${templatePath}' not found. Please check the path includes .md extension.`);
					}
				}
			}
		}

		// Use processor's validation
		const validationResult = this.processor.validateConfig(
			this.formValues as ProcessorConfig
		);

		if (!validationResult.valid) {
			if (validationResult.errors) {
				this.validationErrors.push(...validationResult.errors);
			}
		}

		// Show errors if any
		if (this.validationErrors.length > 0) {
			errorsContainer.style.display = "block";
			errorsContainer.createEl("div", {
				text: "Please fix the following errors:",
				cls: "validation-error-title",
			});
			const errorList = errorsContainer.createEl("ul");
			this.validationErrors.forEach((error) => {
				errorList.createEl("li", { text: error });
			});
			return;
		}

		// Save configuration
		try {
			await this.onSave(this.formValues as ProcessorConfig);
			new Notice(`${this.processor.name} configuration saved`);
			this.close();
		} catch (error) {
			new Notice(`Failed to save configuration: ${error}`);
			console.error("Failed to save processor config:", error);
		}
	}

	onClose(): void {
		const { contentEl } = this;
		contentEl.empty();
		// Clear tracked fields to avoid memory leaks
		this.moduleAttachmentsFields = [];
	}
}
