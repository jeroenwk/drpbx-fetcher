# Viwoods Notes Setup Guide

## Quick Start

This guide will help you set up the Viwoods Notes processor to automatically extract and organize your notes from all Viwoods apps. The plugin now supports the complete Viwoods ecosystem with 6 specialized modules.

## Supported Viwoods Modules

The processor handles all Viwoods applications:

1. **🎓 Learning** - EPUB/PDF reading notes with highlights and annotations
2. **📝 Paper** - Handwritten notes with custom folders and PDF templates
3. **📅 Daily** - Daily journal and planner entries
4. **🤝 Meeting** - Meeting notes with templates
5. **🎯 Picking** - Quick captures, screenshots, and image notes
6. **📋 Memo** - Text memos with todo integration and reminders

## What You'll Get

Each module creates specialized output:

### Learning Module
- **Highlight files** - Extracted text highlights with book metadata
- **Annotation files** - Handwritten annotations with composite images
- **Source files** - Original EPUB/PDF files (optional)
- **Composite images** - Handwriting merged with page backgrounds

### Paper Module
- **Note files** - Handwritten notes with page images
- **Folder structure** - Preserves custom organization
- **Rename detection** - Automatically tracks renamed notes
- **PDF support** - Handles notes created from PDF templates

### Daily Module
- **Daily notes** - Formatted daily entries compatible with Obsidian daily notes
- **Date organization** - Structured by year/month/day
- **Page images** - Daily planner pages

### Meeting Module
- **Meeting notes** - Structured meeting note files
- **Meeting metadata** - Date, participants (when available)
- **Template support** - Custom meeting templates

### Picking Module
- **Capture notes** - Screenshots and quick captures
- **Composite images** - Handwriting overlaid on screenshots
- **Layout preservation** - Maintains original positioning

### Memo Module
- **Memo files** - Text memos with todo checkboxes
- **Reminder support** - Preserves Viwoods reminder metadata
- **White background** - Processed images for better visibility
- **Todo integration** - Automatic checkbox generation

## Setup Steps

### 1. Enable Viwoods Processor

1. Open **Obsidian Settings** → **Dropbox Fetcher**
2. Scroll to **File Processors** section
3. Click **Add file processor**
4. Select **Viwoods Files** from dropdown
5. Click **Add**

### 2. Configure Dropbox Folder Mapping

1. In **Folder Mappings** section, add your Viwoods Dropbox folder
2. Map the remote Viwoods folder to a local vault path

**Example Mappings:**

```
Remote path: /Viwoods-Note/AiPaper/S3AA2303M02672/
Local path: Viwoods
```

This will capture all modules in the `Viwoods` folder.

### 3. Configure Module Settings

The Viwoods processor supports per-module configuration. Enable only the modules you use:

#### Learning Module Configuration
```json
{
  "learning": {
    "enabled": true,
    "highlightsFolder": "Viwoods/Learning/Highlights",
    "annotationsFolder": "Viwoods/Learning/Annotations", 
    "sourcesFolder": "Viwoods/Learning/Library",
    "downloadSourceFiles": true,
    "processAnnotations": true,
    "createCompositeImages": true
  }
}
```

#### Paper Module Configuration
```json
{
  "paper": {
    "enabled": true,
    "highlightsFolder": "Viwoods/Paper",
    "sourcesFolder": "Viwoods/Paper/Sources",
    "enableRenameDetection": true,
    "extractImages": true
  }
}
```

#### Daily Module Configuration
```json
{
  "daily": {
    "enabled": true,
    "dailyFolder": "Viwoods/Daily",
    "extractImages": true
  }
}
```

#### Meeting Module Configuration
```json
{
  "meeting": {
    "enabled": true,
    "meetingsFolder": "Viwoods/Meeting",
    "extractImages": true
  }
}
```

#### Picking Module Configuration
```json
{
  "picking": {
    "enabled": true,
    "pickingsFolder": "Viwoods/Picking",
    "processNonNoteFiles": true,
    "extractImages": true
  }
}
```

#### Memo Module Configuration
```json
{
  "memo": {
    "enabled": true,
    "memosFolder": "Viwoods/Memo",
    "enableRenameDetection": true,
    "processImagesWithWhiteBackground": true
  }
}
```

### 4. Customize Templates (Optional)

Each module supports custom templates. Create markdown files in your vault and reference them in the configuration:

#### Example Memo Template
```markdown
# 📝 {{memoTitle}}

> Created: {{created}} | Modified: {{modified}}

{{#hasRemind}}
> ⏰ **Reminder:** {{remindTime}}
{{/hasRemind}}

{{#isTodo}}
## Todo Status
{{#isTodoFinished}}✅ Completed{{/isTodoFinished}}
{{^isTodoFinished}}⭕ Pending{{/isTodoFinished}}
{{/isTodo}}

## Content

![Memo Image]({{memoImagePath}})

#memo/{{memoTitle}}
```

### 5. Run First Sync

1. Click the **Fetch** button in plugin settings
2. Or use the ribbon icon in the sidebar
3. Or run the "Fetch Dropbox files" command (Ctrl/Cmd+P)

## Output Structure

After configuration, your vault will have this structure (for enabled modules):

```
Viwoods/
├── Learning/
│   ├── Highlights/          # Text highlights
│   ├── Annotations/         # Handwritten annotations  
│   ├── Library/             # EPUB/PDF source files
│   └── resources/           # Composite annotation images
├── Paper/
│   ├── Note files           # Handwritten notes
│   ├── Sources/             # Original .note files
│   └── resources/           # Page images
├── Daily/
│   ├── 2025/
│   │   ├── 2025-10/         # Monthly folders
│   │   │   ├── 2025-10-21.md
│   │   │   └── resources/
├── Meeting/
│   ├── Meeting notes        # Meeting files
│   └── resources/
├── Picking/
│   ├── Capture notes        # Screenshots and captures
│   └── resources/
├── Memo/
│   ├── Memo files           # Text memos with todos
│   └── resources/
└── viwoodsNoteMetadata.md   # Cross-reference metadata
```

## Advanced Features

### Rename Detection

Paper and Memo modules support automatic rename detection:

- When you rename a note in Viwoods, the output files are automatically renamed
- User edits are preserved during renames
- Image references are updated automatically
- Enable with `enableRenameDetection: true`

### Content Preservation

The plugin protects your edits:

- User-modified markdown files are never overwritten
- Custom sections are preserved during template updates
- Images and source files can be preserved across syncs
- Use the "Clear processed files tracking" button to force re-fetch

### Smart Image Management

- **Cache-busting** - Images get timestamps to force refresh in Obsidian
- **White background** - Memo images processed for better visibility
- **Composite images** - Handwriting merged with page backgrounds
- **Automatic cleanup** - Orphaned images removed when notes are deleted

## Troubleshooting

### Files Not Processing

1. **Check module is enabled** - Ensure the specific module is turned on in configuration
2. **Verify folder structure** - Files must be in correct Viwoods module folders
3. **Check file extensions** - .note files for notes, .jpg/.png for standalone images
4. **Review logs** - Check console (Ctrl+Shift+I) for error messages

### Rename Detection Not Working

1. **Enable feature** - Set `enableRenameDetection: true` for the module
2. **Check metadata** - Existing files should have `viwoodsNoteId` in YAML frontmatter
3. **Verify cross-reference** - `viwoodsNoteMetadata.md` should exist and be updated
4. **Re-fetch** - Trigger a manual fetch to update metadata

### Images Not Displaying

1. **Check paths** - Image paths in markdown should be relative to vault root
2. **Verify files exist** - Check that image files were created in resources folders
3. **Refresh Obsidian** - Use Ctrl/Cmd+R to clear image cache
4. **Check timestamps** - Images have cache-busting timestamps that update each sync

### Templates Not Applied

1. **Verify template paths** - Paths should be relative to vault root
2. **Check template syntax** - Use `{{variable}}` format, correct variable names
3. **Test with defaults** - Remove custom template paths to test with defaults
4. **Restart Obsidian** - Templates are cached, restart to clear

## Performance Tips

### Selective Module Processing

Only enable the modules you actually use to improve sync speed:

```json
{
  "learning": { "enabled": true },
  "paper": { "enabled": true },
  "daily": { "enabled": false },    // Not using Daily app
  "meeting": { "enabled": false },  // Not using Meeting app
  "picking": { "enabled": false },  // Not using Picking app
  "memo": { "enabled": true }
}
```

### Source File Management

Disable source file downloads to save space:

```json
{
  "learning": { "downloadSourceFiles": false },
  "paper": { "sourcesFolder": "" }  // Empty = don't save .note files
}
```

### Mobile Optimization

On mobile devices, consider:

- Smaller folder structures
- Fewer enabled modules
- Disabled source file downloads
- Lower resolution image processing

## Migration from Single Module

If you were using the old single-module Viwoods processor:

1. **Backup existing files** - Copy your current Viwoods folder
2. **Update configuration** - Enable the new modular processor
3. **Configure modules** - Set up each module you use
4. **Test with new folder** - Start with a fresh output folder
5. **Migrate manually** - Move old files to new structure if needed

The new processor creates better-organized output but may have different folder structures than the legacy version.

## Need Help?

- **Documentation**: [FILE-PROCESSORS.md](FILE-PROCESSORS.md) for detailed configuration
- **Technical Specs**: [VIWOODS_SPECIFICATION.md](../specs/VIWOODS_SPECIFICATION.md) for implementation details
- **Issues**: Report problems on [GitHub Issues](https://github.com/jeroenwk/drpbx-fetcher/issues)
- **Community**: Share templates and workflows in the discussions