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

	private async handleSave(errorsContainer: HTMLElement): Promise<void> {
		// Clear previous errors
		this.validationErrors = [];
		errorsContainer.empty();
		errorsContainer.style.display = "none";

		// Validate required fields
		const schema = this.processor.getConfigSchema();
		for (const field of schema.fields) {
			if (field.required) {
				const value = this.formValues[field.key];
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
