# DRPBX Fetcher Plugin - Technical Specification

## Overview

DRPBX Fetcher is an Obsidian plugin that fetches and processes files from Dropbox folders to the Obsidian vault. The plugin supports multiple file processors, with specialized support for Viwoods app files across different modules (Learning, Paper, Daily, Meeting, Picking, Memo).

## Architecture

### Core Components

#### 1. Plugin Main Class (Location: main.ts - Root Directory)
- **Entry point**: Main plugin class extending Obsidian's `Plugin`
- **Core functionality**: Coordinates file fetching, processing, and UI integration
- **Key methods**:
  - `onload()`: Initializes plugin components
  - `syncFiles()`: Main file synchronization process
  - `getDropboxClient()`: OAuth authentication handling

#### 2. Settings Management (`src/models/Settings.ts`)
- **Main interface**: `DrpbxFetcherSettings`
- **Key settings**:
  - OAuth tokens (accessToken, refreshToken, clientId, codeVerifier)
  - Folder mappings (remote → local paths)
  - File type mappings (extension → processor)
  - Processing configuration
  - Logging preferences

#### 3. File Processor System (`src/processors/`)

##### Processor Registry (`src/processors/ProcessorRegistry.ts`)
- **Pattern**: Singleton registry for processor management
- **Key methods**:
  - `register()`: Register new processors
  - `getByType()`: Retrieve processor by type
  - `getByExtension()`: Find processor for file extension
  - `findProcessorForFile()`: Advanced file-to-processor matching

##### Processor Types (`src/processors/types.ts`)
- **Core interface**: `FileProcessor`
- **Required methods**:
  - `process()`: Main file processing logic
  - `validateConfig()`: Configuration validation
  - `getDefaultConfig()`: Default configuration
  - `getConfigSchema()`: UI schema generation
  - `shouldSkipFile()`: Early filtering optimization (optional)
  - `canHandleFile()`: Path-based processor matching (optional)

##### Default Processor (`src/processors/DefaultProcessor.ts`)
- **Purpose**: Fallback processor for unhandled file types
- **Functionality**: Writes files as-is to vault without processing
- **Configuration**: Output folder selection

##### Viwoods Processor (`src/processors/ViwoodsProcessor/index.ts`)
- **Purpose**: Comprehensive processor for all Viwoods app modules
- **Supported modules**:
  - Learning (EPUB/PDF reading notes)
  - Paper (handwritten notes)
  - Daily (daily journal entries)
  - Meeting (meeting notes)
  - Picking (quick captures)
  - Memo (text memos)
- **Architecture**: Modular design with dedicated processors per module

##### Voice Notes Processor (`src/processors/VoiceNotesProcessor/index.ts`)
- **Purpose**: AI-powered link detection for voice-dictated markdown notes
- **Features**:
  - Smart link detection using local or cloud LLMs
  - Local LLM support via WebLLM (browser-based)
  - Cloud LLM support via Gemini API and OpenRouter
  - Fuzzy matching with configurable similarity thresholds
  - Model management (download/delete from settings)
- **Configuration**: Dictation tag, model selection, matching options

### 4. Template System (`src/processors/templates/`)

#### Templater Components
- **TemplaterParser**: Parser for Templater syntax (`<% %>`)
- **TemplaterExecutor**: JavaScript code executor for templates
- **TemplaterContext**: Provides `tp` object with utility modules

#### Template Syntax
- `<% code %>` - Dynamic command: outputs result
- `<%* code %>` - Execution command: uses tR variable
- `<%# comment %>` - Comment: ignored during execution
- `<%- code -%>` - Trim surrounding whitespace

#### Templater Modules
- `tp.date` - Date formatting and manipulation
- `tp.file` - File information and operations
- `tp.frontmatter` - YAML frontmatter access
- `tp.config` - Processor configuration access

### 5. Authentication System (`src/auth/`)

#### OAuth Manager (`src/auth/OAuthManager.ts`)
- **Platform support**: Desktop and mobile OAuth flows
- **Desktop flow**: Local HTTP server on port 53134
- **Mobile flow**: Custom URI scheme redirection
- **PKCE support**: Proof Key for Code Exchange for security
- **Token management**: Automatic refresh token handling

### 6. Utility Libraries (`src/utils/`)

#### File Utilities (`src/utils/FileUtils.ts`)
- **Path operations**: Sanitization, joining, parent directory extraction
- **File operations**: Extension handling, basename extraction
- **Vault integration**: Folder creation, unique filename generation

#### Streaming ZIP Utilities (`src/utils/StreamingZipUtils.ts`)
- **Library**: @zip.js/zip.js for memory-efficient ZIP processing
- **Features**:
  - Streaming extraction (no full ZIP loading)
  - JSON file parsing
  - File existence checking
  - Resource cleanup

#### Platform Detection (`src/utils/platform.ts`)
- **Detection**: Desktop vs mobile platforms
- **Configuration**: Platform-specific OAuth settings
- **Optimization**: Mobile-specific file size limits

#### Stream Logging (`src/utils/StreamLogger.ts`)
- **Logging types**: Console or network stream logging
- **Configuration**: Host/port settings for remote logging
- **Platform awareness**: Includes platform and version info

#### Metadata Management (`src/utils/MetadataManager.ts`)
- **Storage**: YAML frontmatter in markdown files
- **Purpose**: Track Viwoods note processing metadata
- **Operations**: Load, save, and transform metadata

### 6. User Interface (`src/ui/`)

#### Settings Tab (`src/ui/SettingsTab.ts`)
- **Comprehensive settings**:
  - Dropbox authentication
  - Folder mappings
  - File processor configuration
  - Logging preferences
  - Mobile optimization settings
- **Dynamic UI**: Context-aware field visibility
- **Validation**: Input validation and error handling

#### Processor Configuration Modal (`src/ui/ProcessorConfigModal.ts`)
- **Dynamic forms**: Auto-generated from processor schemas
- **Field types**: text, folder, file, boolean, number, select
- **Grouping**: Collapsible sections for organization
- **Validation**: Real-time configuration validation

## File Processing Flow

### 1. File Discovery
- Dropbox API folder traversal
- File filtering by extension and path
- Processor assignment via registry

### 2. Download Process
- Size checking (mobile limits)
- Chunked download for large files
- Progress tracking and status updates

### 3. Processing Pipeline
- Processor-specific file handling
- Template-based content generation
- Metadata extraction and organization
- Vault file creation/modification

### 4. Error Handling
- Graceful degradation for unsupported files
- Detailed error logging and user feedback
- Status bar notifications throughout process

## Viwoods Module Details

### Module Types (`src/processors/ViwoodsProcessor/ViwoodsTypes.ts`)

#### Learning Module
- **Package**: `com.wisky.learning`
- **Purpose**: EPUB/PDF reading notes and annotations
- **Features**:
  - Highlight extraction
  - Handwritten annotation processing
  - Composite image creation
  - Source file management

#### Paper Module
- **Package**: `com.wisky.notewriter`
- **Purpose**: Handwritten notes
- **Features**:
  - Note metadata management
  - Image extraction
  - Folder structure preservation
  - Rename detection and handling

#### Daily Module
- **Package**: `com.wisky.schedule`
- **Purpose**: Daily journal entries
- **Features**:
  - Date-based organization
  - Task data integration
  - Template-based formatting

#### Meeting Module
- **Package**: `com.wisky.meeting`
- **Purpose**: Meeting notes
- **Features**:
  - Meeting-specific formatting
  - Action item extraction
  - Resource organization

#### Picking Module
- **Package**: `com.wisky.captureLog`
- **Purpose**: Quick captures and screenshots
- **Features**:
  - Screenshot processing
  - Layout preservation
  - Composite image creation

#### Memo Module
- **Package**: `com.wisky.memo`
- **Purpose**: Text memos
- **Features**:
  - Text extraction and formatting
  - Template-based organization

### Data Structures

#### Common Structures
- `HeaderInfo`: App identification and versioning
- `NoteFileInfo`: Note metadata (Paper/Meeting)
- `NotesBean`: Note information (Daily/Picking)
- `PageResource`: Resource metadata

#### Learning-Specific
- `BookBean`: EPUB metadata
- `ReadNoteBean`: Annotation data
- `EpubHighlight`: Highlight information

## Template System

### Templater Template Components
- **TemplaterParser** (`src/processors/templates/TemplaterParser.ts`)
  - Parses Templater syntax (`<% %>`)
  - Supports dynamic, execution, and comment commands
  - Tokenizes templates for efficient processing

- **TemplaterExecutor** (`src/processors/templates/TemplaterExecutor.ts`)
  - Executes JavaScript code in templates
  - Supports dynamic commands (`<% code %>`) and execution commands (`<%* code %>`)
  - Provides tR variable for output accumulation

- **TemplaterContext** (`src/processors/templates/TemplaterContext.ts`)
  - Provides the `tp` object with utility modules
  - Modules: tp.date, tp.file, tp.frontmatter, tp.config

### Template Syntax
- `<% code %>` - Dynamic command: outputs the result of code execution
- `<%* code %>` - Execution command: executes code with tR variable for output
- `<%# comment %>` - Comment: ignored during template execution
- `<%- code -%>` - Trim surrounding whitespace

### Template Resolution
- **Custom path**: User-specified template path in vault
- **Default fallback**: Built-in default templates
- **Caching**: Performance optimization with template caching
- **Context injection**: Dynamic variable substitution via tp object

### Template Defaults (`src/processors/templates/defaults/`)
- **Module-specific templates**: Each Viwoods module has dedicated templates
- **Customization**: Users can override defaults with custom templates
- **Variables**: Rich context data available for templates via tp object

## Configuration System

### Schema Definition
- **Dynamic UI generation**: Configuration schemas auto-generate UI forms
- **Field types**: Support for various input types and validation
- **Grouping**: Organized settings with collapsible sections
- **Conditional display**: Context-aware field visibility

### Validation
- **Real-time validation**: Input validation as users type
- **Error reporting**: Clear error messages and warnings
- **Dependency checking**: Inter-field validation and requirements

## Mobile Optimization

### File Size Management
- **Configurable limits**: Mobile-specific file size thresholds
- **Chunked downloads**: Large files downloaded in manageable chunks
- **Memory optimization**: Streaming processing to reduce memory usage

### Platform Adaptation
- **OAuth flow**: Mobile-friendly authentication
- **UI adjustments**: Touch-friendly interface elements
- **Performance tuning**: Optimized for mobile hardware constraints

## Logging and Debugging

### Stream Logging
- **Remote logging**: Network-based log streaming
- **Platform awareness**: Include platform and version information
- **Configurable output**: Console or network stream options

### Error Handling
- **Graceful failures**: Continue processing when individual files fail
- **User feedback**: Clear error messages and progress indicators
- **Debug information**: Detailed logging for troubleshooting

## Security Considerations

### OAuth Implementation
- **PKCE**: Proof Key for Code Exchange for enhanced security
- **Token storage**: Secure token management
- **Refresh handling**: Automatic token refresh without user intervention

### File Handling
- **Path sanitization**: Prevent path traversal attacks
- **Size validation**: Prevent overly large file processing
- **Type validation**: Ensure file type safety

## Performance Optimizations

### Memory Management
- **Streaming ZIP processing**: Avoid loading entire ZIP files
- **Chunked downloads**: Reduce memory footprint for large files
- **Template caching**: Avoid repeated template loading

### Processing Efficiency
- **Early filtering**: Skip files before download when possible
- **Parallel processing**: Concurrent file operations where safe
- **Incremental updates**: Only process changed files

## Extensibility

### Processor System
- **Plugin architecture**: Easy addition of new file processors
- **Registry pattern**: Dynamic processor discovery and registration
- **Configuration schemas**: Self-describing processor configurations

### Template Customization
- **User templates**: Override defaults with custom templates
- **Variable system**: Rich context for template customization
- **Module-specific**: Tailored templates per processor module

## Data Models

### Core Settings Structure
```typescript
interface DrpbxFetcherSettings {
  // Authentication
  accessToken: string;
  refreshToken: string;
  clientId: string;
  codeVerifier: string;

  // Folder mappings
  folderMappings: FolderMapping[];

  // File processing
  fileTypeMappings: FileTypeMapping[];
  skippedExtensions: string[];
  processedFiles: Record<string, number>;

  // Behavior
  syncOnStartup: boolean;
  syncStartupDelay: number;

  // Mobile optimization
  maxFileSizeMobile: number;
  chunkSizeBytes: number;
  chunkedDownloadThreshold: number;

  // Logging
  loggerType: 'console' | 'stream';
  streamLogHost: string;
  streamLogPort: number;
}
```

### File Processor Interface
```typescript
interface FileProcessor {
  readonly type: string;
  readonly name: string;
  readonly description: string;
  readonly supportedExtensions: string[];

  process(
    fileData: Uint8Array,
    originalPath: string,
    metadata: FileMetadata,
    config: ProcessorConfig,
    context: ProcessorContext
  ): Promise<ProcessorResult>;

  validateConfig(config: ProcessorConfig): ValidationResult;
  getDefaultConfig(): ProcessorConfig;
  getDefaultTemplates(): Record<string, string>;
  getConfigSchema(): ConfigSchema;
}
```

## Build and Development

### Build System
- **Bundler**: esbuild for fast compilation
- **Type checking**: TypeScript with strict mode
- **Linting**: ESLint for code quality
- **Auto-versioning**: Automatic version bumping on builds

### Development Workflow
- **Watch mode**: `npm run dev` for development
- **Production build**: `npm run build` for optimized builds
- **Installation**: `npm run install-plugin` for local testing

## Testing Considerations

### Test Scenarios
- **OAuth flows**: Desktop and mobile authentication
- **File processing**: All supported file types and processors
- **Error handling**: Network failures, invalid files, configuration errors
- **Performance**: Large file handling, memory usage
- **Mobile behavior**: File size limits, platform-specific features

### Validation Requirements
- **Configuration**: All processor configurations must validate
- **File formats**: ZIP structure validation and parsing
- **Templates**: Template syntax and variable validation
- **Authentication**: Token validation and refresh flows

This specification provides a comprehensive overview of the DRPBX Fetcher plugin architecture, functionality, and implementation details. The modular design allows for easy extension and maintenance while providing robust file processing capabilities tailored to the Viwoods ecosystem.