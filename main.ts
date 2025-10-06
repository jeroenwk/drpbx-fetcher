import { App, Plugin, PluginSettingTab, Setting, Notice, requestUrl, RequestUrlParam, RequestUrlResponse, TFolder } from "obsidian";
import { Dropbox, files } from "dropbox";
import { OAuthManager } from "./src/auth/OAuthManager";
import { PlatformHelper } from "./src/utils/platform";

interface FolderMapping {
  remotePath: string;
  localPath: string;
}

interface DrpbxFetcherSettings {
  accessToken: string;
  refreshToken: string;
  clientId: string;
  codeVerifier: string;
  folderMappings: FolderMapping[];
  // Mobile auth state
  authInProgress: boolean;
}

const DEFAULT_SETTINGS: DrpbxFetcherSettings = {
  accessToken: "",
  refreshToken: "",
  clientId: "",
  codeVerifier: "",
  folderMappings: [],
  authInProgress: false,
};

export default class DrpbxFetcherPlugin extends Plugin {
  settings: DrpbxFetcherSettings;
  dbx: Dropbox | null = null;
  private isSyncing: boolean = false;
  oauthManager: OAuthManager | null = null;
  settingsTab: DrpbxFetcherSettingTab | null = null;

  // Pure function to create a fetch-compatible response from Obsidian's RequestUrlResponse
  private static createFetchResponse(response: RequestUrlResponse): Response {
    return {
      ok: response.status >= 200 && response.status < 300,
      status: response.status,
      statusText: response.status.toString(),
      headers: new Headers(response.headers),
      // Convert methods to proper async functions that return promises
      json: async () => Promise.resolve(response.json),
      text: async () => Promise.resolve(response.text),
      arrayBuffer: async () => Promise.resolve(response.arrayBuffer),
      blob: async () => {
        // Create a Blob from the arrayBuffer
        const buffer = response.arrayBuffer;
        const contentType = response.headers["content-type"] || "application/octet-stream";
        return new Blob([buffer], { type: contentType });
      },
    } as unknown as Response;
  }

  private async getDropboxClient(): Promise<Dropbox> {
    if (!this.settings.clientId) {
      throw new Error("Dropbox client ID not set. Please set it in the plugin settings.");
    }

    // If we have a refresh token, use it to get a new access token
    if (this.settings.refreshToken) {
      try {
        const response = await requestUrl({
          url: "https://api.dropbox.com/oauth2/token",
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: new URLSearchParams({
            grant_type: "refresh_token",
            refresh_token: this.settings.refreshToken,
            client_id: this.settings.clientId,
          }).toString(),
        });

        if (response.status === 200) {
          const data = response.json;
          this.settings.accessToken = data.access_token;
          await this.saveSettings();
        }
      } catch (error) {
        console.error("Error refreshing access token:", error);
      }
    }

    if (!this.settings.accessToken) {
      throw new Error("No valid Dropbox access token available. Please authenticate through the plugin settings.");
    }

    // Create a fetch-compatible function using Obsidian's requestUrl
    const obsidianFetch = async (url: string, init?: RequestInit): Promise<Response> => {
      try {
        // Create options object for requestUrl from fetch parameters
        const options: RequestUrlParam = {
          url,
          method: init?.method || "GET",
          headers: init?.headers as Record<string, string>,
          body: init?.body as string,
        };

        const response = await requestUrl(options);

        // Use the pure function to create a Response-like object
        return DrpbxFetcherPlugin.createFetchResponse(response);
      } catch (error) {
        console.error("Error in obsidianFetch:", error);
        throw error;
      }
    };

    return new Dropbox({
      accessToken: this.settings.accessToken,
      fetch: obsidianFetch,
    });
  }

  // Async function to fetch all files from Dropbox with pagination
  private async getAllFiles(dbx: Dropbox, folderPath: string): Promise<(files.FileMetadataReference | files.FolderMetadataReference | files.DeletedMetadataReference)[]> {
    let allFiles: (files.FileMetadataReference | files.FolderMetadataReference | files.DeletedMetadataReference)[] = [];
    let hasMore = true;
    let cursor: string | undefined;

    while (hasMore) {
      const response = cursor
        ? await dbx.filesListFolderContinue({ cursor })
        : await dbx.filesListFolder({
            path: folderPath,
            recursive: true,
            limit: 1000,
          });

      allFiles = allFiles.concat(response.result.entries);
      hasMore = response.result.has_more;
      cursor = response.result.cursor;
    }

    return allFiles;
  }

  // Sync files from Dropbox to Obsidian vault
  async syncFiles(): Promise<void> {
    if (this.isSyncing) {
      new Notice("Sync already in progress");
      return;
    }

    if (this.settings.folderMappings.length === 0) {
      new Notice("No folder mappings configured. Please add mappings in settings.");
      return;
    }

    this.isSyncing = true;
    new Notice("Starting Dropbox sync...");

    try {
      const dbx = await this.getDropboxClient();
      let totalFiles = 0;
      let syncedFiles = 0;

      for (const mapping of this.settings.folderMappings) {
        try {
          console.log(`Syncing ${mapping.remotePath} to ${mapping.localPath}`);

          // Validate remote path format
          if (!mapping.remotePath.startsWith("/")) {
            throw new Error(`Remote path must start with /: ${mapping.remotePath}`);
          }

          // Get all files from Dropbox folder
          const entries = await this.getAllFiles(dbx, mapping.remotePath);

          // Filter only files (not folders)
          const files = entries.filter((entry) => entry[".tag"] === "file") as files.FileMetadata[];
          totalFiles += files.length;

          // Ensure local folder exists
          const localFolder = mapping.localPath.startsWith("/")
            ? mapping.localPath.slice(1)
            : mapping.localPath;

          try {
            await this.app.vault.createFolder(localFolder);
          } catch (error) {
            // Folder might already exist, that's okay
          }

          // Download and save each file
          for (const file of files) {
            try {
              // Get relative path from the remote folder, preserving case
              // Use path_display to keep original capitalization
              const remoteFolderRegex = new RegExp("^" + mapping.remotePath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), "i");
              const relativePath = file.path_display!.replace(remoteFolderRegex, "");
              const localFilePath = localFolder + relativePath;

              // Ensure parent directories exist
              const parentPath = localFilePath.substring(0, localFilePath.lastIndexOf("/"));
              if (parentPath) {
                try {
                  await this.app.vault.createFolder(parentPath);
                } catch (error) {
                  // Folder might already exist
                }
              }

              // Download file from Dropbox
              console.log(`Downloading: ${file.path_display}`);
              const response = await dbx.filesDownload({ path: file.path_lower! });
              const fileBlob = (response.result as any).fileBlob as Blob;
              const arrayBuffer = await fileBlob.arrayBuffer();
              const uint8Array = new Uint8Array(arrayBuffer);

              // Check if THIS EXACT file already exists with same size
              let shouldWrite = true;
              try {
                const existingFile = this.app.vault.getAbstractFileByPath(localFilePath);
                if (existingFile && existingFile instanceof TFolder === false) {
                  const stat = await this.app.vault.adapter.stat(localFilePath);
                  if (stat && stat.size === file.size) {
                    // File exists with same name and same size - skip download
                    shouldWrite = false;
                    console.log(`Skipping ${localFilePath} - already exists with same size (${file.size} bytes)`);
                  } else {
                    console.log(`Updating ${localFilePath} - size changed (old: ${stat?.size}, new: ${file.size})`);
                  }
                }
              } catch (error) {
                // File doesn't exist, we should write it
                console.log(`Creating new file: ${localFilePath}`);
              }

              if (shouldWrite) {
                // Write file to vault
                const existingFile = this.app.vault.getAbstractFileByPath(localFilePath);
                if (existingFile) {
                  await this.app.vault.adapter.writeBinary(localFilePath, uint8Array);
                } else {
                  await this.app.vault.createBinary(localFilePath, uint8Array);
                }
                syncedFiles++;
                console.log(`✓ Synced: ${localFilePath} (${file.size} bytes)`);
              }
            } catch (error: any) {
              console.error(`Error syncing file ${file.path_display}:`, error);
              console.error(`  - Status: ${error.status}`);
              console.error(`  - Message: ${error.message}`);
              if (error.error) {
                console.error(`  - Dropbox error:`, error.error);
              }
            }
          }
        } catch (error: any) {
          console.error(`Error syncing folder ${mapping.remotePath}:`, error);

          // Provide more helpful error messages for common issues
          let errorMsg = error.message;
          if (error.status === 409) {
            errorMsg = `Path not found or inaccessible: ${mapping.remotePath}. Please verify the path exists in your Dropbox and check spelling/case.`;
          } else if (error.status === 401) {
            errorMsg = `Authentication failed. Please re-authenticate in plugin settings.`;
          } else if (error.status === 403) {
            errorMsg = `Permission denied. Check app permissions in Dropbox settings.`;
          }

          new Notice(`Error syncing ${mapping.remotePath}: ${errorMsg}`);
        }
      }

      new Notice(`Sync complete: ${syncedFiles} files synced (${totalFiles} total)`);
    } catch (error) {
      console.error("Sync error:", error);
      new Notice(`Sync failed: ${error.message}`);
    } finally {
      this.isSyncing = false;
    }
  }

  async onload() {
    await this.loadSettings();

    // Initialize OAuth manager
    this.oauthManager = new OAuthManager(this, this.settings.clientId);

    // Register protocol handler for mobile OAuth callback
    this.registerObsidianProtocolHandler("dropbox-callback", async (params) => {
      if (PlatformHelper.isMobile() && this.oauthManager) {
        await this.oauthManager.handleMobileCallback(params);
      }
    });

    // Add settings tab
    this.settingsTab = new DrpbxFetcherSettingTab(this.app, this);
    this.addSettingTab(this.settingsTab);

    // Add ribbon icon
    this.addRibbonIcon("sync", "Sync Dropbox files", async () => {
      await this.syncFiles();
    });

    // Add command
    this.addCommand({
      id: "sync-dropbox-files",
      name: "Sync Dropbox files",
      callback: async () => {
        await this.syncFiles();
      },
    });

    // Sync on startup if configured
    if (this.settings.folderMappings.length > 0 && this.settings.accessToken) {
      // Delay initial sync to allow Obsidian to fully load
      setTimeout(async () => {
        console.log("Running initial Dropbox sync...");
        await this.syncFiles();
      }, 3000);
    }
  }

  onunload() {
    // Cleanup OAuth manager
    if (this.oauthManager) {
      this.oauthManager.cleanup();
    }
  }

  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  async saveSettings() {
    await this.saveData(this.settings);
  }
}

class DrpbxFetcherSettingTab extends PluginSettingTab {
  plugin: DrpbxFetcherPlugin;

  constructor(app: App, plugin: DrpbxFetcherPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    containerEl.createEl("h2", { text: "Dropbox Fetcher Settings" });

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

    // Manual sync button
    new Setting(containerEl)
      .setName("Sync now")
      .setDesc("Manually trigger a sync of all configured folders")
      .addButton((button) =>
        button.setButtonText("Sync").onClick(async () => {
          await this.plugin.syncFiles();
        })
      );
  }

}
