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

		// Group fields by their group property
		const groupedFields = this.groupFields(schema.fields);

		if (groupedFields.size === 0) {
			// No grouped fields, render all directly
			for (const field of schema.fields) {
				this.renderField(formContainer, field);
			}
		} else {
			// Render grouped fields with collapsible sections
			for (const [groupName, fields] of groupedFields.entries()) {
				this.renderGroup(formContainer, groupName, fields);
			}
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
		// Get the toggle key from the first field (they should all have the same for a group)
		const groupToggleKey = fields[0]?.groupToggleKey;

		// Create group container
		const groupContainer = container.createDiv("config-group");
		groupContainer.style.marginBottom = "1.5em";

		// Create group header (collapsible)
		const groupHeader = groupContainer.createDiv("config-group-header");
		groupHeader.style.cursor = "pointer";
		groupHeader.style.display = "flex";
		groupHeader.style.alignItems = "center";
		groupHeader.style.padding = "0.75em";
		groupHeader.style.backgroundColor = "var(--background-secondary)";
		groupHeader.style.borderRadius = "4px";
		groupHeader.style.marginBottom = "0.5em";
		groupHeader.style.fontWeight = "600";

		// Add collapse indicator
		const collapseIndicator = groupHeader.createSpan({ text: "▼ " });
		collapseIndicator.style.marginRight = "0.5em";
		collapseIndicator.style.transition = "transform 0.2s";

		// Add group title
		groupHeader.createSpan({ text: groupName });

		// Create content container (initially visible if module is enabled)
		const groupContent = groupContainer.createDiv("config-group-content");
		const isEnabled = groupToggleKey ? this.formValues[groupToggleKey] : true;
		groupContent.style.display = isEnabled ? "block" : "none";
		groupContent.style.paddingLeft = "1em";

		// Make header clickable to toggle content
		groupHeader.addEventListener("click", () => {
			const isCurrentlyHidden = groupContent.style.display === "none";
			groupContent.style.display = isCurrentlyHidden ? "block" : "none";
			collapseIndicator.style.transform = isCurrentlyHidden ? "rotate(0deg)" : "rotate(-90deg)";
		});

		// Set initial collapse indicator rotation
		if (!isEnabled) {
			collapseIndicator.style.transform = "rotate(-90deg)";
		}

		// Render fields in the group
		for (const field of fields) {
			this.renderField(groupContent, field);
		}

		// If this group has a toggle key, watch for changes to show/hide the group content
		if (groupToggleKey) {
			// Note: We could add dynamic visibility updates here, but for now
			// the modal will be reopened when saved anyway, which refreshes the visibility
		}
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
