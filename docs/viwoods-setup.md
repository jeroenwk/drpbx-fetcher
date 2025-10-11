# viwoods Notes Setup Guide

## Quick Start

This guide will help you set up the viwoods Notes processor to automatically extract and organize your handwritten notes from `.note` files.

## What You'll Get

When you sync a `.note` file, the processor will create:

1. **Highlight files** - One per page with handwriting, containing:
   - Page image
   - Handwriting stroke data
   - Note-taking space

2. **Annotation files** - One per page with text annotations
   - Text content from the note
   - Note-taking space

3. **Page files** (optional) - Comprehensive page view
   - All page content
   - Metadata

4. **Index file** (optional) - Links to all created files

5. **Source file** (optional) - Original `.note` file for reference

6. **Images** - Extracted page PNGs and thumbnails

## Setup Steps

### 1. Enable viwoods Processor

1. Open **Obsidian Settings** → **Dropbox Fetcher**
2. Scroll to **File Processors** section
3. Click **Add file processor**
4. Select **viwoods Notes** from dropdown
5. Click **Add**

### 2. Configure Output Folders

The processor will create files in these folders (all relative to your vault root):

```
Viwoods/
├── Highlights/      # Highlight markdown files
├── Annotations/     # Annotation markdown files
├── Pages/           # Page images and comprehensive notes
└── Library/         # Original .note files
```

To customize these folders, edit your `data.json`:

```json
{
  "fileTypeMappings": [
    {
      "id": "...",
      "extension": "note",
      "processorType": "viwoods",
      "enabled": true,
      "config": {
        "highlightsFolder": "MyNotes/Highlights",
        "annotationsFolder": "MyNotes/Annotations",
        "sourcesFolder": "MyNotes/Sources",
        "pagesFolder": "MyNotes/Pages",
        "includeMetadata": true,
        "includeThumbnail": true,
        "extractImages": true,
        "createIndex": true
      }
    }
  ]
}
```

### 3. Add .note Files to Dropbox

1. Place your `.note` files in a Dropbox folder
2. Create a folder mapping in Dropbox Fetcher settings:
   - **Remote path:** `/MyNotes` (your Dropbox folder)
   - **Local path:** Leave as configured in processor settings

### 4. Sync

Click the sync button or use the command palette (`Ctrl/Cmd+P` → "Sync Dropbox files")

## Customizing Templates

### Default Highlight Template

The default template looks like:

```markdown
## {{noteTitle}}

**Page:** {{pageNumber}}/{{totalPages}}
**Date:** {{date:YYYY-MM-DD}}
**Source:** [Open Note]({{sourceLink}})

---

![[{{pageImagePath}}]]

### Handwriting Data

Strokes: {{strokeCount}}
Points: {{pointCount}}

### Notes

*Add your thoughts here*

---
#highlight #Viwoods/{{noteSlug}}
```

### Creating a Custom Template

1. Create a new markdown file in your vault, e.g., `Templates/MyHighlight.md`:

```markdown
# 📝 {{noteTitle}} - Page {{pageNumber}}

![[{{pageImagePath}}]]

## My Thoughts

- [ ] Review this
- [ ] Add summary

## Metadata
- **Date:** {{date:MMMM DD, YYYY}}
- **Strokes:** {{strokeCount}}
- **Page:** {{pageNumber}}/{{totalPages}}

#review #Viwoods/{{noteSlug}}
```

2. Update your processor config in `data.json`:

```json
{
  "config": {
    "highlightTemplate": "Templates/MyHighlight.md",
    // ... other settings
  }
}
```

3. Restart Obsidian or clear template cache

### Available Template Variables

**All Templates:**
- `{{noteTitle}}` - Note title
- `{{noteName}}` - Filename
- `{{noteSlug}}` - Slugified name (for tags)
- `{{pageNumber}}` - Current page
- `{{totalPages}}` - Total pages
- `{{createTime}}` - Creation timestamp
- `{{sourceLink}}` - Link to .note file
- `{{date}}` or `{{date:FORMAT}}` - Current date
- `{{time}}` or `{{time:FORMAT}}` - Current time

**Highlight Templates:**
- `{{pageImagePath}}` - Path to page image
- `{{strokeCount}}` - Number of strokes
- `{{pointCount}}` - Total points

**Annotation Templates:**
- `{{textContent}}` - JSON of text annotations

## Advanced Configuration

### Minimal Setup (Highlights Only)

```json
{
  "config": {
    "highlightsFolder": "Highlights",
    "annotationsFolder": "",
    "sourcesFolder": "",
    "pagesFolder": "",
    "includeMetadata": true,
    "includeThumbnail": false,
    "extractImages": true,
    "createIndex": false
  }
}
```

### Complete Setup (All Features)

```json
{
  "config": {
    "highlightsFolder": "Viwoods/Highlights",
    "annotationsFolder": "Viwoods/Annotations",
    "sourcesFolder": "Viwoods/Library",
    "pagesFolder": "Viwoods/Pages",
    "highlightTemplate": "Templates/Highlight.md",
    "annotationTemplate": "Templates/Annotation.md",
    "pageTemplate": "Templates/Page.md",
    "includeMetadata": true,
    "includeThumbnail": true,
    "extractImages": true,
    "createIndex": true
  }
}
```

## File Naming Convention

Files are named automatically:

- **Highlights:** `{note-slug}-page-{N}-highlight.md`
- **Annotations:** `{note-slug}-page-{N}-annotation.md`
- **Pages:** `{note-slug}-page-{N}.md`
- **Index:** `{note-slug}-index.md`
- **Images:** `{note-slug}-page-{N}.png`
- **Thumbnail:** `{note-slug}-thumbnail.png`
- **Source:** `{note-slug}.note`

Example:
- Input: `My Reading Notes.note`
- Output:
  - `my-reading-notes-page-1-highlight.md`
  - `my-reading-notes-page-1.png`
  - etc.

## Workflow Examples

### Study Notes Workflow

1. Take notes in viwoods app
2. Save to Dropbox
3. Sync to Obsidian
4. Review highlights in `Viwoods/Highlights/`
5. Add your thoughts in the "Notes" section
6. Link to other notes in your vault
7. Use tags for organization

### Reading Highlights Workflow

1. Highlight passages while reading
2. Sync to Obsidian
3. Use Obsidian's graph view to see connections
4. Create literature notes from highlights
5. Build your knowledge base

## Troubleshooting

**Problem:** No files created after sync

**Solution:**
- Check console logs (Ctrl+Shift+I / Cmd+Opt+I)
- Verify the `.note` file is valid (can be opened as ZIP)
- Ensure at least one output folder is configured
- Check that the processor mapping is enabled

**Problem:** Images not showing in markdown

**Solution:**
- Verify `extractImages: true` in config
- Check that image paths are correct
- Reload the note or restart Obsidian

**Problem:** Template not applied

**Solution:**
- Check template path is correct
- Verify template file exists
- Restart Obsidian to clear template cache
- Check for syntax errors in template

## Tips

1. **Use tags consistently** - The `{{noteSlug}}` variable creates consistent tags
2. **Keep templates simple** - Start with defaults, customize gradually
3. **Organize by project** - Use different folders for different note types
4. **Link your notes** - Use `[[wikilinks]]` to connect highlights to your other notes
5. **Review regularly** - Set up a daily/weekly review routine

## Getting Help

- See `FILE-PROCESSORS.md` for technical details
- Check `SPEC-FileProcessors.md` for architecture
- Report issues on GitHub
- Check console logs for error details
