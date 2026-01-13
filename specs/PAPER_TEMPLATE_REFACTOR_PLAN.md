# Plan: Refactor PaperProcessor Templating

## Summary

**Goal:** Clean up and improve PaperProcessor templating to make structure explicit and move audio files to end of file.

**Key Changes:**
1. Rename template: `Note Template.md` → `Paper Template.md`
2. Rewrite template with explicit loops over pages (instead of pre-built string)
3. Move audio files from per-page to end of file in "## Audio Recordings" section
4. Update MarkdownMerger to parse and rebuild audio section at end
5. Use PageResource.json to detect audio files (add `ResourceType.AUDIO = 6`)
6. Maintain backward compatibility with existing notes

**Files Modified:** 5 files
- Template file (rename + rewrite)
- TemplateDefaults.ts (update import)
- ViwoodsTypes.ts (add AUDIO enum)
- PaperProcessor.ts (remove manual building, use structured data, improve audio detection)
- MarkdownMerger.ts (parse/rebuild audio footer section)

## Understanding: Current Implementation

### How It Works Now

**New Files:**
1. PaperProcessor builds `screenshotSections` manually (lines 319-342 in PaperProcessor.ts)
2. Passes `screenshotSections` as a single pre-built string to template
3. Template (`Note Template.md`) only contains frontmatter + `<% tp.user.screenshotSections %>`
4. TemplateEngine renders the template with the pre-built sections

**Existing Files (Modified by User):**
1. Uses `MarkdownMerger.merge()` to parse existing markdown
2. Parses into structured sections: header + pages (image + audio + userContent) + footer
3. Updates image paths if needed (e.g., after rename)
4. Adds new audio files while avoiding duplicates
5. Preserves all user content in `userContent` field
6. Reconstructs markdown by calling `buildMarkdown()`

**Key Difference:**
- New files use TemplateEngine with pre-built screenshotSections
- Existing files use MarkdownMerger which completely bypasses the template

### Current Template File
```markdown
---
created: <% tp.user.createTime %>
modified: <% tp.user.modifiedTime %>
total_pages: <% tp.user.totalPages %>
tags:
  - scribbling
  - <% tp.date.now("YYYY-MM-DD") %>
dropbox_file_id: <% tp.config.dropbox_file_id %>
---

<% tp.user.screenshotSections %>
```

### Problems Identified

1. **Template is not used for merging** - MarkdownMerger bypasses template entirely
2. **Template doesn't show page loop structure** - Just a placeholder for pre-built content
3. **No loop over pages** - Screenshot sections are manually built in TypeScript
4. **No loop over audio files** - Audio embeds are manually inserted
5. **Template name is wrong** - Should be "Paper Template.md" not "Note Template.md"
6. **Merge logic is hardcoded** - Cannot customize structure via template

## Critical Discovery: Audio File Structure

**Audio files are NOTE-LEVEL, not page-level resources:**

Analysis of `samples/Todo.note` reveals:
- Audio file has `pid: "710247b1-76de-49fb-b7f7-f3fb078849e0"` (the note ID)
- Page has `id: "c28f67e2-c354-47d7-b309-c2bdbe7f0e53"` (different ID)
- Audio `resourceType: 6` (AUDIO - not in current enum)
- Screenshots have `resourceType: 2` (SCREENSHOT) and `pid` matching page ID

**Conclusion:** Audio files belong to the entire note, not individual pages.

**User's requirement:** "If audio is related to a page then they should be under the notes of each page. If they are related to all pages then they should come at the end of the file"

**Implementation decision:** Since audio files have `pid` equal to note ID (not page ID), they are note-level resources and should be placed at the end of the file, not repeated on each page.

## Proposed Refactoring

### Goals

1. Make template actually loop over pages using Templater syntax
2. Place note-level audio files at the end of the file (not repeated on each page)
3. Support future page-level audio if detected via PageResource.json
4. Clearly show the structure in the template (like the example provided)
5. Ensure merge logic preserves user content correctly
6. Rename template file appropriately
7. Keep backward compatibility with existing notes

### Implementation Plan

#### Step 1: Rename Template File
- Rename `src/processors/ViwoodsProcessor/modules/paper/Note Template.md` → `Paper Template.md`
- Update `TemplateDefaults.ts` import path
- **No bundle key change needed** - keep `"viwoods-paper-note.md"` for backward compatibility with user configs

#### Step 2: Redesign Template with Loops

Create new template structure (audio at end, pages loop):
```markdown
---
created: <% tp.user.createTime %>
modified: <% tp.user.modifiedTime %>
total_pages: <% tp.user.totalPages %>
tags:
  - scribbling
  - <% tp.date.now("YYYY-MM-DD") %>
dropbox_file_id: <% tp.config.dropbox_file_id %>
---

<%*
// Loop over pages - each page shows image + Notes section for user content
tp.user.pages.forEach((page, index) => {
-%>
<%* if (index > 0) { -%>
___

<%* } -%>
![[<% page.imagePath %>]]

### Notes

*Add your notes here*

<%* }) -%>
<%*
// Note-level audio files appear at the end (not repeated on each page)
if (tp.user.audioFiles && tp.user.audioFiles.length > 0) {
-%>

## Audio Recordings

<%* tp.user.audioFiles.forEach(audio => { -%>
![[<% audio.path %>]]
<%* }) -%>
<%* } -%>
```

#### Step 3: Update PaperProcessor Data Preparation

**Change in `PaperProcessor.ts` (line 319-342):**

Instead of building `screenshotSections` manually, pass structured data:

```typescript
// REMOVE manual screenshotSections building (lines 319-342)

// KEEP page metadata collection (pageImagePaths already exists)

// Pass structured data to template
const templateData = {
    noteId: noteId,
    dropboxFileId: dropboxFileId,
    noteName,
    noteSlug,
    totalPages,
    createTime: TemplateEngine.formatDate(createTime, "YYYY-MM-DD HH:mm"),
    modifiedTime: TemplateEngine.formatDate(modifiedTime, "YYYY-MM-DD HH:mm"),
    lastModified: noteInfo.lastModifiedTime,
    folderPath,
    pages: pageImagePaths,  // Array of { pageNumber, imagePath }
    audioFiles,  // Array of { fileName, path }
};
```

#### Step 4: Update MarkdownMerger for Template Compatibility

**Challenge:** MarkdownMerger currently reconstructs markdown manually. Need to consider two approaches:

**Option A: Keep MarkdownMerger as-is (Recommended)**
- MarkdownMerger logic is solid and preserves user content perfectly
- The merge bypasses template because template cannot handle user content preservation
- Template is only for NEW files where no user content exists
- Keep both paths separate - they serve different purposes

**Option B: Template-driven Merge (Complex, not recommended)**
- Would require passing user content back to template
- Template would need complex conditionals for each page
- Much harder to maintain and debug
- Risk of losing user content if template logic has bugs

**Recommendation:** Keep Option A - the current approach is correct. Template is for structure definition (new files), MarkdownMerger is for content preservation (existing files).

#### Step 5: Update MarkdownMerger for Audio at End

**Changes needed to match new template structure:**

1. **Update parsing logic:**
   - Currently: Audio embeds are detected within page sections
   - New: Audio embeds at end of file (after all pages) in "## Audio Recordings" section
   - Need to parse footer section to extract audio files

2. **Update buildMarkdown logic:**
   - Currently: Audio embeds added to each page's content
   - New: Audio embeds added to footer section after all pages
   - Need to reconstruct "## Audio Recordings" section at end

3. **Changes in `MarkdownMerger.ts`:**

**ParsedMarkdown interface:**
```typescript
export interface ParsedMarkdown {
    header: string;  // Content before first page section
    pages: PageSection[];
    footer: string;  // Content after last page section (if any)
    audioFiles: string[];  // NEW: Audio embeds extracted from footer
}
```

**PageSection interface:**
```typescript
export interface PageSection {
    pageNumber: number;
    imageEmbed: string;  // The ![[...]] wiki link
    audioEmbeds: string[];  // REMOVE: Audio no longer per-page (keep for backward compat with old notes)
    userContent: string;  // Everything after the image until next page or audio section
}
```

**parseMarkdown() updates:**
- After parsing all pages, look for "## Audio Recordings" section in remaining content
- Extract audio embeds from that section
- Store in `audioFiles` array
- Preserve backward compatibility: if audio embeds found in page sections, keep them there

**buildMarkdown() updates:**
- After all page sections, add "## Audio Recordings" section if audioFiles array is not empty
- Format: `\n\n## Audio Recordings\n\n` + audio embeds

**merge() updates:**
- Accept new audio files array
- Merge with existing audio files from footer section
- Avoid duplicates
- Rebuild footer with updated audio files

#### Step 6: Documentation & Comments

Add clear comments explaining:
1. Why template is only used for new files
2. Why MarkdownMerger bypasses template for existing files
3. How the two approaches work together

### Additional Changes Required

#### Add AUDIO ResourceType to ViwoodsTypes

**File:** `src/processors/ViwoodsProcessor/ViwoodsTypes.ts`

Add missing audio resource type to enum:
```typescript
export enum ResourceType {
    MAIN_BITMAP = 1,
    SCREENSHOT = 2,
    AUDIO = 6,  // NEW: Audio recordings
    PATH_DATA = 7,
    ORDER_FILE = 8,
    THUMBNAIL = 9,
    BROWSING_HISTORY = 11,
}
```

#### Update Audio Extraction Logic in PaperProcessor

**File:** `src/processors/ViwoodsProcessor/modules/PaperProcessor.ts` (lines 270-317)

**Current approach:** Extracts all files from `audio/` folder in ZIP
**New approach:** Use PageResource.json to identify audio resources

```typescript
// Find note-level audio resources (pid matches note ID, not page ID)
const noteId = noteInfo.id;
const noteLevelAudioResources = resources?.filter(
    r => r.resourceType === ResourceType.AUDIO && r.pid === noteId
) || [];

// Find page-level audio resources (pid matches page ID)
// For future support - currently seems not used by Paper app
const pageLevelAudioResources = resources?.filter(
    r => r.resourceType === ResourceType.AUDIO && r.pid !== noteId
) || [];

// Extract note-level audio files
const audioFiles: Array<{ fileName: string; path: string }> = [];
for (const audioResource of noteLevelAudioResources) {
    // Extract from resources, not from audio/ folder
    const audioData = await StreamingZipUtils.extractFile(
        zipReader,
        `audio/${audioResource.fileName}`
    );
    // ... rest of extraction logic
}
```

**Benefit:** Proper resource detection instead of filename pattern matching
**Backward compatibility:** Keep fallback to `audio/` folder scan if no resources found

### Critical Files to Modify

1. **src/processors/ViwoodsProcessor/modules/paper/Note Template.md**
   - Rename to `Paper Template.md`
   - Rewrite with loops over pages
   - Add audio section at end of file

2. **src/processors/ViwoodsProcessor/TemplateDefaults.ts**
   - Update import path for renamed template
   - Keep bundle key as `"viwoods-paper-note.md"` (backward compat)

3. **src/processors/ViwoodsProcessor/ViwoodsTypes.ts**
   - Add `ResourceType.AUDIO = 6` to enum

4. **src/processors/ViwoodsProcessor/modules/PaperProcessor.ts**
   - Remove manual `screenshotSections` building (lines 319-342)
   - Update audio extraction to use PageResource.json (lines 270-317)
   - Update data structure passed to template (line 350-362)
   - Add comments explaining new file vs existing file logic
   - Ensure `pageImagePaths` and `audioFiles` are passed to template as structured arrays

5. **src/processors/ViwoodsProcessor/utils/MarkdownMerger.ts**
   - Update `ParsedMarkdown` interface to include `audioFiles` array
   - Update `parseMarkdown()` to extract audio from footer section
   - Update `buildMarkdown()` to reconstruct audio section at end
   - Update `merge()` to handle audio files in footer
   - Add backward compatibility for old notes with audio in page sections
   - Add documentation comments explaining why it bypasses template

### Data Structure Changes

**Before:**
```typescript
{
    screenshotSections: string,  // Pre-built markdown
    audioFiles: Array<{ fileName, path }>,  // Not used in template
}
```

**After:**
```typescript
{
    pages: Array<{ pageNumber, imagePath }>,  // Used in template loop
    audioFiles: Array<{ fileName, path }>,  // Used in template loop
}
```

### Testing Strategy

1. **New file creation:**
   - Extract a .note file from Dropbox
   - Verify template generates correct structure with page loops
   - Check audio files are embedded under each page's Notes section
   - Verify frontmatter is populated correctly

2. **Existing file update (no rename):**
   - Create a note, add user content
   - Re-fetch the same note
   - Verify user content is preserved
   - Verify audio files are merged (duplicates avoided)
   - Verify image paths stay the same or update correctly

3. **Existing file update (with rename):**
   - Create a note
   - Rename it in Dropbox
   - Re-fetch
   - Verify note file is renamed
   - Verify images are renamed with new slug
   - Verify user content is preserved

4. **Multiple pages:**
   - Test note with 3+ pages
   - Verify page breaks (`___`) appear correctly
   - Verify each page has its own Notes section

5. **Audio files:**
   - Test note with audio recordings (use `samples/Todo.note`)
   - Verify audio embeds appear in "## Audio Recordings" section at end of file
   - Verify audio does NOT appear on individual pages
   - Verify note-level audio (pid = note ID) is correctly identified
   - Test merge: add user content, re-fetch, verify audio section stays at end

### Verification Checklist

After implementation:

- [ ] Template file renamed to `Paper Template.md`
- [ ] Template shows clear loop structure over pages
- [ ] Template shows clear loop structure over audio files
- [ ] New notes use template with loops (no pre-built sections)
- [ ] Existing notes use MarkdownMerger (preserves user content)
- [ ] Comments explain why two different code paths exist
- [ ] Build succeeds (`npm run build`)
- [ ] TypeScript checking passes (`npx tsc -noEmit -skipLibCheck`)
- [ ] Linting passes (`npm run lint`)
- [ ] Plugin installs to vault (`npm run install-plugin`)
- [ ] Manual testing: create new note, verify structure
- [ ] Manual testing: update existing note, verify user content preserved
- [ ] Manual testing: rename note, verify rename handling works
- [ ] Check log.txt for any errors during fetch
- [ ] Verify generated .md files match expected structure

### Risk Assessment

**Low Risk:**
- Template rename (file system operation)
- TemplateDefaults import update
- Adding comments/documentation

**Medium Risk:**
- Removing screenshotSections building logic
- Changing data structure passed to template
- Template syntax (loops with Templater)

**Mitigation:**
- Test thoroughly with sample .note files
- Keep git history for easy rollback
- Add verbose logging during template rendering
- Verify both new file and existing file code paths

### Notes

- The current architecture (template for new, merger for existing) is actually good design
- The main issue is that the template doesn't show its intent clearly
- Making template use loops solves the clarity problem
- MarkdownMerger should continue to bypass template - this is correct behavior
- Audio files currently appear on ALL pages - template will maintain this behavior
