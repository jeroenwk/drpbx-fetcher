Summary

  I've successfully implemented rename detection for Viwoods Paper notes on the
  feature/detect-renamed-notes branch. Here's what was done:

  Problem Solved

  When a note is renamed in Dropbox, it gets a new file.id, causing the plugin to
  treat it as a completely new file and create a duplicate note instead of updating
  the existing one.

  Solution Implemented

  1. Content Hash-Based Detection
  - Created ContentHasher utility that generates a stable hash from:
    - Creation time (unchanged on rename)
    - Total page count (structure stays the same)
    - Folder path (unless moved)
  - Uses FNV-1a hash algorithm (fast, sufficient for our use case)

  2. Rename Handler
  - Created NoteRenameHandler that:
    - Renames the markdown file to match new name
    - Updates image file paths when note slug changes (e.g., old-note-page-1.png →
  new-note-page-1.png)
    - Updates all image embeds in markdown content
    - Updates metadata with new fileId and paths
    - Cleans up old metadata entries

  3. Metadata Enhancement
  - Added contentHash field to ViwoodsNoteMetadata
  - Added findByContentHash() method to MetadataManager
  - Added hasFileId() helper method

  4. Integration in PaperProcessor
  - Before processing a note:
    a. Calculate content hash
    b. Search for existing note with same hash but different fileId
    c. If found → execute rename handler
    d. Continue with normal processing/merging

  Files Created/Modified

  - ✅ src/models/Settings.ts - Added contentHash field
  - ✅ src/utils/ContentHasher.ts - New hash utility
  - ✅ src/utils/NoteRenameHandler.ts - New rename handler
  - ✅ src/utils/MetadataManager.ts - Added search methods
  - ✅ src/processors/ViwoodsProcessor/modules/PaperProcessor.ts - Integrated
  detection

  Testing Ready

  The plugin has been:
  - ✅ Type-checked (TypeScript)
  - ✅ Linted (ESLint)
  - ✅ Built successfully
  - ✅ Installed to vault (v0.2.118)

  Next Steps for Testing

  1. Reload Obsidian to load the new plugin version
  2. Create a test note in Viwoods
  3. Sync to Obsidian
  4. Add some user content to the markdown
  5. Rename the note in Viwoods
  6. Sync again and verify:
    - Old note renamed to new name ✓
    - User content preserved ✓
    - Images updated if needed ✓
    - No duplicate created ✓

  The feature is ready for testing on the feature/detect-renamed-notes branch!