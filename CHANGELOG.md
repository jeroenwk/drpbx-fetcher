# Changelog

All notable changes to the Dropbox Fetcher plugin will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
