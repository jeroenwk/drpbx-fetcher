# Viwoods Note Files - Technical Specification

## Overview

This document provides a comprehensive technical specification for Viwoods `.note` files as they are organized in Dropbox after synchronization. Viwoods is a note-taking ecosystem that includes multiple specialized apps (modules) for different use cases.

**Version:** 1.0
**Date:** October 2025
**Status:** Based on analysis of samples from Viwoods-Note folder structure

---

## Table of Contents

1. [Dropbox Folder Structure](#dropbox-folder-structure)
2. [Note File Format](#note-file-format)
3. [Common JSON Schemas](#common-json-schemas)
4. [Module Specifications](#module-specifications)
   - [Paper Module](#paper-module)
   - [Daily Module](#daily-module)
   - [Meeting Module](#meeting-module)
   - [Learning Module](#learning-module)
   - [Picking Module](#picking-module)
   - [Memo Module](#memo-module)
5. [Resource Types Reference](#resource-types-reference)
6. [Implementation Guidelines](#implementation-guidelines)

---

## Dropbox Folder Structure

Viwoods synchronizes notes to Dropbox using the following structure:

```
Viwoods-Note/
└── {Device-Name}/          # e.g., "AiPaper"
    └── {Device-ID}/        # e.g., "S3AA2303M02672"
        ├── Paper/          # Handwritten notes module
        │   ├── Papers/     # User notes organized in custom folders
        │   │   ├── {Custom-Folder}/
        │   │   └── Unclassified Notes/
        │   ├── PDF Template/
        │   └── Image template/
        ├── Daily/          # Daily journal module
        ├── Meeting/        # Meeting notes module
        │   ├── Meetings/
        │   └── Image template/
        ├── Learning/       # Reading/study notes module
        │   ├── Reading Notes/
        │   └── Library/
        ├── Picking/        # Quick capture module
        │   ├── Pickings/
        │   └── Screenshot/
        └── Memo/           # Memo module (structure TBD)
```

### Folder Naming Conventions

- **Device Name**: Often the app name (e.g., "AiPaper")
- **Device ID**: Unique identifier for the device (e.g., "S3AA2303M02672")
- **Module Folders**: Named after their function (Paper, Daily, Meeting, Learning, Picking, Memo)
- **Subfolders**:
  - User-created custom folders (Paper module)
  - Predefined folders like "Unclassified Notes", "Meetings", "Reading Notes"
  - Template folders for PDF/Image templates

---

## Note File Format

All Viwoods notes use the `.note` file extension, which are **ZIP archives** containing:

### File Structure

A typical `.note` file contains:

```
note-name.note (ZIP archive)
├── {name}_HeaderInfo.json              # App metadata
├── {name}_NoteFileInfo.json            # Note metadata (Meeting/Paper)
├── {name}_NotesBean.json               # Note metadata (Daily/Picking)
├── {name}_PageListFileInfo.json        # Page metadata array
├── {name}_PageResource.json            # Resource metadata array
├── {name}_NoteTemplateResource.json    # Template info
├── {name}_PageTemplateResource.json    # Page template info
├── {name}_FolderFileInfo.json          # Folder metadata
├── mainBmp_{uuid}.png                  # Main page image
├── screenshotBmp_{uuid}.png            # Screenshot/capture image
├── Thumbnail_{uuid}.png                # Thumbnail image
├── path_{uuid}.json                    # Handwriting stroke data
├── order_{uuid}.txt                    # Resource ordering
├── browsingHistory_{timestamp}.browsingHistory  # Page history
└── {resource-files}                    # Images, PDFs, etc.
```

### Learning Module (EPUB) Format

Learning module notes that contain EPUB/PDF annotations have additional files:

```
├── {name}_BookBean.json                # Book metadata
├── {name}_ReadNoteBean.json            # Annotations array
├── {name}_PageTextAnnotation.json      # Text highlights
├── {book-file}.epub                    # Original EPUB
└── {annotation-images}/                # Annotation overlays
```

---

## Common JSON Schemas

### HeaderInfo.json

Identifies which Viwoods app created the note.

```json
{
  "appVersion": "string",      // Version code (e.g., "169", "1.0.88", "1.2.158", "1401")
  "dbVersion": number,         // Database schema version
  "packageName": "string"      // App identifier
}
```

**Package Names:**
- `com.wisky.schedule` - Daily module
- `com.wisky.meeting` - Meeting module
- `com.wisky.notewriter` - Paper module
- `com.wisky.learning` - Learning module
- `com.wisky.captureLog` - Picking module
- `com.wisky.memo` - Memo module (expected)

### NoteFileInfo.json

Used by Paper and Meeting modules.

```json
{
  "author": "string",           // User ID (e.g., "wisky_visitor_id")
  "creationTime": number,       // Unix timestamp in milliseconds
  "description": "string",      // Note description
  "fileName": "string",         // Note filename without extension
  "fileParentName": "string",   // Parent folder name
  "fileState": number,          // State flags (e.g., 1, 257, 65)
  "fileType": number,           // 20 = note file, 30 = page, 3 = folder
  "iconResource": number,       // Icon resource ID
  "id": "string",              // UUID or generated ID
  "isChecked": boolean,
  "isShowMenu": boolean,
  "lastModifiedTime": number,   // Unix timestamp in milliseconds
  "lastSyncTime": number,
  "order": number,
  "page": [],                   // Page references (usually empty in file)
  "pid": "string",             // Parent ID
  "resource": [],              // Resource references (usually empty in file)
  "totalPageSize": number,
  "uniqueId": "string",
  "userId": "string"
}
```

### NotesBean.json

Used by Daily and Picking modules.

```json
{
  "noteId": "string",          // Note identifier
  "noteName": "string",        // Display name
  "createTime": number,        // Unix timestamp in milliseconds
  "pageCount": number,         // Number of pages
  "currentPage": number,       // Current page index (Picking)
  "upTime": number,           // Last update time (Picking)
  "userId": "string",         // User identifier (Picking)
  // Daily-specific fields:
  "fileName": "string",       // e.g., "day_2025_9_14"
  "fileType": number,         // 1 = daily note
  "year": number,
  "month": number,
  "day": number,
  "lastTab": "string",        // e.g., "task"
  "taskPageCount": number,
  "taskLastPageIndex": number,
  "lastPageIndex": number,
  "isDelete": boolean
}
```

### PageListFileInfo.json

Array of page objects.

```json
[
  {
    "author": "string",
    "creationTime": number,
    "description": "string",
    "fileName": "string",        // e.g., "page_{uuid}"
    "fileParentName": "string",
    "fileState": number,
    "fileType": number,          // 30 = page
    "iconResource": number,
    "id": "string",             // Page UUID
    "isChecked": boolean,
    "isShowMenu": boolean,
    "lastModifiedTime": number,
    "lastSyncTime": number,
    "order": number,
    "page": [],
    "pid": "string",            // Parent note ID
    "resource": [],
    "totalPageSize": number,
    "uniqueId": "string",
    "userId": "string"
  }
]
```

### PageResource.json

Array of all resources (images, strokes, attachments) for the note.

```json
[
  {
    "bottom": number,           // Bottom coordinate
    "creationTime": number,
    "description": "string",
    "fileName": "string",       // Resource filename
    "id": "string",            // Resource UUID
    "imageBoxPath": "string",   // Optional path for image box
    "isChecked": boolean,
    "lastModifiedTime": number,
    "lastSyncTime": number,
    "left": number,            // Left coordinate
    "nickname": "string",       // Display name or page number
    "noteId": "string",        // Parent note ID
    "order": number,
    "pid": "string",           // Parent page ID or note ID
    "resourceState": number,    // 1 = normal, 3 = main
    "resourceType": number,     // See Resource Types Reference
    "right": number,           // Right coordinate
    "rotate": number,          // Rotation angle
    "scale": number,           // Scale factor
    "screenHeight": number,    // Screen height (e.g., 2560.0)
    "screenWidth": number,     // Screen width (e.g., 1920.0)
    "top": number,            // Top coordinate
    "uniqueId": "string"
  }
]
```

### NoteList.json (Daily/Picking)

Array of page/image metadata.

```json
[
  {
    "creationTime": number,
    "fileName": "string",           // e.g., "day_2025_9_14"
    "fullPagePath": "string",
    "id": "string",                // UUID
    "isNote": number,              // 1 = is a note
    "lastModifiedTime": number,
    "offsetY": "string",
    "pageFilePath": "string",      // Original Android file path
    "pageOrder": number,
    "pageShotFilePath": "string",
    "userId": "string",
    // Picking-specific fields:
    "fixHeightHandWrite": number,
    "fixHeightLayer": number,
    "isChose": boolean,
    "noteId": "string",
    "pageId": "string",
    "pathFile": "string",
    "pathOrder": number,
    "smallOrderId": "string"
  }
]
```

### Path JSON (Handwriting Strokes)

Large array of stroke coordinate data `[x, y, id]`.

```json
[
  [904, 224, 166],
  [899, 225, 167],
  [908, 225, 165],
  // ... thousands of coordinate triplets
]
```

### Layout Files (Picking Module)

**LayoutImage.json:**
```json
[
  {
    "imgUrl": "string",         // Path to image file
    "isShow": boolean,
    "layHeight": number,
    "layId": "string",
    "layType": number,          // 0 = image
    "layWidth": number,
    "layX": number,            // X position
    "layY": number,            // Y position
    "noteId": "string",
    "pageId": "string",
    "screenHeight": number,
    "screenWidth": number,
    "upTime": number,
    "word": "string"
  }
]
```

**LayoutText.json:**
```json
[]  // Often empty, would contain text layout info
```

---

## Module Specifications

## Paper Module

**App:** Viwoods Note Writer (`com.wisky.notewriter`)
**Purpose:** Freeform handwritten notes, sketches, and annotated PDFs
**Folder:** `Paper/`

### Folder Structure

```
Paper/
├── Papers/                    # User notes
│   ├── {Custom-Folder}/      # User-created folders (e.g., "Léna", "Séverine")
│   │   └── {note}.note
│   └── Unclassified Notes/   # Default folder
│       └── {note}.note
├── PDF Template/             # Notes created from PDF templates
│   └── {template}.pdf.note
└── Image template/           # Notes created from image templates
    └── {template}.note
```

### File Contents

**Standard handwritten note:**
- `{name}_HeaderInfo.json` - Package: `com.wisky.notewriter`
- `{name}_NoteFileInfo.json` - Note metadata
- `{name}_PageListFileInfo.json` - Pages array
- `{name}_PageResource.json` - Resources (images, strokes, PDFs)
- `{name}_FolderFileInfo.json` - Folder info
- `{name}_NoteTemplateResource.json` - Template reference
- `{name}_PageTemplateResource.json` - Page template
- `mainBmp_{uuid}.png` - Main canvas image
- `path_{uuid}.json` - Handwriting stroke data
- `screenshotBmp_{uuid}.png` - Screenshot of page
- `Thumbnail_{uuid}.png` - Thumbnail image
- `order_{uuid}.txt` - Resource ordering
- `browsingHistory_{timestamp}.browsingHistory` - Page viewing history

**PDF template note:**
- All standard files plus:
- `{template-name}.pdf` - Original PDF file
- Note filename ends with `.pdf.note`

### Subfolder Categories

The Paper module supports user-created organizational folders. Common patterns:

- **Unclassified Notes** - Default folder
- **Thinking** - Brainstorming notes
- **Writing** - Writing drafts
- **Sketching** - Drawings and diagrams
- **Analyzing** - Analysis notes
- **Custom names** - Any user-defined folder name

### Resource Types in Paper Notes

From `PageResource.json`:
- **Type 1** - Main bitmap (`resourceState: 3`)
- **Type 2** - Screenshot bitmap
- **Type 7** - Path/stroke data
- **Type 8** - Order file
- **Type 9** - Thumbnail
- **Type 11** - Browsing history

### Implementation Notes

Paper notes should be processed to extract:
1. **Handwritten content** - Via path JSON and composite images
2. **Text annotations** - If OCR is available
3. **Attached PDFs** - Copy to resources folder
4. **Page structure** - Multiple pages per note
5. **Custom folder hierarchy** - Preserve in vault

---

## Daily Module

**App:** Viwoods Daily (`com.wisky.schedule`)
**Purpose:** Daily journal/planner with date-based organization
**Folder:** `Daily/`

### Folder Structure

```
Daily/
└── day_{YYYY}_{M}_{D}.note    # e.g., day_2025_10_14.note
```

### File Contents

- `{name}_HeaderInfo.json` - Package: `com.wisky.schedule`
- `{name}_NotesBean.json` - Daily note metadata with date fields
- `{name}_NoteList.json` - Page array with single entry
- `{uuid}.png` - Page image

### Daily Note Metadata Fields

From `NotesBean.json`:
```json
{
  "fileName": "day_2025_9_14",
  "year": 2025,
  "month": 9,
  "day": 14,
  "fileType": 1,           // Daily note type
  "lastTab": "task",       // Active tab (task/note/etc)
  "pageCount": 1,
  "taskPageCount": 1,
  "taskLastPageIndex": 0,
  "lastPageIndex": 0
}
```

### Implementation Notes

Daily notes should be processed to:
1. **Extract date** from filename or NotesBean
2. **Generate daily note** in Obsidian daily notes format
3. **Link to calendar** - Integration with calendar plugins
4. **Extract tasks** - If task data available
5. **Preserve page image** - Reference from markdown

**Suggested Output Structure:**
```
Daily/
├── 2025/
│   ├── 2025-10/
│   │   ├── 2025-10-14.md
│   │   └── resources/
│   │       └── 2025-10-14.png
```

---

## Meeting Module

**App:** Viwoods Meeting (`com.wisky.meeting`)
**Purpose:** Meeting notes with templates and action items
**Folder:** `Meeting/`

### Folder Structure

```
Meeting/
├── Meetings/              # User meeting notes
│   └── {note}.note
└── Image template/        # Template resources
```

### File Contents

- `{name}_HeaderInfo.json` - Package: `com.wisky.meeting`
- `{name}_NoteFileInfo.json` - Meeting metadata
- `{name}_PageListFileInfo.json` - Pages
- `{name}_PageResource.json` - Resources
- `{name}_FolderFileInfo.json` - Folder info
- `{name}_NoteTemplateResource.json` - Template
- `{name}_PageTemplateResource.json` - Page template
- `mainBmp_{uuid}.png` - Main canvas
- `path_{uuid}.json` - Handwriting strokes
- `screenshotBmp_{uuid}.png` - Screenshot
- `Thumbnail_{uuid}.png` - Thumbnail
- `order_{uuid}.txt` - Resource order
- `browsingHistory_{timestamp}.browsingHistory` - History

### Implementation Notes

Meeting notes are very similar to Paper notes but have meeting-specific context. Process to:

1. **Extract meeting metadata** - Date, attendees if available
2. **Structure as meeting note** - Use meeting note template
3. **Extract action items** - If marked in note
4. **Link to calendar** - Meeting date/time if available
5. **Preserve handwriting** - Via composite images

**Suggested Output Structure:**
```
Meeting/
├── {meeting-name}.md
└── resources/
    ├── {meeting-name}-page-1.png
    └── {meeting-name}-thumbnail.png
```

---

## Learning Module

**App:** Viwoods Learning (`com.wisky.learning`)
**Purpose:** Reading notes with EPUB/PDF annotations and highlights
**Folder:** `Learning/`

### Folder Structure

```
Learning/
├── Reading Notes/         # Annotation notes
│   └── {book-title}.note
└── Library/              # Original books (optional)
```

### File Contents (EPUB Format)

- `{name}_HeaderInfo.json` - Package: `com.wisky.learning`
- `{name}_BookBean.json` - Book metadata
- `{name}_ReadNoteBean.json` - Annotations array
- `{name}_PageTextAnnotation.json` - Text highlights
- `{book-file}.epub` - Original EPUB file
- Annotation overlay images:
  - `noteImagePath_{uuid}.png` - Handwriting overlay
  - `pageImage_{uuid}.jpg` - Page background

### BookBean Schema

```json
{
  "bookId": "string",
  "bookName": "string",
  "bookPath": "string"
}
```

### ReadNoteBean Schema

```json
[
  {
    "id": number,
    "bookId": "string",
    "bookName": "string",
    "userId": "string",
    "epubPageIndex": number,      // EPUB page number
    "pageIndex": number,          // Display page
    "pageIndexItem": number,
    "rootChapterName": "string",  // Chapter name
    "rootChapterLinkUri": "string",
    "title": "string",
    "sumary": "string",          // Annotation text (note: misspelled)
    "alias": "string",
    "noteImagePath": "string",   // PNG overlay with handwriting
    "pageImage": "string",       // JPG background image
    "upDataTime": number,
    "noteType": number,
    "epubSettingStr": "string",
    "bookType": number
  }
]
```

### PageTextAnnotation Schema

```json
[
  {
    "bookName": "string",
    "chapterName": "string",
    "rootChapterName": "string",
    "chapterLinkUri": "string",
    "rawText": "string",         // Highlighted text
    "pageIndex": number,
    "pageCount": number,
    "createTime": number
  }
]
```

### Implementation Status

✅ **Currently Implemented** - The Learning module is fully processed by `EpubFormatProcessor`:
- Extracts highlights to markdown
- Processes annotations with composite images
- Copies source EPUB to library
- Generates index files

---

## Picking Module

**App:** Viwoods Capture Log (`com.wisky.captureLog`)
**Purpose:** Quick captures - screenshots, images, quick notes
**Folder:** `Picking/`

### Folder Structure

```
Picking/
├── Pickings/              # Quick capture notes
│   └── {capture}.note
└── Screenshot/           # Screenshot captures
```

### File Contents

- `{name}_HeaderInfo.json` - Package: `com.wisky.captureLog`
- `{name}_NotesBean.json` - Capture metadata
- `{name}_NoteList.json` - Page/capture list
- `{name}_{pageId}_LayoutImage.json` - Image layout
- `{name}_{pageId}_LayoutText.json` - Text layout (often empty)
- `PATH_{pageId}.json` - Handwriting strokes
- `{timestamp}.jpg` - Captured/inserted image
- `{pageId}.png` - Handwriting layer
- `thumbnai.jpg` - Thumbnail (note: filename misspelled in samples)

### Picking Metadata

From `NotesBean.json`:
```json
{
  "noteId": "17598264557446607",  // Timestamp-based ID
  "noteName": "Paper 1",
  "nickname": "Paper 1",
  "createTime": 1759826455744,
  "currentPage": 1,
  "pageCount": 1,
  "userId": "8388",
  "lastEditDialogTime": 1759826503443,
  "upTime": 1759826622786
}
```

### Layout Files

**LayoutImage.json** describes inserted images:
```json
[
  {
    "imgUrl": "/storage/.../photo/1759826454684.jpg",
    "isShow": true,
    "layHeight": 809,
    "layWidth": 1193,
    "layX": 111,          // X position
    "layY": 290,          // Y position
    "layId": "...",
    "layType": 0,         // 0 = image
    "noteId": "...",
    "pageId": "...",
    "screenHeight": 2560,
    "screenWidth": 1920,
    "upTime": 1759826620197,
    "word": ""
  }
]
```

### Implementation Notes

Picking notes are quick captures that may contain:
1. **Screenshots** - Captured screen images
2. **Photos** - Camera or gallery images
3. **Quick sketches** - Handwritten annotations
4. **Mixed content** - Combination of images + handwriting

Process to:
1. **Extract capture images** - From LayoutImage.json
2. **Overlay handwriting** - Combine PATH data with images
3. **Preserve layout** - Maintain relative positioning
4. **Generate markdown** - Link to composite images

**Suggested Output Structure:**
```
Picking/
├── {capture-name}.md
└── resources/
    ├── {capture-name}-composite.png
    └── {capture-name}-thumbnail.jpg
```

---

## Memo Module

**App:** Viwoods Memo (expected: `com.wisky.memo`)
**Purpose:** Quick text memos and reminders
**Folder:** `Memo/`

### Status

⚠️ **No Samples Available** - No memo notes found in sample data.

### Expected Structure

Based on patterns from other modules:

```
Memo/
└── {memo}.note
```

**Expected file contents:**
- `{name}_HeaderInfo.json` - Package: `com.wisky.memo`
- `{name}_MemoInfo.json` or `{name}_NotesBean.json` - Memo metadata
- Text content files
- Optional images

### Implementation Notes

When samples become available:
1. Analyze memo file structure
2. Identify unique memo fields
3. Determine text extraction method
4. Create MemoProcessor class

---

## Resource Types Reference

From `PageResource.json`, the `resourceType` field identifies resource purpose:

| Type | Name | Description | Example Filename |
|------|------|-------------|------------------|
| 1 | Main Bitmap | Main canvas image | `mainBmp_{uuid}.png` |
| 2 | Screenshot | Page screenshot | `screenshotBmp_{uuid}.png` |
| 7 | Path Data | Handwriting strokes | `path_{uuid}.json` |
| 8 | Order File | Resource ordering | `order_{uuid}.txt` |
| 9 | Thumbnail | Thumbnail image | `Thumbnail_{uuid}.png` |
| 11 | Browsing History | Page view history | `browsingHistory_{timestamp}.browsingHistory` |

### Resource States

The `resourceState` field:
- `1` - Normal resource
- `3` - Main resource (primary canvas)

---

## Implementation Guidelines

### Extending ViwoodsProcessor

The current `ViwoodsProcessor` architecture supports extension:

```typescript
// src/processors/ViwoodsProcessor/index.ts
async process(...) {
  // Detects format:
  if (hasEpubFormat) {
    // EpubFormatProcessor (Learning - ✅ implemented)
  } else {
    // HandwrittenNotesProcessor (all others - ⚠️ basic implementation)
  }
}
```

### Module Detection Strategy

Detect module type from:

1. **Package name** in `HeaderInfo.json`:
   - `com.wisky.schedule` → Daily
   - `com.wisky.meeting` → Meeting
   - `com.wisky.notewriter` → Paper
   - `com.wisky.captureLog` → Picking
   - `com.wisky.memo` → Memo
   - `com.wisky.learning` → Learning (already handled)

2. **File structure** indicators:
   - Presence of `NotesBean.json` with date fields → Daily
   - Presence of `LayoutImage.json` → Picking
   - Folder path contains `/Daily/` → Daily module
   - Folder path contains `/Meeting/` → Meeting module
   - etc.

### Recommended Processor Architecture

```
src/processors/ViwoodsProcessor/
├── index.ts                      # Main router
├── EpubFormatProcessor.ts        # ✅ Learning module
├── HandwrittenNotesProcessor.ts  # ⚠️ Generic fallback
├── DailyProcessor.ts             # ⭕ To implement
├── MeetingProcessor.ts           # ⭕ To implement
├── PaperProcessor.ts             # ⭕ To implement
├── PickingProcessor.ts           # ⭕ To implement
├── MemoProcessor.ts              # ⭕ To implement (when samples available)
├── AnnotationProcessor.ts        # Shared
├── ImageCompositor.ts            # Shared
└── ViwoodsTypes.ts              # Shared types
```

### Implementation Priority

Suggested order based on complexity and usefulness:

1. **Daily** - Simple structure, very useful for daily notes
2. **Paper** - Core handwritten notes, moderate complexity
3. **Meeting** - Similar to Paper but meeting-specific
4. **Picking** - More complex due to layout system
5. **Memo** - Awaiting sample data

### Common Processing Tasks

All modules share these processing needs:

1. **Extract metadata** - Parse HeaderInfo, NoteFileInfo/NotesBean
2. **Extract images** - Main canvas, screenshots, thumbnails
3. **Process handwriting** - Path JSON → rendered strokes or composite images
4. **Generate markdown** - Using configurable templates
5. **Organize output** - Folder structure in vault
6. **Handle resources** - Images, PDFs, attachments

### Template Variables

Each module should support these template variables:

**Common:**
- `{{title}}` - Note title
- `{{created}}` - Creation timestamp
- `{{modified}}` - Last modified timestamp
- `{{appVersion}}` - App version
- `{{userId}}` - User ID

**Module-specific:**

**Daily:**
- `{{date}}` - ISO date (YYYY-MM-DD)
- `{{year}}`, `{{month}}`, `{{day}}`
- `{{lastTab}}` - Active tab

**Meeting:**
- `{{meetingTitle}}` - Meeting name
- `{{meetingDate}}` - Meeting date if available

**Paper:**
- `{{folderPath}}` - Custom folder path
- `{{pageCount}}` - Number of pages

**Picking:**
- `{{captureType}}` - Screenshot/Photo/Note
- `{{imageCount}}` - Number of images

**Learning:**
- `{{bookTitle}}` - Book name
- `{{author}}` - Book author if available
- `{{highlightCount}}` - Number of highlights
- `{{annotationCount}}` - Number of annotations

---

## Appendix: Field Descriptions

### Common Timestamp Fields

- **creationTime** - When note/resource was created (Unix ms)
- **lastModifiedTime** - When note/resource was last edited (Unix ms)
- **upDataTime / upTime** - Upload/update time (Unix ms)
- **lastSyncTime** - Last sync to cloud (Unix ms, often 0)

### Common ID Fields

- **id** - Primary UUID or generated ID
- **noteId** - Parent note ID
- **pageId** - Parent page ID
- **pid** - Parent ID (note or page)
- **userId** - User identifier

### File State Flags

The `fileState` field appears to be a bitmask:
- `1` - Normal state
- `65` - PDF template (64 + 1)
- `257` - Special state (256 + 1)

Further analysis needed for complete flag documentation.

---

## Version History

- **v1.0** (October 2025) - Initial specification based on sample analysis
  - Documented all 6 modules
  - Analyzed JSON schemas
  - Provided implementation guidelines
  - Learning module already implemented

---

## Notes for Developers

1. **Timestamp Conversion**: All timestamps are Unix milliseconds. Convert to Date: `new Date(timestamp)`

2. **UUID References**: Resources reference pages via `pid`, and pages reference notes. Follow the chain to build structure.

3. **Path Coordinates**: Path JSON contains `[x, y, strokeId]` triplets. X/Y are absolute coordinates for the screen dimensions specified in PageResource.

4. **File Naming**: Original Android paths in metadata are not relevant for output. Use note titles and UUIDs.

5. **Empty Arrays**: Many JSON files contain empty `page` and `resource` arrays - the actual data is in separate JSON files.

6. **Package Detection**: Always check `HeaderInfo.json` first to identify which Viwoods app created the note.

7. **Folder Preservation**: Paper module custom folders should be preserved in vault structure.

8. **Template Support**: All modules should support custom Obsidian templates via TemplateEngine.

---

**End of Specification**
