# File Processors

## Overview

The File Processor system allows the Dropbox Fetcher plugin to intelligently process different file types during sync. Instead of simply downloading files as-is, processors can:

- Extract content from archives and structured files
- Generate organized markdown files with custom templates
- Create multiple output files from a single source
- Apply file-specific transformations

## Available Processors

### Default Processor
- **Type:** `default`
- **Extensions:** All unmatched extensions
- **Description:** Downloads files without processing (standard behavior)
- **Configuration:**
  - `outputFolder`: Where to save files (default: vault root)

### Viwoods Notes Processor
- **Type:** `viwoods`
- **Extensions:** `.note`, `.jpg`, `.png`, `.pdf`, `.epub` (when in Viwoods folders)
- **Description:** Comprehensive processing of Viwoods ecosystem files from all 6 modules
- **Supported Modules:**
  - **Learning** - EPUB/PDF reading notes and annotations
  - **Paper** - Handwritten notes with custom folders
  - **Daily** - Daily journal entries
  - **Meeting** - Meeting notes with templates
  - **Picking** - Quick captures and screenshots
  - **Memo** - Text memos with todo integration
- **What it extracts:**
  - Handwriting strokes (PATH_*.json files)
  - Page images (*.png files)
  - Text annotations (LayoutText.json, PageTextAnnotation.json)
  - Image annotations (LayoutImage.json)
  - Metadata (HeaderInfo.json, NotesBean.json, NoteFileInfo.json)
  - Books and source files (.epub, .pdf)
  - Todo items and reminders (Memo module)
  - Composite annotation images (handwriting + page backgrounds)

### Voice Notes Processor
- **Type:** `voicenotes`
- **Extensions:** `.md`
- **Description:** AI-powered link detection for voice-dictated markdown notes
- **Features:**
  - **Smart Link Detection**: Automatically converts text mentions of notes into Obsidian wiki-links
  - **Local LLM Support**: Uses WebLLM for browser-based local AI processing (no API key needed)
  - **Cloud LLM Support**: Optional Gemini API and OpenRouter integration
  - **Multiple Models**: Support for Phi-3, Gemma, Llama, Gemini, Mistral, and more
  - **Fuzzy Matching**: Advanced note matching with configurable similarity thresholds
  - **Model Management**: Download, manage, and delete AI models from settings
- **Configuration:**
  - `enabled`: Enable/disable Voice Notes processing
  - `dictationTag`: Tag to identify voice-dictated notes (default: "dictation")
  - `llm.model`: AI model to use for link detection
  - `llm.geminiApiKey`: Gemini API key for cloud models
  - `llm.openRouterApiKey`: OpenRouter API key for OpenRouter models
  - `llm.temperature`: LLM generation temperature (0.0-1.0)
  - `matching.similarityThreshold`: Minimum similarity for note matching (0.0-1.0)
  - `matching.fuzzyMatching`: Enable/disable fuzzy matching algorithm
  - `matching.excludeFolders`: Folders to exclude from note search
  - `createMissingLinks`: Create wiki-links even when no matching note is found

## Using File Processors

### 1. Adding a Processor

1. Open Obsidian Settings
2. Navigate to **Dropbox Fetcher** settings
3. Scroll to **File Processors** section
4. Select a processor from the dropdown
5. Click **Add**

This creates a new file type mapping with default configuration.

### 2. Configuring a Processor

**Viwoods Processor Configuration:**

```json
{
  "learning": {
    "enabled": true,
    "highlightsFolder": "Viwoods/Highlights",
    "annotationsFolder": "Viwoods/Annotations",
    "sourcesFolder": "Viwoods/Library",
    "highlightTemplate": "",
    "annotationTemplate": "",
    "includeMetadata": true,
    "includeThumbnail": true,
    "extractImages": true,
    "processAnnotations": true,
    "annotationImagesFolder": "Viwoods/Annotations/resources",
    "includeSummaryInAnnotation": true,
    "createCompositeImages": true,
    "downloadSourceFiles": true
  },
  "paper": {
    "enabled": true,
    "highlightsFolder": "Viwoods/Paper",
    "sourcesFolder": "Viwoods/Paper/Sources",
    "pagesFolder": "Viwoods/Paper/Pages",
    "highlightTemplate": "",
    "pageTemplate": "",
    "includeMetadata": true,
    "includeThumbnail": true,
    "extractImages": true,
    "enableRenameDetection": true
  },
  "daily": {
    "enabled": true,
    "dailyFolder": "Viwoods/Daily",
    "dailyTemplate": "",
    "includeMetadata": true,
    "includeThumbnail": true,
    "extractImages": true
  },
  "meeting": {
    "enabled": true,
    "meetingsFolder": "Viwoods/Meeting",
    "meetingTemplate": "",
    "includeMetadata": true,
    "includeThumbnail": true,
    "extractImages": true
  },
  "picking": {
    "enabled": true,
    "pickingsFolder": "Viwoods/Picking",
    "pickingTemplate": "",
    "includeMetadata": true,
    "includeThumbnail": true,
    "extractImages": true,
    "processNonNoteFiles": true
  },
  "memo": {
    "enabled": true,
    "memosFolder": "Viwoods/Memo",
    "memoTemplate": "",
    "includeMetadata": true,
    "includeThumbnail": true,
    "extractImages": true,
    "enableRenameDetection": true,
    "processImagesWithWhiteBackground": true
  }
}
```

**Configuration Options:**

#### General Settings
- **enabled** - Enable/disable processing for this module
- **includeMetadata** - Extract and include metadata files
- **includeThumbnail** - Extract thumbnail images
- **extractImages** - Extract page and content images

#### Module-Specific Settings

**Learning Module:**
- **highlightsFolder**: Folder for highlight markdown files
- **annotationsFolder**: Folder for annotation markdown files
- **sourcesFolder**: Folder to save EPUB/PDF source files
- **annotationImagesFolder**: Folder for composite annotation images
- **processAnnotations**: Process handwritten annotations
- **createCompositeImages**: Combine page backgrounds with handwriting
- **downloadSourceFiles**: Include original EPUB/PDF files

**Paper Module:**
- **highlightsFolder**: Folder for handwritten note markdowns
- **sourcesFolder**: Folder for original .note files
- **pagesFolder**: Folder for page images and comprehensive page markdown
- **enableRenameDetection**: Track renamed notes using internal note IDs

**Daily Module:**
- **dailyFolder**: Folder for daily note markdowns

**Meeting Module:**
- **meetingsFolder**: Folder for meeting note markdowns

**Picking Module:**
- **pickingsFolder**: Folder for quick capture markdowns
- **processNonNoteFiles**: Process standalone images in Picking folders

**Memo Module:**
- **memosFolder**: Folder for memo markdowns
- **enableRenameDetection**: Track renamed memos
- **processImagesWithWhiteBackground**: Apply white background to memo images

#### Template Settings (All Modules)
- **highlightTemplate**: Path to custom template (optional, uses default if empty)
- **annotationTemplate**: Path to custom annotation template
- **pageTemplate**: Path to custom page template
- **dailyTemplate**: Path to custom daily template
- **meetingTemplate**: Path to custom meeting template
- **pickingTemplate**: Path to custom picking template
- **memoTemplate**: Path to custom memo template

### 3. Enabling/Disabling Processors

Use the toggle switch next to each processor mapping in settings to enable or disable it without deleting the configuration.

### 4. Editing Configuration

Currently, processor configurations are edited via the `data.json` file in your vault's `.obsidian/plugins/drpbx-fetcher/` directory.

Future updates will include a visual configuration modal.

## Custom Templates

### Template Syntax (Templater)

Templates use Templater-compatible syntax for dynamic content:

- `<% code %>` - Dynamic command: outputs the result of code execution
- `<%* code %>` - Execution command: executes code with `tR` variable for output accumulation
- `<%# comment %>` - Comment: ignored during template execution
- `<%- code -%>` - Trim surrounding whitespace

### Templater Modules

Templates have access to the `tp` object with these modules:

**tp.date**
- `<% tp.date.now("YYYY-MM-DD") %>` - Current date with format
- `<% tp.date.now() %>` - Current date and time

**tp.file**
- `<% tp.file.title %>` - Current filename
- `<% tp.file.path %>` - Current file path

**tp.frontmatter**
- `<% tp.frontmatter.key %>` - Access YAML frontmatter values

**tp.config**
- `<% tp.config.moduleSetting %>` - Access processor configuration

### Module-Specific Template Variables

#### Learning Module
**Highlight Template:**
- `<% bookTitle %>` - Book name
- `<% bookAuthor %>` - Book author (if available)
- `<% highlightCount %>` - Number of highlights
- `<% sourceLink %>` - Link to source EPUB/PDF

**Annotation Template:**
- `<% bookTitle %>` - Book name
- `<% chapterName %>` - Chapter name
- `<% textContent %>` - Highlighted text
- `<% summary %>` - Annotation/note text
- `<% pageNumber %>` - Page number
- `<% annotationImagePath %>` - Path to composite annotation image

#### Paper Module
**Note Template:**
- `<% noteTitle %>` - Title of the note
- `<% noteName %>` - Filename
- `<% noteSlug %>` - Slugified name for tags
- `<% pageNumber %>` - Current page number
- `<% totalPages %>` - Total pages in note
- `<% createTime %>` - Note creation timestamp
- `<% sourceLink %>` - Link to original .note file
- `<% pageImagePath %>` - Path to page image
- `<% strokeCount %>` - Number of handwriting strokes
- `<% pointCount %>` - Total number of points in strokes

#### Daily Module
**Daily Template:**
- `<% date %>` - ISO date (YYYY-MM-DD)
- `<% year %>`, `<% month %>`, `<% day %>` - Date components
- `<% lastTab %>` - Active tab in Viwoods Daily
- `<% pageImagePath %>` - Path to daily page image
- `<% createTime %>` - Daily note creation time

#### Meeting Module
**Meeting Template:**
- `<% meetingTitle %>` - Meeting name
- `<% noteTitle %>` - Note title
- `<% createTime %>` - Meeting creation time
- `<% pageImagePath %>` - Path to meeting page image
- `<% totalPages %>` - Total pages in meeting

#### Picking Module
**Picking Template:**
- `<% captureTitle %>` - Capture title
- `<% captureType %>` - Type (Screenshot/Photo/Note)
- `<% imageCount %>` - Number of images
- `<% captureImagePath %>` - Path to composite capture image
- `<% screenshotPath %>` - Path to screenshot
- `<% createTime %>` - Capture creation time

#### Memo Module
**Memo Template:**
- `<% memoTitle %>` - Memo filename
- `<% created %>`, `<% modified %>` - Formatted timestamps
- `<% isTodo %>` - Todo status boolean
- `<% isTodoFinished %>` - Todo completion status
- `<% hasRemind %>` - Has reminder boolean
- `<% remindTime %>` - Formatted reminder time
- `<% pageCount %>` - Number of pages
- `<% memoImagePath %>` - Main image path
- `<% screenshotPath %>` - Screenshot path
- `<% memoContent %>` - Todo checkbox content

### Creating Custom Templates

1. Create a markdown file in your vault with your template
2. Use the variables listed above
3. In processor configuration, set the template path:
   ```json
   {
     "highlightTemplate": "Templates/MyHighlight.md"
   }
   ```

### Example Custom Highlight Template

```markdown
# 📝 <% noteTitle %>

> Highlighted on <% tp.date.now("MMMM Do, YYYY") %>

---

## Page <% pageNumber %> of <% totalPages %>

![[<% pageImagePath %>]]

**Strokes:** <% strokeCount %> | **Points:** <% pointCount %>

### My Notes



### Tags
#highlight #notes/<% noteSlug %>

---
[View Original](<% sourceLink %>)
```

## How It Works

### Module Detection

The Viwoods processor automatically detects which module created a note:

1. **Package Name Detection** (most reliable):
   - `com.wisky.schedule` → Daily module
   - `com.wisky.meeting` → Meeting module
   - `com.wisky.notewriter` → Paper module
   - `com.wisky.captureLog` → Picking module
   - `com.wisky.memo` → Memo module
   - `com.wisky.learning` → Learning module

2. **File Structure Analysis**:
   - Presence of `NotesBean.json` with date fields → Daily
   - Presence of `LayoutImage.json` → Picking
   - Presence of `BookBean.json` → Learning
   - EPUB/PDF files in archive → Learning

3. **Path-Based Detection**:
   - Folder path contains `/Daily/` → Daily module
   - Folder path contains `/Meeting/` → Meeting module
   - Folder path contains `/Paper/` → Paper module
   - etc.

### Processing Flow

1. **During Sync:** When a file is downloaded from Dropbox:
   - The file extension and path are extracted
   - The processor registry is checked for enabled mappings
   - ViwoodsProcessor claims all files in Viwoods module folders
   - Files are filtered by enabled modules before download

2. **Module Processing:**
   - Processor receives the file data (ZIP archive for .note files)
   - Detects module type using HeaderInfo.json and file structure
   - Routes to specialized module processor
   - Extracts JSON metadata and images based on module
   - Loads templates (custom or default)
   - Generates markdown files using template engine
   - Handles rename detection and image management
   - Writes all output files to vault
   - Returns list of created files

3. **Rename Detection:**
   - Metadata stored in YAML frontmatter of generated files
   - Cross-referenced with `viwoodsNoteMetadata.md` in vault
   - When notes are renamed in Viwoods, output files are renamed
   - Images and references are updated automatically

4. **Template Resolution:**
   - If custom template path is specified, load from vault
   - If path is empty or file not found, use default template
   - Templates are cached for performance
   - Module-specific template variables available
   - Templates use Templater-compatible syntax (`<% %>`)

## Architecture

The system is built with modularity and extensibility in mind:

```
src/
├── processors/
│   ├── types.ts                    # Core interfaces
│   ├── ProcessorRegistry.ts        # Processor registry
│   ├── DefaultProcessor.ts         # Default passthrough
│   ├── VoiceNotesProcessor/        # Voice Notes processing
│   │   ├── index.ts                # Main processor
│   │   ├── VoiceNotesTypes.ts      # Type definitions
│   │   └── services/               # LLM and text processing
│   │       ├── WebLLMClient.ts     # Local LLM support
│   │       ├── GeminiClient.ts     # Gemini API client
│   │       ├── OpenRouterClient.ts # OpenRouter API client
│   │       ├── NoteFinder.ts       # Fuzzy note matching
│   │       ├── TextRewriter.ts     # Link replacement
│   │       └── ReferenceExtractor.ts # Reference extraction
│   ├── ViwoodsProcessor/           # Complete Viwoods system
│   │   ├── index.ts                # Main processor router
│   │   ├── AnnotationProcessor.ts  # Shared annotation handling
│   │   ├── ImageCompositor.ts      # Composite image generation
│   │   ├── TemplateDefaults.ts     # Default templates
│   │   ├── ViwoodsTypes.ts         # Type definitions
│   │   ├── utils/                  # Utilities
│   │   │   ├── ContentPreserver.ts # Content preservation
│   │   │   ├── CrossReferenceManager.ts # Daily cross-references
│   │   │   ├── MetadataManager.ts  # Note metadata handling
│   │   │   └── NoteRenameHandler.ts # Rename detection
│   │   └── modules/                # Module processors
│   │       ├── LearningProcessor.ts    # EPUB/PDF notes
│   │       ├── PaperProcessor.ts        # Handwritten notes
│   │       ├── DailyProcessor.ts        # Daily journal
│   │       ├── MeetingProcessor.ts      # Meeting notes
│   │       ├── PickingProcessor.ts      # Quick captures
│   │       └── MemoProcessor.ts         # Text memos
│   └── templates/
│       ├── TemplateEngine.ts       # Template rendering (legacy)
│       ├── TemplateResolver.ts     # Template loading
│       ├── TemplaterParser.ts      # Templater syntax parser
│       ├── TemplaterExecutor.ts    # Templater code executor
│       ├── TemplaterContext.ts     # Templater tp object
│       ├── modules/                # Templater modules
│       │   ├── DateModule.ts       # tp.date functions
│       │   ├── FileModule.ts       # tp.file functions
│       │   ├── FrontmatterModule.ts # tp.frontmatter functions
│       │   └── ConfigModule.ts     # tp.config functions
│       └── defaults/               # Default templates
│           ├── viwoods-highlight.md
│           ├── viwoods-annotation.md
│           ├── viwoods-note.md
│           ├── viwoods-daily.md
│           ├── viwoods-meeting.md
│           ├── viwoods-picking.md
│           └── viwoods-memo.md
├── models/
│   └── Settings.ts                 # Settings interfaces
├── utils/
│   ├── FileUtils.ts                # File operations
│   ├── ZipUtils.ts                 # ZIP extraction (legacy)
│   ├── StreamingZipUtils.ts        # Streaming ZIP extraction
│   ├── ImageCacheBuster.ts         # Image refresh handling
│   ├── TempFileManager.ts          # Temporary file handling
│   ├── StreamLogger.ts             # Logging system
│   ├── crypto.ts                   # OAuth crypto
│   └── platform.ts                 # Platform detection
└── auth/
    └── OAuthManager.ts             # OAuth authentication
```

## Adding New Processors

To add a new processor:

1. **Create processor class** implementing `FileProcessor` interface:
   ```typescript
   export class MyProcessor implements FileProcessor {
     readonly type = "myprocessor";
     readonly name = "My Processor";
     readonly description = "Processes my file type";
     readonly supportedExtensions = ["myext"];

     async process(...) { /* implementation */ }
     validateConfig(config) { /* validation */ }
     getDefaultConfig() { /* defaults */ }
     getDefaultTemplates() { /* templates */ }
     getConfigSchema() { /* schema */ }
     shouldSkipFile(path, metadata, config) { /* optional early filtering */ }
     canHandleFile(path, ext, config) { /* optional path-based routing */ }
   }
   ```

2. **Register in main.ts**:
   ```typescript
   registry.register(new MyProcessor());
   ```

3. **Create default templates** in `src/processors/templates/defaults/`

4. **Document** in this file

### Advanced Processor Features

#### Early Filtering
Implement `shouldSkipFile()` to filter files before download:
```typescript
shouldSkipFile(path: string, metadata: DropboxFile, config: ProcessorConfig): SkipResult {
  if (shouldSkipBasedOnPath(path)) {
    return { shouldSkip: true, reason: 'Path not supported' };
  }
  return { shouldSkip: false };
}
```

#### Path-Based Routing
Implement `canHandleFile()` to claim files based on path patterns:
```typescript
canHandleFile(path: string, ext: string, config: ProcessorConfig): boolean {
  // Claim all files in specific folders regardless of extension
  return path.includes('/my-special-folder/');
}
```

#### Module-Specific Processors
For complex file types (like Viwoods), create a router processor:
```typescript
async process(...) {
  const moduleType = this.detectModuleType(zipContent);
  const moduleProcessor = this.getModuleProcessor(moduleType);
  return await moduleProcessor.process(...);
}
```

## Troubleshooting

### Processor Not Working

1. Check that the mapping is **enabled** (toggle in settings)
2. Verify the file extension or path matches the processor's routing rules
3. For Viwoods: ensure the specific module is enabled in configuration
4. Check console logs for errors (`Ctrl+Shift+I` / `Cmd+Opt+I`)
5. Ensure output folders exist or can be created
6. Check that files are in the correct Dropbox folder structure

### Template Not Applied

1. Verify template path is correct relative to vault root
2. Check template file exists and is readable
3. Look for template syntax errors
4. Templates are cached - restart Obsidian to clear cache
5. Ensure template variables are spelled correctly

### Files Not Created

1. Check processor configuration is valid
2. Ensure you have write permissions to output folders
3. Review console logs for specific errors
4. Verify the source file is a valid format for the processor
5. For Viwoods: check that the specific module is enabled

### Rename Detection Not Working

1. Ensure `enableRenameDetection` is true in module configuration
2. Check that `viwoodsNoteMetadata.md` exists in vault and is accessible
3. Verify YAML frontmatter in generated files contains `viwoodsNoteId`
4. Check that metadata files are being updated during fetch

### Images Not Updating

1. Verify `ImageCacheBuster` is working (check for timestamp suffixes)
2. Check that images are being regenerated during fetch
3. Ensure image paths in markdown files are correct
4. For Memos: check `processImagesWithWhiteBackground` setting

## Future Enhancements

Planned features:

- **Template editor** with syntax highlighting and preview
- **More processors**: PDF, EPUB (standalone), markdown enrichment, image processing
- **Batch processing** for faster syncs
- **Conflict resolution** for duplicate files
- **Preview mode** to see what would be created
- **Template marketplace** for sharing custom templates
- **Image optimization** and compression options
- **Background sync** with configurable intervals

## Examples

### Viwoods Module Setup Examples

#### Learning Module for Academic Reading
```json
{
  "learning": {
    "enabled": true,
    "highlightsFolder": "Academic/Highlights",
    "annotationsFolder": "Academic/Annotations",
    "sourcesFolder": "Academic/Library",
    "downloadSourceFiles": true,
    "processAnnotations": true,
    "createCompositeImages": true
  }
}
```

#### Paper Module for Creative Work
```json
{
  "paper": {
    "enabled": true,
    "highlightsFolder": "Creative/Notes",
    "sourcesFolder": "Creative/Originals",
    "enableRenameDetection": true,
    "extractImages": true
  }
}
```

#### Memo Module for Task Management
```json
{
  "memo": {
    "enabled": true,
    "memosFolder": "Tasks/Memos",
    "enableRenameDetection": true,
    "processImagesWithWhiteBackground": true
  }
}
```

See `specs/VIWOODS_SPECIFICATION.md` for detailed technical specifications.

### Custom Template Example

#### Memo Template with Todo Integration
```markdown
# 📝 {{memoTitle}}

> Created: {{created}} | Modified: {{modified}}

{{#hasRemind}}
> ⏰ **Reminder:** {{remindTime}}
{{/hasRemind}}

---

{{#isTodo}}
## Todo Status
{{#isTodoFinished}}✅ Completed{{/isTodoFinished}}
{{^isTodoFinished}}⭕ Pending{{/isTodoFinished}}

{{/isTodo}}

## Content

![Memo Image]({{memoImagePath}})

{{#screenshotPath}}
### Screenshot
![Screenshot]({{screenshotPath}})
{{/screenshotPath}}

---
#memo/{{memoTitle}}
```
