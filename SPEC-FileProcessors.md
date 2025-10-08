# File Processor System Specification

## Overview

The File Processor System enables the Dropbox Fetcher plugin to apply custom processing logic to files based on their extensions. Each processor can extract, transform, and generate structured markdown files in the vault, with customizable templates.

## Architecture

### 1. Core Components

#### 1.1 FileProcessor Interface (`src/processors/FileProcessor.ts`)

```typescript
interface FileProcessor {
  /**
   * Unique identifier for this processor type
   */
  readonly type: string;

  /**
   * Human-readable name for UI display
   */
  readonly name: string;

  /**
   * Description of what this processor does
   */
  readonly description: string;

  /**
   * File extensions this processor handles (without dot)
   */
  readonly supportedExtensions: string[];

  /**
   * Process a file and write output to vault
   * @param fileData Binary data of the downloaded file
   * @param originalPath Original Dropbox path
   * @param metadata File metadata from Dropbox
   * @param config Processor-specific configuration
   * @param context Processing context (vault, app, template resolver)
   * @returns Array of created file paths
   */
  process(
    fileData: Uint8Array,
    originalPath: string,
    metadata: FileMetadata,
    config: ProcessorConfig,
    context: ProcessorContext
  ): Promise<ProcessorResult>;

  /**
   * Validate processor configuration
   */
  validateConfig(config: ProcessorConfig): ValidationResult;

  /**
   * Get default configuration for this processor
   */
  getDefaultConfig(): ProcessorConfig;

  /**
   * Get default templates for this processor
   */
  getDefaultTemplates(): Record<string, string>;

  /**
   * Get configuration schema for UI generation
   */
  getConfigSchema(): ConfigSchema;
}

interface ProcessorContext {
  vault: Vault;
  app: App;
  templateResolver: TemplateResolver;
}

interface ProcessorResult {
  success: boolean;
  createdFiles: string[];
  errors?: string[];
  warnings?: string[];
}
```

#### 1.2 Template System (`src/processors/templates/`)

**TemplateResolver.ts**
- Resolves template paths (custom vs default)
- Loads template content from vault or defaults
- Caches templates for performance
- Validates template syntax

**TemplateEngine.ts**
- Renders templates with data
- Supports template variables: `{{variable}}`
- Supports conditionals: `{{#if variable}}...{{/if}}`
- Supports loops: `{{#each items}}...{{/each}}`
- Supports filters: `{{date | format "YYYY-MM-DD"}}`

**Default Templates Structure:**
```
src/processors/templates/defaults/
├── viwoods/
│   ├── highlight.md
│   ├── annotation.md
│   └── page.md
└── [future processors]/
```

#### 1.3 Processor Registry (`src/processors/ProcessorRegistry.ts`)

Singleton pattern for managing processors:
- Register processors at plugin load
- Retrieve processor by type or extension
- List all available processors
- Validate file type mappings

```typescript
class ProcessorRegistry {
  private static instance: ProcessorRegistry;
  private processors: Map<string, FileProcessor>;

  register(processor: FileProcessor): void;
  getByType(type: string): FileProcessor | null;
  getByExtension(extension: string, mappings: FileTypeMapping[]): FileProcessor | null;
  listAll(): FileProcessor[];
}
```

### 2. Settings & Configuration

#### 2.1 Settings Interface (`src/models/Settings.ts`)

```typescript
interface DrpbxFetcherSettings {
  // ... existing fields ...
  fileTypeMappings: FileTypeMapping[];
}

interface FileTypeMapping {
  id: string;                    // Unique ID for this mapping
  extension: string;             // File extension (without dot), e.g., "note"
  processorType: string;         // Processor type identifier, e.g., "viwoods"
  enabled: boolean;              // Whether this mapping is active
  config: ProcessorConfig;       // Processor-specific configuration
}

interface ProcessorConfig {
  [key: string]: any;            // Base interface, extended by specific processors
}
```

#### 2.2 viwoods Processor Configuration

```typescript
interface viwoodsProcessorConfig extends ProcessorConfig {
  highlightsFolder: string;      // Vault path for highlights, e.g., "Highlights"
  annotationsFolder: string;     // Vault path for annotations, e.g., "Annotations"
  sourcesFolder: string;         // Vault path for source documents, e.g., "Sources"
  pagesFolder: string;           // Vault path for rendered pages, e.g., "Pages"

  // Template paths (optional - falls back to defaults if empty)
  highlightTemplate?: string;    // Vault path to custom template
  annotationTemplate?: string;
  pageTemplate?: string;

  // Processing options
  includeMetadata: boolean;      // Include HeaderInfo.json data
  includeThumbnail: boolean;     // Extract and save thumbnail.png
  extractImages: boolean;        // Extract embedded images
  createIndex: boolean;          // Create index markdown file linking all content
}
```

### 3. Processor Implementations

#### 3.1 Default Processor (`src/processors/DefaultProcessor.ts`)

Simple passthrough processor for unmatched files:
- Downloads file as-is to configured folder
- No transformation applied
- Preserves original filename and extension

#### 3.2 viwoods Processor (`src/processors/viwoodsProcessor.ts`)

Processes .note files (viwoods/AIPaper format):

**Processing Flow:**
1. Unzip .note file (ZIP archive)
2. Parse JSON files:
   - `HeaderInfo.json` - App metadata
   - `NotesBean.json` - Note metadata
   - `NoteList.json` - Page listing
   - `LayoutText.json` - Text annotations
   - `LayoutImage.json` - Image annotations
   - `PATH_<pageId>.json` - Handwriting stroke data
3. Extract assets:
   - `<pageId>.png` - Rendered page images
   - `thumbnail.png` - Note thumbnail
4. Generate markdown files using templates:
   - One highlight file per page with handwriting
   - One annotation file per page with text/images
   - One page file per page (combines all data)
   - Optional index file linking everything

**Template Variables for viwoods:**

Highlight template variables:
```
{{noteTitle}}           - Title from NotesBean.json
{{noteName}}            - File name
{{pageNumber}}          - Current page number
{{totalPages}}          - Total page count
{{dateHighlighted}}     - Current date
{{createTime}}          - Note creation time
{{handwritingData}}     - JSON data from PATH_*.json
{{pageImagePath}}       - Path to rendered PNG
{{sourceLink}}          - Link to source note file
{{location}}            - Location/chapter if available
```

Annotation template variables:
```
{{noteTitle}}
{{pageNumber}}
{{totalPages}}
{{textAnnotations}}     - Array of text objects
{{imageAnnotations}}    - Array of image objects
{{dateCreated}}
```

**Default Highlight Template Example:**
```markdown
## {{noteTitle}}

**Page:** {{pageNumber}}/{{totalPages}}
**Date:** {{dateHighlighted}}
**Source:** [Open Note]({{sourceLink}})

---

![[{{pageImagePath}}]]

### Handwriting Data

{{#if handwritingData}}
Strokes: {{handwritingData.length}}
{{/if}}

### Notes

*Add your thoughts here*

---
#highlight #viwoods/{{noteName}}
```

### 4. UI Components

#### 4.1 Settings Tab Enhancement (`src/ui/SettingsTab.ts`)

Extract settings tab from main.ts and add new section:

**File Type Processors Section:**
- Header: "File Type Processors"
- Description: "Configure how specific file types are processed"
- List of existing mappings:
  - Show: Extension | Processor | Status (Enabled/Disabled)
  - Actions: Edit, Delete, Toggle
- Add new mapping button
- Configuration modal for each processor type

**Configuration Modal (`src/ui/ProcessorConfigModal.ts`):**
- Dynamic form based on processor's config schema
- Folder pickers for path fields
- Template path pickers with "Use default" checkbox
- Validation feedback
- Preview section showing what will be created

#### 4.2 Template Editor (`src/ui/TemplateEditorModal.ts`)

Optional future enhancement:
- View/edit templates in-app
- Syntax highlighting
- Available variables reference
- Live preview with sample data

### 5. Integration with Sync Flow

#### 5.1 Modified Sync Process (`main.ts`)

Update `syncFiles()` method:

```typescript
// After downloading file (line ~220)
const fileExtension = this.getFileExtension(file.name);
const processor = ProcessorRegistry.getInstance()
  .getByExtension(fileExtension, this.settings.fileTypeMappings);

if (processor) {
  // Use processor
  const mapping = this.settings.fileTypeMappings
    .find(m => m.extension === fileExtension && m.enabled);

  if (mapping) {
    const context: ProcessorContext = {
      vault: this.app.vault,
      app: this.app,
      templateResolver: new TemplateResolver(this.app.vault)
    };

    const result = await processor.process(
      uint8Array,
      file.path_display!,
      file,
      mapping.config,
      context
    );

    if (result.success) {
      syncedFiles += result.createdFiles.length;
      console.log(`✓ Processed with ${processor.name}: ${result.createdFiles.join(', ')}`);
    } else {
      console.error(`✗ Processor error: ${result.errors?.join(', ')}`);
    }
    continue;
  }
}

// Fall back to default file handling
// ... existing code ...
```

### 6. Utilities

#### 6.1 ZIP Utilities (`src/utils/ZipUtils.ts`)

```typescript
class ZipUtils {
  static async unzip(data: Uint8Array): Promise<Map<string, Uint8Array>>;
  static async extractFile(zip: JSZip, path: string): Promise<Uint8Array>;
  static async extractJson<T>(zip: JSZip, path: string): Promise<T>;
  static async listFiles(zip: JSZip): Promise<string[]>;
}
```

#### 6.2 File Utilities (`src/utils/FileUtils.ts`)

```typescript
class FileUtils {
  static getExtension(filename: string): string;
  static sanitizeFilename(filename: string): string;
  static ensurePath(vault: Vault, path: string): Promise<void>;
  static generateUniqueFilename(vault: Vault, basePath: string, name: string): Promise<string>;
}
```

#### 6.3 Template Utilities (`src/utils/TemplateUtils.ts`)

```typescript
class TemplateUtils {
  static formatDate(date: Date | string, format: string): string;
  static slugify(text: string): string;
  static truncate(text: string, maxLength: number): string;
  static escapeMarkdown(text: string): string;
}
```

### 7. Dependencies

Add to `package.json`:
```json
{
  "dependencies": {
    "jszip": "^3.10.1",
    "handlebars": "^4.7.8"  // For template engine
  },
  "devDependencies": {
    "@types/jszip": "^3.4.1",
    "@types/handlebars": "^4.1.0"
  }
}
```

### 8. Implementation Phases

#### Phase 1: Core Infrastructure
1. Create base interfaces (FileProcessor, ProcessorConfig, ProcessorContext)
2. Implement ProcessorRegistry
3. Implement DefaultProcessor
4. Create template system (TemplateResolver, TemplateEngine)
5. Add utility classes (ZipUtils, FileUtils, TemplateUtils)

#### Phase 2: viwoods Processor
1. Add jszip dependency
2. Implement viwoodsProcessor
3. Create default templates for highlights, annotations, pages
4. Test with sample .note files
5. Handle edge cases (missing files, corrupt data)

#### Phase 3: Settings & UI
1. Extract SettingsTab to separate file
2. Update settings interface with fileTypeMappings
3. Create processor configuration section in UI
4. Implement ProcessorConfigModal
5. Add folder/template pickers

#### Phase 4: Integration
1. Modify syncFiles() to use processors
2. Add processor selection logic
3. Update logging and error handling
4. Add progress indicators for processor operations

#### Phase 5: Testing & Polish
1. Test with various .note files
2. Validate template rendering
3. Test custom template paths
4. Ensure cross-platform compatibility
5. Add user documentation

### 9. Future Enhancements

#### Additional Processors
- **PDF Processor**: Extract annotations, highlights, bookmarks
- **EPUB Processor**: Extract chapters, highlights, notes
- **Markdown Processor**: Transform/enrich markdown files
- **Image Processor**: Generate thumbnails, extract EXIF data
- **Audio/Video Processor**: Extract metadata, generate transcripts

#### Advanced Features
- **Batch processing**: Process multiple files in parallel
- **Incremental sync**: Only process changed files
- **Conflict resolution**: Handle duplicate files intelligently
- **Preview mode**: Show what would be created without writing
- **Undo/rollback**: Revert processor operations
- **Template marketplace**: Share custom templates with community

### 10. Example: Complete viwoods Highlight Template

```markdown
## {{noteTitle}}

{{#if location}}
**Location:** {{location}}
{{/if}}
**Page:** {{pageNumber}}/{{totalPages}}
**Date highlighted:** {{dateHighlighted | format "YYYY-MM-DD"}}
**Source:** [Open in Note]({{sourceLink}})

---

{{#if hasHandwriting}}
![[{{pageImagePath}}]]

### Handwriting Strokes
Total strokes: {{handwritingData.length}}
{{/if}}

{{#if textContent}}
> {{textContent}}
{{/if}}

### Notes

*Add your thoughts here*

---
{{#each tags}}
#{{this}}
{{/each}}
#viwoods/{{noteName | slugify}}
```

### 11. Configuration Example

Example user configuration for viwoods .note files:

```json
{
  "fileTypeMappings": [
    {
      "id": "uuid-1234",
      "extension": "note",
      "processorType": "viwoods",
      "enabled": true,
      "config": {
        "highlightsFolder": "Highlights/viwoods",
        "annotationsFolder": "Annotations/viwoods",
        "sourcesFolder": "Sources/viwoods",
        "pagesFolder": "Pages/viwoods",
        "highlightTemplate": "Templates/MyHighlight.md",
        "annotationTemplate": "",
        "pageTemplate": "",
        "includeMetadata": true,
        "includeThumbnail": true,
        "extractImages": true,
        "createIndex": true
      }
    }
  ]
}
```

## Success Criteria

1. ✅ User can configure file type processors via settings UI
2. ✅ viwoods .note files are processed and split into organized markdown files
3. ✅ Default templates work out of the box
4. ✅ Users can customize templates by specifying vault paths
5. ✅ System is extensible - new processors can be added easily
6. ✅ Processing errors are handled gracefully with user feedback
7. ✅ Cross-platform compatibility (Desktop, iOS, Android)
8. ✅ Performance is acceptable for large .note files (< 5s per file)

## Open Questions

1. Should we allow multiple processors for the same extension?
2. Should template validation happen at save time or process time?
3. Should we implement a template cache to improve performance?
4. Should processors be able to modify existing files or only create new ones?
5. Should there be a "dry run" mode to preview what would be created?
