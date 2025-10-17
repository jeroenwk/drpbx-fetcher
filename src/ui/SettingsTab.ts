import { App, Modal, Notice, PluginSettingTab, Setting } from "obsidian";
import type DrpbxFetcherPlugin from "../../main";
import { OAuthManager } from "../auth/OAuthManager";
import { PlatformHelper } from "../utils/platform";
import { ProcessorRegistry } from "../processors/ProcessorRegistry";
import { StreamLogger } from "../utils/StreamLogger";
import { ProcessorConfigModal } from "./ProcessorConfigModal";
import { FileTypeMapping } from "../models/Settings";

export class DrpbxFetcherSettingTab extends PluginSettingTab {
  plugin: DrpbxFetcherPlugin;

  constructor(app: App, plugin: DrpbxFetcherPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    const titleEl = containerEl.createEl("h2", { text: "Dropbox Fetcher Settings" });
    titleEl.style.fontSize = "1.5em";
    titleEl.style.fontWeight = "bold";
    titleEl.style.marginBottom = "1em";

    // Fetch section
    new Setting(containerEl)
      .setName("Fetch now")
      .setDesc("Manually fetch files from Dropbox")
      .addButton((button) =>
        button.setButtonText("Fetch").onClick(async () => {
          await this.plugin.syncFiles();
        })
      );

    // General Settings section
    containerEl.createEl("h3", { text: "General Settings" });

    // Dropbox Authentication Settings (moved to top)
    new Setting(containerEl)
      .setName("Dropbox client ID")
      .setDesc("Enter your Dropbox app client ID")
      .addText((text) =>
        text
          .setPlaceholder("Enter your client ID")
          .setValue(this.plugin.settings.clientId)
          .onChange(async (value) => {
            this.plugin.settings.clientId = value;
            await this.plugin.saveSettings();
            // Reinitialize OAuth manager with new clientId
            if (this.plugin.oauthManager) {
              this.plugin.oauthManager = new OAuthManager(this.plugin, value);
            }
          })
      );

    // Platform indicator
    new Setting(containerEl)
      .setName("Platform")
      .setDesc(`Running on: ${PlatformHelper.getPlatformName()}${PlatformHelper.isMobile() ? " (Mobile)" : ""}`);

    // Authentication
    new Setting(containerEl)
      .setName("Authenticate with Dropbox")
      .setDesc(
        this.plugin.settings.refreshToken
          ? "✓ Connected to Dropbox"
          : PlatformHelper.isMobile()
          ? "Click to authenticate. You'll be redirected to Dropbox in your browser, then back to Obsidian."
          : "Click to start OAuth flow"
      )
      .addButton((button) =>
        button
          .setButtonText(this.plugin.settings.refreshToken ? "Re-authenticate" : "Authenticate")
          .onClick(async () => {
            if (this.plugin.oauthManager) {
              await this.plugin.oauthManager.authenticate();
            }
          })
      );

    if (this.plugin.settings.refreshToken) {
      new Setting(containerEl)
        .setName("Clear Authentication")
        .setDesc("Disconnect from Dropbox")
        .addButton((button) =>
          button.setButtonText("Clear Authentication").onClick(async () => {
            this.plugin.settings.accessToken = "";
            this.plugin.settings.refreshToken = "";
            this.plugin.settings.authInProgress = false;
            await this.plugin.saveSettings();
            this.display();
          })
        );
    }

    new Setting(containerEl)
      .setName("Fetch on startup")
      .setDesc("Automatically fetch files when Obsidian starts")
      .addToggle((toggle) =>
        toggle.setValue(this.plugin.settings.syncOnStartup).onChange(async (value) => {
          this.plugin.settings.syncOnStartup = value;
          await this.plugin.saveSettings();
        })
      );

    new Setting(containerEl)
      .setName("Startup fetch delay")
      .setDesc("Delay in milliseconds before fetching on startup (default: 3000)")
      .addText((text) =>
        text
          .setPlaceholder("3000")
          .setValue(String(this.plugin.settings.syncStartupDelay))
          .onChange(async (value) => {
            const delay = parseInt(value);
            if (!isNaN(delay) && delay >= 0) {
              this.plugin.settings.syncStartupDelay = delay;
              await this.plugin.saveSettings();
            }
          })
      );

    new Setting(containerEl)
      .setName("Mobile file size limit (MB)")
      .setDesc("Maximum file size for mobile devices to prevent crashes. Large files will be skipped on mobile.")
      .addText((text) =>
        text
          .setPlaceholder("10")
          .setValue(String(Math.round(this.plugin.settings.maxFileSizeMobile / (1024 * 1024))))
          .onChange(async (value) => {
            const sizeMB = parseInt(value);
            if (!isNaN(sizeMB) && sizeMB > 0) {
              this.plugin.settings.maxFileSizeMobile = sizeMB * 1024 * 1024;
              await this.plugin.saveSettings();
            }
          })
      );

    new Setting(containerEl)
      .setName("Clear processed files tracking")
      .setDesc("Clears the internal tracking of processed files. Use this after deleting fetched files to allow re-fetching. Note: Modified files (markdown, images, EPUBs) will NOT be overwritten - only files that don't exist will be re-created.")
      .addButton((button) =>
        button
          .setButtonText("Clear tracking")
          .setWarning()
          .onClick(async () => {
            // Show confirmation dialog
            const confirmed = await this.showConfirmDialog(
              "Clear Processed Files Tracking",
              "This will clear the internal tracking of processed files. The next fetch will attempt to reprocess all files, but modified output files (markdown, images, EPUBs) will be preserved.\n\nAre you sure you want to continue?"
            );

            if (confirmed) {
              this.plugin.settings.processedFiles = {};
              await this.plugin.saveSettings();
              new Notice("✓ Processed files tracking cleared");
              console.log("Processed files tracking cleared");
            }
          })
      );

    // Chunked download settings
    containerEl.createEl("h3", { text: "Large File Download Settings" });
    containerEl.createEl("p", {
      text: "Configure chunked download for large files to reduce memory usage. Files above the threshold will be downloaded in smaller chunks.",
      cls: "setting-item-description"
    });

    new Setting(containerEl)
      .setName("Chunked download threshold (MB)")
      .setDesc("Files larger than this size will be downloaded in chunks (default: 10 MB)")
      .addText((text) =>
        text
          .setPlaceholder("10")
          .setValue(String(Math.round(this.plugin.settings.chunkedDownloadThreshold / (1024 * 1024))))
          .onChange(async (value) => {
            const sizeMB = parseInt(value);
            if (!isNaN(sizeMB) && sizeMB > 0) {
              this.plugin.settings.chunkedDownloadThreshold = sizeMB * 1024 * 1024;
              await this.plugin.saveSettings();
            }
          })
      );

    new Setting(containerEl)
      .setName("Chunk size (MB)")
      .setDesc("Size of each download chunk. Smaller chunks use less memory but require more requests (default: 2 MB)")
      .addText((text) =>
        text
          .setPlaceholder("2")
          .setValue(String(Math.round(this.plugin.settings.chunkSizeBytes / (1024 * 1024))))
          .onChange(async (value) => {
            const sizeMB = parseInt(value);
            if (!isNaN(sizeMB) && sizeMB > 0 && sizeMB <= 10) {
              this.plugin.settings.chunkSizeBytes = sizeMB * 1024 * 1024;
              await this.plugin.saveSettings();
            }
          })
      );

    // Logging settings
    containerEl.createEl("h3", { text: "Logging Settings" });

    new Setting(containerEl)
      .setName("Logger type")
      .setDesc("Choose between console logging or network stream logging")
      .addDropdown((dropdown) =>
        dropdown
          .addOption("console", "Console")
          .addOption("stream", "Network Stream")
          .setValue(this.plugin.settings.loggerType)
          .onChange(async (value: "console" | "stream") => {
            this.plugin.settings.loggerType = value;
            await this.plugin.saveSettings();
            // Reinitialize logger with new settings
            const manifest = (this.plugin.app as { plugins?: { manifests?: Record<string, { version?: string }> } }).plugins?.manifests?.["drpbx-fetcher"];
            const version = manifest?.version || "unknown";
            const platform = PlatformHelper.getPlatformName();
            StreamLogger.initialize({
              type: value,
              host: this.plugin.settings.streamLogHost,
              port: this.plugin.settings.streamLogPort,
              version,
              platform,
            });
            this.display(); // Refresh settings to show/hide stream options
          })
      );

    // Show stream logger settings only when stream logging is enabled
    if (this.plugin.settings.loggerType === "stream") {
      new Setting(containerEl)
        .setName("Stream log server host")
        .setDesc("IP address or hostname of the log server (default: localhost)")
        .addText((text) =>
          text
            .setPlaceholder("localhost")
            .setValue(this.plugin.settings.streamLogHost)
            .onChange(async (value) => {
              this.plugin.settings.streamLogHost = value || "localhost";
              await this.plugin.saveSettings();
              // Reinitialize logger with new host
              const manifest = (this.plugin.app as { plugins?: { manifests?: Record<string, { version?: string }> } }).plugins?.manifests?.["drpbx-fetcher"];
              const version = manifest?.version || "unknown";
              const platform = PlatformHelper.getPlatformName();
              StreamLogger.initialize({
                type: this.plugin.settings.loggerType,
                host: this.plugin.settings.streamLogHost,
                port: this.plugin.settings.streamLogPort,
                version,
                platform,
              });
            })
        );

      new Setting(containerEl)
        .setName("Stream log server port")
        .setDesc("Port number of the log server (default: 3000)")
        .addText((text) =>
          text
            .setPlaceholder("3000")
            .setValue(String(this.plugin.settings.streamLogPort))
            .onChange(async (value) => {
              const port = parseInt(value);
              if (!isNaN(port) && port > 0 && port <= 65535) {
                this.plugin.settings.streamLogPort = port;
                await this.plugin.saveSettings();
                // Reinitialize logger with new port
                const manifest = (this.plugin.app as { plugins?: { manifests?: Record<string, { version?: string }> } }).plugins?.manifests?.["drpbx-fetcher"];
                const version = manifest?.version || "unknown";
                const platform = PlatformHelper.getPlatformName();
                StreamLogger.initialize({
                  type: this.plugin.settings.loggerType,
                  host: this.plugin.settings.streamLogHost,
                  port: this.plugin.settings.streamLogPort,
                  version,
                  platform,
                });
              }
            })
        );
    }

    // Folder mappings section
    containerEl.createEl("h3", { text: "Folder Mappings" });
    containerEl.createEl("p", {
      text: "Map Dropbox folders to local paths in your vault. Remote paths should start with /. Local paths are relative to your vault root.",
      cls: "setting-item-description"
    });

    // Display existing mappings
    for (let i = 0; i < this.plugin.settings.folderMappings.length; i++) {
      const mapping = this.plugin.settings.folderMappings[i];
      new Setting(containerEl)
        .setName(`Mapping ${i + 1}`)
        .setDesc(`${mapping.remotePath} → ${mapping.localPath}`)
        .addButton((button) =>
          button.setButtonText("Delete").onClick(async () => {
            this.plugin.settings.folderMappings.splice(i, 1);
            await this.plugin.saveSettings();
            this.display();
          })
        );
    }

    // Add new mapping
    let newRemotePath = "";
    let newLocalPath = "";

    new Setting(containerEl)
      .setName("Add new mapping")
      .setDesc("Add a new folder mapping")
      .addText((text) =>
        text
          .setPlaceholder("Remote path (e.g., /Documents/Notes)")
          .onChange((value) => {
            newRemotePath = value;
          })
      )
      .addText((text) =>
        text
          .setPlaceholder("Local path (e.g., MyNotes)")
          .onChange((value) => {
            newLocalPath = value;
          })
      )
      .addButton((button) =>
        button.setButtonText("Add").onClick(async () => {
          if (!newRemotePath || !newLocalPath) {
            new Notice("Please fill in both remote and local paths");
            return;
          }

          // Ensure remote path starts with /
          if (!newRemotePath.startsWith("/")) {
            newRemotePath = "/" + newRemotePath;
          }

          // Remove leading slash from local path if present
          if (newLocalPath.startsWith("/")) {
            newLocalPath = newLocalPath.slice(1);
          }

          this.plugin.settings.folderMappings.push({
            remotePath: newRemotePath,
            localPath: newLocalPath,
          });
          await this.plugin.saveSettings();
          this.display();
        })
      );

    // Skipped Extensions section
    containerEl.createEl("h3", { text: "Skipped File Extensions" });
    containerEl.createEl("p", {
      text: "File extensions listed here will be completely ignored - not downloaded or processed. Useful for skipping large files like videos, archives, etc.",
      cls: "setting-item-description"
    });

    // Display existing skipped extensions
    if (this.plugin.settings.skippedExtensions.length > 0) {
      for (let i = 0; i < this.plugin.settings.skippedExtensions.length; i++) {
        const ext = this.plugin.settings.skippedExtensions[i];
        new Setting(containerEl)
          .setName(`.${ext}`)
          .setDesc(`Files with this extension will be skipped`)
          .addButton((button) =>
            button.setButtonText("Remove").onClick(async () => {
              this.plugin.settings.skippedExtensions.splice(i, 1);
              await this.plugin.saveSettings();
              this.display();
            })
          );
      }
    }

    // Add new skipped extension
    new Setting(containerEl)
      .setName("Add extension to skip")
      .setDesc("Enter file extension without the dot (e.g., 'mp4', 'zip')")
      .addText((text) => {
        text.setPlaceholder("Extension");
      })
      .addButton((button) =>
        button.setButtonText("Add").onClick(async () => {
          const input = button.buttonEl.parentElement?.querySelector("input[type='text']") as HTMLInputElement;
          const extension = input?.value.trim().toLowerCase().replace(/\./g, "") || "";

          if (!extension) {
            new Notice("Please enter an extension");
            return;
          }

          if (this.plugin.settings.skippedExtensions.includes(extension)) {
            new Notice(`Extension "${extension}" is already in the skip list`);
            return;
          }

          this.plugin.settings.skippedExtensions.push(extension);
          await this.plugin.saveSettings();
          this.display();
          new Notice(`Will skip .${extension} files`);
        })
      );

    // File Processors section
    containerEl.createEl("h3", { text: "File Processors" });
    containerEl.createEl("p", {
      text: "Configure how specific file types are processed. Processors can extract content, generate markdown files, and organize files in your vault.",
      cls: "setting-item-description"
    });

    // Display existing file type mappings
    for (let i = 0; i < this.plugin.settings.fileTypeMappings.length; i++) {
      const mapping = this.plugin.settings.fileTypeMappings[i];
      const registry = ProcessorRegistry.getInstance();
      const processor = registry.getByType(mapping.processorType);
      const processorName = processor ? processor.name : mapping.processorType;

      const setting = new Setting(containerEl)
        .setName(`${mapping.extension} → ${processorName}`)
        .setDesc(processor ? processor.description : "Unknown processor")
        .addToggle((toggle) =>
          toggle.setValue(mapping.enabled).onChange(async (value) => {
            this.plugin.settings.fileTypeMappings[i].enabled = value;
            await this.plugin.saveSettings();
            this.display();
          })
        );

      // Only show "Edit Extension" button for non-viwoods processors
      // Viwoods processor handles multiple extensions internally
      if (mapping.processorType !== "viwoods") {
        setting.addButton((button) =>
          button.setButtonText("Edit Extension").onClick(() => {
            this.editExtension(mapping);
          })
        );
      }

      setting
        .addButton((button) =>
          button.setButtonText("Configure").onClick(() => {
            this.showProcessorConfig(mapping);
          })
        )
        .addButton((button) =>
          button.setButtonText("Delete").onClick(async () => {
            this.plugin.settings.fileTypeMappings.splice(i, 1);
            await this.plugin.saveSettings();
            this.display();
          })
        );
    }

    // Add new file processor mapping
    const registry = ProcessorRegistry.getInstance();
    const processors = registry.listAll();

    new Setting(containerEl)
      .setName("Add file processor")
      .setDesc("Select a processor and specify the file extension to process")
      .addDropdown((dropdown) => {
        processors.forEach((processor) => {
          dropdown.addOption(processor.type, processor.name);
        });
        return dropdown;
      })
      .addText((text) => {
        // Get default extension from selected processor
        const selectedType = processors[0]?.type;
        const selectedProcessor = selectedType ? registry.getByType(selectedType) : null;
        const defaultExt = selectedProcessor?.supportedExtensions[0] || "";

        text
          .setPlaceholder("Extension (e.g., note)")
          .setValue(defaultExt);

        // Update placeholder when dropdown changes
        const dropdown = text.inputEl.parentElement?.parentElement?.querySelector("select");
        if (dropdown) {
          dropdown.addEventListener("change", () => {
            const procType = dropdown.value;
            const proc = registry.getByType(procType);
            const ext = proc?.supportedExtensions[0] || "";
            text.setValue(ext);
          });
        }
      })
      .addButton((button) =>
        button.setButtonText("Add").onClick(async () => {
          const dropdown = button.buttonEl.parentElement?.querySelector("select");
          const extensionInput = button.buttonEl.parentElement?.querySelector("input[type='text']") as HTMLInputElement;

          const processorType = dropdown?.value || processors[0]?.type;
          const extension = extensionInput?.value.trim().toLowerCase().replace(/\./g, "") || "";

          if (!processorType) {
            new Notice("No processors available");
            return;
          }

          if (!extension) {
            new Notice("Please enter a file extension");
            return;
          }

          const processor = registry.getByType(processorType);
          if (!processor) {
            new Notice("Processor not found");
            return;
          }

          // Validate unique extension
          if (!this.validateUniqueExtension(extension)) {
            return;
          }

          // Create new mapping with default config
          const newMapping = {
            id: Date.now().toString(),
            extension: extension,
            processorType: processor.type,
            enabled: true,
            config: processor.getDefaultConfig(),
          };

          this.plugin.settings.fileTypeMappings.push(newMapping);
          await this.plugin.saveSettings();
          this.display();
          new Notice(`Added processor for .${extension} files`);
        })
      );
  }

  /**
   * Validate that an extension is unique among enabled mappings
   * @param extension Extension to validate (without dot)
   * @param excludeMappingId Optional mapping ID to exclude from check (for editing)
   * @returns True if extension is unique
   */
  private validateUniqueExtension(extension: string, excludeMappingId?: string): boolean {
    const normalizedExt = extension.toLowerCase().trim();

    if (!normalizedExt) {
      new Notice("Extension cannot be empty");
      return false;
    }

    const duplicate = this.plugin.settings.fileTypeMappings.find(
      (m) =>
        m.extension.toLowerCase() === normalizedExt &&
        m.enabled &&
        m.id !== excludeMappingId
    );

    if (duplicate) {
      new Notice(`Extension "${extension}" is already used by another enabled processor`);
      return false;
    }

    return true;
  }

  /**
   * Show modal to edit extension for a mapping
   */
  private async editExtension(mapping: FileTypeMapping): Promise<void> {
    const modal = new ExtensionEditModal(
      this.app,
      mapping.extension,
      async (newExtension: string) => {
        if (this.validateUniqueExtension(newExtension, mapping.id)) {
          const index = this.plugin.settings.fileTypeMappings.findIndex(
            (m) => m.id === mapping.id
          );
          if (index !== -1) {
            this.plugin.settings.fileTypeMappings[index].extension = newExtension.toLowerCase().trim();
            await this.plugin.saveSettings();
            this.display();
            new Notice(`Extension updated to "${newExtension}"`);
          }
        }
      }
    );
    modal.open();
  }

  private showProcessorConfig(mapping: FileTypeMapping): void {
    const registry = ProcessorRegistry.getInstance();
    const processor = registry.getByType(mapping.processorType);

    if (!processor) {
      new Notice("Processor not found");
      return;
    }

    // Open configuration modal
    const modal = new ProcessorConfigModal(
      this.app,
      processor,
      mapping.config,
      async (newConfig) => {
        // Find the mapping in settings and update it
        const index = this.plugin.settings.fileTypeMappings.findIndex(
          (m: FileTypeMapping) => m.id === mapping.id
        );
        if (index !== -1) {
          this.plugin.settings.fileTypeMappings[index].config = newConfig;
          await this.plugin.saveSettings();
          // Refresh settings display
          this.display();
        }
      }
    );
    modal.open();
  }

  /**
   * Show a confirmation dialog
   * @param title Dialog title
   * @param message Dialog message
   * @returns Promise that resolves to true if confirmed, false if cancelled
   */
  private showConfirmDialog(title: string, message: string): Promise<boolean> {
    return new Promise((resolve) => {
      const modal = new ConfirmModal(this.app, title, message, (confirmed) => {
        resolve(confirmed);
      });
      modal.open();
    });
  }

}

/**
 * Modal for editing file extension
 */
export class ExtensionEditModal extends Modal {
  private currentExtension: string;
  private onSave: (newExtension: string) => Promise<void>;

  constructor(app: App, currentExtension: string, onSave: (newExtension: string) => Promise<void>) {
    super(app);
    this.currentExtension = currentExtension;
    this.onSave = onSave;
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.empty();

    contentEl.createEl("h2", { text: "Edit File Extension" });

    let extensionInput: HTMLInputElement;

    new Setting(contentEl)
      .setName("File Extension")
      .setDesc("Enter the file extension without the dot (e.g., 'note', 'pdf')")
      .addText((text) => {
        extensionInput = text.inputEl;
        text
          .setValue(this.currentExtension)
          .onChange((value) => {
            // Remove any dots that user might type
            const cleaned = value.replace(/\./g, "");
            if (cleaned !== value) {
              text.setValue(cleaned);
            }
          });
      });

    new Setting(contentEl)
      .addButton((button) =>
        button
          .setButtonText("Save")
          .setCta()
          .onClick(async () => {
            const newExtension = extensionInput.value.trim();
            if (newExtension) {
              await this.onSave(newExtension);
              this.close();
            } else {
              new Notice("Extension cannot be empty");
            }
          })
      )
      .addButton((button) =>
        button.setButtonText("Cancel").onClick(() => {
          this.close();
        })
      );
  }

  onClose() {
    const { contentEl } = this;
    contentEl.empty();
  }
}

/**
 * Modal for confirmation dialogs
 */
export class ConfirmModal extends Modal {
  private title: string;
  private message: string;
  private onConfirm: (confirmed: boolean) => void;

  constructor(app: App, title: string, message: string, onConfirm: (confirmed: boolean) => void) {
    super(app);
    this.title = title;
    this.message = message;
    this.onConfirm = onConfirm;
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.empty();

    contentEl.createEl("h2", { text: this.title });
    contentEl.createEl("p", { text: this.message });

    new Setting(contentEl)
      .addButton((button) =>
        button
          .setButtonText("Continue")
          .setWarning()
          .onClick(() => {
            this.onConfirm(true);
            this.close();
          })
      )
      .addButton((button) =>
        button
          .setButtonText("Cancel")
          .onClick(() => {
            this.onConfirm(false);
            this.close();
          })
      );
  }

  onClose() {
    const { contentEl } = this;
    contentEl.empty();
  }
}
