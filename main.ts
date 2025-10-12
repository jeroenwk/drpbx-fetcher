import { App, Plugin, PluginSettingTab, Setting, Notice, requestUrl, RequestUrlParam, RequestUrlResponse, TFolder, Modal } from "obsidian";
import { Dropbox, files } from "dropbox";
import { OAuthManager } from "./src/auth/OAuthManager";
import { PlatformHelper } from "./src/utils/platform";
import { DrpbxFetcherSettings, DEFAULT_SETTINGS } from "./src/models/Settings";
import { ProcessorRegistry } from "./src/processors/ProcessorRegistry";
import { DefaultProcessor } from "./src/processors/DefaultProcessor";
import { ViwoodsProcessor } from "./src/processors/ViwoodsProcessor";
import { FileUtils } from "./src/utils/FileUtils";
import { TemplateResolver } from "./src/processors/templates/TemplateResolver";
import { ProcessorConfigModal } from "./src/ui/ProcessorConfigModal";
import { FileTypeMapping } from "./src/models/Settings";
import { StreamLogger } from "./src/utils/StreamLogger";
import { TempFileManager } from "./src/utils/TempFileManager";

export default class DrpbxFetcherPlugin extends Plugin {
  settings: DrpbxFetcherSettings;
  dbx: Dropbox | null = null;
  private isSyncing = false;
  oauthManager: OAuthManager | null = null;
  settingsTab: DrpbxFetcherSettingTab | null = null;
  tempFileManager: TempFileManager | null = null;
  private statusBarItem: HTMLElement | null = null;

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
        const headersObj = init?.headers as Record<string, string> || {};

        // Android fix: Dropbox API requires specific Content-Type headers
        // Android's requestUrl automatically adds "application/x-www-form-urlencoded" for POST
        // but Dropbox expects "application/octet-stream" or "text/plain"
        if (PlatformHelper.isAndroid() && init?.method === "POST" && url.includes("dropboxapi.com")) {
          if (!headersObj["Content-Type"]) {
            headersObj["Content-Type"] = "application/octet-stream";
          }
        }

        const options: RequestUrlParam = {
          url,
          method: init?.method || "GET",
          headers: headersObj,
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

  /**
   * Download a file from Dropbox in chunks using Range requests
   * This approach uses much less memory than downloading the entire file at once
   * @param filePath Dropbox file path
   * @param fileSize Total file size in bytes
   * @param chunkSize Size of each chunk in bytes
   * @returns Uint8Array containing the complete file data
   */
  private async downloadFileInChunks(
    filePath: string,
    fileSize: number,
    chunkSize: number
  ): Promise<Uint8Array> {
    StreamLogger.log(`[DrpbxFetcher] Starting chunked download`, {
      filePath,
      fileSize,
      chunkSize,
      totalChunks: Math.ceil(fileSize / chunkSize)
    });

    // Create array to hold the complete file
    const completeFile = new Uint8Array(fileSize);
    let downloadedBytes = 0;
    let chunkNumber = 0;
    const totalChunks = Math.ceil(fileSize / chunkSize);

    while (downloadedBytes < fileSize) {
      const start = downloadedBytes;
      const end = Math.min(start + chunkSize - 1, fileSize - 1);
      chunkNumber++;

      StreamLogger.log(`[DrpbxFetcher] Downloading chunk ${chunkNumber}/${totalChunks}`, {
        start,
        end,
        chunkBytes: end - start + 1,
        progress: `${((downloadedBytes / fileSize) * 100).toFixed(1)}%`
      });

      try {
        // Make direct HTTP request with Range header
        // We need to bypass the Dropbox SDK and use direct API calls for Range support
        const accessToken = this.settings.accessToken;

        // Android fix: Dropbox API requires specific Content-Type headers
        // Android's requestUrl automatically adds "application/x-www-form-urlencoded" for POST
        // but Dropbox expects "application/octet-stream" or "text/plain"
        const headers: Record<string, string> = {
          "Authorization": `Bearer ${accessToken}`,
          "Dropbox-API-Arg": JSON.stringify({ path: filePath }),
          "Range": `bytes=${start}-${end}`,
        };

        if (PlatformHelper.isAndroid()) {
          headers["Content-Type"] = "application/octet-stream";
        }

        const response = await requestUrl({
          url: "https://content.dropboxapi.com/2/files/download",
          method: "POST",
          headers,
        });

        if (response.status !== 206 && response.status !== 200) {
          throw new Error(`Chunk download failed with status ${response.status}`);
        }

        // Get chunk data from response
        const chunkData = new Uint8Array(response.arrayBuffer);

        // Verify chunk size
        const expectedSize = end - start + 1;
        if (chunkData.length !== expectedSize) {
          StreamLogger.warn(`[DrpbxFetcher] Chunk size mismatch`, {
            expected: expectedSize,
            received: chunkData.length
          });
        }

        // Copy chunk into complete file array
        completeFile.set(chunkData, start);
        downloadedBytes += chunkData.length;

        StreamLogger.log(`[DrpbxFetcher] Chunk ${chunkNumber}/${totalChunks} complete`, {
          downloadedBytes,
          totalBytes: fileSize,
          progress: `${((downloadedBytes / fileSize) * 100).toFixed(1)}%`
        });

      } catch (error: any) {
        StreamLogger.error(`[DrpbxFetcher] Chunk download failed`, {
          chunkNumber,
          start,
          end,
          error: error.message
        });
        throw new Error(`Failed to download chunk ${chunkNumber}/${totalChunks}: ${error.message}`);
      }
    }

    StreamLogger.log(`[DrpbxFetcher] Chunked download complete`, {
      filePath,
      totalBytes: downloadedBytes,
      totalChunks
    });

    return completeFile;
  }

  /**
   * Download a file from Dropbox in chunks directly to disk
   * This approach uses minimal memory by writing chunks as they arrive
   * @param filePath Dropbox file path
   * @param fileSize Total file size in bytes
   * @param chunkSize Size of each chunk in bytes
   * @param tempFileManager Temp file manager instance
   * @returns Path to temporary file containing the downloaded data
   */
  private async downloadFileInChunksToDisk(
    filePath: string,
    fileSize: number,
    chunkSize: number,
    tempFileManager: TempFileManager
  ): Promise<string> {
    StreamLogger.log(`[DrpbxFetcher] Starting chunked download to disk`, {
      filePath,
      fileSize,
      chunkSize,
      totalChunks: Math.ceil(fileSize / chunkSize)
    });

    // Generate temp file path
    const tempPath = tempFileManager.getTempFilePath("download", "tmp");
    await tempFileManager.ensureTempDir();

    let downloadedBytes = 0;
    let chunkNumber = 0;
    const totalChunks = Math.ceil(fileSize / chunkSize);

    try {
      while (downloadedBytes < fileSize) {
        const start = downloadedBytes;
        const end = Math.min(start + chunkSize - 1, fileSize - 1);
        chunkNumber++;

        StreamLogger.log(`[DrpbxFetcher] Downloading chunk ${chunkNumber}/${totalChunks} to disk`, {
          start,
          end,
          chunkBytes: end - start + 1,
          progress: `${((downloadedBytes / fileSize) * 100).toFixed(1)}%`
        });

        try {
          // Make direct HTTP request with Range header
          const accessToken = this.settings.accessToken;

          // Android fix: Dropbox API requires specific Content-Type headers
          const headers: Record<string, string> = {
            "Authorization": `Bearer ${accessToken}`,
            "Dropbox-API-Arg": JSON.stringify({ path: filePath }),
            "Range": `bytes=${start}-${end}`,
          };

          if (PlatformHelper.isAndroid()) {
            headers["Content-Type"] = "application/octet-stream";
          }

          const response = await requestUrl({
            url: "https://content.dropboxapi.com/2/files/download",
            method: "POST",
            headers,
          });

          if (response.status !== 206 && response.status !== 200) {
            throw new Error(`Chunk download failed with status ${response.status}`);
          }

          // Get chunk data and write to disk immediately
          const chunkData = new Uint8Array(response.arrayBuffer);

          // Append chunk to temp file
          await tempFileManager.append(tempPath, chunkData);
          downloadedBytes += chunkData.length;

          StreamLogger.log(`[DrpbxFetcher] Chunk ${chunkNumber}/${totalChunks} written to disk`, {
            downloadedBytes,
            totalBytes: fileSize,
            progress: `${((downloadedBytes / fileSize) * 100).toFixed(1)}%`,
            tempFileSize: await tempFileManager.getSize(tempPath)
          });

        } catch (error: any) {
          StreamLogger.error(`[DrpbxFetcher] Chunk download failed`, {
            chunkNumber,
            start,
            end,
            error: error.message
          });
          // Clean up partial temp file on error
          await tempFileManager.delete(tempPath);
          throw new Error(`Failed to download chunk ${chunkNumber}/${totalChunks}: ${error.message}`);
        }
      }

      StreamLogger.log(`[DrpbxFetcher] Chunked download to disk complete`, {
        filePath,
        totalBytes: downloadedBytes,
        totalChunks,
        tempPath,
        tempFileSize: await tempFileManager.getSize(tempPath)
      });

      return tempPath;
    } catch (error) {
      // Ensure cleanup on any error
      await tempFileManager.delete(tempPath);
      throw error;
    }
  }

  // Fetch files from Dropbox to Obsidian vault
  async syncFiles(): Promise<void> {
    if (this.isSyncing) {
      if (this.statusBarItem) {
        this.statusBarItem.setText("⏳ Fetch already in progress");
      }
      return;
    }

    if (this.settings.folderMappings.length === 0) {
      if (this.statusBarItem) {
        this.statusBarItem.setText("❌ No folder mappings configured");
        setTimeout(() => {
          if (this.statusBarItem) this.statusBarItem.setText("");
        }, 5000);
      }
      return;
    }

    this.isSyncing = true;
    if (this.statusBarItem) {
      this.statusBarItem.setText("⏳ Fetching from Dropbox...");
    }
    StreamLogger.log("[DrpbxFetcher] Starting fetch...", {
      folderMappings: this.settings.folderMappings.length
    });

    try {
      const dbx = await this.getDropboxClient();
      let totalSourceFiles = 0;
      let processedSourceFiles = 0;
      let createdFiles = 0;
      let regularFiles = 0;
      let skippedFiles = 0;
      let skippedProcessors = 0;

      for (const mapping of this.settings.folderMappings) {
        try {
          console.log(`Syncing ${mapping.remotePath} to ${mapping.localPath}`);
          StreamLogger.log(`[DrpbxFetcher] Syncing folder mapping`, {
            remotePath: mapping.remotePath,
            localPath: mapping.localPath
          });

          // Validate remote path format
          if (!mapping.remotePath.startsWith("/")) {
            throw new Error(`Remote path must start with /: ${mapping.remotePath}`);
          }

          // Get all files from Dropbox folder
          const entries = await this.getAllFiles(dbx, mapping.remotePath);

          // Filter only files (not folders)
          const files = entries.filter((entry) => entry[".tag"] === "file") as files.FileMetadata[];
          totalSourceFiles += files.length;
          StreamLogger.log(`[DrpbxFetcher] Found ${files.length} files in folder`, {
            remotePath: mapping.remotePath,
            fileCount: files.length
          });

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
          StreamLogger.log(`[DrpbxFetcher] Processing ${files.length} files...`);
          for (let i = 0; i < files.length; i++) {
            const file = files[i];
            try {
              // Update status bar with progress
              if (this.statusBarItem) {
                this.statusBarItem.setText(`⏳ Fetching... ${i + 1}/${files.length} files`);
              }

              StreamLogger.log(`[DrpbxFetcher] Processing file ${i + 1}/${files.length}`, {
                fileName: file.name,
                size: file.size,
                path: file.path_display
              });

              // Check if this file extension should be skipped
              const fileExtension = FileUtils.getExtension(file.name);
              if (this.settings.skippedExtensions.includes(fileExtension.toLowerCase())) {
                console.log(`Skipping ${file.name} - extension .${fileExtension} is in skip list`);
                StreamLogger.log(`[DrpbxFetcher] Skipping file (extension in skip list)`, {
                  fileName: file.name,
                  extension: fileExtension
                });
                skippedFiles++;
                continue;
              }

              // Check file size limit on mobile platforms
              if (PlatformHelper.isMobile() && file.size > this.settings.maxFileSizeMobile) {
                const sizeMB = (file.size / (1024 * 1024)).toFixed(2);
                const limitMB = (this.settings.maxFileSizeMobile / (1024 * 1024)).toFixed(0);
                console.log(`Skipping ${file.name} - file too large for mobile (${sizeMB} MB > ${limitMB} MB limit)`);
                StreamLogger.warn(`[DrpbxFetcher] Skipping file (too large for mobile)`, {
                  fileName: file.name,
                  fileSizeMB: sizeMB,
                  limitMB: limitMB,
                  platform: PlatformHelper.getPlatformName()
                });
                skippedFiles++;
                continue;
              }

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

              // Download file from Dropbox - use chunked download for large files
              console.log(`Downloading: ${file.path_display}`);

              let uint8Array: Uint8Array;
              const useChunkedDownload = file.size >= this.settings.chunkedDownloadThreshold;

              if (useChunkedDownload) {
                StreamLogger.log(`[DrpbxFetcher] Using chunked download for large file`, {
                  fileName: file.name,
                  size: file.size,
                  sizeMB: (file.size / (1024 * 1024)).toFixed(2),
                  chunkSizeMB: (this.settings.chunkSizeBytes / (1024 * 1024)).toFixed(2)
                });
                uint8Array = await this.downloadFileInChunks(
                  file.path_lower!,
                  file.size,
                  this.settings.chunkSizeBytes
                );
              } else {
                StreamLogger.log(`[DrpbxFetcher] Downloading file...`, {
                  fileName: file.name,
                  size: file.size
                });
                const response = await dbx.filesDownload({ path: file.path_lower! });
                StreamLogger.log(`[DrpbxFetcher] Download complete, converting to buffer...`);
                const fileBlob = (response.result as any).fileBlob as Blob;
                const arrayBuffer = await fileBlob.arrayBuffer();
                uint8Array = new Uint8Array(arrayBuffer);
                StreamLogger.log(`[DrpbxFetcher] Buffer ready`, { bytes: uint8Array.length });
              }

              // Check if file should be processed by a processor
              const registry = ProcessorRegistry.getInstance();
              const processor = registry.getByExtension(fileExtension, this.settings.fileTypeMappings);

              if (processor) {
                // Use processor
                console.log(`Processing ${file.name} with ${processor.name}`);
                StreamLogger.log(`[DrpbxFetcher] Found processor for file`, {
                  fileName: file.name,
                  processorName: processor.name,
                  extension: fileExtension
                });
                const mapping = this.settings.fileTypeMappings.find(
                  (m) => m.extension.toLowerCase() === fileExtension.toLowerCase() && m.enabled
                );

                if (mapping) {
                  // Check if this file was already processed with same size (skip to preserve user edits)
                  let shouldProcess = true;
                  const fileId = file.id; // Unique Dropbox file ID

                  if (this.settings.processedFiles[fileId] === file.size) {
                    // File already processed with same size - skip to preserve user edits
                    shouldProcess = false;
                    skippedProcessors++;
                    console.log(`Skipping ${file.name} - already processed (${file.size} bytes)`);
                  } else if (this.settings.processedFiles[fileId]) {
                    // File exists but size changed - reprocess
                    console.log(`Reprocessing ${file.name} - changed (old: ${this.settings.processedFiles[fileId]}, new: ${file.size})`);
                  } else {
                    // New file - process it
                    console.log(`Processing new file: ${file.name}`);
                  }

                  if (shouldProcess) {
                    try {
                      StreamLogger.log(`[DrpbxFetcher] Starting processor...`, {
                        fileName: file.name,
                        processor: processor.name
                      });
                      const templateResolver = new TemplateResolver(this.app.vault);
                      const result = await processor.process(
                        uint8Array,
                        file.path_display!,
                        file,
                        mapping.config,
                        {
                          vault: this.app.vault,
                          app: this.app,
                          templateResolver,
                          pluginSettings: this.settings,
                        }
                      );
                      StreamLogger.log(`[DrpbxFetcher] Processor completed`, {
                        fileName: file.name,
                        success: result.success,
                        createdFiles: result.createdFiles?.length || 0
                      });

                      if (result.success) {
                        processedSourceFiles++;
                        createdFiles += result.createdFiles.length;
                        // Track successful processing
                        this.settings.processedFiles[fileId] = file.size;
                        await this.saveSettings();
                        console.log(`✓ Processed: ${result.createdFiles.length} files created`);
                        if (result.warnings && result.warnings.length > 0) {
                          console.warn(`Warnings: ${result.warnings.join(", ")}`);
                          StreamLogger.warn(`[DrpbxFetcher] Processor warnings`, {
                            warnings: result.warnings
                          });
                        }
                      } else {
                        console.error(`✗ Processing failed: ${result.errors?.join(", ")}`);
                        StreamLogger.error(`[DrpbxFetcher] Processor failed`, {
                          fileName: file.name,
                          errors: result.errors
                        });
                      }
                    } catch (procError: any) {
                      console.error(`Error processing file with ${processor.name}:`, procError);
                      StreamLogger.error(`[DrpbxFetcher] Processor exception`, {
                        fileName: file.name,
                        processor: processor.name,
                        error: procError.message,
                        stack: procError.stack
                      });
                    }
                  }
                  continue; // Skip default file handling
                }
              }

              // Default file handling (no processor)
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
                regularFiles++;
                console.log(`✓ Synced: ${localFilePath} (${file.size} bytes)`);
              }
            } catch (error: any) {
              console.error(`Error syncing file ${file.path_display}:`, error);
              console.error(`  - Status: ${error.status}`);
              console.error(`  - Message: ${error.message}`);
              if (error.error) {
                console.error(`  - Dropbox error:`, error.error);
              }
              StreamLogger.error(`[DrpbxFetcher] File sync error`, {
                fileName: file.name,
                path: file.path_display,
                error: error.message,
                status: error.status,
                stack: error.stack
              });
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

          if (this.statusBarItem) {
            this.statusBarItem.setText(`❌ Error: ${errorMsg}`);
            setTimeout(() => {
              if (this.statusBarItem) this.statusBarItem.setText("");
            }, 8000);
          }
        }
      }

      // Build summary message
      const totalOutputFiles = createdFiles + regularFiles;
      let summary = `✓ Fetch complete: ${totalSourceFiles} source files`;

      if (processedSourceFiles > 0 && regularFiles > 0) {
        // Mixed: some processed, some regular
        summary += ` → ${totalOutputFiles} files (${processedSourceFiles} processed → ${createdFiles} created, ${regularFiles} copied)`;
      } else if (processedSourceFiles > 0) {
        // Only processed files
        summary += ` → ${createdFiles} files created`;
      } else if (regularFiles > 0) {
        // Only regular files
        summary += ` → ${regularFiles} files copied`;
      }

      if (skippedFiles > 0) {
        summary += `, ${skippedFiles} skipped`;
      }

      if (skippedProcessors > 0) {
        summary += ` (${skippedProcessors} already processed)`;
      }

      if (this.statusBarItem) {
        this.statusBarItem.setText(summary);
        // Clear after 10 seconds
        setTimeout(() => {
          if (this.statusBarItem) this.statusBarItem.setText("");
        }, 10000);
      }

      StreamLogger.log("[DrpbxFetcher] Fetch completed successfully", {
        totalSourceFiles,
        processedSourceFiles,
        createdFiles,
        regularFiles,
        skippedFiles,
        skippedProcessors,
        summary
      });
    } catch (error) {
      console.error("Fetch error:", error);
      StreamLogger.error("[DrpbxFetcher] Fetch failed", error);
      if (this.statusBarItem) {
        this.statusBarItem.setText(`❌ Fetch failed: ${error.message}`);
        setTimeout(() => {
          if (this.statusBarItem) this.statusBarItem.setText("");
        }, 10000);
      }
    } finally {
      this.isSyncing = false;
    }
  }

  async onload() {
    await this.loadSettings();

    // Initialize status bar item
    this.statusBarItem = this.addStatusBarItem();
    this.statusBarItem.setText("");

    // Initialize temp file manager
    this.tempFileManager = new TempFileManager(this.app.vault);
    await this.tempFileManager.ensureTempDir();

    // Initialize stream logger
    const manifest = (this.app as any).plugins?.manifests?.["drpbx-fetcher"];
    const version = manifest?.version || "unknown";
    const platform = PlatformHelper.getPlatformName();

    StreamLogger.initialize({
      type: this.settings.loggerType,
      host: this.settings.streamLogHost,
      port: this.settings.streamLogPort,
      version,
      platform,
    });
    StreamLogger.log("[DrpbxFetcher] Plugin loading...");
    StreamLogger.log("[DrpbxFetcher] User Agent", { userAgent: navigator.userAgent });

    // Register file processors
    const registry = ProcessorRegistry.getInstance();
    registry.register(new DefaultProcessor());
    registry.register(new ViwoodsProcessor());
    console.log("Registered file processors:", registry.listAll().map(p => p.name).join(", "));
    StreamLogger.log("[DrpbxFetcher] Registered file processors:", { processors: registry.listAll().map(p => p.name) });

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
    this.addRibbonIcon("download", "Fetch Dropbox files", async () => {
      await this.syncFiles();
    });

    // Add command
    this.addCommand({
      id: "sync-dropbox-files",
      name: "Fetch Dropbox files",
      callback: async () => {
        await this.syncFiles();
      },
    });

    // Fetch on startup if configured
    if (this.settings.syncOnStartup && this.settings.folderMappings.length > 0 && this.settings.accessToken) {
      // Delay initial fetch to allow Obsidian to fully load
      StreamLogger.log(`[DrpbxFetcher] Scheduling startup fetch with ${this.settings.syncStartupDelay}ms delay...`);
      setTimeout(async () => {
        console.log("Running initial Dropbox fetch...");
        StreamLogger.log("[DrpbxFetcher] Running startup fetch...");
        await this.syncFiles();
      }, this.settings.syncStartupDelay);
    } else {
      StreamLogger.log("[DrpbxFetcher] Startup fetch disabled or not configured");
    }
  }

  async onunload() {
    // Cleanup OAuth manager
    if (this.oauthManager) {
      this.oauthManager.cleanup();
    }

    // Cleanup temp files
    if (this.tempFileManager) {
      await this.tempFileManager.cleanupAll();
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
      .setName("Download source files")
      .setDesc("Download source files (.epub, .note) to Sources folder.")
      .addToggle((toggle) =>
        toggle.setValue(this.plugin.settings.downloadSourceFiles).onChange(async (value) => {
          this.plugin.settings.downloadSourceFiles = value;
          await this.plugin.saveSettings();
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
            const manifest = (this.plugin.app as any).plugins?.manifests?.["drpbx-fetcher"];
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
              const manifest = (this.plugin.app as any).plugins?.manifests?.["drpbx-fetcher"];
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
                const manifest = (this.plugin.app as any).plugins?.manifests?.["drpbx-fetcher"];
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

      new Setting(containerEl)
        .setName(`${mapping.extension} → ${processorName}`)
        .setDesc(processor ? processor.description : "Unknown processor")
        .addToggle((toggle) =>
          toggle.setValue(mapping.enabled).onChange(async (value) => {
            this.plugin.settings.fileTypeMappings[i].enabled = value;
            await this.plugin.saveSettings();
            this.display();
          })
        )
        .addButton((button) =>
          button.setButtonText("Edit Extension").onClick(() => {
            this.editExtension(mapping);
          })
        )
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

}

/**
 * Modal for editing file extension
 */
class ExtensionEditModal extends Modal {
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
