> explain to me what happens when the viwoodsNoteMetadata.md accidentialy 
gets corrupted or missing 

⏺ I'll analyze what happens when the viwoodsNoteMetadata.md file gets
  corrupted or missing by examining the codebase.

⏺ Search(pattern: "viwoodsNoteMetadata")
  ⎿  Found 8 files (ctrl+o to expand)

⏺ Search(pattern: "**/*metadata*.ts")
  ⎿  Found 1 file (ctrl+o to expand)

⏺ Search(pattern: "**/specs/*.md")
  ⎿  Found 5 files (ctrl+o to expand)

⏺ Read(src/utils/MetadataManager.ts)
  ⎿  Read 283 lines

⏺ Read(src/processors/ViwoodsProcessor/index.ts)
  ⎿  Read 835 lines

⏺ Read(specs/VIWOODS_SPECIFICATION.md)
  ⎿  Read 927 lines

⏺ Read(src/processors/ViwoodsProcessor/modules/PaperProcessor.ts)
  ⎿  Read 309 lines

⏺ Based on my analysis of the code, here's what happens when
  viwoodsNoteMetadata.md gets corrupted or missing:

  Recovery Behavior

  The system has graceful degradation built in. When the metadata file is
  corrupted or missing:

  1. On Load (Initial Startup)

  - Location: MetadataManager.load() (src/utils/MetadataManager.ts:27-43)
  - Behavior:
    - Tries to load the file via loadDataFn()
    - If the file doesn't exist, catches the error and returns null
    - If the file is corrupted (invalid YAML), fromMarkdown() returns null
    - In either case, initializes with an empty metadata object ({})
    - Logs a warning: "Failed to load metadata, using empty"

  this.metadata = data || {};  // Line 30

  2. On Parsing Corrupted Data

  - Location: MetadataManager.fromYAML()
  (src/utils/MetadataManager.ts:139-246)
  - Behavior:
    - If YAML frontmatter is missing or malformed, returns null
    - If parsing fails with exception, catches error and returns null
    - Logs error: "Failed to parse YAML"

  3. During Note Processing

  - Location: PaperProcessor.generateOrMergeNoteFile()
  (src/processors/ViwoodsProcessor/modules/PaperProcessor.ts:224-307)
  - Behavior:
    - Checks if existing metadata exists: metadataManager.get(metadataKey)
   (line 267)
    - If no metadata found for existing file:
        - Still performs merge operation to preserve user content
      - Creates new metadata from current note state
      - Updates images and frontmatter based on new fetch
    - Always saves fresh metadata after processing

  4. On Save (After Processing)

  - Location: ViwoodsProcessor.process()
  (src/processors/ViwoodsProcessor/index.ts:177-179) and
  MetadataManager.save() (src/utils/MetadataManager.ts:48-67)
  - Behavior:
    - After successful Paper note processing, calls metadataManager.save()
    - Recreates the file with current in-memory metadata
    - If save fails, logs error and throws exception

  What Actually Happens to Your Notes

  If Metadata is Missing/Corrupted:

  1. Existing notes are preserved - No data loss
  2. On next sync:
    - Plugin treats all existing notes as if metadata is unknown
    - Still performs intelligent merge using MarkdownMerger
    - Updates image links if images changed
    - Updates frontmatter with new timestamps
    - Preserves user-added content (notes, edits)
  3. New metadata is generated from the fresh fetch
  4. File is recreated with current state

  Potential Edge Cases:

  ⚠️ Without metadata, the plugin can't detect:
  - Which page images have actually changed vs just renamed
  - The exact last modified time from previous sync

  ✅ But it still works because:
  - MarkdownMerger.merge() uses the current page structure from the ZIP
  file
  - User content (text notes) is always preserved via content-aware
  merging
  - Images are updated with cache-busting filenames, so outdated images
  won't persist

  Conclusion

  The plugin is resilient to metadata file corruption/loss:
  - ✅ No crashes or fatal errors
  - ✅ Notes continue to sync and process
  - ✅ User content is preserved
  - ✅ Metadata is automatically rebuilt from next sync
  - ⚠️ May lose some optimization (can't tell what changed between syncs)

  The worst-case scenario is that all notes get re-processed and images
  might get new cache-bust numbers, but no actual user data is lost.

> So this file is only for optimisation purposes? Are you sure ? 

⏺ You're right to question this. Let me investigate more carefully by
  looking at how the metadata is actually used in the merge logic.

⏺ Read(src/processors/ViwoodsProcessor/utils/MarkdownMerger.ts)
  ⎿  Read 244 lines

⏺ Actually, you're absolutely right to push back! Let me look more
  carefully at how the metadata is actually used:

⏺ Search(pattern: "metadataManager\.get", output_mode: "content")
  ⎿  Found 14 lines (ctrl+o to expand)

⏺ Now let me check how ImageCacheBuster.updateImageWithCacheBust works:

⏺ Read(src/utils/ImageCacheBuster.ts)
  ⎿  Read 212 lines

⏺ Ah! Now I see the full picture. You're absolutely correct - the metadata
   file is NOT just for optimization. Let me revise my understanding:

  What the Metadata File Actually Does

  Critical Function: Image Update Tracking

  The metadata stored in viwoodsNoteMetadata.md contains:
  {
    fileId: string,
    lastModified: number,
    notePath: string,
    pages: Array<{
      page: number,
      image: string  // <-- THIS IS CRITICAL
    }>
  }

  The Real Problem When Metadata is Missing/Corrupted

  Looking at PaperProcessor.ts lines 141-156:

  const result = await ImageCacheBuster.updateImageWithCacheBust(
      context.vault,
      screenshotPath,
      new Uint8Array(screenshotData.buffer)
  );

  // Track image updates for merge
  if (result.oldPath) {  // <-- ONLY populated if old file was found
      imageUpdates.push({
          pageNumber: pageNum,
          oldPath: result.oldPath,
          newPath: result.newPath,
      });
  }

  The issue: ImageCacheBuster finds old images by filesystem search
  (looking for timestamp patterns), NOT by reading metadata.

  But then the merge happens:

  const mergedContent = MarkdownMerger.merge(
      existingContent,
      pageImagePaths,
      imageUpdates,  // <-- Only contains updates IF old files were found 
  by filesystem
      modifiedTime
  );

  What Happens When Metadata is Lost

  Scenario 1: Note exists but metadata is missing

  1. ImageCacheBuster.updateImageWithCacheBust() is called with path like:
    - resources/note-slug-page-1.png
  2. ImageCacheBuster searches filesystem for existing variants:
    - Looks for note-slug-page-1.png
    - Looks for note-slug-page-1-<timestamp>.png
  3. If found:
    - Returns { oldPath: "resources/note-slug-page-1-1234567.png", 
  newPath: "resources/note-slug-page-1-9876543.png" }
    - Creates new timestamped file
    - Deletes old file(s)
    - Merge updates the markdown links from old → new
  4. If NOT found (metadata was corrupted AND user manually renamed
  images):
    - Returns { oldPath: null, newPath: 
  "resources/note-slug-page-1-9876543.png" }
    - Creates new timestamped file
    - PROBLEM: Old images stay in vault (orphaned)
    - PROBLEM: Markdown still points to old (possibly wrong) paths

  So What IS the Metadata For?

  Looking back at the code more carefully... I was wrong. The metadata is
  NOT directly used during the merge process. Let me check if it's used
  elsewhere:

⏺ Search(pattern: "existingMetadata", output_mode: "content")
  ⎿  Found 22 lines (ctrl+o to expand)

⏺ Final Answer: You're Right - But It's ONLY for Documentation/Logging

  After thorough analysis, here's the truth:

  The metadata file is ONLY used for:

  1. Logging - Line 273: hasMetadata: !!existingMetadata (just logged, not
   used)
  2. Future-proofing - It's stored but NOT currently read/used in any
  logic
  3. Documentation - Provides human-readable record of note structure

  The ACTUAL tracking mechanism is:

  ImageCacheBuster handles everything by filesystem search:
  - Searches for existing files matching the pattern
  note-slug-page-N-<timestamp>.png
  - If found → updates links in markdown
  - If not found → creates new file, markdown may have broken links

  So When Metadata is Lost/Corrupted:

  ✅ System works fine because:
  - Image tracking relies on filesystem search, NOT metadata
  - Merge logic reads existing markdown content directly
  - No functionality breaks

  ⚠️ But you lose:
  - Human-readable documentation of note structure
  - Potential future features that might use this metadata
  - Debugging information (logs show hasMetadata: false)

  Revised Conclusion

  You were right to question me! The metadata file is essentially:
  - A documentation/audit trail of note structure
  - Not used in critical path of merge/update logic
  - Safe to lose without breaking functionality
  - Automatically regenerated on next sync

  It's designed for observability and future extensibility, not core
  functionality.