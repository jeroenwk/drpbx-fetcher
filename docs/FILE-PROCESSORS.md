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

### viwoods Notes Processor
- **Type:** `viwoods`
- **Extensions:** `.note`
- **Description:** Processes viwoods/AIPaper `.note` files (ZIP archives containing handwriting data)
- **What it extracts:**
  - Handwriting strokes (PATH_*.json files)
  - Page images (*.png files)
  - Text annotations (LayoutText.json)
  - Image annotations (LayoutImage.json)
  - Metadata (HeaderInfo.json, NotesBean.json)

## Using File Processors

### 1. Adding a Processor

1. Open Obsidian Settings
2. Navigate to **Dropbox Fetcher** settings
3. Scroll to **File Processors** section
4. Select a processor from the dropdown
5. Click **Add**

This creates a new file type mapping with default configuration.

### 2. Configuring a Processor

**viwoods Processor Configuration:**

```json
{
  "highlightsFolder": "viwoods/Highlights",
  "annotationsFolder": "viwoods/Annotations",
  "sourcesFolder": "viwoods/Sources",
  "pagesFolder": "viwoods/Pages",
  "highlightTemplate": "",
  "annotationTemplate": "",
  "pageTemplate": "",
  "includeMetadata": true,
  "includeThumbnail": true,
  "extractImages": true,
  "createIndex": true
}
```

**Configuration Options:**

- **highlightsFolder**: Folder for highlight markdown files (contains handwriting data)
- **annotationsFolder**: Folder for text annotations
- **sourcesFolder**: Folder to save original .note files
- **pagesFolder**: Folder for page images and comprehensive page markdown
- **highlightTemplate**: Path to custom template (optional, uses default if empty)
- **annotationTemplate**: Path to custom annotation template
- **pageTemplate**: Path to custom page template
- **includeMetadata**: Extract and include HeaderInfo.json data
- **includeThumbnail**: Extract thumbnail image
- **extractImages**: Extract page images
- **createIndex**: Create an index file linking all content

### 3. Enabling/Disabling Processors

Use the toggle switch next to each processor mapping in settings to enable or disable it without deleting the configuration.

### 4. Editing Configuration

Currently, processor configurations are edited via the `data.json` file in your vault's `.obsidian/plugins/drpbx-fetcher/` directory.

Future updates will include a visual configuration modal.

## Custom Templates

### Template Syntax

Templates use Obsidian's template syntax:

- `{{variable}}` - Simple variable replacement
- `{{date}}` or `{{date:YYYY-MM-DD}}` - Current date with optional format
- `{{time}}` or `{{time:HH:mm}}` - Current time with optional format

### viwoods Template Variables

**Highlight Template:**
- `{{noteTitle}}` - Title of the note
- `{{noteName}}` - Filename
- `{{noteSlug}}` - Slugified name for tags
- `{{pageNumber}}` - Current page number
- `{{totalPages}}` - Total pages in note
- `{{createTime}}` - Note creation timestamp
- `{{sourceLink}}` - Link to original .note file
- `{{pageImagePath}}` - Path to page image
- `{{strokeCount}}` - Number of handwriting strokes
- `{{pointCount}}` - Total number of points in strokes

**Annotation Template:**
- Same as highlight, plus:
- `{{textContent}}` - JSON of text annotations

**Page Template:**
- Combines all available variables

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
# 📝 {{noteTitle}}

> Highlighted on {{date:MMMM Do, YYYY}}

---

## Page {{pageNumber}} of {{totalPages}}

![[{{pageImagePath}}]]

**Strokes:** {{strokeCount}} | **Points:** {{pointCount}}

### My Notes



### Tags
#highlight #notes/{{noteSlug}}

---
[View Original]({{sourceLink}})
```

## How It Works

1. **During Sync:** When a file is downloaded from Dropbox:
   - The file extension is extracted (e.g., "note" from "MyNote.note")
   - The processor registry is checked for enabled mappings
   - If a processor is found, it processes the file
   - Otherwise, the default file handler is used

2. **Processing Flow:**
   - Processor receives the file data
   - Extracts/transforms content based on file type
   - Loads templates (custom or default)
   - Generates markdown files using template engine
   - Writes all output files to vault
   - Returns list of created files

3. **Template Resolution:**
   - If custom template path is specified, load from vault
   - If path is empty or file not found, use default template
   - Templates are cached for performance

## Architecture

The system is built with modularity and extensibility in mind:

```
src/
├── processors/
│   ├── types.ts                    # Core interfaces
│   ├── ProcessorRegistry.ts        # Processor registry
│   ├── DefaultProcessor.ts         # Default passthrough
│   ├── viwoodsProcessor.ts         # viwoods implementation
│   └── templates/
│       ├── TemplateEngine.ts       # Template rendering
│       ├── TemplateResolver.ts     # Template loading
│       └── defaults/               # Default templates
│           ├── viwoods-highlight.md
│           ├── viwoods-annotation.md
│           └── viwoods-page.md
├── models/
│   └── Settings.ts                 # Settings interfaces
└── utils/
    ├── FileUtils.ts                # File operations
    └── ZipUtils.ts                 # ZIP extraction
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
   }
   ```

2. **Register in main.ts**:
   ```typescript
   registry.register(new MyProcessor());
   ```

3. **Create default templates** in `src/processors/templates/defaults/`

4. **Document** in this file

## Troubleshooting

### Processor Not Working

1. Check that the mapping is **enabled** (toggle in settings)
2. Verify the file extension matches the mapping
3. Check console logs for errors (`Ctrl+Shift+I` / `Cmd+Opt+I`)
4. Ensure output folders exist or can be created

### Template Not Applied

1. Verify template path is correct relative to vault root
2. Check template file exists and is readable
3. Look for template syntax errors
4. Templates are cached - restart Obsidian to clear cache

### Files Not Created

1. Check processor configuration is valid
2. Ensure you have write permissions to output folders
3. Review console logs for specific errors
4. Verify the source file is a valid format for the processor

## Future Enhancements

Planned features:

- **Visual configuration modal** with form-based editing
- **Template editor** with syntax highlighting and preview
- **More processors**: PDF, EPUB, markdown enrichment, image processing
- **Batch processing** for faster syncs
- **Conflict resolution** for duplicate files
- **Preview mode** to see what would be created
- **Template marketplace** for sharing custom templates

## Examples

See `SPEC-FileProcessors.md` for detailed technical specifications and examples.
