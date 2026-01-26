# Changelog

All notable changes to the Dropbox Fetcher plugin will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.2.318] - 2025-01-26

### 🎤 Voice Notes Processor - Major New Feature
- **AI-Powered Link Detection**: Automatically converts text mentions of notes into Obsidian wiki-links
- **Local LLM Support**: Uses WebLLM for browser-based local AI processing (no API key needed)
- **Cloud LLM Support**: Optional Gemini API and OpenRouter integration for cloud processing
- **Smart Link Placement**: Intelligently places converted links while preserving user content
- **Fuzzy Matching**: Advanced note matching with configurable similarity thresholds
- **Model Management**: Download, manage, and delete AI models from settings UI
- **Progress Tracking**: Real-time progress updates for model downloads and processing
- **Dictation Tag**: Configurable tag to identify voice-dictated notes (default: `#dictation`)
- **Multiple Model Options**: Support for Phi-3, Gemma, Llama, Gemini, Mistral, and more via OpenRouter

### 🎨 Templater Template System
- **Full Templater Syntax**: Templates now use Templater syntax (`<% %>`) instead of Handlebars
- **Dynamic Commands**: `<% code %>` - Outputs the result of code execution
- **Execution Commands**: `<%* code %>` - Executes code with `tR` variable for output accumulation
- **Comments**: `<%# comment %>` - Ignored during template execution
- **Templater Modules**: tp.date, tp.file, tp.frontmatter, tp.config available in templates
- **Template Parser**: Complete parser for Templater syntax with tokenization
- **Template Executor**: Safe JavaScript execution in template context

### 🧪 ContentPreserver System
- **Callout Preservation**: User-modified callout blocks are preserved in-place during updates
- **Smart Merging**: Preserves user edits while updating template-generated content
- **Paper Notes**: Refactored to use ContentPreserver for better content preservation
- **Meeting, Daily, Picking**: Standardized to use ContentPreserver system

### 🛠️ Processor Improvements
- **DefaultProcessor**: Auto-populates `allowedExtensions` from routed file extension
- **Folder Mapping**: DefaultProcessor now correctly respects folder mapping for `.md` files
- **Re-fetch Command**: New command to mark files as unprocessed for re-fetching

### 📝 Template Changes
- **Daily Tag Change**: Daily note tag changed from `#daily-note` to `#journal`
- **Template Tests**: Added comprehensive tests for TemplateEngine and TemplaterExecutor

### 🔧 Developer Experience
- **Log File Recreation**: Log file recreated on plugin reload and log-server start
- **Test Reset Script**: New script to clean Viwoods test data
- **Dead Code Removal**: Removed legacy and unused code for cleaner codebase

## [0.2.236] - 2026-01-13

### 🎵 Audio File Support for Paper Module
- **Extract Audio from .note Files**: Audio files stored inside .note ZIP files are now extracted and saved to the attachments folder
- **Audio Embeddings**: Extracted audio files are automatically embedded in the generated markdown under the Notes section
- **Audio Metadata Tracking**: Audio files are tracked in `ViwoodsNoteMetadata` for proper merge handling on note updates
- **Skip External Audio Files**: Audio files in `Paper/Audio File/` Dropbox folder are now skipped (only audio inside .note files is processed)

### 🚫 Improved File Filtering
- **No Processor = No Download**: Files without an explicit processor mapping are now completely skipped (no download, no folder creation)
- **Early Skip Logic**: Files are now filtered before downloading, saving bandwidth and preventing empty folder creation
- **DefaultProcessor Configuration**: DefaultProcessor now requires explicit `allowedExtensions` configuration (defaults to empty for safety)

### 📝 DefaultProcessor Changes
- **Explicit Configuration Required**: DefaultProcessor no longer has hardcoded defaults. Users must configure `allowedExtensions` when creating a `.md` → `default` mapping
- **Configurable Extensions**: Users can specify which file types to sync via comma-separated list (e.g., "md, txt, pdf")

## [0.2.223] - 2025-01-02

### 🎨 Template System Overhaul
- **Templater Syntax Migration**: All Viwoods templates now use Templater syntax (`<% %>`) instead of hardcoded strings
- **Separate Template Files**: Templates extracted to individual `.md` files in module folders for easy editing
- **Export Templates Feature**: New "Export Templates" button in Viwoods processor configuration
- **Smart Folder Detection**: Automatically exports to Templater plugin folder (priority), Templates core plugin folder, or "Templates" default
- **YAML Frontmatter**: All templates now use consistent YAML frontmatter for structured metadata
- **Build-time Bundling**: Templates bundled at build time using esbuild's text loader

### 🧹 Template Cleanup
- **Removed Unused Templates**: Eliminated 3 unused templates (annotation, paper-page, legacy page)
- **Learning Module Refactor**: Migrated from inline hardcoded templates to TemplateDefaults system
- **Template Count**: Reduced from 9 to 7 actively used templates

### ⚙️ Configuration UI Enhancements
- **Button Field Type**: Added new "button" type to processor configuration schema
- **Custom Actions**: Processors can now handle button actions via `handleButtonAction()` method
- **Viwoods-Specific Config**: Export functionality properly scoped to Viwoods processor (not global settings)

### 📝 Templates Included
- Learning: Highlight Template, EPUB Annotation Template
- Paper: Note Template
- Daily: Daily Template
- Meeting: Meeting Template
- Picking: Picking Template
- Memo: Memo Template

## [0.2.181] - 2025-01-13

### 🍎 iOS Platform Fixes
- **Disabled Chunked Downloads on iOS**: iOS platform now uses SDK-based download method instead of HTTP Range requests due to compatibility issues
- **iOS Range Request Fixes**: Fixed HTTP method and header issues with iOS Range requests (GET instead of POST, removed Content-Type header)

### 🏷️ Frontmatter Properties Enhancement
- **All Viwoods Modules**: Added Obsidian frontmatter properties to all Viwoods modules (Paper, Meeting, Memo, Daily, Picking, Learning)
- **Paper Template Layout Update**: Tags moved to frontmatter properties with proper structure
- **Page Break Support**: Added page breaks between images in Paper notes for better organization

### 🔧 Debugging and Logging
- **Enhanced Error Logging**: Added verbose error logging to capture response bodies for better debugging
- **Chunk Download Logging**: Added detailed logging for chunk download requests and responses
- **Case-Sensitive Paths**: Fixed path handling to use case-sensitive `path_display` for chunked downloads

### 🔐 Authentication Improvements
- **Fresh Access Tokens**: Ensured fresh access tokens are used for chunked downloads on iOS
- **Note File ID Logging**: Added verbose logging for note file IDs during processing

## [0.2.164] - 2025-10-23

### 🏷️ Tag Structure Improvements
- **Simplified Tags**: Streamlined tag structure across all Viwoods modules for better organization
- **Date Tags**: Added consistent date tags (`#YYYY-MM-DD`) to all module footers (Paper, Meeting, Memo, Picking, Learning)
- **Paper Module**: Tags simplified to `#scribbling #{{date}}`
- **Meeting Module**: Tags simplified to `#meeting #{{date}}`
- **Memo Module**: Tags simplified to `#memo{{todoTag}} #{{date}}`
- **Picking Module**: Tags simplified to `#picking #{{date}}`
- **Learning Module**: Added date tags to EPUB highlights and annotations

### 🔧 Technical Improvements
- **MemoProcessor**: Fixed date parameter passing to template renderer for proper date tag generation
- **Template Consistency**: All modules now follow the same date tagging pattern as Daily notes
- **Cleaner Footers**: Removed redundant slug-based tags for simplified tag structure

## [0.2.142] - 2025-10-22

### 🎉 Major New Feature: Complete Daily Module Implementation with Cross-Referencing
- **Full Viwoods Daily Support**: Complete processing of Viwoods Daily journal notes (`com.wisky.schedule`) with multi-page support and date-based organization
- **Smart Cross-Referencing**: Automatically generates links to Paper, Meeting, Memo notes created on the same date
- **Incremental Link Updates**: Other modules (Paper, Meeting, Memo) automatically add themselves to daily notes when processed
- **Query Parameter Cache-Busting**: Uses `?t=timestamp` pattern for daily note images to force Obsidian cache invalidation
- **Content Preservation**: Markdown merging preserves user-added journal and task content while regenerating Related Notes section
- **Template System**: Enhanced daily note template with dedicated sections for related notes, journal, and tasks

### 🔗 Cross-Reference Architecture
- **CrossReferenceManager Utility**: Centralized system for finding and linking related notes by creation date
- **Date-Based Matching**: Finds notes from all modules created on the same calendar day (local timezone)
- **Processing Order**: Daily notes processed last to ensure all related notes exist first
- **Incremental Updates**: New notes from other modules automatically add links to existing daily notes
- **Metadata Integration**: Added `creationTime` field to note metadata for accurate date matching

### 📁 Daily Note Features
- **Flat Folder Structure**: Daily notes stored directly in `Viwoods/Daily/` with YYYY-MM-DD naming
- **Multi-Page Support**: All page images embedded sequentially in single markdown file
- **Related Notes Sections**: Organized by module type (Paper Notes, Meeting Notes, Memos, etc.)
- **Date Tags**: Automatic tagging with `#journal #Viwoods/daily #date/YYYYMMDD`
- **No Manual Rebuild Needed**: Cross-references update automatically; users can re-sync to reset if needed

### 🏗️ Architecture Improvements
- **ViwoodsNoteMetadata Enhancement**: Added optional `creationTime` field for cross-referencing
- **NoteListEntry Interface**: New type for Daily/Picking module note list structures
- **Template Variables**: Added date-specific and cross-reference template variables
- **TypeScript Safety**: Proper type handling for cross-module configurations

### 📋 Technical Details
- **Related Note Query**: O(n) where n = notes in metadata file (fast even with hundreds of notes)
- **Link Insertion**: Smart section detection and creation in existing daily notes
- **Duplicate Prevention**: Checks for existing links before adding new ones
- **Graceful Degradation**: Cross-referencing works even if some modules are disabled

## [0.2.141] - 2025-10-21

### 🎉 Major New Feature: Complete Meeting Module Implementation
- **Full Viwoods Meeting Support**: Complete processing of Viwoods Meeting notes (`com.wisky.meeting`) with screenshot extraction and page organization
- **Advanced Rename Detection**: Automatic detection and handling of meeting note renames using stable Viwoods internal noteId
- **Smart Image Management**: Meeting-specific image patterns with cache-busting and automatic cleanup during renames
- **Content Preservation**: MarkdownMerger integration ensures all user edits are preserved during updates
- **Clean Folder Structure**: Meeting notes stored directly in `Viwoods/Meeting/` without extra subfolders
- **Template System**: Enhanced meeting templates with meeting-specific variables and proper tag structure

### 🔄 Image and Rename Features
- **Meeting Image Cache-Busting**: Uses `{slug}-page-{number}-{timestamp}.png` pattern for proper updates
- **Dedicated Metadata Manager**: Meeting module now uses its own metadata space separate from Paper/Memo modules
- **Automatic Image Cleanup**: Old images automatically cleaned up after successful rename operations

## [0.2.130] - 2025-10-21

### 🎉 Major New Feature: Complete Memo Module Implementation
- **Full Viwoods Memo Support**: Complete processing of Viwoods Memo notes (`com.wisky.memo`) with todo integration and reminder functionality
- **Advanced Rename Detection**: Automatic detection and handling of memo note renames using stable Viwoods internal noteId
- **Smart Image Management**: Memo-specific image patterns with cache-busting, white background processing, and automatic cleanup
- **Content Preservation**: MemoMerger class ensures all user edits are preserved during updates and renames
- **Template System**: Enhanced memo templates with todo-specific variables and minute-level time formatting

### 🔄 Image and Rename Features
- **Memo Image Patterns**: Support for `{slug}-image-{timestamp}.png` pattern distinct from paper notes
- **Image Rename During Note Rename**: Images automatically renamed to match new note names while preserving timestamps
- **Automatic Cleanup**: Old cache-busted images cleaned up after successful rename operations
- **White Background Processing**: Memo images automatically enhanced with white background for better visibility
- **Proper Tagging**: Separate tags (`#memo #shopping`) instead of combined tags

### 🏗️ Architecture Improvements
- **MetadataManager Integration**: Memo module now has full metadata tracking for rename detection
- **Extended NoteRenameHandler**: Enhanced to handle both paper and memo image patterns
- **TypeScript Enhancements**: Removed all `any` types, added proper interfaces, fixed all ESLint warnings
- **TemplateEngine Integration**: Consistent template rendering across all Viwoods modules

### 📋 User Experience Improvements
- **Minute-Level Timestamps**: Clean time formatting without seconds (`21/10/2025, 11:38` instead of `21/10/2025, 11:38:25`)
- **No Duplicate Titles**: Obsidian filename used as title instead of markdown title
- **Todo Checkbox Support**: Automatic todo checkbox generation for memo notes marked as todos
- **Reminder Metadata**: Full support for Viwoods memo reminder functionality
- **Clean Content Updates**: Fixed "## Content" section duplication during updates

## [0.2.121] - 2025-10-21

### Added
- **Automatic Rename Detection**: Plugin now automatically detects when Viwoods Paper notes are renamed in Dropbox and updates the corresponding markdown files
- **Smart Note Identity Tracking**: Uses Viwoods internal note ID (from NoteFileInfo.json) to track notes across renames instead of relying on Dropbox file IDs that change on rename
- **Image Path Preservation**: Images are automatically renamed and updated when note slugs change during rename operations
- **Metadata-Based Image Updates**: Images are tracked via metadata, ensuring proper updates even after multiple renames with different slugs

### Fixed
- **Duplicate Notes on Rename**: Previously, renaming a note in Dropbox created a duplicate note with the new name while keeping the old one
- **Lost User Content**: User edits in renamed notes are now preserved through the rename process
- **Orphaned Images**: Old images are properly cleaned up when notes are renamed and slugs change
- **Image Update After Rename**: Fixed bug where images weren't updating after rename because ImageCacheBuster couldn't find old files with different slugs

### Changed
- **Metadata Structure**: Added `noteId` (Viwoods internal ID, stable) and `dropboxFileId` (Dropbox ID, changes on rename) fields to metadata
- **Processing Flow**: Rename detection happens before image processing, allowing proper image updates in renamed notes

### Technical
- Added `NoteRenameHandler` utility for handling note rename operations
- Added `findByNoteId()` method to `MetadataManager` for note identity lookup
- Enhanced `PaperProcessor` with rename detection logic before processing
- Improved image update tracking using metadata when filename patterns don't match after rename
- Updated YAML serialization to track both noteId and dropboxFileId

## [0.2.117] - 2025-10-21

### Fixed
- **Learning Module Source Links**: Source field now displays book name as link title instead of generic text like "Open in EPUB" or file extension
- **Learning Module Hashtags**: Changed hashtag format from `#book/title-of-book` to `#book #title-of-book` for better tag organization
- **Learning Module Page Tags**: Removed `#page/xxx` hashtag from annotation files to reduce tag clutter

### Changed
- Source links in Learning module highlights and annotations now use book name for better readability
- Hashtag structure updated for consistency across Learning module notes

## [0.2.116] - 2025-10-20

### Fixed
- **YAML Parser Metadata Loss**: Fixed critical bug where YAML parser incorrectly matched `    pages:` (4-space indent) as note keys, causing all Paper note metadata to be lost after first save/load cycle
- **Modified Date Not Updating**: Fixed bug where markdown note headers showed stale Modified timestamps even after syncing updated notes
- **Total Pages Not Updating**: Fixed bug where Total Pages count in note headers wasn't updated when page counts changed

### Changed
- **Metadata Storage Format**: Moved Paper note metadata from plugin settings (data.json) to separate markdown file with YAML frontmatter (`viwoodsNoteMetadata.md`)
- **Header Updates During Merge**: Note headers now automatically update Modified date and Total Pages count during merge operations

### Improved
- **Metadata Reliability**: All Paper notes are now correctly tracked with complete page information across multiple sync cycles
- **Timestamp Accuracy**: Modified dates update correctly on each sync to reflect actual note modification times
- **Page Count Tracking**: Total pages count stays accurate in note headers
- **User Content Preservation**: All user notes and edits continue to be preserved during merges

### Technical
- Fixed YAML parser regex from `/^ {2}([^:]+):\s*$/` to `/^  ([^:]+):\s*$/` with `!line.startsWith('   ')` check
- Added `MetadataManager` class for centralized metadata operations with YAML serialization
- Added `updateHeader()` method to `MarkdownMerger` for updating metadata fields
- Enhanced logging for metadata save/load operations and parser debugging
- Metadata now stored in vault alongside Paper notes for better visibility and backup

## [0.2.104] - 2025-10-20

### Fixed
- **User Notes Preservation**: Fixed critical bug where user-edited notes in Paper markdown files were lost during image updates
- User content in markdown files is now always preserved when images are updated from Dropbox

### Changed
- **Metadata Storage**: Moved Paper note metadata from sidecar files to plugin settings (data.json)
- Metadata storage is now more reliable - no issues with hidden file detection
- Simplified merge strategy: always merge existing files to preserve user edits

### Improved
- More robust Paper note processing with guaranteed user content preservation
- Better logging and error handling for Paper note merge operations
- Cleaner production code after removing verbose debug logging

### Technical
- Added `viwoodsNoteMetadata` to plugin settings for centralized metadata storage
- Refactored `MarkdownMerger` to use settings-based metadata lookup
- Removed unnecessary `await` keywords on StreamLogger calls (TypeScript warning fixes)
- Settings-based approach eliminates filesystem dependency for metadata

## [0.2.98] - 2025-10-17

### Added
- **Image Cache Busting Utility**: New ImageCacheBuster class for forcing Obsidian to refresh updated images
- Architecture documentation (specs/ARCHITECTURE.md) describing plugin structure and design patterns
- File modification event triggering to ensure proper workspace refresh

### Changed
- Modified files now use `vault.modifyBinary()` instead of `adapter.writeBinary()` for proper change detection
- Improved image update mechanism with workspace event triggering

### Removed
- Deleted obsolete specification files (IMPLEMENTATION-SUMMARY.md, multiple SPEC-*.md files)
- Removed outdated debugging and installation guides from specs folder

### Improved
- Better image refresh behavior - updated images now display immediately without requiring restart
- Cleaner specs folder organization with consolidated architecture documentation

### Technical
- Added TFile import for proper type handling
- ImageCacheBuster implements ping-pong filename strategy (image.png ↔ image-cache-bust.png)
- Workspace triggers 'file-modified' event after binary modifications for view updates

## [0.2.85] - 2025-01-17

### Fixed
- **Module Configuration**: Fixed nested module configuration (e.g., `learning.enabled`) not saving to data.json
- Module enable/disable toggles now properly update and persist configuration

### Changed
- **Settings UI Simplification**: Removed collapsible sections from processor configuration modal
- Configuration modal now uses simple section headers for better clarity
- All module settings are always visible (no collapse/expand behavior)

### Improved
- Better configuration persistence - nested config properties are now handled correctly
- Cleaner configuration UI with straightforward section headers
- Deep copy of config ensures proper handling of nested objects

### Technical
- Added `getNestedValue()` and `setNestedValue()` helper methods for dot-notation path handling
- Fixed shallow copy issue in ProcessorConfigModal that prevented nested config updates
- Added version field to package.json for automatic version bumping

## [0.2.82] - 2025-01-17

### Changed
- **Settings Reorganization**: Moved "Download source files" setting from global settings to Learning module configuration
- Source file download option is now specific to the Learning module, where it applies

### Improved
- Better configuration organization - module-specific settings are now grouped with their respective modules
- Clearer settings UI - users configure source file downloads where they configure other Learning module settings

## [0.2.81] - 2025-10-17

### Changed
- **Architecture Refactoring**: Removed all processor-specific code from main.ts
- Processor filtering and routing logic moved to processor implementations via lifecycle hooks
- Main plugin orchestrator is now processor-agnostic and follows clean architecture principles

### Added
- `shouldSkipFile()` optional hook in FileProcessor interface for early filtering optimization
- `canHandleFile()` optional hook in FileProcessor interface for path-based file routing
- `findProcessorForFile()` helper method in ProcessorRegistry for unified processor detection
- ViwoodsProcessor now implements both hooks to handle its own filtering logic

### Removed
- Hardcoded Viwoods-specific code from main.ts (~40 lines)
- `shouldSkipViwoodsModule()` method that contained processor-specific logic
- Template folder filtering checks in main sync loop
- Manual Viwoods path detection and routing logic

### Improved
- Better separation of concerns - processors control their own behavior
- More extensible architecture - new processors can implement custom filtering/routing
- Easier to test - processor logic isolated and testable independently
- Cleaner codebase - main.ts only orchestrates file sync without processor knowledge
- Maintains early filtering optimization for performance

### Technical
- FileProcessor interface extended with optional lifecycle hooks (backward compatible)
- ViwoodsProcessor handles template folder filtering (`/image template/`, `/pdf template/`)
- ViwoodsProcessor handles module folder filtering based on enabled/disabled modules
- ProcessorRegistry provides unified API for processor detection via extension or path

## [0.2.80] - 2025-10-17

### Changed
- **Performance Optimization**: Viwoods module filtering now happens before file download instead of after
- Module filtering moved to occur immediately after fetching file list from Dropbox
- Removed duplicate module checks that occurred after file download

### Added
- `shouldSkipViwoodsModule()` helper method for centralized module filtering logic
- Enhanced logging to show how many files were filtered by module settings
- Log file support in log-server.js for easier debugging (writes to `log.txt`)
- `npm run install-plugin` script for streamlined development workflow

### Improved
- Eliminates unnecessary Dropbox API calls for files in disabled module folders
- Reduces memory usage and CPU time during sync operations
- Faster sync times, especially noticeable when many files exist in disabled modules
- Clearer feedback in logs about filtering activity with early-exit messages

### Technical
- Early-exit optimization prevents processing of files that will be skipped
- Moved file processing check to occur before download to avoid unnecessary work
- Updated CLAUDE.md with plugin installation instructions and debugging notes

## [0.2.61] - 2025-10-15

### Added
- Jest testing framework with TypeScript support
- Comprehensive test suite with 115 tests covering core functionality:
  - FileUtils tests (path manipulation, sanitization, slugification)
  - Crypto tests (PKCE OAuth flow)
  - TemplateEngine tests (variable replacement, date formatting, markdown escaping)
  - ProcessorRegistry tests (processor registration and management)
  - ViwoodsProcessor tests (configuration validation, schema structure)
  - Dropbox API response conversion tests
- Test scripts: `npm test`, `npm run test:watch`, `npm run test:coverage`
- Obsidian API mocks for testing

### Technical
- All tests pass TypeScript compilation and ESLint checks
- Tests focus on pure functions and configuration logic
- Proper test isolation with mocking support

## [0.2.60] - 2025-10-15

### Added
- "Clear processed files tracking" button in settings with confirmation dialog
- File existence checks before writing resource files (images, EPUBs)
- Preservation logging for images and EPUBs

### Changed
- Composite images (PNG) are now preserved if they exist (not overwritten)
- Extracted EPUB files are now preserved if they exist (not overwritten)
- Clear tracking button shows detailed description about preservation behavior

### Improved
- User modifications to any output file (markdown, images, EPUBs) are now preserved during re-fetch
- Only missing output files are regenerated during reprocessing
- Better transparency with logging for preserved vs created files

## [0.2.59] - 2025-10-15

### Fixed
- All TypeScript compilation errors (37 problems → 0: 5 errors + 32 warnings)
- Removed all `any` types from the codebase
- Type assertion for Dropbox response handling
- ProcessorConfigModal defaultValue type handling

### Changed
- Replaced all `any` types with proper TypeScript types (`unknown`, specific types, or error handling)
- Added ESLint suppression comments with safety explanations for intentional non-null assertions
- Improved type safety throughout the codebase

### Technical
- All non-null assertions are now safe and documented
- Fixed type conversion using `unknown` intermediate type
- Enhanced type guards and error handling

## [0.2.55] - 2025-01-12

### Fixed
- ViwoodsProcessor now handles .note files with annotations but no highlights
- Book metadata extraction uses three-tier fallback: highlights → BookBean.json → ReadNoteBean.json
- Annotations can be processed even when highlights are absent

### Changed
- Highlights processing is now conditional - only runs when highlights exist
- Improved error messages to indicate when no book metadata is available from any source

## [0.2.54] - 2025-01-12

### Added
- Status bar progress indicator that persists throughout entire fetch operation
- File count progress display (e.g., "⏳ Fetching... 5/10 files")

### Changed
- All popup notices replaced with status bar notifications for cleaner UX
- Updated all "sync/synchronize" terminology to "fetch" throughout codebase
- Changed ribbon icon from "sync" to "download" icon
- Status bar shows completion summary for 10 seconds before clearing
- Error messages display in status bar for 8-10 seconds

### Improved
- Better visibility of fetch progress - users can always see if fetching is ongoing
- Cleaner user experience with no intrusive popups

## [0.2.52] - 2025-01-11

### Added
- Configuration option to enable/disable source file downloads (default: enabled)
- BookPath extraction from BookBean.json for EPUB notes
- File protocol links (file://) to original book locations when source downloads disabled
- Link text shows file extension (epub, pdf, etc.) for external file links

### Changed
- Moved Dropbox Client ID and Authentication settings to top of General Settings
- Simplified "Download source files" setting description
- Source info now shows clickable file:// links instead of broken links when downloads disabled
- Settings UI reorganized for better user experience

### Improved
- Sync speed can be 20-50% faster when source file downloads disabled
- Better source information display for disabled source downloads
- Enhanced logging for file creation tracking

## [0.2.39] - 2025-01-10

### Added
- Annotation support for Viwoods .note files
- Composite image generation from JPG page backgrounds + PNG handwriting overlays
- Canvas API-based image composition for transparent annotation rendering
- Markdown file generation per annotation with embedded images
- Annotation summary extraction and formatting as blockquotes
- Default annotation images folder at `Viwoods/Annotations/resources`

### Changed
- Use accurate book names from PageTextAnnotation for annotations
- Format annotation summaries with blockquote prefix for consistency with highlights
- Updated ViwoodsProcessor default config to enable annotation processing

### Fixed
- Template conditional syntax not supported - replaced with dynamic content insertion
- Annotation images now correctly saved to resources subfolder by default

## [0.2.35] - 2025-01-10

### Added
- Streaming ZIP extraction using zip.js for memory-efficient processing
- TempFileManager utility for temporary file handling
- StreamingZipUtils for processing ZIP files without loading entire archive into memory

### Changed
- Replaced JSZip with zip.js in ViwoodsProcessor for better memory efficiency
- Configured zip.js to use JavaScript decompression fallback (Android compatibility)
- Updated plugin to handle large .note files (35+ MB) on Android without crashes

### Fixed
- Android crash when processing large Viwoods .note files
- "Unsupported compression format: 'deflate-raw'" error on Android by disabling native DecompressionStream API

## [0.2.32] - 2025-01-09

### Fixed
- Android chunked download failure (400 status) by explicitly setting Content-Type header to "application/octet-stream"

## [0.2.31] - 2025-01-09

### Added
- HTTP Range request support for chunked file downloads
- Mobile file size protection (10 MB default limit on mobile platforms)

## [0.2.1] - 2025-01-08

### Added
- Full cross-platform support (Desktop, iOS, and Android)
- Modular file processor system
- Viwoods Notes processor for .note files
- Template engine for customizable output
- Configurable sync settings

### Changed
- Improved settings UI with processor-specific configuration
- Enhanced error handling and logging

## [0.1.0] - 2024-12-15

### Added
- Initial release
- Basic Dropbox sync functionality
- OAuth 2.0 authentication with PKCE
- Folder mapping configuration
- Manual and automatic sync options
