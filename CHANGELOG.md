# Changelog

All notable changes to the Dropbox Fetcher plugin will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
