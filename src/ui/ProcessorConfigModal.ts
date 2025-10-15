import { App, Modal, Setting, Notice } from "obsidian";
import { FileProcessor, ProcessorConfig, ConfigField } from "../processors/types";

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

	constructor(
		app: App,
		processor: FileProcessor,
		currentConfig: ProcessorConfig,
		onSave: (newConfig: ProcessorConfig) => Promise<void>
	) {
		super(app);
		this.processor = processor;
		this.currentConfig = currentConfig;
		this.onSave = onSave;

		// Initialize form values with current config
		this.formValues = { ...currentConfig };
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

		for (const field of schema.fields) {
			this.renderField(formContainer, field);
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

	private renderField(container: HTMLElement, field: ConfigField): void {
		const setting = new Setting(container).setName(field.label);

		if (field.description) {
			setting.setDesc(field.description);
		}

		// Get current value or default
		const currentValue =
			this.formValues[field.key] !== undefined
				? this.formValues[field.key]
				: field.defaultValue;

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
		setting.addText((text) => {
			text
				.setPlaceholder(field.placeholder || "Folder path")
				.setValue(currentValue || "")
				.onChange((value) => {
					this.formValues[field.key] = value;
				});

			// Add folder icon
			text.inputEl.style.paddingRight = "2rem";
		});
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
					this.formValues[field.key] = value;
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
				this.formValues[field.key] = value;
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
					this.formValues[field.key] = isNaN(numValue) ? undefined : numValue;
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
				this.formValues[field.key] = value;
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
					this.formValues[field.key] = value;
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
	}
}
