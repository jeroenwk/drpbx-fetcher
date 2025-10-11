# Changelog

All notable changes to the Dropbox Fetcher plugin will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
