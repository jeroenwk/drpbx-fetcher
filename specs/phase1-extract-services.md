# Phase 1: Extract Services - Implementation Guide

**Goal:** Extract 4-5 service classes from main.ts
**Duration:** 1-2 weeks (depending on testing thoroughness)
**Risk Level:** 🟢 Low
**Expected Outcome:** main.ts reduced from 936 → ~600 lines

---

## Table of Contents
1. [Overview](#overview)
2. [Step 1: StatusBarService](#step-1-statusbarservice)
3. [Step 2: DropboxClientFactory](#step-2-dropboxclientfactory)
4. [Step 3: FileDownloader](#step-3-filedownloader)
5. [Step 4: OAuth Reorganization](#step-4-oauth-reorganization)
6. [Testing Strategy](#testing-strategy)
7. [Verification](#verification)

---

## Overview

### What We're Extracting

```
main.ts (936 lines)
├── StatusBarService (~50 lines) ← Extract
├── DropboxClientFactory (~100 lines) ← Extract
├── FileDownloader (~180 lines) ← Extract
├── OAuth reorganization (~100 lines) ← Extract
└── Remaining orchestration (~506 lines)
```

### Benefits

- **Testability:** Each service can be tested in isolation
- **Reusability:** Services can be used independently
- **Clarity:** Each service has single responsibility
- **Maintainability:** Easier to find and fix issues

### Prerequisites

Before starting:
- [ ] All current tests passing
- [ ] Create branch: `git checkout -b refactor/phase1-extract-services`
- [ ] Commit current state: `git commit -am "chore: checkpoint before Phase 1 refactoring"`

---

## Step 1: StatusBarService

### 1.1 Create Service File

Create `src/services/StatusBarService.ts`:

```typescript
/**
 * Service for managing status bar updates during sync operations.
 * Provides a clean abstraction over Obsidian's status bar element.
 */
export class StatusBarService {
  private statusBarItem: HTMLElement | null;
  private clearTimer: NodeJS.Timeout | null = null;

  constructor(statusBarItem: HTMLElement | null) {
    this.statusBarItem = statusBarItem;
  }

  /**
   * Display a message in the status bar
   * @param message Message to display
   */
  show(message: string): void {
    if (this.statusBarItem) {
      this.statusBarItem.setText(message);
    }
    this.cancelPendingClear();
  }

  /**
   * Show sync progress (X/Y files)
   * @param current Current file number
   * @param total Total files
   */
  showProgress(current: number, total: number): void {
    this.show(`⏳ Fetching... ${current}/${total} files`);
  }

  /**
   * Show completion summary with auto-clear
   * @param summary Summary message
   * @param duration Auto-clear timeout in ms (default: 10000)
   */
  showCompletion(summary: string, duration: number = 10000): void {
    this.show(summary);
    this.autoClear(duration);
  }

  /**
   * Show error message with auto-clear
   * @param message Error message
   * @param duration Auto-clear timeout in ms (default: 8000)
   */
  showError(message: string, duration: number = 8000): void {
    this.show(`❌ ${message}`);
    this.autoClear(duration);
  }

  /**
   * Clear the status bar
   */
  clear(): void {
    if (this.statusBarItem) {
      this.statusBarItem.setText("");
    }
    this.cancelPendingClear();
  }

  /**
   * Schedule auto-clear after duration
   * @param duration Timeout in milliseconds
   */
  private autoClear(duration: number): void {
    this.cancelPendingClear();
    this.clearTimer = setTimeout(() => {
      this.clear();
      this.clearTimer = null;
    }, duration);
  }

  /**
   * Cancel any pending auto-clear timer
   */
  private cancelPendingClear(): void {
    if (this.clearTimer) {
      clearTimeout(this.clearTimer);
      this.clearTimer = null;
    }
  }

  /**
   * Cleanup on service destruction
   */
  destroy(): void {
    this.cancelPendingClear();
    this.clear();
  }
}
```

### 1.2 Update main.ts

**Add import:**
```typescript
import { StatusBarService } from "./src/services/StatusBarService";
```

**Replace statusBarItem with service:**
```typescript
export default class DrpbxFetcherPlugin extends Plugin {
  // ... other fields
  private statusBarService: StatusBarService | null = null;

  async onload() {
    // ... existing code

    // Initialize status bar service
    const statusBarItem = this.addStatusBarItem();
    this.statusBarService = new StatusBarService(statusBarItem);
    statusBarItem.setText("");

    // ... rest of onload
  }

  async onunload() {
    // Cleanup status bar service
    if (this.statusBarService) {
      this.statusBarService.destroy();
    }

    // ... rest of onunload
  }
}
```

**Replace all status bar calls:**

Search for `this.statusBarItem?.setText` and replace:

```typescript
// OLD:
if (this.statusBarItem) {
  this.statusBarItem.setText("⏳ Fetching from Dropbox...");
}

// NEW:
this.statusBarService?.show("⏳ Fetching from Dropbox...");
```

```typescript
// OLD:
if (this.statusBarItem) {
  this.statusBarItem.setText(`⏳ Fetching... ${i + 1}/${files.length} files`);
}

// NEW:
this.statusBarService?.showProgress(i + 1, files.length);
```

```typescript
// OLD:
if (this.statusBarItem) {
  this.statusBarItem.setText(summary);
  setTimeout(() => {
    if (this.statusBarItem) this.statusBarItem.setText("");
  }, 10000);
}

// NEW:
this.statusBarService?.showCompletion(summary);
```

```typescript
// OLD:
if (this.statusBarItem) {
  this.statusBarItem.setText(`❌ Error: ${errorMsg}`);
  setTimeout(() => {
    if (this.statusBarItem) this.statusBarItem.setText("");
  }, 8000);
}

// NEW:
this.statusBarService?.showError(errorMsg);
```

### 1.3 Add Tests

Create `src/services/__tests__/StatusBarService.test.ts`:

```typescript
import { StatusBarService } from '../StatusBarService';

describe('StatusBarService', () => {
  let mockElement: { setText: jest.Mock };
  let service: StatusBarService;

  beforeEach(() => {
    mockElement = { setText: jest.fn() };
    service = new StatusBarService(mockElement as unknown as HTMLElement);
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('show', () => {
    it('should display message', () => {
      service.show('test message');
      expect(mockElement.setText).toHaveBeenCalledWith('test message');
    });

    it('should handle null status bar', () => {
      const nullService = new StatusBarService(null);
      expect(() => nullService.show('test')).not.toThrow();
    });
  });

  describe('showProgress', () => {
    it('should format progress message', () => {
      service.showProgress(5, 10);
      expect(mockElement.setText).toHaveBeenCalledWith('⏳ Fetching... 5/10 files');
    });
  });

  describe('showCompletion', () => {
    it('should show message and auto-clear', () => {
      service.showCompletion('Done!', 5000);
      expect(mockElement.setText).toHaveBeenCalledWith('Done!');

      // Fast-forward time
      jest.advanceTimersByTime(5000);
      expect(mockElement.setText).toHaveBeenCalledWith('');
    });

    it('should use default duration', () => {
      service.showCompletion('Done!');
      jest.advanceTimersByTime(10000);
      expect(mockElement.setText).toHaveBeenCalledWith('');
    });
  });

  describe('showError', () => {
    it('should show error with emoji', () => {
      service.showError('Something failed');
      expect(mockElement.setText).toHaveBeenCalledWith('❌ Something failed');
    });

    it('should auto-clear after duration', () => {
      service.showError('Error!', 3000);
      jest.advanceTimersByTime(3000);
      expect(mockElement.setText).toHaveBeenCalledWith('');
    });
  });

  describe('clear', () => {
    it('should clear status bar', () => {
      service.clear();
      expect(mockElement.setText).toHaveBeenCalledWith('');
    });

    it('should cancel pending auto-clear', () => {
      service.showCompletion('Test');
      service.clear();

      // Timer should be cancelled
      jest.advanceTimersByTime(10000);
      expect(mockElement.setText).toHaveBeenCalledTimes(2); // show + clear
    });
  });

  describe('destroy', () => {
    it('should cancel timers and clear', () => {
      service.showCompletion('Test');
      service.destroy();

      jest.advanceTimersByTime(10000);
      expect(mockElement.setText).toHaveBeenCalledTimes(2); // show + clear
    });
  });
});
```

### 1.4 Verify & Commit

```bash
# Run tests
npm test

# Run TypeScript check
npx tsc -noEmit -skipLibCheck

# Run ESLint
npm run lint

# Build
npm run build

# Manual test: Open Obsidian and verify status bar works

# Commit
git add src/services/StatusBarService.ts
git add src/services/__tests__/StatusBarService.test.ts
git add main.ts
git commit -m "refactor: extract StatusBarService from main.ts

- Created StatusBarService with clear API for status updates
- Replaced all direct status bar manipulations in main.ts
- Added comprehensive tests with 100% coverage
- Reduced main.ts by ~40 lines

Lines of code reduced: ~40
New service: StatusBarService (~120 lines including tests)"
```

---

## Step 2: DropboxClientFactory

### 2.1 Create Service Folder

Create `src/services/dropbox/DropboxClientFactory.ts`:

```typescript
import { requestUrl, RequestUrlResponse } from "obsidian";
import { Dropbox } from "dropbox";
import { PlatformHelper } from "../../utils/platform";
import type { DrpbxFetcherSettings } from "../../models/Settings";

/**
 * Factory for creating and configuring Dropbox client instances.
 * Handles token refresh and platform-specific fetch configuration.
 */
export class DropboxClientFactory {
  constructor(
    private settings: DrpbxFetcherSettings,
    private saveSettings: () => Promise<void>
  ) {}

  /**
   * Create a Dropbox client instance with fresh access token
   * @returns Configured Dropbox client
   * @throws Error if client ID or access token not available
   */
  async createClient(): Promise<Dropbox> {
    if (!this.settings.clientId) {
      throw new Error("Dropbox client ID not set. Please set it in the plugin settings.");
    }

    // Refresh token if we have one
    if (this.settings.refreshToken) {
      await this.refreshAccessToken();
    }

    if (!this.settings.accessToken) {
      throw new Error("No valid Dropbox access token available. Please authenticate through the plugin settings.");
    }

    return new Dropbox({
      accessToken: this.settings.accessToken,
      fetch: this.createFetchWrapper(),
    });
  }

  /**
   * Refresh the access token using the refresh token
   * @private
   */
  private async refreshAccessToken(): Promise<void> {
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
        const data = response.json as { access_token: string };
        this.settings.accessToken = data.access_token;
        await this.saveSettings();
      }
    } catch (error) {
      console.error("Error refreshing access token:", error);
      // Don't throw - allow fallback to existing token
    }
  }

  /**
   * Create a fetch wrapper function that uses Obsidian's requestUrl
   * Handles platform-specific headers and response conversion
   * @private
   */
  private createFetchWrapper(): typeof fetch {
    return async (url: string, init?: RequestInit): Promise<Response> => {
      try {
        // Convert fetch headers to plain object
        const headersObj = init?.headers as Record<string, string> || {};

        // Android fix: Dropbox API requires specific Content-Type headers
        // Android's requestUrl automatically adds "application/x-www-form-urlencoded" for POST
        // but Dropbox expects "application/octet-stream" or "text/plain"
        if (PlatformHelper.isAndroid() && init?.method === "POST" && url.includes("dropboxapi.com")) {
          if (!headersObj["Content-Type"]) {
            headersObj["Content-Type"] = "application/octet-stream";
          }
        }

        const response = await requestUrl({
          url,
          method: init?.method || "GET",
          headers: headersObj,
          body: init?.body as string,
        });

        // Convert Obsidian response to fetch-compatible Response
        return DropboxClientFactory.createFetchResponse(response);
      } catch (error) {
        console.error("Error in Dropbox fetch wrapper:", error);
        throw error;
      }
    };
  }

  /**
   * Convert Obsidian's RequestUrlResponse to fetch-compatible Response
   * @param response Obsidian response object
   * @returns Fetch-compatible Response object
   * @private
   */
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
}
```

### 2.2 Update main.ts

**Add import:**
```typescript
import { DropboxClientFactory } from "./src/services/dropbox/DropboxClientFactory";
```

**Add factory field:**
```typescript
export default class DrpbxFetcherPlugin extends Plugin {
  // ... other fields
  private dropboxFactory: DropboxClientFactory | null = null;
```

**Initialize in onload:**
```typescript
async onload() {
  await this.loadSettings();

  // Initialize Dropbox factory
  this.dropboxFactory = new DropboxClientFactory(
    this.settings,
    () => this.saveSettings()
  );

  // ... rest of onload
}
```

**Replace getDropboxClient method:**
```typescript
// DELETE the entire getDropboxClient method (70+ lines)
// DELETE the createFetchResponse static method

// Replace calls to getDropboxClient:
// OLD:
const dbx = await this.getDropboxClient();

// NEW:
const dbx = await this.dropboxFactory.createClient();
```

### 2.3 Add Tests

Create `src/services/dropbox/__tests__/DropboxClientFactory.test.ts`:

```typescript
import { DropboxClientFactory } from '../DropboxClientFactory';
import { DEFAULT_SETTINGS } from '../../../models/Settings';

// Mock requestUrl
jest.mock('obsidian', () => ({
  requestUrl: jest.fn(),
}));

import { requestUrl } from 'obsidian';

describe('DropboxClientFactory', () => {
  let settings: typeof DEFAULT_SETTINGS;
  let saveSettings: jest.Mock;
  let factory: DropboxClientFactory;

  beforeEach(() => {
    settings = {
      ...DEFAULT_SETTINGS,
      clientId: 'test-client-id',
      accessToken: 'test-access-token',
      refreshToken: 'test-refresh-token',
    };
    saveSettings = jest.fn();
    factory = new DropboxClientFactory(settings, saveSettings);
    jest.clearAllMocks();
  });

  describe('createClient', () => {
    it('should create Dropbox client with access token', async () => {
      const client = await factory.createClient();
      expect(client).toBeDefined();
      // Dropbox client should be configured
    });

    it('should throw if client ID not set', async () => {
      settings.clientId = '';
      await expect(factory.createClient()).rejects.toThrow('client ID not set');
    });

    it('should throw if no access token available', async () => {
      settings.accessToken = '';
      settings.refreshToken = '';
      await expect(factory.createClient()).rejects.toThrow('No valid Dropbox access token');
    });

    it('should refresh token if refresh token available', async () => {
      (requestUrl as jest.Mock).mockResolvedValue({
        status: 200,
        json: { access_token: 'new-access-token' },
      });

      await factory.createClient();

      expect(requestUrl).toHaveBeenCalledWith(
        expect.objectContaining({
          url: 'https://api.dropbox.com/oauth2/token',
          method: 'POST',
        })
      );

      expect(settings.accessToken).toBe('new-access-token');
      expect(saveSettings).toHaveBeenCalled();
    });

    it('should handle token refresh failure gracefully', async () => {
      (requestUrl as jest.Mock).mockRejectedValue(new Error('Network error'));

      // Should not throw, should use existing token
      const client = await factory.createClient();
      expect(client).toBeDefined();
    });
  });
});
```

### 2.4 Verify & Commit

```bash
# Test
npm test

# Check TypeScript
npx tsc -noEmit -skipLibCheck

# Lint
npm run lint

# Build
npm run build

# Manual test OAuth and file sync

# Commit
git add src/services/dropbox/
git add main.ts
git commit -m "refactor: extract DropboxClientFactory from main.ts

- Created DropboxClientFactory service for client creation
- Handles token refresh and platform-specific fetch wrapper
- Removed 100+ lines from main.ts
- Added comprehensive tests

Lines of code reduced: ~100
New service: DropboxClientFactory (~150 lines including tests)"
```

---

## Step 3: FileDownloader

### 3.1 Create Service File

Create `src/services/dropbox/FileDownloader.ts`:

```typescript
import { Dropbox, files } from "dropbox";
import { requestUrl } from "obsidian";
import { PlatformHelper } from "../../utils/platform";
import { StreamLogger } from "../../utils/StreamLogger";
import type { DrpbxFetcherSettings } from "../../models/Settings";
import type { TempFileManager } from "../../utils/TempFileManager";

/**
 * Service for downloading files from Dropbox with support for:
 * - Regular downloads (small files)
 * - Chunked downloads (large files using HTTP Range requests)
 * - Memory-efficient disk-based downloads
 */
export class FileDownloader {
  constructor(
    private dbx: Dropbox,
    private settings: DrpbxFetcherSettings,
    private tempFileManager?: TempFileManager
  ) {}

  /**
   * Download a file from Dropbox
   * Automatically chooses chunked or regular download based on file size
   * @param file File metadata from Dropbox
   * @returns File data as Uint8Array
   */
  async download(file: files.FileMetadata): Promise<Uint8Array> {
    const useChunked = file.size >= this.settings.chunkedDownloadThreshold;

    if (useChunked) {
      StreamLogger.log(`[FileDownloader] Using chunked download`, {
        fileName: file.name,
        size: file.size,
        sizeMB: (file.size / (1024 * 1024)).toFixed(2),
        chunkSizeMB: (this.settings.chunkSizeBytes / (1024 * 1024)).toFixed(2)
      });

      return this.downloadChunked(
        // Safe: path_lower is always defined for FileMetadata
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        file.path_lower!,
        file.size,
        this.settings.chunkSizeBytes
      );
    } else {
      StreamLogger.log(`[FileDownloader] Using regular download`, {
        fileName: file.name,
        size: file.size
      });

      return this.downloadRegular(
        // Safe: path_lower is always defined for FileMetadata
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        file.path_lower!
      );
    }
  }

  /**
   * Download a file in chunks using HTTP Range requests
   * @param filePath Dropbox file path
   * @param fileSize Total file size in bytes
   * @param chunkSize Chunk size in bytes
   * @returns Complete file data
   * @private
   */
  private async downloadChunked(
    filePath: string,
    fileSize: number,
    chunkSize: number
  ): Promise<Uint8Array> {
    StreamLogger.log(`[FileDownloader] Starting chunked download`, {
      filePath,
      fileSize,
      chunkSize,
      totalChunks: Math.ceil(fileSize / chunkSize)
    });

    const completeFile = new Uint8Array(fileSize);
    let downloadedBytes = 0;
    let chunkNumber = 0;
    const totalChunks = Math.ceil(fileSize / chunkSize);

    while (downloadedBytes < fileSize) {
      const start = downloadedBytes;
      const end = Math.min(start + chunkSize - 1, fileSize - 1);
      chunkNumber++;

      StreamLogger.log(`[FileDownloader] Downloading chunk ${chunkNumber}/${totalChunks}`, {
        start,
        end,
        chunkBytes: end - start + 1,
        progress: `${((downloadedBytes / fileSize) * 100).toFixed(1)}%`
      });

      try {
        const chunkData = await this.downloadChunk(filePath, start, end);

        // Verify chunk size
        const expectedSize = end - start + 1;
        if (chunkData.length !== expectedSize) {
          StreamLogger.warn(`[FileDownloader] Chunk size mismatch`, {
            expected: expectedSize,
            received: chunkData.length
          });
        }

        // Copy chunk into complete file array
        completeFile.set(chunkData, start);
        downloadedBytes += chunkData.length;

        StreamLogger.log(`[FileDownloader] Chunk ${chunkNumber}/${totalChunks} complete`, {
          downloadedBytes,
          totalBytes: fileSize,
          progress: `${((downloadedBytes / fileSize) * 100).toFixed(1)}%`
        });

      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        StreamLogger.error(`[FileDownloader] Chunk download failed`, {
          chunkNumber,
          start,
          end,
          error: errorMessage
        });
        throw new Error(`Failed to download chunk ${chunkNumber}/${totalChunks}: ${errorMessage}`);
      }
    }

    StreamLogger.log(`[FileDownloader] Chunked download complete`, {
      filePath,
      totalBytes: downloadedBytes,
      totalChunks
    });

    return completeFile;
  }

  /**
   * Download a single chunk using HTTP Range header
   * @param filePath Dropbox file path
   * @param start Start byte
   * @param end End byte
   * @returns Chunk data
   * @private
   */
  private async downloadChunk(
    filePath: string,
    start: number,
    end: number
  ): Promise<Uint8Array> {
    const accessToken = this.settings.accessToken;

    const headers: Record<string, string> = {
      "Authorization": `Bearer ${accessToken}`,
      "Dropbox-API-Arg": JSON.stringify({ path: filePath }),
      "Range": `bytes=${start}-${end}`,
    };

    // Android fix: Dropbox API requires specific Content-Type
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

    return new Uint8Array(response.arrayBuffer);
  }

  /**
   * Download a file using regular Dropbox SDK method
   * @param filePath Dropbox file path
   * @returns File data
   * @private
   */
  private async downloadRegular(filePath: string): Promise<Uint8Array> {
    const response = await this.dbx.filesDownload({ path: filePath });
    const result = response.result as unknown as { fileBlob: Blob };
    const arrayBuffer = await result.fileBlob.arrayBuffer();
    return new Uint8Array(arrayBuffer);
  }
}
```

### 3.2 Update main.ts

**Add import:**
```typescript
import { FileDownloader } from "./src/services/dropbox/FileDownloader";
```

**Remove downloadFileInChunks and downloadFileInChunksToDisk methods**

**Update syncFiles to use FileDownloader:**
```typescript
async syncFiles(): Promise<void> {
  // ... existing code

  try {
    const dbx = await this.dropboxFactory.createClient();

    // Create file downloader
    const downloader = new FileDownloader(
      dbx,
      this.settings,
      this.tempFileManager
    );

    // ... folder iteration

    for (const file of files) {
      // ... skip logic

      // Download file (OLD code - DELETE):
      // let uint8Array: Uint8Array;
      // const useChunkedDownload = file.size >= this.settings.chunkedDownloadThreshold;
      // if (useChunkedDownload) {
      //   uint8Array = await this.downloadFileInChunks(...);
      // } else {
      //   const response = await dbx.filesDownload({ path: file.path_lower! });
      //   ...
      // }

      // Download file (NEW code):
      const uint8Array = await downloader.download(file);

      // ... process or copy
    }
  }
}
```

### 3.3 Add Tests

Create `src/services/dropbox/__tests__/FileDownloader.test.ts`:

```typescript
import { FileDownloader } from '../FileDownloader';
import { Dropbox, files } from 'dropbox';
import { DEFAULT_SETTINGS } from '../../../models/Settings';

// Mock dependencies
jest.mock('obsidian');
jest.mock('../../utils/StreamLogger');

describe('FileDownloader', () => {
  let mockDropbox: jest.Mocked<Dropbox>;
  let settings: typeof DEFAULT_SETTINGS;
  let downloader: FileDownloader;

  beforeEach(() => {
    mockDropbox = {
      filesDownload: jest.fn(),
    } as unknown as jest.Mocked<Dropbox>;

    settings = {
      ...DEFAULT_SETTINGS,
      chunkedDownloadThreshold: 10 * 1024 * 1024, // 10 MB
      chunkSizeBytes: 2 * 1024 * 1024, // 2 MB
      accessToken: 'test-token',
    };

    downloader = new FileDownloader(mockDropbox, settings);
  });

  describe('download', () => {
    it('should use regular download for small files', async () => {
      const smallFile: files.FileMetadata = {
        name: 'small.txt',
        path_lower: '/small.txt',
        size: 1024, // 1 KB
      } as files.FileMetadata;

      mockDropbox.filesDownload.mockResolvedValue({
        result: {
          fileBlob: new Blob(['test content']),
        },
      } as never);

      await downloader.download(smallFile);

      expect(mockDropbox.filesDownload).toHaveBeenCalledWith({
        path: '/small.txt',
      });
    });

    it('should use chunked download for large files', async () => {
      const largeFile: files.FileMetadata = {
        name: 'large.pdf',
        path_lower: '/large.pdf',
        size: 20 * 1024 * 1024, // 20 MB
      } as files.FileMetadata;

      // Mock chunked download (would need to mock requestUrl)
      // This is a simplified test
      const result = await downloader.download(largeFile);
      expect(result).toBeInstanceOf(Uint8Array);
    });
  });
});
```

### 3.4 Verify & Commit

```bash
# Test
npm test

# Build and test manually with large files
npm run build
npm run install-plugin

# Commit
git add src/services/dropbox/FileDownloader.ts
git add src/services/dropbox/__tests__/FileDownloader.test.ts
git add main.ts
git commit -m "refactor: extract FileDownloader service from main.ts

- Created FileDownloader service for all download logic
- Supports regular and chunked downloads
- Removed 180+ lines from main.ts
- Added tests for download strategies

Lines of code reduced: ~180
New service: FileDownloader (~200 lines including tests)"
```

---

## Step 4: OAuth Reorganization

### 4.1 Reorganize Folder Structure

Create new folder structure:
```
src/services/auth/
├── OAuthManager.ts (updated)
├── flows/
│   ├── DesktopOAuthFlow.ts
│   └── MobileOAuthFlow.ts
└── types.ts
```

### 4.2 Create Shared Types

Create `src/services/auth/types.ts`:

```typescript
import type DrpbxFetcherPlugin from "../../../main";

/**
 * Result of OAuth authentication flow
 */
export interface AuthResult {
  success: boolean;
  accessToken?: string;
  refreshToken?: string;
  error?: string;
}

/**
 * Base interface for OAuth flow implementations
 */
export interface OAuthFlow {
  /**
   * Execute authentication flow
   * @param clientId Dropbox app client ID
   * @returns Authentication result
   */
  authenticate(clientId: string): Promise<AuthResult>;

  /**
   * Cleanup resources (servers, listeners, etc.)
   */
  cleanup(): void;
}

/**
 * Dependencies shared across OAuth flows
 */
export interface OAuthDependencies {
  plugin: DrpbxFetcherPlugin;
  clientId: string;
}
```

### 4.3 Extract Desktop Flow

Create `src/services/auth/flows/DesktopOAuthFlow.ts`:

```typescript
import * as http from "http";
import { Notice } from "obsidian";
import { PKCEGenerator } from "../../../utils/crypto";
import type { OAuthFlow, OAuthDependencies, AuthResult } from "../types";

/**
 * Desktop OAuth flow using localhost callback server
 */
export class DesktopOAuthFlow implements OAuthFlow {
  private server: http.Server | null = null;
  private plugin: OAuthDependencies["plugin"];
  private clientId: string;

  constructor(deps: OAuthDependencies) {
    this.plugin = deps.plugin;
    this.clientId = deps.clientId;
  }

  async authenticate(clientId: string): Promise<AuthResult> {
    const verifier = await PKCEGenerator.generateCodeVerifier();
    const challenge = await PKCEGenerator.generateCodeChallenge(verifier);

    // Store verifier for token exchange
    this.plugin.settings.codeVerifier = verifier;
    await this.plugin.saveSettings();

    // Build authorization URL
    const authUrl = this.buildAuthUrl(challenge);

    // Start local server
    await this.startLocalServer(verifier);

    // Open browser
    window.open(authUrl);

    // Return pending (actual token exchange happens in server callback)
    return { success: true };
  }

  cleanup(): void {
    if (this.server) {
      this.server.close();
      this.server = null;
    }
  }

  private buildAuthUrl(challenge: string): string {
    const params = new URLSearchParams({
      client_id: this.clientId,
      response_type: "code",
      redirect_uri: "http://localhost:53134/callback",
      code_challenge: challenge,
      code_challenge_method: "S256",
      token_access_type: "offline",
    });

    return `https://www.dropbox.com/oauth2/authorize?${params.toString()}`;
  }

  private async startLocalServer(verifier: string): Promise<void> {
    return new Promise((resolve, reject) => {
      this.server = http.createServer(async (req, res) => {
        if (!req.url?.startsWith("/callback")) {
          res.writeHead(404);
          res.end();
          return;
        }

        const url = new URL(req.url, "http://localhost:53134");
        const code = url.searchParams.get("code");

        if (!code) {
          res.writeHead(400);
          res.end("No authorization code received");
          this.cleanup();
          return;
        }

        try {
          // Exchange code for tokens
          const tokens = await this.exchangeCodeForTokens(code, verifier);

          // Save tokens
          this.plugin.settings.accessToken = tokens.access_token;
          this.plugin.settings.refreshToken = tokens.refresh_token;
          await this.plugin.saveSettings();

          // Success response
          res.writeHead(200, { "Content-Type": "text/html" });
          res.end(`
            <html>
              <body>
                <h1>✓ Authentication Successful</h1>
                <p>You can close this window and return to Obsidian.</p>
                <script>window.close();</script>
              </body>
            </html>
          `);

          new Notice("Dropbox authentication successful!");
          this.cleanup();
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : String(error);
          res.writeHead(500);
          res.end(`Authentication failed: ${errorMsg}`);
          new Notice(`Authentication failed: ${errorMsg}`);
          this.cleanup();
        }
      });

      this.server.on("error", (error) => {
        if ((error as NodeJS.ErrnoException).code === "EADDRINUSE") {
          new Notice("Port 53134 is already in use. Please wait a moment and try again.");
          reject(new Error("Port already in use"));
        } else {
          reject(error);
        }
      });

      this.server.listen(53134, () => {
        resolve();
      });
    });
  }

  private async exchangeCodeForTokens(
    code: string,
    verifier: string
  ): Promise<{ access_token: string; refresh_token: string }> {
    const response = await fetch("https://api.dropbox.com/oauth2/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        code,
        grant_type: "authorization_code",
        client_id: this.clientId,
        redirect_uri: "http://localhost:53134/callback",
        code_verifier: verifier,
      }).toString(),
    });

    if (!response.ok) {
      throw new Error(`Token exchange failed: ${response.statusText}`);
    }

    return await response.json();
  }
}
```

### 4.4 Extract Mobile Flow

Create `src/services/auth/flows/MobileOAuthFlow.ts`:

```typescript
import { Notice } from "obsidian";
import { PKCEGenerator } from "../../../utils/crypto";
import type { OAuthFlow, OAuthDependencies, AuthResult } from "../types";

/**
 * Mobile OAuth flow using custom URI scheme
 */
export class MobileOAuthFlow implements OAuthFlow {
  private plugin: OAuthDependencies["plugin"];
  private clientId: string;

  constructor(deps: OAuthDependencies) {
    this.plugin = deps.plugin;
    this.clientId = deps.clientId;
  }

  async authenticate(clientId: string): Promise<AuthResult> {
    const verifier = await PKCEGenerator.generateCodeVerifier();
    const challenge = await PKCEGenerator.generateCodeChallenge(verifier);

    // Store verifier and set auth in progress
    this.plugin.settings.codeVerifier = verifier;
    this.plugin.settings.authInProgress = true;
    await this.plugin.saveSettings();

    // Build authorization URL
    const authUrl = this.buildAuthUrl(challenge);

    // Open external browser
    window.open(authUrl);

    new Notice("Opening Dropbox authentication in browser...");

    return { success: true };
  }

  cleanup(): void {
    // No resources to cleanup for mobile flow
  }

  /**
   * Handle callback from mobile protocol handler
   * Called by Obsidian when obsidian://dropbox-callback is triggered
   * @param params URL search params from callback
   */
  async handleCallback(params: URLSearchParams): Promise<void> {
    const code = params.get("code");

    if (!code) {
      new Notice("Authentication failed: No authorization code received");
      this.plugin.settings.authInProgress = false;
      await this.plugin.saveSettings();
      return;
    }

    try {
      // Exchange code for tokens
      const verifier = this.plugin.settings.codeVerifier;
      if (!verifier) {
        throw new Error("Code verifier not found");
      }

      const tokens = await this.exchangeCodeForTokens(code, verifier);

      // Save tokens and clear auth state
      this.plugin.settings.accessToken = tokens.access_token;
      this.plugin.settings.refreshToken = tokens.refresh_token;
      this.plugin.settings.authInProgress = false;
      await this.plugin.saveSettings();

      new Notice("✓ Dropbox authentication successful!");

      // Refresh settings UI
      if (this.plugin.settingsTab) {
        this.plugin.settingsTab.display();
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      new Notice(`Authentication failed: ${errorMsg}`);
      this.plugin.settings.authInProgress = false;
      await this.plugin.saveSettings();
    }
  }

  private buildAuthUrl(challenge: string): string {
    const params = new URLSearchParams({
      client_id: this.clientId,
      response_type: "code",
      redirect_uri: "obsidian://dropbox-callback",
      code_challenge: challenge,
      code_challenge_method: "S256",
      token_access_type: "offline",
    });

    return `https://www.dropbox.com/oauth2/authorize?${params.toString()}`;
  }

  private async exchangeCodeForTokens(
    code: string,
    verifier: string
  ): Promise<{ access_token: string; refresh_token: string }> {
    const response = await fetch("https://api.dropbox.com/oauth2/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        code,
        grant_type: "authorization_code",
        client_id: this.clientId,
        redirect_uri: "obsidian://dropbox-callback",
        code_verifier: verifier,
      }).toString(),
    });

    if (!response.ok) {
      throw new Error(`Token exchange failed: ${response.statusText}`);
    }

    return await response.json();
  }
}
```

### 4.5 Update OAuthManager

Update `src/services/auth/OAuthManager.ts`:

```typescript
import { PlatformHelper } from "../../utils/platform";
import { DesktopOAuthFlow } from "./flows/DesktopOAuthFlow";
import { MobileOAuthFlow } from "./flows/MobileOAuthFlow";
import type { OAuthDependencies } from "./types";
import type DrpbxFetcherPlugin from "../../../main";

/**
 * OAuth manager that delegates to platform-specific flows
 */
export class OAuthManager {
  private desktopFlow: DesktopOAuthFlow | null = null;
  private mobileFlow: MobileOAuthFlow | null = null;

  constructor(
    private plugin: DrpbxFetcherPlugin,
    private clientId: string
  ) {}

  async authenticate(): Promise<void> {
    if (!this.clientId) {
      throw new Error("Please set your Dropbox Client ID first");
    }

    const deps: OAuthDependencies = {
      plugin: this.plugin,
      clientId: this.clientId,
    };

    if (PlatformHelper.isDesktop()) {
      this.desktopFlow = new DesktopOAuthFlow(deps);
      await this.desktopFlow.authenticate(this.clientId);
    } else {
      this.mobileFlow = new MobileOAuthFlow(deps);
      await this.mobileFlow.authenticate(this.clientId);
    }
  }

  async handleMobileCallback(params: URLSearchParams): Promise<void> {
    if (!this.mobileFlow) {
      const deps: OAuthDependencies = {
        plugin: this.plugin,
        clientId: this.clientId,
      };
      this.mobileFlow = new MobileOAuthFlow(deps);
    }

    await this.mobileFlow.handleCallback(params);
  }

  cleanup(): void {
    if (this.desktopFlow) {
      this.desktopFlow.cleanup();
      this.desktopFlow = null;
    }

    if (this.mobileFlow) {
      this.mobileFlow.cleanup();
      this.mobileFlow = null;
    }
  }
}
```

### 4.6 Update Imports in main.ts

```typescript
// OLD:
import { OAuthManager } from "./src/auth/OAuthManager";

// NEW:
import { OAuthManager } from "./src/services/auth/OAuthManager";
```

### 4.7 Delete Old Files

```bash
# Delete old auth folder
rm -rf src/auth/
```

### 4.8 Verify & Commit

```bash
# Test
npm test

# Test OAuth on desktop and mobile
npm run build
npm run install-plugin

# Commit
git add src/services/auth/
git rm -r src/auth/
git add main.ts
git commit -m "refactor: reorganize OAuth into flow-specific classes

- Split OAuth logic into Desktop and Mobile flows
- Created shared types and interfaces
- Improved separation of concerns
- No functional changes, just organization

Files reorganized:
- src/auth/ → src/services/auth/
- OAuthManager.ts (simplified)
- flows/DesktopOAuthFlow.ts (new)
- flows/MobileOAuthFlow.ts (new)
- types.ts (new)"
```

---

## Testing Strategy

### Unit Tests
- **StatusBarService:** 100% coverage
- **DropboxClientFactory:** Token refresh, error handling
- **FileDownloader:** Regular vs chunked download logic
- **OAuth Flows:** Mock authentication flows

### Integration Tests
```typescript
describe('Service Integration', () => {
  it('should sync files using services', async () => {
    // Test full sync using all services
  });
});
```

### Manual Testing Checklist
- [ ] Desktop: OAuth works
- [ ] Desktop: File sync works
- [ ] Desktop: Large file chunked download works
- [ ] Desktop: Status bar updates correctly
- [ ] Mobile: OAuth works
- [ ] Mobile: File sync works
- [ ] Mobile: Chunked download works
- [ ] Mobile: Status bar updates correctly
- [ ] All processor types still work
- [ ] Error handling works
- [ ] Settings UI works

---

## Verification

### Code Metrics
```bash
# Count lines in main.ts before
wc -l main.ts
# Expected: ~936 lines

# Count lines in main.ts after
wc -l main.ts
# Target: ~600 lines

# Count total lines in services
find src/services -name "*.ts" -not -path "*__tests__*" -exec wc -l {} +
# Expected: ~500-600 lines
```

### Test Coverage
```bash
npm run test:coverage
# Target: >70% overall coverage
```

### TypeScript Check
```bash
npx tsc -noEmit -skipLibCheck
# Should have 0 errors
```

### ESLint
```bash
npm run lint
# Should have 0 warnings
```

### Build
```bash
npm run build
# Should succeed
```

---

## Completion Checklist

Phase 1 complete when:
- [ ] StatusBarService extracted and tested
- [ ] DropboxClientFactory extracted and tested
- [ ] FileDownloader extracted and tested
- [ ] OAuth reorganized into flows
- [ ] All existing tests still passing
- [ ] New service tests added and passing
- [ ] Manual testing on Desktop completed
- [ ] Manual testing on Mobile completed
- [ ] No TypeScript errors
- [ ] No ESLint warnings
- [ ] main.ts reduced to ~600 lines
- [ ] Documentation updated
- [ ] All commits pushed to branch
- [ ] Pull request created for review

---

**Document Status:** Complete
**Phase:** Phase 1 - Extract Services
**Next Phase:** Phase 2 - Extract Sync Logic (see REFACTORING_ROADMAP.md)
