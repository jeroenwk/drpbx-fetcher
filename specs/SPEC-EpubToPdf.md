# EPUB to PDF Conversion with Deeplinks - Specification

**Status:** POC / In Development
**Version:** 1.0.0
**Date:** 2025-01-10
**Platform Support:** Desktop, iOS, Android

---

## Overview

Automatically convert EPUB files (extracted from Viwoods .note archives) to PDF format with proper page-based deeplinks. This enables users to click on annotations and highlights to jump directly to the correct page in the PDF viewer within Obsidian.

### Current Behavior
- EPUB files are extracted from .note ZIP archives
- Source links use EPUB chapter URIs: `book.epub#OEBPS/Text/chapter.html`
- Limited deeplink support (depends on EPUB reader)

### New Behavior
- EPUB files are automatically converted to PDF during processing
- Source links use PDF page numbers: `book.pdf#page=4`
- Native Obsidian PDF viewer with accurate page jumping
- Original EPUB optionally preserved or deleted

---

## Design Philosophy

Following the proven approach from **StreamingZipUtils** (created for Android large file support):
- ✅ **Streaming/chunked processing** - Process chapter-by-chapter
- ✅ **Memory-efficient** - Never hold full EPUB/PDF in memory
- ✅ **Platform-agnostic** - Pure JavaScript libraries
- ✅ **Incremental writes** - Write to disk progressively
- ✅ **Progress indicators** - User feedback during conversion
- ✅ **Mobile-friendly** - Respects memory constraints on iOS/Android

---

## Technical Approach

### 1. Libraries (Mobile-Friendly)

#### epub.js (~50KB gzipped)
- **Purpose:** Parse EPUB structure, extract chapters
- **Why:** Pure JavaScript, works in browser environment
- **Mobile-friendly:** Small bundle size, low memory footprint
- **URL:** https://github.com/futurepress/epub.js

#### pdf-lib (~200KB gzipped)
- **Purpose:** Generate PDF files in pure JavaScript
- **Why:** No native dependencies, works on all platforms
- **Mobile-friendly:** Streaming API, chunked writes
- **URL:** https://github.com/Hopding/pdf-lib

#### Existing Canvas API
- Already used for composite image generation (ViwoodsProcessor.ts lines 743-796)
- Proven to work on mobile platforms
- Used for rendering HTML content to images

### 2. Conversion Flow (Memory-Efficient)

```
┌─────────────────────────────────────────────────────────┐
│ 1. Extract EPUB from .note ZIP                          │
│    (Already streaming via StreamingZipUtils)            │
└─────────────────────────┬───────────────────────────────┘
                          │
┌─────────────────────────▼───────────────────────────────┐
│ 2. Parse EPUB structure with epub.js                    │
│    - Get table of contents                              │
│    - Get chapter list                                   │
│    - Extract spine order                                │
└─────────────────────────┬───────────────────────────────┘
                          │
┌─────────────────────────▼───────────────────────────────┐
│ 3. Initialize PDF document (pdf-lib)                    │
└─────────────────────────┬───────────────────────────────┘
                          │
                    ┌─────▼─────┐
                    │  FOR EACH │
                    │  CHAPTER  │
                    └─────┬─────┘
                          │
    ┌─────────────────────▼───────────────────────────┐
    │ a. Load chapter content (1 chapter in memory)   │
    └─────────────────────┬───────────────────────────┘
                          │
    ┌─────────────────────▼───────────────────────────┐
    │ b. Render HTML to Canvas                        │
    │    - Use existing Canvas rendering code         │
    │    - Respect mobile quality settings            │
    └─────────────────────┬───────────────────────────┘
                          │
    ┌─────────────────────▼───────────────────────────┐
    │ c. Convert Canvas to PNG/JPEG                   │
    └─────────────────────┬───────────────────────────┘
                          │
    ┌─────────────────────▼───────────────────────────┐
    │ d. Embed image as PDF page                      │
    │    - Add to PDF document                        │
    │    - Track page number mapping                  │
    └─────────────────────┬───────────────────────────┘
                          │
    ┌─────────────────────▼───────────────────────────┐
    │ e. Free memory (GC old chapter data)            │
    └─────────────────────┬───────────────────────────┘
                          │
    ┌─────────────────────▼───────────────────────────┐
    │ f. Progress: "Converting chapter 3/15..."       │
    └─────────────────────┬───────────────────────────┘
                          │
                    ┌─────▼─────┐
                    │   NEXT    │
                    │  CHAPTER  │
                    └─────┬─────┘
                          │
┌─────────────────────────▼───────────────────────────────┐
│ 4. Save completed PDF to vault                          │
│    - Write to sourcesFolder/{bookSlug}.pdf              │
└─────────────────────────┬───────────────────────────────┘
                          │
┌─────────────────────────▼───────────────────────────────┐
│ 5. Optional: Delete original EPUB                       │
│    (Based on keepOriginalEpub config)                   │
└─────────────────────────┬───────────────────────────────┘
                          │
┌─────────────────────────▼───────────────────────────────┐
│ 6. Generate deeplinks with page numbers                 │
│    - book.pdf#page=N                                    │
│    - Use pageIndex from ReadNoteBean                    │
└─────────────────────────────────────────────────────────┘
```

### 3. Memory Budget Analysis

| Operation | Desktop Peak | Mobile Peak | Notes |
|-----------|-------------|-------------|-------|
| Current image composition | ~5MB | ~5MB | Already working on mobile |
| EPUB chapter rendering | 5-15MB | 3-10MB | One chapter at a time |
| PDF page creation | 2-8MB | 2-5MB | Per page, then freed |
| **Total peak memory** | ~30MB | ~20MB | Well within mobile limits |

**Mobile Safeguards:**
- Maximum EPUB size: 50MB on mobile, 200MB on desktop
- Skip conversion with warning if exceeds limit
- Lower rendering quality on mobile (configurable)
- Process 1 chapter at a time (vs 3 on desktop)

### 4. Deeplink Accuracy

**Key Insight:** The Viwoods app already computes accurate page numbers!

From `ReadNoteBean.json`:
```json
{
  "pageIndex": 4,           // ← Accurate PDF page number
  "epubPageIndex": 4,
  "rootChapterLinkUri": "OEBPS/Text/index_split_003.html"
}
```

**Implementation:**
- Use `annotation.pageIndex` directly for PDF deeplinks
- No complex chapter-to-page mapping needed
- Simple substitution in sourceLink generation

**Before:**
```typescript
const sourceLink = `${epubPath}#${annotation.rootChapterLinkUri}`;
// Result: "book.epub#OEBPS/Text/index_split_003.html"
```

**After:**
```typescript
const sourceLink = pdfPath
  ? `${pdfPath}#page=${annotation.pageIndex}`
  : `${epubPath}#${annotation.rootChapterLinkUri}`;  // fallback
// Result: "book.pdf#page=4"
```

---

## Configuration

### ViwoodsProcessorConfig Updates

Add new fields to existing interface:

```typescript
export interface ViwoodsProcessorConfig extends ProcessorConfig {
  // ... existing fields ...

  // NEW: EPUB to PDF conversion
  convertEpubToPdf?: boolean;           // Enable conversion (default: true)
  keepOriginalEpub?: boolean;           // Keep EPUB after converting (default: false)
  maxEpubSizeMobile?: number;          // Max size on mobile in MB (default: 50)
  pdfQuality?: 'low' | 'medium' | 'high'; // Rendering quality (default: 'medium')
  pdfPageWidth?: number;               // PDF page width in points (default: 595 = A4)
  pdfPageHeight?: number;              // PDF page height in points (default: 842 = A4)
}
```

### Default Values

```typescript
{
  convertEpubToPdf: true,
  keepOriginalEpub: false,
  maxEpubSizeMobile: 50,  // MB
  pdfQuality: 'medium',
  pdfPageWidth: 595,      // A4 width in points
  pdfPageHeight: 842,     // A4 height in points
}
```

### Configuration Schema

```typescript
{
  key: "convertEpubToPdf",
  label: "Convert EPUB to PDF",
  description: "Automatically convert EPUB files to PDF with page-based deeplinks",
  type: "boolean",
  defaultValue: true,
},
{
  key: "keepOriginalEpub",
  label: "Keep Original EPUB",
  description: "Preserve EPUB file after converting to PDF",
  type: "boolean",
  defaultValue: false,
},
{
  key: "pdfQuality",
  label: "PDF Quality",
  description: "Rendering quality for PDF conversion (higher quality = larger files)",
  type: "dropdown",
  options: ["low", "medium", "high"],
  defaultValue: "medium",
},
```

---

## Platform-Specific Optimizations

```typescript
// In EpubToPdfConverter.ts

import { PlatformHelper } from "../utils/platform";

export class EpubToPdfConverter {

  private getConversionSettings() {
    return {
      maxChaptersInMemory: PlatformHelper.isMobile() ? 1 : 3,
      renderQuality: PlatformHelper.isMobile() ? 'medium' : 'high',
      maxEpubSize: PlatformHelper.isMobile() ? 50 : 200, // MB
      imageCompression: PlatformHelper.isMobile() ? 0.8 : 0.9,
      // On mobile, use smaller canvas sizes
      maxCanvasWidth: PlatformHelper.isMobile() ? 1200 : 2400,
      maxCanvasHeight: PlatformHelper.isMobile() ? 1600 : 3200,
    };
  }
}
```

---

## Implementation Plan

### Phase 1: Core Infrastructure ✓ (POC)

**Files to create:**
- `src/utils/EpubToPdfConverter.ts` - Main conversion utility

**Key methods:**
```typescript
class EpubToPdfConverter {
  /**
   * Convert EPUB to PDF with progress callbacks
   * @returns Path to created PDF file
   */
  async convertEpubToPdf(
    epubData: Uint8Array,
    outputPath: string,
    config: EpubToPdfConfig,
    progressCallback?: (progress: number, message: string) => void
  ): Promise<string>;

  /**
   * Render HTML content to canvas image
   */
  private async renderChapterToCanvas(
    htmlContent: string,
    width: number,
    height: number
  ): Promise<HTMLCanvasElement>;

  /**
   * Add canvas as page to PDF document
   */
  private async addCanvasToPdf(
    pdfDoc: PDFDocument,
    canvas: HTMLCanvasElement
  ): Promise<void>;

  /**
   * Check if EPUB size is within limits for current platform
   */
  private checkEpubSize(size: number): boolean;
}
```

### Phase 2: Integration ✓ (POC)

**ViwoodsProcessor.ts modifications:**

1. Import converter:
```typescript
import { EpubToPdfConverter } from "../utils/EpubToPdfConverter";
```

2. Modify `processEpubFormat()` method (around line 418-430):
```typescript
// Extract EPUB file if configured
let epubPath = "";
let pdfPath = "";

if (epubFile && config.sourcesFolder) {
  await StreamLogger.log(`[processEpubFormat] Extracting EPUB: ${epubFile}`);
  const epubData = await StreamingZipUtils.extractFile(zipReader, epubFile);

  if (epubData) {
    // Check if conversion is enabled
    if (config.convertEpubToPdf !== false) {
      try {
        // Convert EPUB to PDF
        const converter = new EpubToPdfConverter();
        pdfPath = FileUtils.joinPath(
          config.sourcesFolder,
          `${bookSlug}.pdf`
        );

        await converter.convertEpubToPdf(
          epubData,
          pdfPath,
          {
            quality: config.pdfQuality || 'medium',
            pageWidth: config.pdfPageWidth || 595,
            pageHeight: config.pdfPageHeight || 842,
          },
          (progress, message) => {
            StreamLogger.log(`[EPUB→PDF] ${message} (${progress}%)`);
          }
        );

        await StreamLogger.log(`[processEpubFormat] PDF created: ${pdfPath}`);
        createdFiles.push(pdfPath);

        // Optionally keep EPUB
        if (config.keepOriginalEpub) {
          epubPath = FileUtils.joinPath(
            config.sourcesFolder,
            `${bookSlug}.epub`
          );
          await context.vault.adapter.writeBinary(epubPath, epubData);
          createdFiles.push(epubPath);
        }
      } catch (error: any) {
        await StreamLogger.error(`PDF conversion failed: ${error.message}`);
        // Fallback: save EPUB
        epubPath = FileUtils.joinPath(
          config.sourcesFolder,
          `${bookSlug}.epub`
        );
        await context.vault.adapter.writeBinary(epubPath, epubData);
        createdFiles.push(epubPath);
      }
    } else {
      // Conversion disabled, save EPUB
      epubPath = FileUtils.joinPath(
        config.sourcesFolder,
        `${bookSlug}.epub`
      );
      await context.vault.adapter.writeBinary(epubPath, epubData);
      createdFiles.push(epubPath);
    }
  }
}
```

3. Update sourceLink generation (around line 448-449):
```typescript
// Build EPUB/PDF link with deeplink
const sourceLink = pdfPath
  ? `${pdfPath}#page=${highlight.pageIndex}`
  : epubPath
    ? `${epubPath}#${highlight.chapterLinkUri}`
    : highlight.chapterLinkUri;
```

4. Update annotation sourceLink (around line 832-833):
```typescript
// Build EPUB/PDF deep link
const sourceLink = pdfPath
  ? `${pdfPath}#page=${annotation.pageIndex}`
  : epubPath
    ? `${epubPath}#${annotation.rootChapterLinkUri}`
    : annotation.rootChapterLinkUri;
```

### Phase 3: Configuration

**Settings.ts:**
- Add new config fields to `ViwoodsProcessorConfig` interface

**ViwoodsProcessor.ts:**
- Update `getDefaultConfig()` with new defaults
- Update `getConfigSchema()` with new fields

### Phase 4: Templates & Documentation

**Template updates:**
- `viwoods-highlight.md`: Change "Open in EPUB" to "Open in PDF"
- `viwoods-annotation.md`: Change "Open in EPUB" to "Open in PDF"
- Make text conditional based on whether PDF or EPUB was used

**Documentation updates:**
- `docs/FILE-PROCESSORS.md`: Document EPUB to PDF conversion
- `docs/viwoods-setup.md`: Add conversion details
- `README.md`: Update features list

---

## User Experience

### Desktop Experience
- **Speed:** 2-5 seconds per EPUB (typical)
- **Quality:** High rendering quality
- **Memory:** 20-30MB peak
- **Progress:** "Converting EPUB to PDF... Chapter 3/15 (45%)"

### Mobile Experience (iOS/Android)
- **Speed:** 5-15 seconds per EPUB (typical)
- **Quality:** Medium rendering quality (optimized)
- **Memory:** 15-20MB peak
- **Progress:** "Converting EPUB to PDF... Chapter 3/15 (45%)"
- **Safeguard:** EPUBs > 50MB show warning, save as EPUB

### Error Handling

**If conversion fails:**
1. Log error to console
2. Show notice: "PDF conversion failed, saved as EPUB"
3. Fall back to original EPUB behavior
4. Generate EPUB deeplinks instead

**If EPUB too large (mobile):**
1. Log warning
2. Show notice: "EPUB too large for conversion on mobile, saved as EPUB"
3. Save as EPUB
4. Generate EPUB deeplinks

---

## Dependencies

### New Dependencies

Add to `package.json`:

```json
{
  "dependencies": {
    "epubjs": "^0.3.93",
    "pdf-lib": "^1.17.1"
  },
  "devDependencies": {
    "@types/node": "^20.10.0"
  }
}
```

**Bundle size impact:**
- epub.js: ~50KB gzipped
- pdf-lib: ~200KB gzipped
- **Total increase:** ~250KB gzipped (~750KB uncompressed)

---

## File Organization

### Before (EPUB only)
```
viwoods/
├── Sources/
│   ├── book-name.note
│   └── book-name.epub          ← Current
├── Highlights/
│   └── book-name-highlight-1.md
└── Annotations/
    └── book-name-p004-annotation-2.md
```

### After (PDF default)
```
viwoods/
├── Sources/
│   ├── book-name.note
│   └── book-name.pdf           ← New (converted from EPUB)
├── Highlights/
│   └── book-name-highlight-1.md    ← Links to PDF with #page=N
└── Annotations/
    └── book-name-p004-annotation-2.md  ← Links to PDF with #page=4
```

### With keepOriginalEpub=true
```
viwoods/
├── Sources/
│   ├── book-name.note
│   ├── book-name.pdf           ← Primary (linked in markdown)
│   └── book-name.epub          ← Backup (optional)
├── Highlights/
│   └── book-name-highlight-1.md
└── Annotations/
    └── book-name-p004-annotation-2.md
```

---

## Testing Strategy

### Test Cases

#### 1. Basic Conversion
- [x] Parse EPUB structure
- [ ] Render chapters to canvas
- [ ] Create PDF with multiple pages
- [ ] Verify PDF file is created
- [ ] Verify PDF opens in Obsidian

#### 2. Deeplink Accuracy
- [ ] Click highlight link → jumps to correct PDF page
- [ ] Click annotation link → jumps to correct PDF page
- [ ] Verify pageIndex matches visible page number

#### 3. Platform Testing
- [ ] **Desktop (macOS):** Convert 10MB EPUB, verify quality
- [ ] **Desktop (Windows):** Convert 10MB EPUB, verify quality
- [ ] **iOS:** Convert 10MB EPUB, verify memory usage
- [ ] **Android:** Convert 10MB EPUB, verify memory usage
- [ ] **Mobile:** Test 50MB EPUB → expect warning, EPUB saved

#### 4. Error Handling
- [ ] Corrupt EPUB → falls back to EPUB
- [ ] Missing chapters → partial conversion
- [ ] Memory limit exceeded → graceful failure
- [ ] Conversion interrupted → cleanup temp files

#### 5. Configuration
- [ ] convertEpubToPdf=false → saves EPUB
- [ ] keepOriginalEpub=true → saves both PDF and EPUB
- [ ] pdfQuality='low' → smaller file size
- [ ] pdfQuality='high' → better quality, larger file

#### 6. Memory Testing
- [ ] Monitor peak memory during conversion
- [ ] Verify GC frees chapter memory
- [ ] No memory leaks after multiple conversions
- [ ] Mobile: Stay under 50MB peak

---

## Success Criteria

✅ **Functional Requirements:**
- [ ] EPUBs automatically converted to PDFs
- [ ] PDF deeplinks use page numbers
- [ ] Clicking links jumps to correct page in Obsidian
- [ ] Works on Desktop, iOS, Android
- [ ] No user action required

✅ **Performance Requirements:**
- [ ] Desktop: < 5 seconds per typical EPUB
- [ ] Mobile: < 15 seconds per typical EPUB
- [ ] Peak memory < 50MB on all platforms
- [ ] No memory leaks

✅ **Quality Requirements:**
- [ ] PDFs readable and formatted correctly
- [ ] Text visible and clear
- [ ] Images preserved
- [ ] Page navigation works

✅ **Robustness Requirements:**
- [ ] Graceful fallback if conversion fails
- [ ] Mobile size limits respected
- [ ] Error messages clear and helpful
- [ ] Original EPUB preserved on failure

---

## Known Limitations (v1.0 POC)

1. **Complex EPUB layouts:** May not render perfectly (tables, complex CSS)
2. **Large EPUBs on mobile:** 50MB+ will skip conversion
3. **Conversion speed:** Slower than native tools (Calibre, etc.)
4. **PDF size:** May be larger than optimized PDFs
5. **Text selection:** Images-based PDF, text not selectable (future: OCR layer)

---

## Future Enhancements (Post-POC)

1. **OCR text layer:** Add searchable text to PDF pages
2. **Optimized compression:** Reduce PDF file size
3. **Background conversion:** Don't block sync for conversion
4. **Conversion queue:** Batch multiple EPUBs
5. **Progress persistence:** Resume interrupted conversions
6. **Custom page sizes:** Support different paper sizes
7. **Bookmarks:** Transfer EPUB TOC to PDF bookmarks

---

## References

- **epub.js Documentation:** https://github.com/futurepress/epub.js
- **pdf-lib Documentation:** https://pdf-lib.js.org/
- **Obsidian PDF Support:** https://help.obsidian.md/Files+and+folders/Accepted+file+formats#PDF
- **Canvas API:** https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API
- **StreamingZipUtils:** `/src/utils/StreamingZipUtils.ts` (reference implementation)

---

**END OF SPECIFICATION**

**Version:** 1.0.0 (POC)
**Status:** Ready for Implementation
**Next Steps:** Create feature branch, implement Phase 1
