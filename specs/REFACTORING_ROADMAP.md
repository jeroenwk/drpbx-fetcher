# Refactoring Roadmap: Dropbox Fetcher

**Purpose:** Step-by-step guide for refactoring the Dropbox Fetcher plugin
**Approach:** Incremental, low-risk improvements
**Timeline:** Phased over 2-3 months

---

## Table of Contents
1. [Phase 1: Extract Services](#phase-1-extract-services)
2. [Phase 2: Extract Sync Logic](#phase-2-extract-sync-logic)
3. [Phase 3: Unify Metadata](#phase-3-unify-metadata)
4. [Phase 4: Plugin Split](#phase-4-plugin-split)
5. [Risk Management](#risk-management)
6. [Testing Strategy](#testing-strategy)
7. [Rollback Procedures](#rollback-procedures)

---

## Phase 1: Extract Services

**Goal:** Extract 4-5 service classes from main.ts to reduce complexity
**Duration:** 1-2 days
**Risk Level:** 🟢 Low
**Lines Reduced:** 936 → ~600 lines in main.ts

### Pre-Refactoring Checklist
- [ ] All existing tests passing
- [ ] No TypeScript errors
- [ ] No ESLint warnings
- [ ] Create feature branch: `refactor/phase1-extract-services`
- [ ] Document current behavior (manual test checklist)

### Step 1.1: Extract StatusBar Service

**Current State:**
```typescript
// main.ts (scattered throughout)
if (this.statusBarItem) {
  this.statusBarItem.setText("⏳ Fetching from Dropbox...");
}

if (this.statusBarItem) {
  this.statusBarItem.setText(`⏳ Fetching... ${i + 1}/${files.length} files`);
}
```

**Target State:**
```typescript
// src/services/StatusBarService.ts
export class StatusBarService {
  constructor(private statusBarItem: HTMLElement | null) {}

  show(message: string): void {
    if (this.statusBarItem) {
      this.statusBarItem.setText(message);
    }
  }

  showProgress(current: number, total: number): void {
    this.show(`⏳ Fetching... ${current}/${total} files`);
  }

  showCompletion(summary: string, duration: number = 10000): void {
    this.show(summary);
    setTimeout(() => this.clear(), duration);
  }

  showError(message: string, duration: number = 8000): void {
    this.show(`❌ ${message}`);
    setTimeout(() => this.clear(), duration);
  }

  clear(): void {
    if (this.statusBarItem) {
      this.statusBarItem.setText("");
    }
  }
}
```

**Migration Steps:**
1. Create `src/services/StatusBarService.ts`
2. Add class with methods above
3. In main.ts `onload()`:
   ```typescript
   this.statusBarItem = this.addStatusBarItem();
   this.statusBarService = new StatusBarService(this.statusBarItem);
   ```
4. Replace all `this.statusBarItem.setText()` calls:
   - `setText("⏳ Fetching...")` → `this.statusBarService.show("⏳ Fetching...")`
   - Progress updates → `this.statusBarService.showProgress(i+1, total)`
   - Errors → `this.statusBarService.showError(message)`
5. Run tests
6. Manual testing: Verify status bar still works
7. Commit: `refactor: extract StatusBarService from main.ts`

**Files Changed:**
- Created: `src/services/StatusBarService.ts`
- Modified: `main.ts`

**Tests to Add:**
```typescript
// src/services/__tests__/StatusBarService.test.ts
describe('StatusBarService', () => {
  it('should show message', () => {
    const mockElement = { setText: jest.fn() };
    const service = new StatusBarService(mockElement);
    service.show('test');
    expect(mockElement.setText).toHaveBeenCalledWith('test');
  });

  it('should show progress', () => {
    const mockElement = { setText: jest.fn() };
    const service = new StatusBarService(mockElement);
    service.showProgress(5, 10);
    expect(mockElement.setText).toHaveBeenCalledWith('⏳ Fetching... 5/10 files');
  });

  // ... more tests
});
```

---

### Step 1.2: Extract DropboxClient Wrapper

**Current State:**
```typescript
// main.ts
private async getDropboxClient(): Promise<Dropbox> {
  // 70+ lines of token refresh, custom fetch, etc.
}
```

**Target State:**
```typescript
// src/services/dropbox/DropboxClientFactory.ts
export class DropboxClientFactory {
  constructor(
    private settings: DrpbxFetcherSettings,
    private saveSettings: () => Promise<void>
  ) {}

  async createClient(): Promise<Dropbox> {
    await this.refreshTokenIfNeeded();
    return this.buildClient();
  }

  private async refreshTokenIfNeeded(): Promise<void> {
    // Token refresh logic
  }

  private buildClient(): Dropbox {
    // Custom fetch wrapper
    // Platform-specific headers
    return new Dropbox({
      accessToken: this.settings.accessToken,
      fetch: this.createFetchWrapper()
    });
  }

  private createFetchWrapper(): typeof fetch {
    // obsidianFetch logic
  }

  private static createFetchResponse(response: RequestUrlResponse): Response {
    // Pure function moved here
  }
}
```

**Migration Steps:**
1. Create `src/services/dropbox/DropboxClientFactory.ts`
2. Move `getDropboxClient()` logic to `createClient()`
3. Move `createFetchResponse()` static method
4. In main.ts:
   ```typescript
   private dropboxFactory: DropboxClientFactory;

   async onload() {
     this.dropboxFactory = new DropboxClientFactory(
       this.settings,
       () => this.saveSettings()
     );
   }

   async syncFiles() {
     const dbx = await this.dropboxFactory.createClient();
   }
   ```
5. Run tests
6. Manual testing: Verify OAuth still works, files still sync
7. Commit: `refactor: extract DropboxClientFactory`

**Files Changed:**
- Created: `src/services/dropbox/DropboxClientFactory.ts`
- Modified: `main.ts`

**Tests to Add:**
```typescript
describe('DropboxClientFactory', () => {
  it('should refresh token when needed', async () => {
    // Mock settings with expired token
    // Verify token refresh called
  });

  it('should create client with custom fetch', async () => {
    // Verify client created correctly
  });

  it('should handle Android Content-Type headers', () => {
    // Platform-specific test
  });
});
```

---

### Step 1.3: Extract FileDownloader Service

**Current State:**
```typescript
// main.ts
private async downloadFileInChunks(path, size, chunkSize): Promise<Uint8Array> {
  // 100+ lines
}

private async downloadFileInChunksToDisk(path, size, chunkSize, tempMgr): Promise<string> {
  // 100+ lines
}

// In syncFiles():
if (useChunkedDownload) {
  uint8Array = await this.downloadFileInChunks(...);
} else {
  const response = await dbx.filesDownload(...);
  // ...conversion logic
}
```

**Target State:**
```typescript
// src/services/dropbox/FileDownloader.ts
export class FileDownloader {
  constructor(
    private dbx: Dropbox,
    private settings: DrpbxFetcherSettings,
    private tempFileManager?: TempFileManager
  ) {}

  async download(file: FileMetadata): Promise<Uint8Array> {
    const useChunked = file.size >= this.settings.chunkedDownloadThreshold;

    if (useChunked) {
      return this.downloadChunked(file);
    } else {
      return this.downloadRegular(file);
    }
  }

  private async downloadChunked(file: FileMetadata): Promise<Uint8Array> {
    // Moved from downloadFileInChunks
  }

  private async downloadRegular(file: FileMetadata): Promise<Uint8Array> {
    // Simple download logic
  }

  async downloadToDisk(file: FileMetadata): Promise<string> {
    // Moved from downloadFileInChunksToDisk
  }
}
```

**Migration Steps:**
1. Create `src/services/dropbox/FileDownloader.ts`
2. Move chunked download methods
3. Move regular download logic
4. In main.ts `syncFiles()`:
   ```typescript
   const downloader = new FileDownloader(
     dbx,
     this.settings,
     this.tempFileManager
   );

   // Replace:
   const uint8Array = await downloader.download(file);
   ```
5. Run tests
6. Manual testing: Verify downloads work, especially large files
7. Commit: `refactor: extract FileDownloader service`

**Files Changed:**
- Created: `src/services/dropbox/FileDownloader.ts`
- Modified: `main.ts`

**Tests to Add:**
```typescript
describe('FileDownloader', () => {
  it('should use chunked download for large files', async () => {
    // Mock large file
    // Verify chunked strategy used
  });

  it('should use regular download for small files', async () => {
    // Mock small file
    // Verify regular strategy used
  });

  it('should handle download errors gracefully', async () => {
    // Mock error
    // Verify error handled
  });
});
```

---

### Step 1.4: Reorganize OAuth Folder Structure

**Current State:**
```
src/auth/
└── OAuthManager.ts          # 200+ lines
```

**Target State:**
```
src/services/auth/
├── OAuthManager.ts           # Main manager (thin)
├── flows/
│   ├── DesktopOAuthFlow.ts  # Desktop-specific
│   └── MobileOAuthFlow.ts   # Mobile-specific
└── types.ts                  # Shared types
```

**Migration Steps:**
1. Create new folder structure
2. Extract desktop logic to `DesktopOAuthFlow.ts`:
   ```typescript
   export class DesktopOAuthFlow {
     async authenticate(clientId: string): Promise<AuthResult> {
       // Desktop OAuth logic
     }

     private async startLocalServer(verifier: string): Promise<void> {
       // Server logic
     }
   }
   ```
3. Extract mobile logic to `MobileOAuthFlow.ts`:
   ```typescript
   export class MobileOAuthFlow {
     async authenticate(clientId: string): Promise<AuthResult> {
       // Mobile OAuth logic
     }

     async handleCallback(params: URLSearchParams): Promise<void> {
       // Callback handling
     }
   }
   ```
4. Update `OAuthManager.ts` to delegate:
   ```typescript
   export class OAuthManager {
     async authenticate(): Promise<void> {
       if (PlatformHelper.isDesktop()) {
         const flow = new DesktopOAuthFlow(this.plugin, this.clientId);
         await flow.authenticate();
       } else {
         const flow = new MobileOAuthFlow(this.plugin, this.clientId);
         await flow.authenticate();
       }
     }
   }
   ```
5. Update imports in main.ts
6. Run tests
7. Manual testing: Test OAuth on Desktop and Mobile
8. Commit: `refactor: reorganize OAuth into flow-specific classes`

**Files Changed:**
- Created: `src/services/auth/flows/DesktopOAuthFlow.ts`
- Created: `src/services/auth/flows/MobileOAuthFlow.ts`
- Created: `src/services/auth/types.ts`
- Modified: `src/services/auth/OAuthManager.ts`
- Deleted: `src/auth/OAuthManager.ts` (moved)
- Modified: `main.ts` (update import path)

---

### Phase 1 Completion Checklist
- [ ] All 4 services extracted
- [ ] Tests added for each service
- [ ] All existing tests still passing
- [ ] Manual testing on Desktop completed
- [ ] Manual testing on Mobile completed
- [ ] Code review completed
- [ ] Documentation updated
- [ ] main.ts reduced to ~600 lines
- [ ] Commit message: `refactor(phase1): extract services from main.ts`
- [ ] Merge to main branch

---

## Phase 2: Extract Sync Logic

**Goal:** Extract sync orchestration from main.ts into dedicated classes
**Duration:** 3-4 days
**Risk Level:** 🟡 Medium
**Lines Reduced:** ~600 → ~300 lines in main.ts

### Pre-Refactoring Checklist
- [ ] Phase 1 completed and merged
- [ ] All tests passing
- [ ] Create feature branch: `refactor/phase2-extract-sync-logic`
- [ ] Review current sync flow thoroughly

### Step 2.1: Create FileSyncStrategy

**Purpose:** Encapsulate "should we sync this file?" logic

**Current State:**
```typescript
// main.ts (scattered throughout syncFiles)
if (this.settings.skippedExtensions.includes(fileExtension)) {
  continue;
}

if (PlatformHelper.isMobile() && file.size > this.settings.maxFileSizeMobile) {
  continue;
}

if (this.settings.processedFiles[fileId] === file.size) {
  continue;
}
```

**Target State:**
```typescript
// src/domain/sync/FileSyncStrategy.ts
export interface SyncDecision {
  shouldSync: boolean;
  reason?: string;
  action: 'process' | 'copy' | 'skip';
}

export class FileSyncStrategy {
  constructor(
    private settings: DrpbxFetcherSettings,
    private processorRegistry: ProcessorRegistry
  ) {}

  async decide(file: FileMetadata, path: string): Promise<SyncDecision> {
    // Extension in skip list?
    if (this.isExtensionSkipped(file)) {
      return { shouldSync: false, reason: 'extension skipped', action: 'skip' };
    }

    // Too large for mobile?
    if (this.isTooLargeForMobile(file)) {
      return { shouldSync: false, reason: 'too large for mobile', action: 'skip' };
    }

    // Already processed?
    if (this.isAlreadyProcessed(file)) {
      return { shouldSync: false, reason: 'already processed', action: 'skip' };
    }

    // Find processor
    const processor = this.processorRegistry.findProcessorForFile(path, ...);

    if (processor) {
      return { shouldSync: true, action: 'process' };
    } else {
      return { shouldSync: true, action: 'copy' };
    }
  }

  private isExtensionSkipped(file: FileMetadata): boolean {
    // ...
  }

  private isTooLargeForMobile(file: FileMetadata): boolean {
    // ...
  }

  private isAlreadyProcessed(file: FileMetadata): boolean {
    // ...
  }
}
```

**Migration Steps:**
1. Create `src/domain/sync/FileSyncStrategy.ts`
2. Extract all skip logic into methods
3. Create comprehensive tests
4. Integrate into main.ts:
   ```typescript
   private syncStrategy: FileSyncStrategy;

   async onload() {
     this.syncStrategy = new FileSyncStrategy(
       this.settings,
       ProcessorRegistry.getInstance()
     );
   }

   async syncFiles() {
     for (const file of files) {
       const decision = await this.syncStrategy.decide(file, path);

       if (!decision.shouldSync) {
         StreamLogger.log('Skipping file', { reason: decision.reason });
         continue;
       }

       if (decision.action === 'process') {
         // process
       } else {
         // copy
       }
     }
   }
   ```
5. Run tests
6. Commit: `refactor: extract FileSyncStrategy`

**Tests to Add:**
```typescript
describe('FileSyncStrategy', () => {
  it('should skip files with skipped extensions', async () => {
    // Test logic
  });

  it('should skip files too large for mobile', async () => {
    // Test logic
  });

  it('should skip already processed files', async () => {
    // Test logic
  });

  it('should decide to process files with processors', async () => {
    // Test logic
  });

  it('should decide to copy files without processors', async () => {
    // Test logic
  });
});
```

---

### Step 2.2: Create ProcessorRouter

**Purpose:** Centralize processor routing logic

**Current State:**
```typescript
// main.ts
const processorResult = registry.findProcessorForFile(
  pathLower,
  fileExtension,
  this.settings.fileTypeMappings
);

const processor = processorResult?.processor || null;
const processorMapping = processorResult?.mapping || null;

if (processor && processorMapping) {
  await processor.process(...);
}
```

**Target State:**
```typescript
// src/domain/sync/ProcessorRouter.ts
export class ProcessorRouter {
  constructor(
    private registry: ProcessorRegistry,
    private settings: DrpbxFetcherSettings
  ) {}

  async routeAndProcess(
    file: FileMetadata,
    fileData: Uint8Array,
    path: string,
    context: ProcessorContext
  ): Promise<ProcessorResult | null> {
    const result = this.registry.findProcessorForFile(
      path,
      FileUtils.getExtension(file.name),
      this.settings.fileTypeMappings
    );

    if (!result) {
      return null;
    }

    const { processor, mapping } = result;

    StreamLogger.log('Processing file', {
      fileName: file.name,
      processorName: processor.name
    });

    const processResult = await processor.process(
      fileData,
      path,
      file,
      mapping.config,
      context
    );

    if (processResult.success) {
      await this.updateProcessedTracking(file, mapping);
    }

    return processResult;
  }

  private async updateProcessedTracking(
    file: FileMetadata,
    mapping: FileTypeMapping
  ): Promise<void> {
    this.settings.processedFiles[file.id] = file.size;
    // Save settings
  }
}
```

**Migration Steps:**
1. Create `src/domain/sync/ProcessorRouter.ts`
2. Extract processor routing logic
3. Include tracking updates
4. Integrate into main.ts
5. Add tests
6. Commit: `refactor: extract ProcessorRouter`

---

### Step 2.3: Create SyncOrchestrator

**Purpose:** High-level sync coordination

**Current State:**
```typescript
// main.ts
async syncFiles(): Promise<void> {
  // 478 lines of orchestration
}
```

**Target State:**
```typescript
// src/application/SyncOrchestrator.ts
export class SyncOrchestrator {
  constructor(
    private dropboxFactory: DropboxClientFactory,
    private downloader: FileDownloader,
    private syncStrategy: FileSyncStrategy,
    private processorRouter: ProcessorRouter,
    private statusBar: StatusBarService,
    private settings: DrpbxFetcherSettings,
    private vault: Vault,
    private app: App
  ) {}

  async sync(): Promise<SyncResult> {
    if (this.isSyncing) {
      this.statusBar.show("⏳ Fetch already in progress");
      return { success: false, reason: 'already syncing' };
    }

    if (this.settings.folderMappings.length === 0) {
      this.statusBar.showError("No folder mappings configured");
      return { success: false, reason: 'no mappings' };
    }

    this.isSyncing = true;
    this.statusBar.show("⏳ Fetching from Dropbox...");

    try {
      const dbx = await this.dropboxFactory.createClient();
      const stats = new SyncStatistics();

      for (const mapping of this.settings.folderMappings) {
        await this.syncFolder(mapping, dbx, stats);
      }

      this.showCompletionSummary(stats);
      return { success: true, stats };
    } catch (error) {
      this.handleSyncError(error);
      return { success: false, error };
    } finally {
      this.isSyncing = false;
    }
  }

  private async syncFolder(
    mapping: FolderMapping,
    dbx: Dropbox,
    stats: SyncStatistics
  ): Promise<void> {
    // Folder sync logic
  }

  private async syncFile(
    file: FileMetadata,
    mapping: FolderMapping,
    dbx: Dropbox,
    stats: SyncStatistics,
    index: number,
    total: number
  ): Promise<void> {
    this.statusBar.showProgress(index + 1, total);

    const decision = await this.syncStrategy.decide(file, file.path_display);

    if (!decision.shouldSync) {
      stats.skipped++;
      return;
    }

    const fileData = await this.downloader.download(file);

    if (decision.action === 'process') {
      await this.processFile(file, fileData, mapping, stats);
    } else {
      await this.copyFile(file, fileData, mapping, stats);
    }
  }

  // ... more private methods
}
```

**Migration Steps:**
1. Create `src/application/SyncOrchestrator.ts`
2. Create `src/application/SyncResult.ts` (types)
3. Extract orchestration logic from main.ts
4. In main.ts:
   ```typescript
   private orchestrator: SyncOrchestrator;

   async onload() {
     this.orchestrator = new SyncOrchestrator(
       this.dropboxFactory,
       // ... inject all services
     );
   }

   async syncFiles(): Promise<void> {
     await this.orchestrator.sync();
   }
   ```
5. Add comprehensive tests
6. Commit: `refactor: extract SyncOrchestrator`

**Tests to Add:**
```typescript
describe('SyncOrchestrator', () => {
  it('should prevent concurrent syncs', async () => {
    // Test concurrent calls
  });

  it('should sync all folder mappings', async () => {
    // Mock multiple mappings
  });

  it('should handle sync errors gracefully', async () => {
    // Mock error
  });

  it('should update statistics correctly', async () => {
    // Verify stats
  });
});
```

---

### Phase 2 Completion Checklist
- [ ] FileSyncStrategy extracted and tested
- [ ] ProcessorRouter extracted and tested
- [ ] SyncOrchestrator extracted and tested
- [ ] All existing tests still passing
- [ ] Manual testing completed
- [ ] main.ts reduced to ~300 lines
- [ ] Code review completed
- [ ] Commit message: `refactor(phase2): extract sync orchestration logic`
- [ ] Merge to main branch

---

## Phase 3: Unify Metadata

**Goal:** Create single abstraction for all metadata storage
**Duration:** 2-3 days
**Risk Level:** 🟡 Medium
**Migration Required:** Yes

### Pre-Refactoring Checklist
- [ ] Phase 2 completed and merged
- [ ] All tests passing
- [ ] Create feature branch: `refactor/phase3-unify-metadata`
- [ ] Backup current metadata (data.json, viwoodsNoteMetadata.md)

### Step 3.1: Create MetadataStore Interface

**Target:**
```typescript
// src/infrastructure/storage/MetadataStore.ts
export interface MetadataStore<T> {
  load(): Promise<Record<string, T>>;
  save(data: Record<string, T>): Promise<void>;
  get(key: string): Promise<T | null>;
  set(key: string, value: T): Promise<void>;
  delete(key: string): Promise<void>;
  clear(): Promise<void>;
  has(key: string): Promise<boolean>;
}

export interface ProcessedFilesStore {
  wasProcessed(fileId: string, size: number): Promise<boolean>;
  markProcessed(fileId: string, size: number): Promise<void>;
  clearAll(): Promise<void>;
}
```

**Migration Steps:**
1. Create interface file
2. Document all methods
3. Define type parameters
4. Commit: `refactor: define MetadataStore interface`

---

### Step 3.2: Create Vault-Based Implementation

**Target:**
```typescript
// src/infrastructure/storage/VaultMetadataStore.ts
export class VaultMetadataStore<T> implements MetadataStore<T> {
  private cache: Record<string, T> | null = null;

  constructor(
    private vault: Vault,
    private filePath: string,
    private serializer: MetadataSerializer<T>
  ) {}

  async load(): Promise<Record<string, T>> {
    if (this.cache) return this.cache;

    try {
      const content = await this.vault.adapter.read(this.filePath);
      this.cache = this.serializer.deserialize(content);
      return this.cache;
    } catch (error) {
      this.cache = {};
      return this.cache;
    }
  }

  async save(data: Record<string, T>): Promise<void> {
    const content = this.serializer.serialize(data);
    await this.ensureFolder();
    await this.vault.adapter.write(this.filePath, content);
    this.cache = data;
  }

  async get(key: string): Promise<T | null> {
    const data = await this.load();
    return data[key] || null;
  }

  async set(key: string, value: T): Promise<void> {
    const data = await this.load();
    data[key] = value;
    await this.save(data);
  }

  // ... other methods
}
```

**Migration Steps:**
1. Create `VaultMetadataStore.ts`
2. Create `MetadataSerializer.ts` interface
3. Create YAML serializer implementation
4. Add tests for store
5. Commit: `refactor: implement VaultMetadataStore`

---

### Step 3.3: Create Settings-Based Implementation

**Target:**
```typescript
// src/infrastructure/storage/SettingsMetadataStore.ts
export class SettingsMetadataStore<T> implements MetadataStore<T> {
  constructor(
    private settings: DrpbxFetcherSettings,
    private key: keyof DrpbxFetcherSettings,
    private saveSettings: () => Promise<void>
  ) {}

  async load(): Promise<Record<string, T>> {
    return (this.settings[this.key] as Record<string, T>) || {};
  }

  async save(data: Record<string, T>): Promise<void> {
    (this.settings as Record<string, unknown>)[this.key] = data;
    await this.saveSettings();
  }

  // ... other methods
}
```

**Migration Steps:**
1. Create `SettingsMetadataStore.ts`
2. Add tests
3. Commit: `refactor: implement SettingsMetadataStore`

---

### Step 3.4: Migrate Existing Metadata

**Target:**
- Processed files: Use SettingsMetadataStore
- Viwoods note metadata: Use VaultMetadataStore

**Migration Steps:**
1. Update processors to use MetadataStore interface
2. Inject appropriate implementation
3. Add migration logic if needed
4. Test thoroughly
5. Commit: `refactor: migrate to MetadataStore abstraction`

**Migration Code:**
```typescript
// In main.ts onload()
this.processedFilesStore = new SettingsMetadataStore(
  this.settings,
  'processedFiles',
  () => this.saveSettings()
);

this.viwoodsMetadataStore = new VaultMetadataStore(
  this.app.vault,
  'Viwoods/resources/viwoodsNoteMetadata.md',
  new YAMLMetadataSerializer()
);
```

---

### Phase 3 Completion Checklist
- [ ] MetadataStore interface defined
- [ ] VaultMetadataStore implemented and tested
- [ ] SettingsMetadataStore implemented and tested
- [ ] All metadata migrated to new abstraction
- [ ] All existing tests passing
- [ ] Manual testing completed
- [ ] Backup verified working
- [ ] Commit message: `refactor(phase3): unify metadata storage`
- [ ] Merge to main branch

---

## Phase 4: Plugin Split

**Goal:** Split into generic sync engine + Viwoods extension
**Duration:** 10-15 days
**Risk Level:** 🔴 Very High
**User Impact:** High (migration required)

### Pre-Refactoring Checklist
- [ ] Phase 3 completed and merged
- [ ] User research conducted (do users want this?)
- [ ] Community feedback gathered
- [ ] Create feature branch: `feat/plugin-split`
- [ ] Design plugin API
- [ ] Plan migration strategy

### Step 4.1: Design Plugin API

**Target:**
```typescript
// Dropbox Fetcher Core API
export interface FileProcessorPlugin {
  id: string;
  name: string;
  version: string;
  processor: FileProcessor;

  onload(api: DrpbxFetcherAPI): void;
  onunload(): void;
}

export interface DrpbxFetcherAPI {
  registerProcessor(processor: FileProcessor): void;
  unregisterProcessor(type: string): void;
  onBeforeSync(callback: () => void): void;
  onAfterSync(callback: (result: SyncResult) => void): void;
  getSettings(): Readonly<DrpbxFetcherSettings>;
}
```

**Tasks:**
1. Design API interface
2. Document API
3. Create example plugin
4. Get community feedback
5. Iterate on design

---

### Step 4.2: Extract Core Plugin

**Target:**
```
dropbox-fetcher-core/
├── main.ts              # Core sync engine only
├── src/
│   ├── application/     # Sync orchestration
│   ├── domain/          # Sync logic
│   ├── infrastructure/  # Dropbox, storage
│   ├── api/             # Plugin API
│   └── ui/              # Settings
└── manifest.json
```

**Tasks:**
1. Remove all Viwoods code
2. Keep only core sync + DefaultProcessor
3. Implement plugin API
4. Test thoroughly
5. Prepare for release

---

### Step 4.3: Create Viwoods Extension Plugin

**Target:**
```
viwoods-notes/
├── main.ts              # Viwoods plugin entry
├── src/
│   ├── processors/      # All Viwoods processors
│   ├── utils/           # Viwoods-specific utils
│   └── ui/              # Viwoods settings
├── manifest.json
└── README.md
```

**Tasks:**
1. Extract Viwoods code
2. Implement FileProcessorPlugin interface
3. Register processors via API
4. Test integration
5. Prepare for release

---

### Step 4.4: User Migration Plan

**Tasks:**
1. Write migration guide
2. Provide migration script if possible
3. Support both plugins during transition
4. Communicate changes clearly
5. Monitor issues

**Migration Guide:**
```markdown
# Migration Guide: v1 → v2 (Plugin Split)

## What's Changing
The Dropbox Fetcher plugin is splitting into:
- Dropbox Fetcher Core (generic sync)
- Viwoods Notes Extension (Viwoods processing)

## Why?
- Lighter core for non-Viwoods users
- Faster iteration on Viwoods features
- Cleaner architecture

## Migration Steps
1. Update to final v1.x release
2. Install Dropbox Fetcher Core v2.0
3. Install Viwoods Notes Extension v1.0
4. Verify settings transferred
5. Uninstall old plugin

## Timeline
- v1.x: Continue supporting for 6 months
- v2.0: Released XX/XX/XXXX
- Deprecation: XX/XX/XXXX
```

---

### Phase 4 Completion Checklist
- [ ] Plugin API designed and documented
- [ ] Core plugin extracted and tested
- [ ] Viwoods extension created and tested
- [ ] Integration tested
- [ ] Migration guide written
- [ ] Community informed
- [ ] Both plugins released
- [ ] Migration support period planned
- [ ] Commit message: `feat(phase4): split into core + viwoods plugins`

---

## Risk Management

### Risk Matrix

| Risk | Probability | Impact | Mitigation |
|------|------------|--------|------------|
| Break existing functionality | Medium | High | Comprehensive testing, gradual rollout |
| User data loss | Low | Critical | Backup procedures, migration testing |
| Performance regression | Low | Medium | Benchmarking, performance tests |
| User confusion | Medium | Medium | Clear communication, documentation |
| Increased complexity | Medium | Low | Focus on simplification, not complexity |

### Mitigation Strategies

**1. Comprehensive Testing**
- Unit tests for all new code
- Integration tests for refactored flows
- Manual testing on all platforms
- Beta testing with community

**2. Gradual Rollout**
- Feature branch development
- Code review before merge
- Beta releases before stable
- Monitor issues closely

**3. Backup Procedures**
- Document backup steps
- Auto-backup before migration
- Easy rollback process
- Support for old versions

**4. Clear Communication**
- Announce changes in advance
- Provide migration guides
- Maintain changelog
- Responsive to issues

---

## Testing Strategy

### Unit Tests
**Coverage Target:** >80%

**Key Areas:**
- All new service classes
- Sync strategy logic
- Processor routing
- Metadata storage
- Error handling

**Example:**
```typescript
describe('SyncOrchestrator', () => {
  let orchestrator: SyncOrchestrator;
  let mockDropbox: jest.Mocked<DropboxClientFactory>;
  let mockDownloader: jest.Mocked<FileDownloader>;
  // ... more mocks

  beforeEach(() => {
    // Setup mocks
    orchestrator = new SyncOrchestrator(
      mockDropbox,
      mockDownloader,
      // ... inject mocks
    );
  });

  it('should sync successfully', async () => {
    // Test logic
  });
});
```

### Integration Tests
**Key Flows:**
- Full sync flow (end-to-end)
- OAuth flow (Desktop + Mobile)
- Processor pipeline
- Error recovery

**Example:**
```typescript
describe('Full Sync Integration', () => {
  it('should sync files from Dropbox to vault', async () => {
    // Mock Dropbox API
    // Mock vault
    // Run sync
    // Verify files created
  });
});
```

### Manual Testing Checklist

**Phase 1:**
- [ ] Desktop: OAuth works
- [ ] Mobile: OAuth works
- [ ] Status bar updates correctly
- [ ] File downloads work (small + large)
- [ ] Chunked downloads work

**Phase 2:**
- [ ] Sync orchestration works
- [ ] Files processed correctly
- [ ] Files copied correctly
- [ ] Skip logic works (extensions, size, already processed)
- [ ] Error handling graceful

**Phase 3:**
- [ ] Metadata saves correctly
- [ ] Metadata loads correctly
- [ ] Migration from old format successful
- [ ] No data loss

**Phase 4:**
- [ ] Both plugins install
- [ ] Viwoods extension registers
- [ ] Processing works via API
- [ ] Settings accessible
- [ ] Migration successful

---

## Rollback Procedures

### Phase 1 Rollback
**If:** Services extraction breaks functionality
**Steps:**
1. Identify breaking commit
2. `git revert <commit>`
3. Run tests
4. Deploy rollback
5. Investigate issue

**Recovery Time:** <1 hour

### Phase 2 Rollback
**If:** Sync orchestration breaks
**Steps:**
1. `git revert` phase 2 commits
2. Run full test suite
3. Manual testing
4. Deploy rollback
5. Post-mortem

**Recovery Time:** <2 hours

### Phase 3 Rollback
**If:** Metadata migration loses data
**Steps:**
1. Immediately notify users to stop using
2. Restore from backups
3. `git revert` phase 3 commits
4. Verify data integrity
5. Deploy rollback
6. Comprehensive investigation

**Recovery Time:** <4 hours
**User Impact:** Potentially high

### Phase 4 Rollback
**If:** Plugin split causes major issues
**Steps:**
1. Provide old version download
2. Create hotfix branch
3. Issue critical fix
4. Post-mortem and re-plan

**Recovery Time:** <1 day
**User Impact:** High

---

## Success Metrics

### Phase 1
- ✅ main.ts reduced to ~600 lines
- ✅ 4 service classes created
- ✅ Test coverage >70%
- ✅ No functionality broken
- ✅ Community feedback positive

### Phase 2
- ✅ main.ts reduced to ~300 lines
- ✅ Sync logic extracted and tested
- ✅ Test coverage >80%
- ✅ No functionality broken
- ✅ Performance unchanged or improved

### Phase 3
- ✅ Single metadata abstraction
- ✅ All metadata migrated successfully
- ✅ Zero data loss
- ✅ Test coverage maintained
- ✅ Users report no issues

### Phase 4
- ✅ Two functional plugins
- ✅ >90% users migrate successfully
- ✅ <5% support requests
- ✅ Core plugin has non-Viwoods users
- ✅ Viwoods plugin development faster

---

## Timeline

### Conservative Estimate

**Phase 1:** 2 weeks
- Week 1: Implementation
- Week 2: Testing + bug fixes

**Phase 2:** 3 weeks
- Week 1-2: Implementation
- Week 3: Testing + bug fixes

**Phase 3:** 2 weeks
- Week 1: Implementation
- Week 2: Migration testing

**Phase 4:** 6 weeks (if proceeding)
- Week 1-2: Design + API
- Week 3-4: Implementation
- Week 5: Testing
- Week 6: Migration support

**Total:** 7 weeks (without Phase 4), 13 weeks (with Phase 4)

### Aggressive Estimate

**Phase 1:** 1 week
**Phase 2:** 2 weeks
**Phase 3:** 1 week
**Phase 4:** 4 weeks

**Total:** 4 weeks (without Phase 4), 8 weeks (with Phase 4)

---

## Conclusion

This roadmap provides a structured approach to improving the Dropbox Fetcher architecture while managing risk. The key is **incremental progress** with **comprehensive testing** at each phase.

**Recommended Approach:**
1. Start with Phase 1 (low risk, high value)
2. Evaluate before proceeding to Phase 2
3. Consider Phase 3 based on feedback
4. Only pursue Phase 4 if there's clear user demand

**Success Criteria:**
- Code is more maintainable
- Tests are more comprehensive
- New features easier to add
- No regression in functionality
- Positive community feedback

**Remember:** The goal is improvement, not perfection. Each phase should deliver value independently.

---

**Document Status:** Complete
**Next Document:** ARCHITECTURE_DIAGRAMS.md
