# Architecture Diagrams: Dropbox Fetcher

**Purpose:** Visual representation of current and proposed architecture
**Format:** Mermaid diagrams (rendered in GitHub/Obsidian)
**Date:** October 2025

---

## Table of Contents
1. [Current Architecture](#current-architecture)
2. [Proposed Architecture](#proposed-architecture)
3. [Data Flow Diagrams](#data-flow-diagrams)
4. [Sequence Diagrams](#sequence-diagrams)
5. [Component Interactions](#component-interactions)

---

## Current Architecture

### High-Level Component View

```mermaid
graph TB
    User[User] --> UI[UI Layer]
    UI --> Main[main.ts - Plugin Core]

    Main --> OAuth[OAuthManager]
    Main --> Registry[ProcessorRegistry]
    Main --> Dropbox[Dropbox SDK]
    Main --> Vault[Obsidian Vault]
    Main --> StatusBar[Status Bar HTML Element]

    Registry --> Default[DefaultProcessor]
    Registry --> Viwoods[ViwoodsProcessor]

    Viwoods --> Learning[LearningProcessor]
    Viwoods --> Paper[PaperProcessor]
    Viwoods --> Meeting[MeetingProcessor]
    Viwoods --> Daily[DailyProcessor]
    Viwoods --> Picking[PickingProcessor]
    Viwoods --> Memo[MemoProcessor]

    Main --> Utils[Utilities]
    Utils --> Logger[StreamLogger]
    Utils --> Platform[PlatformHelper]
    Utils --> Files[FileUtils]
    Utils --> Temp[TempFileManager]
    Utils --> Metadata[MetadataManager]

    style Main fill:#ff6b6b,stroke:#c92a2a,stroke-width:3px
    style Viwoods fill:#4ecdc4,stroke:#0ca697
    style Utils fill:#ffe66d,stroke:#ffd43b
```

### Current Responsibilities - main.ts

```mermaid
mindmap
  root((main.ts<br/>936 lines))
    Plugin Lifecycle
      onload
      onunload
      Settings management
    OAuth
      getDropboxClient
      Token refresh
      Custom fetch wrapper
    Dropbox
      getAllFiles
      Pagination
    Download
      downloadFileInChunks
      downloadFileInChunksToDisk
      Regular download
    Sync Orchestration
      syncFiles - 478 lines!
      Folder iteration
      File iteration
      Progress tracking
    Business Logic
      Skip decisions
      Extension filtering
      Size limits
      Already processed?
    Processor Routing
      findProcessorForFile
      Call processor.process
      Update tracking
    File I/O
      Write to vault
      Create folders
      Modify binary
    UI Updates
      Status bar updates
      Error messages
      Progress display
    Error Handling
      Try-catch blocks
      Logging
      User feedback
```

### Current File Structure

```mermaid
graph LR
    Root[drpbx-fetcher] --> Main[main.ts]
    Root --> Src[src/]

    Src --> Auth[auth/]
    Auth --> OAuthMgr[OAuthManager.ts]

    Src --> Models[models/]
    Models --> Settings[Settings.ts]

    Src --> Proc[processors/]
    Proc --> Types[types.ts]
    Proc --> ProcReg[ProcessorRegistry.ts]
    Proc --> DefProc[DefaultProcessor.ts]
    Proc --> Templates[templates/]
    Proc --> Viw[ViwoodsProcessor/]

    Viw --> ViwIdx[index.ts]
    Viw --> ViwTypes[ViwoodsTypes.ts]
    Viw --> Modules[modules/]
    Viw --> ViwUtils[utils/]

    Modules --> Learn[LearningProcessor.ts]
    Modules --> Ppr[PaperProcessor.ts]
    Modules --> Meet[MeetingProcessor.ts]
    Modules --> Dly[daily/]
    Modules --> Pick[PickingProcessor.ts]
    Modules --> Mem[MemoProcessor.ts]

    Src --> UI[ui/]
    UI --> SettingsTab[SettingsTab.ts]
    UI --> ConfigModal[ProcessorConfigModal.ts]

    Src --> Utils[utils/]
    Utils --> Crypto[crypto.ts]
    Utils --> Platform[platform.ts]
    Utils --> FileUt[FileUtils.ts]
    Utils --> Stream[StreamLogger.ts]
    Utils --> TempFM[TempFileManager.ts]
    Utils --> ImgCache[ImageCacheBuster.ts]
    Utils --> MetaMgr[MetadataManager.ts]

    style Main fill:#ff6b6b,stroke:#c92a2a,stroke-width:3px
    style Viw fill:#4ecdc4,stroke:#0ca697
    style Utils fill:#ffe66d,stroke:#ffd43b
```

---

## Proposed Architecture

### Clean Architecture Layers

```mermaid
graph TB
    subgraph Presentation["Presentation Layer"]
        UI1[SettingsTab]
        UI2[StatusBar Service]
        UI3[ProcessorConfigModal]
    end

    subgraph Application["Application Layer"]
        App1[SyncOrchestrator]
    end

    subgraph Domain["Domain Layer"]
        Dom1[FileDownloader]
        Dom2[ProcessorRouter]
        Dom3[FileSyncStrategy]
        Dom4[ProcessorRegistry]

        subgraph Processors["Processors"]
            Proc1[DefaultProcessor]
            Proc2[ViwoodsProcessor]
            Proc3[Future Processors]
        end
    end

    subgraph Infrastructure["Infrastructure Layer"]
        Infra1[DropboxAdapter]
        Infra2[OAuthManager]
        Infra3[MetadataStore]
        Infra4[VaultStore]
        Infra5[Logger]
        Infra6[TempFileManager]
    end

    UI1 --> App1
    UI2 --> App1

    App1 --> Dom1
    App1 --> Dom2
    App1 --> Dom3
    App1 --> Dom4

    Dom2 --> Processors
    Dom1 --> Infra1
    Dom3 --> Dom4

    Dom1 --> Infra6
    App1 --> Infra3
    App1 --> Infra4
    App1 --> Infra5

    Infra1 --> Infra2

    style Application fill:#51cf66,stroke:#2f9e44
    style Domain fill:#339af0,stroke:#1971c2
    style Infrastructure fill:#ffd43b,stroke:#fab005
    style Presentation fill:#ff6b6b,stroke:#c92a2a
```

### Proposed File Structure

```mermaid
graph LR
    Root[drpbx-fetcher] --> Main2[main.ts<br/>~300 lines]
    Root --> Src2[src/]

    Src2 --> App2[application/]
    App2 --> SyncOrch[SyncOrchestrator.ts]

    Src2 --> Domain[domain/]
    Domain --> Sync[sync/]
    Domain --> Download[download/]
    Domain --> Proc2[processors/]

    Sync --> SyncStrat[FileSyncStrategy.ts]
    Sync --> ProcRouter[ProcessorRouter.ts]
    Sync --> SyncRes[SyncResult.ts]

    Download --> FileDL[FileDownloader.ts]
    Download --> ChunkDL[ChunkedDownloader.ts]
    Download --> DLStrat[DownloadStrategy.ts]

    Proc2 --> ProcReg2[ProcessorRegistry.ts]
    Proc2 --> DefProc2[DefaultProcessor.ts]
    Proc2 --> Viw2[viwoods/]

    Src2 --> Infra[infrastructure/]
    Infra --> Dbx[dropbox/]
    Infra --> Storage[storage/]
    Infra --> Logging[logging/]

    Dbx --> DbxAdapter[DropboxAdapter.ts]
    Dbx --> DbxClient[DropboxClient.ts]
    Dbx --> OAuth2[oauth/]

    OAuth2 --> OAuthMgr2[OAuthManager.ts]
    OAuth2 --> Desktop[DesktopFlow.ts]
    OAuth2 --> Mobile[MobileFlow.ts]

    Storage --> MetaStore[MetadataStore.ts]
    Storage --> VaultMeta[VaultMetadataStore.ts]
    Storage --> SettMeta[SettingsMetadataStore.ts]
    Storage --> VaultSt[VaultStore.ts]

    Logging --> Logger2[Logger.ts]
    Logging --> ConsLog[ConsoleLogger.ts]
    Logging --> StrLog[StreamLogger.ts]

    Src2 --> Pres[presentation/]
    Pres --> SetTab2[SettingsTab.ts]
    Pres --> StatBar[StatusBar.ts]
    Pres --> ConfMod[ProcessorConfigModal.ts]

    Src2 --> Shared[shared/]
    Shared --> Ut[utils/]
    Shared --> Ty[types/]
    Shared --> Const[constants/]

    style Main2 fill:#51cf66,stroke:#2f9e44,stroke-width:3px
    style App2 fill:#51cf66,stroke:#2f9e44
    style Domain fill:#339af0,stroke:#1971c2
    style Infra fill:#ffd43b,stroke:#fab005
    style Pres fill:#ff6b6b,stroke:#c92a2a
```

### Dependency Injection Flow

```mermaid
graph TD
    Main[main.ts - Plugin Entry] --> |creates| Services[Service Instances]

    Services --> DbxFactory[DropboxClientFactory]
    Services --> StatBar[StatusBarService]
    Services --> TempMgr[TempFileManager]
    Services --> ProcReg[ProcessorRegistry]

    Main --> |injects into| Orch[SyncOrchestrator]

    DbxFactory --> |injected| Orch
    StatBar --> |injected| Orch
    TempMgr --> |injected| Orch
    ProcReg --> |injected| Orch

    Orch --> |creates| DL[FileDownloader]
    Orch --> |creates| SyncStrat[FileSyncStrategy]
    Orch --> |creates| Router[ProcessorRouter]

    DbxFactory --> |used by| DL
    TempMgr --> |used by| DL
    ProcReg --> |used by| Router
    ProcReg --> |used by| SyncStrat

    style Main fill:#51cf66,stroke:#2f9e44,stroke-width:3px
    style Orch fill:#339af0,stroke:#1971c2,stroke-width:2px
```

---

## Data Flow Diagrams

### Current: File Sync Flow

```mermaid
sequenceDiagram
    actor User
    participant Main as main.ts
    participant Dropbox as Dropbox API
    participant Registry as ProcessorRegistry
    participant Processor as FileProcessor
    participant Vault as Obsidian Vault
    participant StatusBar as Status Bar

    User->>Main: Click sync button
    Main->>StatusBar: "Fetching from Dropbox..."
    Main->>Dropbox: getDropboxClient()
    Dropbox-->>Main: Dropbox instance

    loop For each folder mapping
        Main->>Dropbox: getAllFiles(path)
        Dropbox-->>Main: FileMetadata[]

        loop For each file
            Main->>StatusBar: "X/Y files"
            Main->>Main: Check skip conditions

            alt Should skip
                Main->>Main: Continue to next file
            else Should sync
                Main->>Dropbox: Download file (chunked or regular)
                Dropbox-->>Main: Uint8Array

                Main->>Registry: findProcessorForFile()
                Registry-->>Main: Processor | null

                alt Processor found
                    Main->>Processor: process(data, path, metadata, config)
                    Processor->>Vault: Write markdown + resources
                    Processor-->>Main: ProcessorResult
                    Main->>Main: Update processedFiles tracking
                else No processor
                    Main->>Vault: createBinary() / modifyBinary()
                end
            end
        end
    end

    Main->>StatusBar: "✓ Fetch complete: X files"
    Main-->>User: Sync complete
```

### Proposed: File Sync Flow

```mermaid
sequenceDiagram
    actor User
    participant UI as StatusBarService
    participant Orch as SyncOrchestrator
    participant Factory as DropboxClientFactory
    participant DL as FileDownloader
    participant Strat as FileSyncStrategy
    participant Router as ProcessorRouter
    participant Proc as FileProcessor
    participant Vault as VaultStore

    User->>Orch: sync()
    Orch->>UI: show("Fetching...")
    Orch->>Factory: createClient()
    Factory-->>Orch: Dropbox instance

    loop For each folder mapping
        Orch->>Factory: listFiles(path)
        Factory-->>Orch: FileMetadata[]

        loop For each file
            Orch->>UI: showProgress(x, total)
            Orch->>Strat: decide(file, path)
            Strat-->>Orch: SyncDecision

            alt Should skip
                Orch->>Orch: Continue
            else Should sync
                Orch->>DL: download(file)
                DL-->>Orch: Uint8Array

                alt Action: process
                    Orch->>Router: routeAndProcess(file, data)
                    Router->>Proc: process(data, ...)
                    Proc->>Vault: write files
                    Proc-->>Router: ProcessorResult
                    Router->>Router: Update tracking
                    Router-->>Orch: Result
                else Action: copy
                    Orch->>Vault: writeFile(data)
                end
            end
        end
    end

    Orch->>UI: showCompletion(summary)
    Orch-->>User: SyncResult
```

### Metadata Flow

```mermaid
graph TD
    A[File Processed] --> B{Needs Metadata?}
    B -->|Yes| C[Get MetadataStore]
    B -->|No| Z[Done]

    C --> D{Store Type?}
    D -->|Vault| E[VaultMetadataStore]
    D -->|Settings| F[SettingsMetadataStore]

    E --> G[Load from .md file]
    G --> H[Parse YAML frontmatter]
    H --> I[Update metadata record]
    I --> J[Serialize to YAML]
    J --> K[Write to .md file]
    K --> Z

    F --> L[Load from data.json]
    L --> M[Update settings object]
    M --> N[Call saveSettings]
    N --> Z

    style E fill:#4ecdc4,stroke:#0ca697
    style F fill:#ffe66d,stroke:#ffd43b
```

---

## Sequence Diagrams

### OAuth Flow - Desktop

```mermaid
sequenceDiagram
    actor User
    participant Settings as SettingsTab
    participant OAuth as OAuthManager
    participant Flow as DesktopOAuthFlow
    participant Server as LocalServer
    participant Browser as Browser
    participant Dropbox as Dropbox API
    participant Plugin as DrpbxFetcherPlugin

    User->>Settings: Click "Authenticate"
    Settings->>OAuth: authenticate()
    OAuth->>Flow: authenticate(clientId)

    Flow->>Flow: Generate PKCE verifier & challenge
    Flow->>Plugin: Save code verifier to settings
    Flow->>Server: Start local server on :53134
    Server-->>Flow: Server running

    Flow->>Browser: Open auth URL with challenge
    User->>Browser: Authorize app
    Browser->>Dropbox: User authorizes
    Dropbox->>Server: Redirect with auth code
    Server->>Flow: Receive auth code

    Flow->>Dropbox: Exchange code for tokens (with verifier)
    Dropbox-->>Flow: Access token + Refresh token
    Flow->>Plugin: Save tokens to settings
    Flow->>Server: Stop server
    Flow-->>OAuth: Success
    OAuth-->>Settings: Success
    Settings->>Settings: Update UI: "Authenticated ✓"
```

### OAuth Flow - Mobile

```mermaid
sequenceDiagram
    actor User
    participant Settings as SettingsTab
    participant OAuth as OAuthManager
    participant Flow as MobileOAuthFlow
    participant Browser as External Browser
    participant Dropbox as Dropbox API
    participant Obsidian as Obsidian App
    participant Plugin as DrpbxFetcherPlugin

    User->>Settings: Click "Authenticate"
    Settings->>OAuth: authenticate()
    OAuth->>Flow: authenticate(clientId)

    Flow->>Flow: Generate PKCE verifier & challenge
    Flow->>Plugin: Save code verifier + authInProgress=true
    Flow->>Browser: Open auth URL with challenge

    User->>Browser: Authorize app
    Browser->>Dropbox: User authorizes
    Dropbox->>Obsidian: obsidian://dropbox-callback?code=...

    Obsidian->>Plugin: Protocol handler triggered
    Plugin->>Flow: handleMobileCallback(params)
    Flow->>Dropbox: Exchange code for tokens
    Dropbox-->>Flow: Access token + Refresh token
    Flow->>Plugin: Save tokens, authInProgress=false
    Flow-->>OAuth: Success
    OAuth-->>Settings: Success
    Settings->>Settings: Update UI: "Authenticated ✓"
```

### Processor Execution

```mermaid
sequenceDiagram
    participant Orch as SyncOrchestrator
    participant Router as ProcessorRouter
    participant Registry as ProcessorRegistry
    participant Viwoods as ViwoodsProcessor
    participant Module as PaperProcessor
    participant Merger as MarkdownMerger
    participant Vault as Vault
    participant Meta as MetadataManager

    Orch->>Router: routeAndProcess(file, data, path)
    Router->>Registry: findProcessorForFile(path, ext, mappings)

    Registry->>Registry: Check extension mapping
    Registry->>Registry: Check canHandleFile() hooks
    Registry-->>Router: {processor: Viwoods, mapping: ...}

    Router->>Viwoods: process(data, path, file, config, context)
    Viwoods->>Viwoods: Detect module type (Paper)
    Viwoods->>Module: processPaper(data, file, config)

    Module->>Module: Extract ZIP contents
    Module->>Module: Parse NoteFileInfo.json
    Module->>Module: Generate page images

    Module->>Meta: Check for existing note
    Meta-->>Module: Existing metadata (if any)

    Module->>Merger: merge(existingContent, newContent, metadata)
    Merger-->>Module: Merged markdown

    Module->>Vault: Write markdown file
    Module->>Vault: Write page images
    Module->>Meta: Update metadata

    Module-->>Viwoods: ProcessorResult{success, createdFiles, ...}
    Viwoods-->>Router: ProcessorResult
    Router->>Router: Update processedFiles tracking
    Router-->>Orch: ProcessorResult
```

### Error Handling Flow

```mermaid
graph TD
    A[Sync Operation] --> B{Error Occurs?}
    B -->|No| Success[Operation Complete]
    B -->|Yes| C{Error Type?}

    C -->|Network Error| D[Log Error]
    C -->|Auth Error| E[Show Auth Message]
    C -->|File Error| F[Log + Continue]
    C -->|Fatal Error| G[Log + Stop Sync]

    D --> H{Retry?}
    H -->|Yes| I[Exponential Backoff]
    I --> J{Max Retries?}
    J -->|No| A
    J -->|Yes| K[Report Failure]
    H -->|No| K

    E --> L[Clear Tokens]
    L --> M[Prompt Re-auth]

    F --> N[Update Stats]
    N --> O[Continue with Next File]

    G --> P[Clean Up]
    P --> Q[Report to User]

    K --> Q
    M --> Q

    style Success fill:#51cf66
    style Q fill:#ff6b6b
```

---

## Component Interactions

### Service Dependencies (Current)

```mermaid
graph TD
    Main[main.ts] --> |directly uses| Dropbox[Dropbox SDK]
    Main --> |directly uses| Vault[Vault API]
    Main --> |directly uses| StatusBar[HTMLElement]
    Main --> |creates| OAuth[OAuthManager]
    Main --> |accesses| Registry[ProcessorRegistry Singleton]

    OAuth --> |uses| Crypto[PKCEGenerator]
    OAuth --> |uses| Platform[PlatformHelper]

    Registry --> |contains| Processors[FileProcessor instances]
    Processors --> |uses| Template[TemplateEngine]
    Processors --> |uses| Vault

    Main --> |uses| Utils[Various Utils]
    Utils --> |includes| Logger[StreamLogger]
    Utils --> |includes| FileUtils[FileUtils]
    Utils --> |includes| Metadata[MetadataManager]

    style Main fill:#ff6b6b,stroke:#c92a2a,stroke-width:3px
```

### Service Dependencies (Proposed)

```mermaid
graph TD
    Main2[main.ts] --> |creates & injects| Services[Services]

    Services --> DbxFactory[DropboxClientFactory]
    Services --> StatusSvc[StatusBarService]
    Services --> TempMgr[TempFileManager]
    Services --> ProcReg[ProcessorRegistry]

    Main2 --> |injects into| Orch[SyncOrchestrator]

    Orch --> |uses interface| FileSource[FileSource Interface]
    DbxFactory -.->|implements| FileSource

    Orch --> |uses interface| StatusService[StatusService Interface]
    StatusSvc -.->|implements| StatusService

    Orch --> |uses interface| MetaStore[MetadataStore Interface]
    VaultMeta[VaultMetadataStore] -.->|implements| MetaStore
    SettMeta[SettingsMetadataStore] -.->|implements| MetaStore

    Orch --> |creates| DL[FileDownloader]
    Orch --> |creates| SyncStrat[FileSyncStrategy]
    Orch --> |creates| Router[ProcessorRouter]

    DL --> |uses| FileSource
    Router --> |uses| ProcReg
    SyncStrat --> |uses| ProcReg

    style Main2 fill:#51cf66,stroke:#2f9e44,stroke-width:3px
    style Orch fill:#339af0,stroke:#1971c2,stroke-width:2px
```

### Processor Pipeline

```mermaid
graph LR
    File[Downloaded File] --> Filter{Early Filter<br/>shouldSkipFile}
    Filter -->|Skip| Skip[Skipped]
    Filter -->|Process| Route{Route<br/>findProcessorForFile}

    Route -->|Extension Match| ExtProc[Processor by Extension]
    Route -->|Path Match| PathProc[Processor by Path]
    Route -->|No Match| NoPro[No Processor]

    ExtProc --> Process[Processor.process]
    PathProc --> Process
    NoPro --> Copy[Direct Copy to Vault]

    Process --> Validate{Validate Config}
    Validate -->|Invalid| Error[Return Error]
    Validate -->|Valid| Transform[Transform File]

    Transform --> Output{Generate Output}
    Output --> MD[Markdown Files]
    Output --> Resources[Resource Files]
    Output --> Meta[Metadata Updates]

    MD --> Vault[Write to Vault]
    Resources --> Vault
    Meta --> Store[Update Metadata Store]

    Vault --> Track[Update processedFiles]
    Store --> Track
    Track --> Done[Complete]

    Error --> Done
    Copy --> Done
    Skip --> Done

    style Process fill:#339af0,stroke:#1971c2
    style Done fill:#51cf66,stroke:#2f9e44
    style Error fill:#ff6b6b,stroke:#c92a2a
```

### Settings Flow

```mermaid
graph TD
    User[User Opens Settings] --> Tab[SettingsTab]

    Tab --> Gen[General Settings]
    Tab --> Auth[Authentication]
    Tab --> Folders[Folder Mappings]
    Tab --> Types[File Type Mappings]

    Gen --> SyncOn[Sync on Startup]
    Gen --> Delay[Startup Delay]
    Gen --> Mobile[Mobile File Size Limit]
    Gen --> Chunk[Chunk Settings]

    Auth --> ClientID[Client ID Input]
    Auth --> AuthBtn[Authenticate Button]
    AuthBtn --> OAuth[OAuth Flow]

    Folders --> List[Mapping List]
    List --> Add[Add Mapping]
    List --> Delete[Delete Mapping]

    Types --> TypeList[Type Mapping List]
    TypeList --> Config[Configure Processor]
    Config --> Modal[ProcessorConfigModal]

    Modal --> Schema[Get Config Schema]
    Schema --> Fields[Generate UI Fields]
    Fields --> Input[User Input]
    Input --> Validate[Validate Config]
    Validate --> Save[Save to Settings]

    Add --> Save
    Delete --> Save

    Save --> Plugin[Plugin.saveSettings]
    Plugin --> DataJSON[data.json]

    style Tab fill:#ff6b6b,stroke:#c92a2a
    style OAuth fill:#4ecdc4,stroke:#0ca697
    style Modal fill:#ffe66d,stroke:#ffd43b
```

---

## Comparison: Before & After

### Complexity Reduction

```mermaid
graph LR
    subgraph Before ["Current Architecture"]
        B1[main.ts<br/>936 lines<br/>13 responsibilities]
    end

    subgraph After ["Proposed Architecture"]
        A1[main.ts<br/>~300 lines<br/>3 responsibilities]
        A2[SyncOrchestrator<br/>~200 lines]
        A3[DropboxClientFactory<br/>~80 lines]
        A4[FileDownloader<br/>~150 lines]
        A5[StatusBarService<br/>~50 lines]
        A6[FileSyncStrategy<br/>~100 lines]
        A7[ProcessorRouter<br/>~80 lines]
    end

    B1 -.transform.-> A1
    B1 -.extract.-> A2
    B1 -.extract.-> A3
    B1 -.extract.-> A4
    B1 -.extract.-> A5
    B1 -.extract.-> A6
    B1 -.extract.-> A7

    style B1 fill:#ff6b6b,stroke:#c92a2a,stroke-width:3px
    style A1 fill:#51cf66,stroke:#2f9e44,stroke-width:2px
```

### Testability Improvement

```mermaid
graph TB
    subgraph Current ["Current Testability"]
        C1[main.ts] --> C2[Hard to Test]
        C2 --> C3[Tightly Coupled]
        C3 --> C4[Requires Full Plugin]
        C4 --> C5[Difficult to Mock]
    end

    subgraph Proposed ["Proposed Testability"]
        P1[Services] --> P2[Easy to Test]
        P2 --> P3[Loosely Coupled]
        P3 --> P4[Interface-Based]
        P4 --> P5[Easy to Mock]

        P1 --> P6[Unit Tests]
        P1 --> P7[Integration Tests]
        P1 --> P8[E2E Tests]
    end

    style Current fill:#ff6b6b,stroke:#c92a2a
    style Proposed fill:#51cf66,stroke:#2f9e44
```

---

## Legend

### Color Coding

- 🔴 **Red**: Current problematic areas or high-risk components
- 🟢 **Green**: Improved/proposed components
- 🔵 **Blue**: Domain/business logic
- 🟡 **Yellow**: Infrastructure/utilities
- 🟣 **Purple**: Presentation/UI

### Diagram Types

- **Graph**: Structure and relationships
- **Sequence**: Time-ordered interactions
- **Mindmap**: Hierarchical concepts
- **Flowchart**: Decision flows and processes

---

## Usage Notes

These diagrams are written in Mermaid syntax and will render in:
- **GitHub** - Automatic rendering in markdown
- **Obsidian** - With Mermaid plugin
- **VS Code** - With Markdown Preview Enhanced extension
- **Online** - https://mermaid.live/

To edit diagrams:
1. Copy Mermaid code
2. Paste into https://mermaid.live/
3. Make changes
4. Copy back to this file

---

**Document Status:** Complete
**Next Document:** QUICK_WINS.md
