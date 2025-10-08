# Annotation Support Specification
## ReadNoteBean Processing for Handwritten Annotations

**Status:** Planning (Not Yet Implemented)
**Version:** 0.3.0 (Planned)
**Date:** 2025-10-07

---

## Overview

This specification details the implementation of handwritten annotation support for EPUB reader `.note` files. This is Phase 2 of the viwoods processor, extending the existing text highlight support.

### Current State (v0.2.5)
✅ Text highlights from `PageTextAnnotation.json`
✅ EPUB file extraction
✅ Source .note file preservation

### Planned Addition (v0.3.0)
🔲 Handwritten annotations from `ReadNoteBean.json`
🔲 Annotation image extraction (PNG files)
🔲 Annotation markdown files with embedded images
🔲 Optional combined view (highlights + annotations per page)

---

## Data Structure Analysis

### ReadNoteBean.json Structure

**File Location:** `*_ReadNoteBean.json` (prefixed with book name)

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
| `noteImagePath` | Path to annotation PNG | Extract filename: `4bc49040b7d46be4362144eb69c7039e.png` |
| `pageIndex` | Page number in EPUB | Use for organization |
| `rootChapterName` | Main chapter | E.g., "EERSTE DEEL De opdracht" |
| `title` | Subchapter/section | E.g., "De ridders van koning Dagonaut" |
| `sumary` | Annotation text summary | May be truncated |
| `upDataTime` | Unix timestamp | When annotation was created |
| `rootChapterLinkUri` | EPUB location | Deep link to chapter |

---

## PNG Image Files

### Image Naming Convention

Images are stored with MD5-hash filenames at the root of the ZIP:
- `4bc49040b7d46be4362144eb69c7039e.png` (20,638 bytes)
- `9a6b5db2969f1ec1cf77881e162b5340.png` (19,694 bytes)

### Extraction Process

1. **Parse ReadNoteBean.json** to get image references
2. **Extract filename** from `noteImagePath`:
   ```typescript
   const imagePath = "/storage/.../4bc49040b7d46be4362144eb69c7039e.png";
   const imageFileName = imagePath.split('/').pop(); // "4bc49040b7d46be4362144eb69c7039e.png"
   ```
3. **Find in ZIP** (images are at root level)
4. **Extract to vault** in annotations folder or dedicated images subfolder

---

## Configuration Schema

### Updated viwoodsProcessorConfig

```typescript
interface viwoodsProcessorConfig extends ProcessorConfig {
  // Existing
  highlightsFolder: string;
  annotationsFolder: string;
  sourcesFolder: string;
  pagesFolder: string;

  // Templates
  highlightTemplate?: string;
  annotationTemplate?: string;       // Template for handwritten annotations
  pageTemplate?: string;

  // Processing options
  includeMetadata: boolean;
  includeThumbnail: boolean;
  extractImages: boolean;
  createIndex: boolean;

  // Annotation options (v0.3.0)
  processAnnotations: boolean;              // Enable/disable annotation processing
  annotationImagesFolder?: string;          // Where to store PNG files (empty = same as annotationsFolder)
  includeSummaryInFrontmatter: boolean;     // Add summary to YAML frontmatter
}
```

### Default Values

```typescript
{
  // Annotation defaults
  processAnnotations: true,
  annotationImagesFolder: "",  // Empty = use annotationsFolder (simpler default)
  includeSummaryInFrontmatter: false  // Off by default, images are primary content
}
```

---

## Markdown Template Design

### Annotation Template Variables

```typescript
{
  bookName: string;          // "De Brief Voor de Koning"
  bookSlug: string;          // "de-brief-voor-de-koning"
  noteTitle: string;         // Same as bookName

  // Location
  location: string;          // "EERSTE DEEL De opdracht → De ridders van koning Dagonaut"
  chapterName: string;       // "De ridders van koning Dagonaut"
  rootChapterName: string;   // "EERSTE DEEL De opdracht"

  // Page & Source
  pageNumber: number;        // 4
  totalPages: number;        // 445
  sourceLink: string;        // EPUB deep link

  // Annotation Content
  annotationImagePath: string;  // Path to PNG in vault
  annotationSummary: string;    // Summary text from ReadNoteBean

  // Metadata
  dateAnnotated: string;     // Formatted from upDataTime
  annotationId: string;      // Unique ID from ReadNoteBean
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

### Notes

*Add your thoughts here*

---
#annotation #book/{{bookSlug}}
```

**Note:** Summary field is NOT included in default template. If user enables `includeSummaryInFrontmatter: true`, it will be added to YAML frontmatter:

```markdown
---
summary: "Ristridin van het Zuiden, om er maar enkelen te noemen..."
---

## {{bookName}} - Annotation
...
```

### Example Output

```markdown
## De Brief Voor de Koning - Annotation

**Location:** EERSTE DEEL De opdracht → De ridders van koning Dagonaut
**Page:** 4/445
**Date:** 2025-10-06
**Source:** [Open in EPUB](viwoods/Sources/de-brief-voor-de-koning.epub#OEBPS/Text/index_split_003.html)

---

![[viwoods/Annotations/de-brief-voor-de-koning-annotation-1.png]]

### Summary
Ristridin van het Zuiden, om er maar enkelen te noemen? De meeste van zijn ridders heeft de koning stukken land in leen gegeven, die ze in zijn naam moeten

### Notes

*Add your thoughts here*

---
#annotation #book/de-brief-voor-de-koning
```

---

## File Organization

### Default Structure (v0.3.0)

**Config:** `annotationImagesFolder: ""` (empty string)

```
viwoods/
├── Highlights/
│   ├── de-brief-voor-de-koning-highlight-1.md
│   └── de-brief-voor-de-koning-highlight-2.md
├── Annotations/
│   ├── de-brief-voor-de-koning-p003-annotation-3.md    ← Markdown
│   ├── de-brief-voor-de-koning-p003-annotation-3.png   ← Image (same folder)
│   ├── de-brief-voor-de-koning-p004-annotation-2.md    ← Markdown
│   └── de-brief-voor-de-koning-p004-annotation-2.png   ← Image (same folder)
├── Sources/
│   ├── de-brief-voor-de-koning.note
│   └── de-brief-voor-de-koning.epub
└── Pages/
    └── de-brief-voor-de-koning-index.md
```

**Features:**
- ✅ Markdown and images together (simpler)
- ✅ Filenames include page number for sorting
- ✅ One folder to browse
- ✅ Default for most users

---

### Advanced: Separate Images Folder

**Config:** `annotationImagesFolder: "viwoods/Annotation-Images"`

```
viwoods/
├── Highlights/
│   └── ...
├── Annotations/
│   ├── de-brief-voor-de-koning-p003-annotation-3.md
│   └── de-brief-voor-de-koning-p004-annotation-2.md
├── Annotation-Images/
│   ├── de-brief-voor-de-koning-p003-annotation-3.png
│   └── de-brief-voor-de-koning-p004-annotation-2.png
└── Sources/
    └── ...
```

**Features:**
- ✅ Clean separation (markdown vs images)
- ✅ For users who prefer organized structure
- ✅ Requires manual config

---

### Future: Grouped by Page (v0.4.0 - Deferred)

**Config:** `groupByPage: true` (not yet implemented)

```
viwoods/
└── de-brief-voor-de-koning/
    ├── page-003/
    │   ├── highlight.md
    │   ├── annotation.md
    │   └── annotation.png
    ├── page-004/
    │   ├── annotation.md
    │   └── annotation.png
    └── index.md
```

**Status:** Deferred to v0.4.0 based on user feedback

---

## Implementation Plan

### Phase 1: Basic Annotation Extraction

**Files to Modify:**
- `src/processors/viwoodsProcessor.ts`

**Steps:**

1. **Update `processEpubFormat()` method**
   ```typescript
   // After processing highlights
   if (config.processAnnotations) {
     await this.processAnnotations(zip, config, context, bookData);
   }
   ```

2. **Create `processAnnotations()` method**
   ```typescript
   private async processAnnotations(
     zip: JSZip,
     config: viwoodsProcessorConfig,
     context: ProcessorContext,
     bookData: { bookName: string; bookSlug: string; totalPages: number }
   ): Promise<string[]> {
     const createdFiles: string[] = [];

     // 1. Find ReadNoteBean.json
     const readNoteBeanFile = allFiles.find(f => f.endsWith('_ReadNoteBean.json'));
     if (!readNoteBeanFile) return createdFiles;

     // 2. Parse annotations
     const annotations = await ZipUtils.extractJson<ReadNoteBean[]>(zip, readNoteBeanFile);

     // 3. Process each annotation
     for (const annotation of annotations) {
       // Extract image
       const imageFile = await this.extractAnnotationImage(zip, annotation, config, context);

       // Generate markdown
       const mdFile = await this.generateAnnotationMarkdown(annotation, imageFile, config, context);

       createdFiles.push(imageFile, mdFile);
     }

     return createdFiles;
   }
   ```

3. **Create `extractAnnotationImage()` method**
   ```typescript
   private async extractAnnotationImage(
     zip: JSZip,
     annotation: ReadNoteBean,
     bookSlug: string,
     config: viwoodsProcessorConfig,
     context: ProcessorContext
   ): Promise<string> {
     // Extract filename from noteImagePath
     const imageFileName = annotation.noteImagePath.split('/').pop();

     // Find in ZIP
     const imageData = await ZipUtils.extractFile(zip, imageFileName);
     if (!imageData) {
       throw new Error(`Image not found in ZIP: ${imageFileName}`);
     }

     // Determine output path
     const outputFolder = config.annotationImagesFolder || config.annotationsFolder;

     // FINALIZED: Use page-based naming with ID
     const pageStr = String(annotation.pageIndex).padStart(3, '0');
     const outputName = `${bookSlug}-p${pageStr}-annotation-${annotation.id}.png`;
     const outputPath = FileUtils.joinPath(outputFolder, outputName);

     // Ensure folder exists
     await FileUtils.ensurePath(context.vault, outputFolder);

     // Write to vault
     await context.vault.adapter.writeBinary(outputPath, imageData);

     return outputPath;
   }
   ```

4. **Create `generateAnnotationMarkdown()` method**
   ```typescript
   private async generateAnnotationMarkdown(
     annotation: ReadNoteBean,
     imagePath: string,
     bookSlug: string,
     totalPages: number,
     epubPath: string,
     config: viwoodsProcessorConfig,
     context: ProcessorContext
   ): Promise<string> {
     const dateAnnotated = new Date(annotation.upDataTime * 1000);

     // Build template variables
     const templateData = {
       bookName: annotation.bookName,
       bookSlug: bookSlug,
       location: `${annotation.rootChapterName} → ${annotation.title}`,
       chapterName: annotation.title,
       rootChapterName: annotation.rootChapterName,
       pageNumber: annotation.pageIndex,
       totalPages: totalPages,
       sourceLink: `${epubPath}#${annotation.rootChapterLinkUri}`,
       annotationImagePath: imagePath,
       dateAnnotated: TemplateEngine.formatDate(dateAnnotated, "YYYY-MM-DD"),
       annotationId: annotation.id.toString()
     };

     // FINALIZED: Summary handling
     let frontmatter = "";
     if (config.includeSummaryInFrontmatter && annotation.sumary) {
       frontmatter = `---\nsummary: "${annotation.sumary.replace(/"/g, '\\"')}"\n---\n\n`;
     }

     // Load template
     const defaultTemplate = this.getDefaultAnnotationTemplate();
     const template = await context.templateResolver.resolve(
       config.annotationTemplate,
       defaultTemplate
     );

     // Render
     const content = frontmatter + TemplateEngine.render(template, templateData, dateAnnotated);

     // FINALIZED: Page-based filename with ID
     const pageStr = String(annotation.pageIndex).padStart(3, '0');
     const filename = `${bookSlug}-p${pageStr}-annotation-${annotation.id}.md`;
     const filepath = FileUtils.joinPath(config.annotationsFolder, filename);

     await context.vault.adapter.write(filepath, content);

     return filepath;
   }
   ```

### Phase 2: Grouped by Page (v0.4.0 - DEFERRED)

**Status:** Not implementing in v0.3.0

**Rationale:**
- Ship annotation extraction first
- Gather user feedback on actual usage patterns
- Validate if page grouping is actually needed
- Simpler implementation and testing for initial release

**Future Implementation:**
When `groupByPage: true` is added:
1. Create book-specific folder structure
2. Name files: `page-{NN}-{type}.md`
3. Generate page index with links
4. Optional migration tool for existing files

### Phase 3: Enhanced Features (v0.4.0+)

**Future possibilities:**
- Combined highlight + annotation views
- OCR text extraction from annotation images
- Annotation editing/export
- Multiple annotation types per page
- Custom grouping strategies

---

## TypeScript Interfaces

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
  sumary: string;  // Note: misspelling in original data
  alias: string;

  // Images
  noteImagePath: string;
  pageImage: string;

  // Metadata
  upDataTime: number;
  noteType: number;
  epubSettingStr: string;
  bookType: number;

  // EPUB specific
  epubChildPageIndex: number;
  epubHtmlChildIndex: number;
  epubKey: string;
  epubUrl: string;
  rootChapterLevel: number;
}
```

---

## Testing Strategy

### Test Cases

1. **Basic Annotation Extraction**
   - ✅ Parse ReadNoteBean.json
   - ✅ Extract annotation images
   - ✅ Generate markdown files
   - ✅ Verify image paths are correct

2. **Multiple Annotations**
   - ✅ Process all annotations in file
   - ✅ Unique filenames for each
   - ✅ Correct ordering

3. **Image Handling**
   - ✅ Extract PNG files correctly
   - ✅ Rename with book slug + ID
   - ✅ Embed vs link based on config

4. **Template Rendering**
   - ✅ All variables populated correctly
   - ✅ Date formatting works
   - ✅ Location string properly formatted
   - ✅ Custom templates applied

5. **Edge Cases**
   - ✅ No ReadNoteBean.json (skip gracefully)
   - ✅ Missing image files (log warning)
   - ✅ Corrupted PNG data (error handling)
   - ✅ Empty summary field
   - ✅ Very long summaries (truncation?)

### Sample .note File

Use: `Dagonauten en Unauwen 01 - De Brief Voor de Koning -- Dragt_ Tonke -- 2014 -- Leopold -- cbe28844ea54d0eb5d50b2501f-more 2.note`

**Expected Output:**
- 2 annotation markdown files
- 2 PNG images
- Files named with book slug
- Correct chapter/page information

---

## User Configuration Example

```json
{
  "fileTypeMappings": [
    {
      "id": "1759862051308",
      "extension": "note",
      "processorType": "viwoods",
      "enabled": true,
      "config": {
        "highlightsFolder": "viwoods/Highlights",
        "annotationsFolder": "viwoods/Annotations",
        "sourcesFolder": "viwoods/Sources",
        "pagesFolder": "viwoods/Pages",

        "highlightTemplate": "",
        "annotationTemplate": "",  // Optional custom template path
        "pageTemplate": "",

        "includeMetadata": true,
        "includeThumbnail": true,
        "extractImages": true,
        "createIndex": true,

        // Annotation options (v0.3.0)
        "processAnnotations": true,
        "annotationImagesFolder": "",  // Empty = same as annotationsFolder (default)
        "includeSummaryInFrontmatter": false  // Summary in YAML frontmatter (default: off)
      }
    }
  ]
}
```

**Notes:**
- `annotationImagesFolder`: Leave empty for default (images WITH markdown)
- `includeSummaryInFrontmatter`: Enable if you want searchable summary text
- Page grouping not available in v0.3.0 (deferred to v0.4.0)

---

## Performance Considerations

### Image Extraction

- PNG files are typically 15-25 KB each
- Extraction is fast (< 100ms per image)
- No resizing/processing needed

### Markdown Generation

- Template rendering is fast
- Main bottleneck is vault I/O
- Consider batching writes if many annotations

### Memory Usage

- ReadNoteBean.json is small (< 10 KB)
- Images loaded one at a time
- No memory concerns for typical use

---

## Documentation Updates

### Files to Update

1. **FILE-PROCESSORS.md**
   - Add annotation processing section
   - Document new config options
   - Add examples

2. **viwoods-setup.md**
   - Update with annotation workflow
   - Add configuration examples
   - Show sample outputs

3. **README.md**
   - Mention annotation support in features
   - Add to changelog for v0.3.0

---

## Implementation Checklist

**Prerequisites:**
- [ ] Highlights working correctly (confirmed by user)
- [ ] User approves this specification

**Phase 1 Tasks:**
- [ ] Add `ReadNoteBean` interface
- [ ] Update `viwoodsProcessorConfig` interface
- [ ] Implement `processAnnotations()` method
- [ ] Implement `extractAnnotationImage()` method
- [ ] Implement `generateAnnotationMarkdown()` method
- [ ] Add default annotation template
- [ ] Update config schema
- [ ] Add validation for annotation config

**Testing:**
- [ ] Test with sample .note file
- [ ] Verify images extracted correctly
- [ ] Verify markdown format
- [ ] Test custom templates
- [ ] Test with `processAnnotations: false`
- [ ] Test error handling

**Documentation:**
- [ ] Update FILE-PROCESSORS.md
- [ ] Update viwoods-setup.md
- [ ] Update README.md changelog
- [ ] Add annotation examples

**Future Enhancements (v0.4.0+):**
- [ ] Grouped by page option (`groupByPage: true`)
- [ ] Combined view (highlights + annotations)
- [ ] Migration tool for reorganizing existing files
- [ ] Image compression/optimization
- [ ] OCR text extraction from images
- [ ] Annotation editing/export features
- [ ] Batch rename tools

---

## ✅ Finalized Decisions

### Before Implementation

1. **Filename Convention** ✅
   - **Decision:** `{book-slug}-p{page}-annotation-{id}.md`
   - **Rationale:** Most informative, sortable by page, handles multiple annotations per page
   - **Example:** `de-brief-voor-de-koning-p004-annotation-2.md`

2. **Image Naming** ✅
   - **Decision:** Match markdown filename exactly: `{book-slug}-p{page}-annotation-{id}.png`
   - **Rationale:** One-to-one correspondence with markdown files, easy to pair
   - **Example:** `de-brief-voor-de-koning-p004-annotation-2.png`

3. **Default Folder Structure** ✅
   - **Decision:** User configurable, default images WITH markdown in same folder
   - **Default:** `annotationImagesFolder: ""` (empty = same as annotationsFolder)
   - **Advanced:** Users can set to separate folder if desired
   - **Rationale:** Flexibility with sensible default, simpler for most users

4. **Summary Field** ✅
   - **Decision:** Hide from body, optionally store in frontmatter
   - **Config:** `includeSummaryInFrontmatter: false` (default off)
   - **Rationale:** Images are primary content, truncated text is just metadata
   - **Future:** Users can enable if they find it useful

5. **Page Grouping** ✅
   - **Decision:** Defer to v0.4.0
   - **Rationale:** Ship faster, validate need with real usage first
   - **v0.3.0 Focus:** Get basic annotation extraction working perfectly
   - **v0.4.0 Plan:** Add grouped-by-page organization if requested

---

## Success Criteria

✅ All annotations from ReadNoteBean.json processed
✅ Images extracted and correctly linked
✅ Markdown files follow template format
✅ Custom templates supported
✅ Configuration options work as expected
✅ No performance degradation
✅ Error handling for edge cases
✅ Documentation complete

---

## Implementation Ready ✅

**Status:** Specification finalized and approved

**Decisions Made:**
1. ✅ Filename: `{book-slug}-p{page}-annotation-{id}.md`
2. ✅ Image naming: Matches markdown filename exactly
3. ✅ Folder structure: Configurable, default images with markdown
4. ✅ Summary: Hidden from body, optional frontmatter
5. ✅ Page grouping: Deferred to v0.4.0

**Next Steps:**
1. User confirms highlights are working correctly
2. Implement annotation extraction (Phase 1 only)
3. Test with sample .note file
4. Ship v0.3.0 with annotation support
5. Gather feedback for v0.4.0 features

**Timeline Estimate:**
- Implementation: 2-3 hours
- Testing: 1 hour
- Documentation: 1 hour
- **Total:** ~4-5 hours to complete annotation support

---

**END OF SPECIFICATION**

**Version:** 1.0 Final
**Date:** 2025-10-07
**Status:** Approved - Ready for Implementation

