# Annotation Support Specification (Updated)

**Status:** Ready for Implementation
**Version:** 0.3.0
**Date:** 2025-10-10
**Last Updated:** 2025-10-10

---

## Overview

This specification details the implementation of handwritten annotation support for EPUB reader `.note` files from the Viwoods/AIPaper app. This extends the existing text highlight support (from `PageTextAnnotation.json`) by processing handwritten annotations from `ReadNoteBean.json`.

### Current State (Implemented)
✅ Text highlights from `PageTextAnnotation.json`
✅ EPUB file extraction
✅ Source .note file preservation
✅ Template-based markdown generation
✅ Streaming ZIP extraction

### New Addition (v0.3.0)
🎯 Handwritten annotations from `ReadNoteBean.json`
🎯 Annotation image extraction and composition (JPG page + PNG overlay)
🎯 Annotation markdown files with embedded composite images
🎯 Per-annotation files with rich metadata

---

## Data Structure Analysis

### ReadNoteBean.json Structure

**File Location:** `{bookName}_ReadNoteBean.json` (prefixed with book name)

**Format:** Array of annotation objects

```json
[
  {
    "id": 2,
    "bookId": "52264d5893d39c3d9865b859cac47f7d",
    "bookName": "De Brief Voor de Koning...",
    "userId": "9999999",

    // Page & Chapter Information
    "epubPageIndex": 4,
    "pageIndex": 4,
    "pageIndexItem": -1,
    "rootChapterName": "EERSTE DEEL De opdracht",
    "rootChapterLinkUri": "OEBPS/Text/index_split_003.html",
    "title": "De ridders van koning Dagonaut",

    // Content
    "sumary": "Ristridin van het Zuiden, om er maar enkelen...",
    "alias": "",

    // Image References
    "noteImagePath": "/storage/.../4bc49040b7d46be4362144eb69c7039e.png",
    "pageImage": "/storage/.../4bc49040b7d46be4362144eb69c7039e.jpg",

    // Timestamps
    "upDataTime": 1759831388,

    // Type & Settings
    "noteType": 0,
    "epubSettingStr": "{...}",
    "bookType": 1
  }
]
```

**Key Fields:**

| Field | Purpose | Notes |
|-------|---------|-------|
| `id` | Unique annotation ID | Used for filename generation |
| `pageIndex` | Page number in EPUB | For organization and sorting |
| `rootChapterName` | Main chapter | E.g., "EERSTE DEEL De opdracht" |
| `title` | Subchapter/section | E.g., "De ridders van koning Dagonaut" |
| `sumary` | Annotation text summary | May be truncated (misspelled in source) |
| `noteImagePath` | Path to PNG overlay | Handwriting/annotations |
| `pageImage` | Path to JPG page image | Background page image |
| `upDataTime` | Unix timestamp | When annotation was created |
| `rootChapterLinkUri` | EPUB location | Deep link to chapter |

---

## Image Handling Strategy

### Image Files in ZIP

Annotations require TWO image files per annotation:

1. **JPG Page Image** (e.g., `4bc49040b7d46be4362144eb69c7039e.jpg`)
   - Full page background from EPUB
   - Extract filename from `pageImage` field

2. **PNG Annotation Overlay** (e.g., `4bc49040b7d46be4362144eb69c7039e.png`)
   - Transparent handwriting/highlights
   - Extract filename from `noteImagePath` field

### Image Composition Process

To create a useful annotation image, we need to **composite** the JPG and PNG:

```
JPG (page background) + PNG (handwriting overlay) = Composite Image
```

**Implementation Approach:**

1. **Extract both images** from ZIP
2. **Create composite image** using Canvas API:
   - Load JPG as base layer
   - Overlay PNG on top (preserving transparency)
   - Export as single PNG file
3. **Save composite** to vault
4. **Embed in markdown** using Obsidian image syntax

**Technical Details:**

```typescript
async function createCompositeImage(
  jpgData: Uint8Array,
  pngData: Uint8Array
): Promise<Blob> {
  // Create Image elements from binary data
  const jpgBlob = new Blob([jpgData], { type: 'image/jpeg' });
  const pngBlob = new Blob([pngData], { type: 'image/png' });

  const jpgUrl = URL.createObjectURL(jpgBlob);
  const pngUrl = URL.createObjectURL(pngBlob);

  const jpgImg = await loadImage(jpgUrl);
  const pngImg = await loadImage(pngUrl);

  // Create canvas with JPG dimensions
  const canvas = document.createElement('canvas');
  canvas.width = jpgImg.width;
  canvas.height = jpgImg.height;

  const ctx = canvas.getContext('2d')!;

  // Draw JPG as background
  ctx.drawImage(jpgImg, 0, 0);

  // Draw PNG overlay on top
  ctx.drawImage(pngImg, 0, 0);

  // Convert to blob
  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob!), 'image/png');
  });

  // Cleanup
  URL.revokeObjectURL(jpgUrl);
  URL.revokeObjectURL(pngUrl);
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });
}
```

---

## Configuration Schema

### Updated ViwoodsProcessorConfig

Add new fields to existing config interface:

```typescript
interface ViwoodsProcessorConfig extends ProcessorConfig {
  // Existing fields
  highlightsFolder: string;
  annotationsFolder: string;
  sourcesFolder: string;
  pagesFolder: string;
  highlightTemplate?: string;
  annotationTemplate?: string;
  pageTemplate?: string;
  includeMetadata: boolean;
  includeThumbnail: boolean;
  extractImages: boolean;
  createIndex: boolean;

  // NEW: Annotation processing options
  processAnnotations?: boolean;           // Enable annotation processing (default: true)
  annotationImagesFolder?: string;        // Subfolder for images (default: same as annotationsFolder)
  includeSummaryInAnnotation?: boolean;   // Include summary text in markdown (default: true)
  createCompositeImages?: boolean;        // Compose JPG+PNG (default: true, false = PNG only)
}
```

### Default Values

```typescript
{
  processAnnotations: true,
  annotationImagesFolder: "",  // Empty = same as annotationsFolder
  includeSummaryInAnnotation: true,
  createCompositeImages: true,
}
```

---

## Markdown Template Design

### Annotation Template Variables

```typescript
interface AnnotationTemplateData {
  // Book info
  bookName: string;          // "De Brief Voor de Koning"
  bookSlug: string;          // "de-brief-voor-de-koning"

  // Location
  location: string;          // "EERSTE DEEL De opdracht → De ridders van koning Dagonaut"
  chapterName: string;       // "De ridders van koning Dagonaut"
  rootChapterName: string;   // "EERSTE DEEL De opdracht"

  // Page & Source
  pageNumber: number;        // 4
  totalPages: number;        // 445
  sourceLink: string;        // EPUB deep link

  // Annotation Content
  annotationImagePath: string;  // Relative path to composite image
  annotationSummary: string;    // Summary text from ReadNoteBean

  // Metadata
  dateAnnotated: string;     // Formatted date (YYYY-MM-DD)
  annotationId: number;      // Unique ID from ReadNoteBean
}
```

### Default Annotation Template

```markdown
## {{bookName}} - Annotation

**Location:** {{location}}
**Page:** {{pageNumber}}/{{totalPages}}
**Date:** {{dateAnnotated}}
**Source:** [Open in EPUB]({{sourceLink}})

---

![[{{annotationImagePath}}]]

{{#if annotationSummary}}
### Summary

{{annotationSummary}}
{{/if}}

### Notes

*Add your thoughts here*

---
#annotation #book/{{bookSlug}} #page/{{pageNumber}}
```

### Example Output

```markdown
## De Brief Voor de Koning - Annotation

**Location:** EERSTE DEEL De opdracht → De ridders van koning Dagonaut
**Page:** 4/445
**Date:** 2025-10-06
**Source:** [Open in EPUB](Viwoods/Sources/de-brief-voor-de-koning.epub#OEBPS/Text/index_split_003.html)

---

![[Viwoods/Annotations/de-brief-voor-de-koning-p004-annotation-2.png]]

### Summary

Ristridin van het Zuiden, om er maar enkelen te noemen? De meeste van zijn ridders heeft de koning stukken land in leen gegeven, die ze in zijn naam moeten

### Notes

*Add your thoughts here*

---
#annotation #book/de-brief-voor-de-koning #page/4
```

---

## File Organization

### Default Structure

**Config:**
```json
{
  "annotationsFolder": "Viwoods/Annotations",
  "annotationImagesFolder": "",
  "processAnnotations": true
}
```

**Result:**
```
Viwoods/
├── Highlights/
│   ├── de-brief-voor-de-koning-highlight-1.md
│   └── de-brief-voor-de-koning-highlight-2.md
├── Annotations/
│   ├── de-brief-voor-de-koning-p004-annotation-2.md
│   ├── de-brief-voor-de-koning-p004-annotation-2.png  ← Composite image
│   ├── de-brief-voor-de-koning-p005-annotation-3.md
│   └── de-brief-voor-de-koning-p005-annotation-3.png  ← Composite image
├── Sources/
│   ├── de-brief-voor-de-koning.note
│   └── de-brief-voor-de-koning.epub
└── Pages/
    └── de-brief-voor-de-koning-index.md
```

### Advanced: Separate Images Folder

**Config:**
```json
{
  "annotationsFolder": "Viwoods/Annotations",
  "annotationImagesFolder": "Viwoods/Annotation-Images"
}
```

**Result:**
```
Viwoods/
├── Annotations/
│   ├── de-brief-voor-de-koning-p004-annotation-2.md
│   └── de-brief-voor-de-koning-p005-annotation-3.md
├── Annotation-Images/
│   ├── de-brief-voor-de-koning-p004-annotation-2.png
│   └── de-brief-voor-de-koning-p005-annotation-3.png
└── ...
```

---

## Implementation Plan

### Phase 1: Core Annotation Processing

**Location:** `src/processors/ViwoodsProcessor.ts`

#### 1.1 Add ReadNoteBean Interface

```typescript
interface ReadNoteBean {
  id: number;
  bookId: string;
  bookName: string;
  userId: string;

  // Page & Location
  epubPageIndex: number;
  pageIndex: number;
  pageIndexItem: number;
  rootChapterName: string;
  rootChapterLinkUri: string;
  title: string;

  // Content
  sumary: string;  // Note: misspelling in source data
  alias: string;

  // Images
  noteImagePath: string;  // PNG overlay
  pageImage: string;      // JPG background

  // Metadata
  upDataTime: number;
  noteType: number;
  epubSettingStr: string;
  bookType: number;
}
```

#### 1.2 Extend processEpubFormat Method

Add annotation processing after highlights processing:

```typescript
private async processEpubFormat(...): Promise<ProcessorResult> {
  // ... existing highlight processing ...

  // NEW: Process annotations from ReadNoteBean
  if (config.processAnnotations !== false) {
    const readNoteBeanFile = allFiles.find(f => f.endsWith('_ReadNoteBean.json'));

    if (readNoteBeanFile) {
      const annotations = await StreamingZipUtils.extractJson<ReadNoteBean[]>(
        zipReader,
        readNoteBeanFile
      );

      if (annotations && annotations.length > 0) {
        await StreamLogger.log(`Processing ${annotations.length} annotations...`);

        for (const annotation of annotations) {
          const files = await this.processAnnotation(
            zipReader,
            annotation,
            bookSlug,
            totalPages,
            epubPath,
            config,
            context
          );
          createdFiles.push(...files);
        }
      }
    }
  }

  return { success: true, createdFiles };
}
```

#### 1.3 Create processAnnotation Method

```typescript
private async processAnnotation(
  zipReader: ZipReader<Blob>,
  annotation: ReadNoteBean,
  bookSlug: string,
  totalPages: number,
  epubPath: string,
  config: ViwoodsProcessorConfig,
  context: ProcessorContext
): Promise<string[]> {
  const createdFiles: string[] = [];

  try {
    // 1. Extract image filenames from paths
    const pngFilename = annotation.noteImagePath.split('/').pop();
    const jpgFilename = annotation.pageImage.split('/').pop();

    if (!pngFilename || !jpgFilename) {
      await StreamLogger.error(`Missing image filenames for annotation ${annotation.id}`);
      return createdFiles;
    }

    // 2. Extract both images from ZIP
    const pngData = await StreamingZipUtils.extractFile(zipReader, pngFilename);
    const jpgData = await StreamingZipUtils.extractFile(zipReader, jpgFilename);

    if (!pngData || !jpgData) {
      await StreamLogger.error(`Missing image files for annotation ${annotation.id}`);
      return createdFiles;
    }

    // 3. Create composite image
    const compositeImage = await this.createCompositeAnnotationImage(
      jpgData,
      pngData,
      config.createCompositeImages !== false
    );

    // 4. Save composite image
    const imageFolder = config.annotationImagesFolder || config.annotationsFolder;
    await FileUtils.ensurePath(context.vault, imageFolder);

    const pageStr = String(annotation.pageIndex).padStart(3, '0');
    const imageName = `${bookSlug}-p${pageStr}-annotation-${annotation.id}.png`;
    const imagePath = FileUtils.joinPath(imageFolder, imageName);

    const imageBuffer = await compositeImage.arrayBuffer();
    await context.vault.adapter.writeBinary(imagePath, new Uint8Array(imageBuffer));
    createdFiles.push(imagePath);

    // 5. Generate markdown file
    const mdPath = await this.generateAnnotationMarkdown(
      annotation,
      bookSlug,
      totalPages,
      epubPath,
      imagePath,
      config,
      context
    );

    if (mdPath) {
      createdFiles.push(mdPath);
    }

    return createdFiles;
  } catch (error: any) {
    await StreamLogger.error(`Failed to process annotation ${annotation.id}: ${error.message}`);
    return createdFiles;
  }
}
```

#### 1.4 Create Image Composition Utility

```typescript
private async createCompositeAnnotationImage(
  jpgData: Uint8Array,
  pngData: Uint8Array,
  shouldComposite: boolean
): Promise<Blob> {
  // If composition disabled, return PNG only
  if (!shouldComposite) {
    return new Blob([pngData], { type: 'image/png' });
  }

  // Create blobs for image loading
  const jpgBlob = new Blob([jpgData], { type: 'image/jpeg' });
  const pngBlob = new Blob([pngData], { type: 'image/png' });

  const jpgUrl = URL.createObjectURL(jpgBlob);
  const pngUrl = URL.createObjectURL(pngBlob);

  try {
    // Load both images
    const jpgImg = await this.loadImage(jpgUrl);
    const pngImg = await this.loadImage(pngUrl);

    // Create canvas with JPG dimensions
    const canvas = document.createElement('canvas');
    canvas.width = jpgImg.width;
    canvas.height = jpgImg.height;

    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Failed to get canvas context');
    }

    // Draw JPG background
    ctx.drawImage(jpgImg, 0, 0);

    // Draw PNG overlay
    ctx.drawImage(pngImg, 0, 0);

    // Convert to blob
    return new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((blob) => {
        if (blob) {
          resolve(blob);
        } else {
          reject(new Error('Failed to create blob from canvas'));
        }
      }, 'image/png');
    });
  } finally {
    // Cleanup object URLs
    URL.revokeObjectURL(jpgUrl);
    URL.revokeObjectURL(pngUrl);
  }
}

private loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Failed to load image: ${url}`));
    img.src = url;
  });
}
```

#### 1.5 Create Markdown Generation Method

```typescript
private async generateAnnotationMarkdown(
  annotation: ReadNoteBean,
  bookSlug: string,
  totalPages: number,
  epubPath: string,
  imagePath: string,
  config: ViwoodsProcessorConfig,
  context: ProcessorContext
): Promise<string | null> {
  try {
    const dateAnnotated = new Date(annotation.upDataTime * 1000);

    // Build location string
    const location = annotation.rootChapterName
      ? `${annotation.rootChapterName} → ${annotation.title}`
      : annotation.title;

    // Build EPUB deep link
    const sourceLink = epubPath
      ? `${epubPath}#${annotation.rootChapterLinkUri}`
      : annotation.rootChapterLinkUri;

    // Build template data
    const templateData = {
      bookName: annotation.bookName,
      bookSlug,
      location,
      chapterName: annotation.title,
      rootChapterName: annotation.rootChapterName,
      pageNumber: annotation.pageIndex,
      totalPages,
      sourceLink,
      annotationImagePath: imagePath,
      annotationSummary: config.includeSummaryInAnnotation !== false
        ? annotation.sumary
        : '',
      dateAnnotated: TemplateEngine.formatDate(dateAnnotated, "YYYY-MM-DD"),
      annotationId: annotation.id,
    };

    // Load template
    const defaultTemplate = await this.loadDefaultTemplate("viwoods-annotation.md");
    const template = await context.templateResolver.resolve(
      config.annotationTemplate,
      defaultTemplate
    );

    // Render markdown
    const content = TemplateEngine.render(template, templateData, dateAnnotated);

    // Generate filename
    const pageStr = String(annotation.pageIndex).padStart(3, '0');
    const filename = `${bookSlug}-p${pageStr}-annotation-${annotation.id}.md`;
    const filepath = FileUtils.joinPath(config.annotationsFolder, filename);

    // Only write if file doesn't exist (preserve user edits)
    const existingFile = context.vault.getAbstractFileByPath(filepath);
    if (!existingFile) {
      await context.vault.adapter.write(filepath, content);
      return filepath;
    } else {
      await StreamLogger.log(`Preserving existing annotation: ${filename}`);
      return null;
    }
  } catch (error: any) {
    await StreamLogger.error(`Failed to generate annotation markdown: ${error.message}`);
    return null;
  }
}
```

#### 1.6 Update Default Template

Update the `loadDefaultTemplate` method to include the new annotation template:

```typescript
"viwoods-annotation.md": `## {{bookName}} - Annotation

**Location:** {{location}}
**Page:** {{pageNumber}}/{{totalPages}}
**Date:** {{dateAnnotated}}
**Source:** [Open in EPUB]({{sourceLink}})

---

![[{{annotationImagePath}}]]

{{#if annotationSummary}}
### Summary

{{annotationSummary}}
{{/if}}

### Notes

*Add your thoughts here*

---
#annotation #book/{{bookSlug}} #page/{{pageNumber}}`
```

### Phase 2: Configuration UI Updates

Add new fields to config schema:

```typescript
getConfigSchema(): ConfigSchema {
  return {
    fields: [
      // ... existing fields ...

      {
        key: "processAnnotations",
        label: "Process Annotations",
        description: "Extract and process handwritten annotations from ReadNoteBean.json",
        type: "boolean",
        defaultValue: true,
      },
      {
        key: "annotationImagesFolder",
        label: "Annotation Images Folder",
        description: "Folder for annotation images. Leave empty to use same as Annotations Folder.",
        type: "folder",
        required: false,
        placeholder: "Example: Viwoods/Annotation-Images",
      },
      {
        key: "includeSummaryInAnnotation",
        label: "Include Summary Text",
        description: "Include annotation summary text in markdown files",
        type: "boolean",
        defaultValue: true,
      },
      {
        key: "createCompositeImages",
        label: "Create Composite Images",
        description: "Combine page image (JPG) with annotation overlay (PNG). If disabled, only PNG will be saved.",
        type: "boolean",
        defaultValue: true,
      },
    ],
  };
}
```

### Phase 3: Testing Strategy

#### Test Cases

1. **Basic Annotation Extraction**
   - Parse ReadNoteBean.json ✓
   - Extract PNG and JPG images ✓
   - Create composite image ✓
   - Generate markdown file ✓
   - Verify correct paths ✓

2. **Multiple Annotations**
   - Process all annotations ✓
   - Unique filenames ✓
   - Correct page ordering ✓

3. **Image Composition**
   - JPG + PNG overlay works ✓
   - Transparency preserved ✓
   - Dimensions correct ✓

4. **Edge Cases**
   - No ReadNoteBean.json (skip gracefully) ✓
   - Missing image files (log error, continue) ✓
   - processAnnotations: false (skip) ✓
   - createCompositeImages: false (PNG only) ✓
   - Empty summary field ✓

5. **Template Rendering**
   - All variables populated ✓
   - Date formatting ✓
   - Location string ✓
   - Custom templates ✓

---

## Migration Notes

### From Previous Spec Version

**Changes:**
1. Added image composition (JPG + PNG) - this is NEW
2. Updated template to use new variable names
3. Added `createCompositeImages` config option
4. Removed page grouping feature (deferred)
5. Aligned with actual codebase structure (streaming ZIP, etc.)

**Breaking Changes:**
- None (this is a new feature)

---

## Performance Considerations

### Image Processing

- Canvas API is fast for image composition
- Each composite image takes ~50-200ms
- Memory usage: ~2-5MB per image (temporary)
- Images cleaned up after processing

### File I/O

- Streaming ZIP extraction minimizes memory
- One annotation processed at a time
- Vault writes are batched where possible

### Recommended Limits

- Max 100 annotations per sync (typical: 5-20)
- Max 2MB per image (typical: 100-500KB)

---

## Success Criteria

✅ ReadNoteBean.json parsed correctly
✅ Both JPG and PNG extracted from ZIP
✅ Composite images created successfully
✅ Markdown files generated with correct metadata
✅ Files organized by page number
✅ Custom templates supported
✅ Configuration options work as expected
✅ No memory leaks from image processing
✅ Cross-platform compatibility (Desktop, Mobile)

---

## Open Questions for User

1. Should we keep original JPG and PNG files separately, or only save the composite?
   - **Recommendation:** Only save composite to save space

2. Should we allow users to disable image composition and just embed the PNG?
   - **Recommendation:** Yes, add `createCompositeImages` option

3. What should happen if JPG or PNG is missing?
   - **Recommendation:** Log error, skip that annotation, continue with others

4. Should summary text be included by default?
   - **Recommendation:** Yes, but allow users to disable via `includeSummaryInAnnotation`

---

## Implementation Checklist

**Prerequisites:**
- [x] Highlights working correctly
- [ ] User approves this specification

**Phase 1: Core Processing**
- [ ] Add ReadNoteBean interface
- [ ] Update ViwoodsProcessorConfig interface
- [ ] Implement processAnnotation() method
- [ ] Implement createCompositeAnnotationImage() method
- [ ] Implement generateAnnotationMarkdown() method
- [ ] Add loadImage() helper
- [ ] Update default annotation template

**Phase 2: Configuration**
- [ ] Update config schema with new fields
- [ ] Update getDefaultConfig() with defaults
- [ ] Test configuration UI

**Phase 3: Testing**
- [ ] Test with real .note file containing annotations
- [ ] Verify composite images look correct
- [ ] Test with missing images
- [ ] Test with processAnnotations: false
- [ ] Test custom templates
- [ ] Verify no memory leaks

**Phase 4: Documentation**
- [ ] Update CLAUDE.md with annotation support
- [ ] Add annotation examples to README
- [ ] Document configuration options

---

## Example User Configuration

```json
{
  "fileTypeMappings": [
    {
      "id": "1759862051308",
      "extension": "note",
      "processorType": "viwoods",
      "enabled": true,
      "config": {
        "highlightsFolder": "Viwoods/Highlights",
        "annotationsFolder": "Viwoods/Annotations",
        "sourcesFolder": "Viwoods/Library",
        "pagesFolder": "Viwoods/Pages",

        "highlightTemplate": "",
        "annotationTemplate": "",

        "includeMetadata": true,
        "includeThumbnail": true,
        "extractImages": true,
        "createIndex": true,

        "processAnnotations": true,
        "annotationImagesFolder": "",
        "includeSummaryInAnnotation": true,
        "createCompositeImages": true
      }
    }
  ]
}
```

---

**END OF SPECIFICATION**

**Version:** 2.0
**Status:** Ready for Implementation
**Approved:** Pending User Review
