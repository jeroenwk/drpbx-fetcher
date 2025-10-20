import { Plugin, requestUrl, RequestUrlParam, RequestUrlResponse, TFolder, TFile } from "obsidian";
import { Dropbox, files } from "dropbox";
import { OAuthManager } from "./src/auth/OAuthManager";
import { PlatformHelper } from "./src/utils/platform";
import { DrpbxFetcherSettings, DEFAULT_SETTINGS, ViwoodsNoteMetadata } from "./src/models/Settings";
import { ProcessorRegistry } from "./src/processors/ProcessorRegistry";
import { DefaultProcessor } from "./src/processors/DefaultProcessor";
import { ViwoodsProcessor } from "./src/processors/ViwoodsProcessor/index";
import { FileUtils } from "./src/utils/FileUtils";
import { TemplateResolver } from "./src/processors/templates/TemplateResolver";
import { StreamLogger } from "./src/utils/StreamLogger";
import { TempFileManager } from "./src/utils/TempFileManager";
import { DrpbxFetcherSettingTab } from "./src/ui/SettingsTab";
import { MetadataManager } from "./src/utils/MetadataManager";

export default class DrpbxFetcherPlugin extends Plugin {
  settings: DrpbxFetcherSettings;
  dbx: Dropbox | null = null;
  private isSyncing = false;
  oauthManager: OAuthManager | null = null;
  settingsTab: DrpbxFetcherSettingTab | null = null;
  tempFileManager: TempFileManager | null = null;
  metadataManager: MetadataManager | null = null;
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

      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        StreamLogger.error(`[DrpbxFetcher] Chunk download failed`, {
          chunkNumber,
          start,
          end,
          error: errorMessage
        });
        throw new Error(`Failed to download chunk ${chunkNumber}/${totalChunks}: ${errorMessage}`);
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

        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          StreamLogger.error(`[DrpbxFetcher] Chunk download failed`, {
            chunkNumber,
            start,
            end,
            error: errorMessage
          });
          // Clean up partial temp file on error
          await tempFileManager.delete(tempPath);
          throw new Error(`Failed to download chunk ${chunkNumber}/${totalChunks}: ${errorMessage}`);
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
          let files = entries.filter((entry) => entry[".tag"] === "file") as files.FileMetadata[];

          StreamLogger.log(`[DrpbxFetcher] Found ${files.length} files in folder (before filtering)`, {
            remotePath: mapping.remotePath,
            fileCount: files.length
          });

          // Early filtering: Let processors decide if files should be skipped
          // This prevents unnecessary downloads and processing
          const registry = ProcessorRegistry.getInstance();
          const filesBeforeFilter = files.length;
          files = files.filter((file) => {
            const filePath = file.path_display || "";

            // Ask all enabled processors if this file should be skipped
            for (const mapping of this.settings.fileTypeMappings) {
              if (!mapping.enabled) continue;

              const processor = registry.getByType(mapping.processorType);
              if (!processor || !processor.shouldSkipFile) continue;

              const skipCheck = processor.shouldSkipFile(filePath, file, mapping.config);
              if (skipCheck.shouldSkip) {
                StreamLogger.log(`[DrpbxFetcher] Skipping file (processor filter)`, {
                  fileName: file.name,
                  processor: processor.name,
                  reason: skipCheck.reason
                });
                skippedFiles++;
                return false;
              }
            }

            return true;
          });

          const filteredByProcessors = filesBeforeFilter - files.length;
          if (filteredByProcessors > 0) {
            StreamLogger.log(`[DrpbxFetcher] Filtered out ${filteredByProcessors} files by processor rules`);
          }

          totalSourceFiles += files.length;
          StreamLogger.log(`[DrpbxFetcher] Processing ${files.length} files after filtering`, {
            remotePath: mapping.remotePath,
            fileCount: files.length,
            skippedByProcessorFilter: filteredByProcessors
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

              // Note: Processor-specific filtering already done earlier (before loop)
              // to avoid unnecessary file processing and downloads

              const fileExtension = FileUtils.getExtension(file.name);
              const pathLower = file.path_display?.toLowerCase() || "";

              // Check if this file extension should be skipped
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

              // Check early if file will be processed by a processor
              // Uses extension-based routing first, then path-based routing via canHandleFile hook
              const processorResult = registry.findProcessorForFile(
                pathLower,
                fileExtension,
                this.settings.fileTypeMappings
              );

              const processor = processorResult?.processor || null;
              const processorMapping = processorResult?.mapping || null;
              const willBeProcessed = processor !== null;

              // Check if file was already processed (for files that will be processed)
              // This prevents unnecessary downloads
              if (willBeProcessed && processor) {
                const fileId = file.id; // Unique Dropbox file ID

                if (this.settings.processedFiles[fileId] === file.size) {
                  // File already processed with same size - skip to preserve user edits
                  skippedProcessors++;
                  console.log(`Skipping ${file.name} - already processed (${file.size} bytes)`);
                  StreamLogger.log(`[DrpbxFetcher] Skipping file (already processed)`, {
                    fileName: file.name,
                    fileId,
                    size: file.size
                  });
                  continue; // Skip both download and processing
                } else if (this.settings.processedFiles[fileId]) {
                  // File exists but size changed - will reprocess
                  console.log(`Will reprocess ${file.name} - changed (old: ${this.settings.processedFiles[fileId]}, new: ${file.size})`);
                } else {
                  // New file - will process it
                  console.log(`Will process new file: ${file.name}`);
                }
              }

              // Only calculate paths and create folders for non-processed files
              // Processors control their own output paths completely
              let localFilePath = "";
              if (!willBeProcessed) {
                // Get relative path from the remote folder, preserving case
                // Use path_display to keep original capitalization
                const remoteFolderRegex = new RegExp("^" + mapping.remotePath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), "i");
                // Safe: path_display is always defined for FileMetadata after filtering entries by .tag === "file"
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                const relativePath = file.path_display!.replace(remoteFolderRegex, "");

                localFilePath = localFolder + relativePath;

                // Ensure parent directories exist
                const parentPath = localFilePath.substring(0, localFilePath.lastIndexOf("/"));
                if (parentPath) {
                  try {
                    await this.app.vault.createFolder(parentPath);
                  } catch (error) {
                    // Folder might already exist
                  }
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
                // Safe: path_lower is always defined for FileMetadata after filtering entries by .tag === "file"
                uint8Array = await this.downloadFileInChunks(
                  file.path_lower!, // eslint-disable-line @typescript-eslint/no-non-null-assertion
                  file.size,
                  this.settings.chunkSizeBytes
                );
              } else {
                StreamLogger.log(`[DrpbxFetcher] Downloading file...`, {
                  fileName: file.name,
                  size: file.size
                });
                // Safe: path_lower is always defined for FileMetadata after filtering entries by .tag === "file"
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                const response = await dbx.filesDownload({ path: file.path_lower! });
                StreamLogger.log(`[DrpbxFetcher] Download complete, converting to buffer...`);
                const result = response.result as unknown as { fileBlob: Blob };
                const arrayBuffer = await result.fileBlob.arrayBuffer();
                uint8Array = new Uint8Array(arrayBuffer);
                StreamLogger.log(`[DrpbxFetcher] Buffer ready`, { bytes: uint8Array.length });
              }

              // Process file with processor if one was found
              if (processor && processorMapping) {
                // Use processor
                console.log(`Processing ${file.name} with ${processor.name}`);
                StreamLogger.log(`[DrpbxFetcher] Found processor for file`, {
                  fileName: file.name,
                  processorName: processor.name,
                  extension: fileExtension
                });

                {
                  // File will be processed (already passed the early check above)
                  const fileId = file.id;

                  try {
                      StreamLogger.log(`[DrpbxFetcher] Starting processor...`, {
                        fileName: file.name,
                        processor: processor.name
                      });
                      const templateResolver = new TemplateResolver(this.app.vault);
                      // Safe: path_display is always defined for FileMetadata after filtering entries by .tag === "file"
                      const result = await processor.process(
                        uint8Array,
                        file.path_display!, // eslint-disable-line @typescript-eslint/no-non-null-assertion
                        file,
                        processorMapping.config,
                        {
                          vault: this.app.vault,
                          app: this.app,
                          templateResolver,
                          pluginSettings: this.settings,
                          metadataManager: this.metadataManager!,
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
                        // Save metadata after processing
                        await this.saveMetadata();
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
                    } catch (procError) {
                      console.error(`Error processing file with ${processor.name}:`, procError);
                      StreamLogger.error(`[DrpbxFetcher] Processor exception`, {
                        fileName: file.name,
                        processor: processor.name,
                        error: procError instanceof Error ? procError.message : String(procError),
                        stack: procError instanceof Error ? procError.stack : undefined
                      });
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
                if (existingFile instanceof TFile) {
                  // Use modifyBinary to trigger Obsidian's file change detection
                  await this.app.vault.modifyBinary(existingFile, uint8Array);
                  // Trigger workspace to refresh views displaying this file (especially images)
                  this.app.workspace.trigger('file-modified', existingFile);
                } else {
                  await this.app.vault.createBinary(localFilePath, uint8Array);
                }
                regularFiles++;
                console.log(`✓ Synced: ${localFilePath} (${file.size} bytes)`);
              }
            } catch (error) {
              const errorMessage = error instanceof Error ? error.message : String(error);
              const errorStatus = (error as { status?: number }).status;
              const errorStack = error instanceof Error ? error.stack : undefined;
              const dropboxError = (error as { error?: unknown }).error;

              console.error(`Error syncing file ${file.path_display}:`, error);
              console.error(`  - Status: ${errorStatus}`);
              console.error(`  - Message: ${errorMessage}`);
              if (dropboxError) {
                console.error(`  - Dropbox error:`, dropboxError);
              }
              StreamLogger.error(`[DrpbxFetcher] File sync error`, {
                fileName: file.name,
                path: file.path_display,
                error: errorMessage,
                status: errorStatus,
                stack: errorStack
              });
            }
          }
        } catch (error) {
          console.error(`Error syncing folder ${mapping.remotePath}:`, error);

          // Provide more helpful error messages for common issues
          const errorMessage = error instanceof Error ? error.message : String(error);
          const errorStatus = (error as { status?: number }).status;
          let errorMsg = errorMessage;
          if (errorStatus === 409) {
            errorMsg = `Path not found or inaccessible: ${mapping.remotePath}. Please verify the path exists in your Dropbox and check spelling/case.`;
          } else if (errorStatus === 401) {
            errorMsg = `Authentication failed. Please re-authenticate in plugin settings.`;
          } else if (errorStatus === 403) {
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
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error("Fetch error:", error);
      StreamLogger.error("[DrpbxFetcher] Fetch failed", error);
      if (this.statusBarItem) {
        this.statusBarItem.setText(`❌ Fetch failed: ${errorMessage}`);
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

    // Initialize metadata manager for Viwoods note metadata
    // Use vault adapter to read/write separate metadata file in plugin config directory
    const configDir = (this.app.vault.adapter as any).getBasePath?.() || '';
    const metadataPath = `${configDir}/.obsidian/plugins/drpbx-fetcher/viwoodsNoteMetadata.json`;
    this.metadataManager = new MetadataManager(
      metadataPath,
      async () => {
        // Load metadata from separate file using vault adapter
        try {
          const content = await this.app.vault.adapter.read('.obsidian/plugins/drpbx-fetcher/viwoodsNoteMetadata.json');
          return JSON.parse(content) as Record<string, ViwoodsNoteMetadata>;
        } catch (error) {
          // File doesn't exist or can't be read
          return null;
        }
      },
      async (data: Record<string, ViwoodsNoteMetadata>) => {
        // Save metadata to separate file using vault adapter
        await this.app.vault.adapter.write('.obsidian/plugins/drpbx-fetcher/viwoodsNoteMetadata.json', JSON.stringify(data, null, 2));
      }
    );
    await this.loadMetadata();

    // Initialize stream logger
    const manifest = (this.app as { plugins?: { manifests?: Record<string, { version?: string }> } }).plugins?.manifests?.["drpbx-fetcher"];
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

  async loadMetadata() {
    if (this.metadataManager) {
      await this.metadataManager.load();
    }
  }

  async saveMetadata() {
    if (this.metadataManager) {
      await this.metadataManager.save();
    }
  }
}