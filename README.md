# Dropbox Fetcher for Obsidian

This plugin automatically fetches and processes files from your Dropbox folders to your Obsidian vault. Configure folder mappings to keep your vault updated with specific Dropbox directories.

## Features

- **Automatic fetch** on Obsidian startup
- **Manual fetch** via ribbon icon or command palette
- **Multiple folder mappings** (Dropbox folder → Vault folder)
- **Recursive folder fetching** with subdirectories
- **Smart file processing** - Extract and transform different file types
- **🎉 Complete Viwoods Memo Support** - Full processing of Viwoods Memo notes with todo integration
- **📝 Viwoods Paper Notes** - Extract handwritten content with smart rename detection
- **📚 Viwoods Learning Notes** - Process reading notes with annotations
- **🤝 Viwoods Meeting Notes** - Extract meeting content with screenshots and smart rename detection
- **📋 Viwoods Daily Notes** - Process daily entries with date organization
- **🎯 Viwoods Picking Notes** - Extract captured screenshots and content
- **🔄 Automatic rename detection** - Tracks renamed notes and updates markdown files automatically
- **🆔 Smart identity tracking** - Uses internal note IDs to preserve user content across renames
- **🖼️ Smart image management** - Cache-busting, automatic cleanup, and rename handling
- **📋 Custom templates** - Customize markdown output with Templater-compatible templates
- **🎨 Template Export** - Export default templates to your vault for easy customization
- **⏭️ Skip unchanged files** (based on file size)
- **🔐 Secure OAuth 2.0** authentication with PKCE
- **🛡️ Privacy-first** - No data sent to third-party servers

## 🎉 New in v0.2.223: Template System Overhaul

### 🎨 Templater Integration
The latest update brings a complete template system redesign with Templater support:

- **Templater Syntax**: All templates now use Templater syntax (`<% %>`) for dynamic content
- **Separate Template Files**: Templates extracted to individual `.md` files for easy editing
- **Export Feature**: New "Export Templates" button in Viwoods configuration
- **Smart Folder Detection**: Automatically exports to Templater plugin folder (if installed), Templates core plugin folder, or "Templates" default
- **YAML Frontmatter**: All templates use structured frontmatter for better metadata management
- **7 Active Templates**: Streamlined from 9 to 7 templates (removed unused ones)

### 📝 Available Templates
- **Learning**: Highlight Template, EPUB Annotation Template
- **Paper**: Note Template
- **Daily**: Daily Template
- **Meeting**: Meeting Template
- **Picking**: Picking Template
- **Memo**: Memo Template

### ⚙️ How to Customize Templates
1. Open Viwoods processor configuration (Settings → Dropbox Fetcher → Configure Viwoods)
2. Click "Export Templates" button
3. Templates will be exported to `{your-templates-folder}/Viwoods`
4. Edit the templates using Templater syntax
5. Configure custom template paths in processor settings to use your customized versions

## 🎉 New in v0.2.181: iOS Fixes & Frontmatter Properties

### 🍎 iOS Platform Improvements
The latest update brings better iOS compatibility and enhanced note organization:

- **iOS Download Fix**: Disabled chunked downloads on iOS, using SDK-based downloads for better reliability
- **Range Request Fixes**: Resolved HTTP method and header issues for iOS Range requests
- **Better Error Logging**: Enhanced debugging with verbose error logging and response body capture

### 🏷️ Frontmatter Properties Enhancement
- **Obsidian Properties**: All Viwoods modules now include proper frontmatter properties
- **Tag Structure**: Tags moved to frontmatter properties for better Obsidian integration
- **Page Breaks**: Added page breaks between images in Paper notes for improved organization
- **Better Metadata**: Consistent property structure across all modules (Paper, Meeting, Memo, Daily, Picking, Learning)

## 🎉 New in v0.2.130: Complete Memo Module

The latest major update brings full support for Viwoods Memo notes with advanced features:

### ✨ Memo Module Features
- **Todo Integration**: Automatic checkbox generation and completion tracking
- **Reminder Support**: Full Viwoods reminder metadata preservation
- **Smart Images**: White background processing and automatic cleanup
- **Template System**: Customizable memo templates with todo variables
- **Rename Detection**: Automatic detection when memo notes are renamed in Viwoods

### 🔧 Technical Improvements
- **Content Preservation**: MemoMerger class protects user edits during updates
- **Type Safety**: Complete TypeScript interface implementation
- **Code Quality**: Zero ESLint warnings and no `any` types
- **Architecture**: Extended NoteRenameHandler for memo-specific patterns

## Installation

### Manual Installation
1. Download the latest release from the [releases page](https://github.com/jeroenwk/drpbx-fetcher/releases)
2. Extract the files to your vault's `.obsidian/plugins/drpbx-fetcher/` directory
3. Reload Obsidian
4. Enable the plugin in the Community Plugins settings

## Setup

### 1. Create a Dropbox App

1. Go to the [Dropbox App Console](https://www.dropbox.com/developers/apps)
2. Click "Create app"
3. Choose "Scoped access"
4. Choose "Full Dropbox" access
5. Name your app (e.g., "My Obsidian Sync")
6. In the app settings, add redirect URIs:
   - **Desktop**: `http://localhost:53134/callback`
   - **Mobile** (iOS/Android): `obsidian://dropbox-callback`
7. Under "Permissions", enable:
   - `files.metadata.read`
   - `files.content.read`
8. Copy your "App key" (this is your Client ID)

### 2. Configure the Plugin

1. Go to Settings > Dropbox Fetcher
2. Paste your Dropbox app Client ID
3. Click "Authenticate" to connect to Dropbox
4. Complete the OAuth flow in your browser

### 3. Add Folder Mappings

1. In the plugin settings, find the "Folder Mappings" section
2. Enter a remote Dropbox path (e.g., `/Documents/Notes`)
3. Enter a local vault path (e.g., `ImportedNotes`)
4. Click "Add" to save the mapping

**Example mapping:**
- Remote path: `/home/Viwoods-PDF/AiPaper/S3AA2303M02672/Picking`
- Local path: `Picking`

This will fetch all files from the Dropbox folder to `YourVault/Picking/`

## Usage

### Automatic Fetch
The plugin automatically fetches all configured folders when Obsidian starts (with a 3-second delay to allow Obsidian to fully load).

### Manual Fetch
- **Ribbon Icon**: Click the download icon in the left sidebar
- **Command Palette**: Use the "Fetch Dropbox files" command (Ctrl/Cmd+P)
- **Settings**: Click the "Fetch" button in the plugin settings

### Fetch Behavior
- Files are downloaded from Dropbox and processed based on file type
- File processors can extract content and generate markdown files
- Subdirectories are created automatically
- Files with the same size are skipped (assumed to be up-to-date)
- **User modifications are preserved** - The plugin will NOT overwrite modified output files (markdown, images, EPUBs) during re-fetch
- **Clear tracking option** - Settings include a button to clear processed files tracking, allowing re-fetch of deleted files

### File Processors (New!)

The plugin can intelligently process different file types during fetch:

**viwoods Notes (.note files)**
- Extract text highlights from EPUB reader format
- Extract handwritten annotations with composite images
- Extract EPUB files from .note archives
- Generate organized highlight and annotation markdown files
- Composite JPG page backgrounds with PNG handwriting overlays
- **Automatic rename detection** - Renamed notes are tracked and updated automatically
- **Smart image updates** - Images update correctly even after multiple renames
- Use custom templates for output formatting
- **[Quick Start Guide](docs/viwoods-setup.md)**

**Coming Soon**
- PDF annotation extraction
- EPUB highlights processing
- Image metadata extraction
- And more...

**[📖 Read the File Processors Documentation](docs/FILE-PROCESSORS.md)**

## Development

### Building the plugin

```bash
# Clone this repository
git clone https://github.com/jeroendezwart/drpbx-fetcher.git
cd drpbx-fetcher

# Install dependencies
npm install

# Build for development (with watch mode)
npm run dev

# Build for production
npm run build
```

The compiled plugin will be in the `dist` directory.

### Testing

The plugin includes comprehensive test coverage:

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage report
npm run test:coverage
```

**Test Suite (115 tests)**
- FileUtils: Path manipulation, sanitization, slugification
- Crypto: PKCE OAuth flow
- TemplateEngine: Variable replacement, date formatting, markdown escaping
- ProcessorRegistry: Processor registration and management
- ViwoodsProcessor: Configuration validation, schema structure
- Dropbox API: Response conversion

### Development workflow

1. Clone the repository to your vault's plugins folder:
   ```
   /path/to/vault/.obsidian/plugins/drpbx-fetcher/
   ```
2. Run `npm install`
3. Run `npm run dev` to start the development build with watch mode
4. Make changes to the code
5. Run `npm test` to verify tests pass
6. Run `npx tsc -noEmit -skipLibCheck` to check TypeScript
7. Run `npm run lint` to check ESLint
8. Reload Obsidian (Ctrl/Cmd+R) to test your changes

### Log Server for Debugging

The plugin includes a development log server that receives and displays logs from the plugin in real-time:

```bash
# Start log server (shows all log levels)
npm run log-server

# Show only errors
npm run log-server:errors

# Show warnings and errors
npm run log-server:warnings

# Custom port
npm run log-server:dev

# Using direct node command (all levels)
node log-server.js

# Direct command with custom options
node log-server.js --level error
node log-server.js --port 3001 --level warn
```

**Important**: When passing arguments through npm scripts, you must use `--` to separate npm arguments from script arguments:

```bash
# ❌ Wrong - npm receives the arguments, not the script
npm run log-server --level error

# ✅ Correct - arguments passed to the script
npm run log-server -- --level error

# ✅ Or use pre-configured scripts
npm run log-server:errors
```

The log server:
- Displays colored, formatted logs in the terminal
- Filters logs by level (debug, info, warn, error)
- Saves all logs to `log.txt` in the project root
- Shows timestamps and metadata for each log entry
- Supports remote access for mobile device debugging

## Mobile Support (iOS/Android)

**✅ This plugin now supports mobile devices!**

### Mobile Setup

1. Install the plugin on your mobile device
2. Make sure you've added `obsidian://dropbox-callback` as a redirect URI in your Dropbox app settings (see Setup step 1.6)
3. In plugin settings, enter your Client ID
4. Tap "Authenticate"
5. You'll be redirected to Dropbox in your external browser (Safari/Chrome)
6. After authorizing, you'll automatically return to Obsidian
7. Configure your folder mappings and fetch!

### Mobile Considerations

- **OAuth Flow**: Opens your default browser for authentication
- **Large Files**: May take longer to download on mobile networks
- **Background Fetch**: Not supported on mobile - use manual fetch
- **Auto-fetch**: Works on app startup (after 3-second delay)

### Platform Differences

The plugin automatically detects your platform and adapts:
- **Desktop**: Uses localhost OAuth server
- **Mobile**: Uses custom URI scheme (`obsidian://dropbox-callback`)
- Settings UI shows platform-specific instructions

## Security and Privacy

- This plugin uses OAuth 2.0 with PKCE for secure authentication
- Your access token and refresh token are stored locally in Obsidian's settings
- The plugin only accesses folders you explicitly configure
- No data is sent to third-party servers (except Dropbox API)
- All file downloads are direct from Dropbox to your local vault

## Troubleshooting

### "Port 53134 is already in use"
This means another process is using the OAuth callback port. Wait a few moments and try authenticating again.

### "No valid Dropbox access token"
Click "Authenticate" in the plugin settings to reconnect to Dropbox.

### Files not fetching
1. Check that your folder mappings are correct
2. Verify your Dropbox app has the correct permissions
3. Check the console (Ctrl/Cmd+Shift+I) for error messages
4. Try manually fetching from the settings page

## Support

If you encounter any issues or have feature requests:

1. Check the [GitHub Issues](https://github.com/jeroenwk/drpbx-fetcher/issues) page
2. Create a new issue if your problem hasn't been reported
3. Include your Obsidian version and operating system details

## Changelog

### 0.2.160 - 2025-10-23
- 🎨 **Daily Note Template Improvements** - Separate Related Notes and Tasks & Notes sections
- ✨ **User Content Preservation** - Custom tasks and notes preserved during re-fetch
- 🐛 **Fixed Metadata Bug** - Meeting/Memo notes now save to correct metadata files
- 🔄 **Smart Image Updates** - Images update while preserving user content
- 🏷️ **Note Type Prefixes** - Related notes show type (Paper, Memo, Meeting, etc.)
- 🧹 **Clean Formatting** - Removed blank line accumulation and improved spacing

### 0.2.117 - 2025-10-21
- 🔗 **Improved source links** - Learning module source field now shows book name as link title instead of generic text
- 🏷️ **Updated hashtags** - Changed from `#book/title` to `#book #title` format for better tag organization
- 🧹 **Removed page tags** - Cleaned up annotation files by removing `#page/xxx` hashtags

### 0.2.116 - 2025-10-20
- 🐛 **Fixed metadata tracking** - YAML parser now correctly handles all Paper note metadata across save/load cycles
- ⏱️ **Updated timestamps** - Modified dates and Total Pages counts now update correctly in note headers
- 💾 **Separate metadata file** - Paper note metadata moved from data.json to vault-based markdown file with YAML frontmatter
- 🔒 **Reliable preservation** - All user notes and edits preserved while metadata stays accurate
- 📝 **Better visibility** - Metadata file stored in vault (`viwoodsNoteMetadata.md`) for easier backup and inspection

### 0.2.104 - 2025-10-20
- 🐛 **Fixed user notes preservation** - User-edited notes in Paper markdown files no longer lost during image updates
- 💾 **Centralized metadata** - Moved Paper note metadata to plugin settings for more reliable storage
- 🔄 **Simplified merge strategy** - Always merge existing files to preserve user edits
- 🧹 **Cleaner production code** - Removed verbose debug logging

### 0.2.81 - 2025-10-17
- 🏗️ **Architecture Refactoring** - Removed all processor-specific code from main.ts
- 🔌 **Extensible Design** - Processors now control their own filtering and routing via lifecycle hooks
- ✨ **New Hooks** - `shouldSkipFile()` and `canHandleFile()` optional hooks for processors
- 🧹 **Cleaner Code** - Main plugin orchestrator is now processor-agnostic (~40 lines removed)
- 🧪 **Better Testing** - Processor logic isolated and testable independently
- 🔧 **Backward Compatible** - All hooks are optional, existing processors work unchanged

### 0.2.80 - 2025-10-17
- 🚀 **Performance optimization** - Viwoods module filtering now happens before file download, not after
- ⚡ **Faster syncs** - Eliminates unnecessary Dropbox API calls for disabled module files
- 💾 **Reduced memory usage** - Files from disabled modules never downloaded or processed
- 📊 **Better logging** - Shows exactly how many files were filtered and why
- 🛠️ **Dev improvements** - Added log file support (`log.txt`) and `npm run install-plugin` script

### 0.2.61 - 2025-10-15
- 🧪 **Comprehensive test suite** - Added Jest testing framework with 115 tests covering core functionality
- ✅ **Quality assurance** - All tests pass TypeScript compilation and ESLint checks
- 📦 **Test utilities** - Obsidian API mocks and test isolation support
- 📝 **Test scripts** - `npm test`, `npm run test:watch`, `npm run test:coverage`

### 0.2.60 - 2025-10-15
- 🛡️ **Resource file preservation** - User-modified images and EPUB files are no longer overwritten during re-fetch
- 🔄 **Clear tracking button** - New settings option to reset processed files tracking for re-fetching deleted files
- 📝 **Better preservation logging** - Transparent logs show which files are preserved vs re-created
- ⚡ **Smart re-processing** - Only missing output files are regenerated, preserving all user customizations

### 0.2.59 - 2025-10-15
- 🐛 **Fixed all TypeScript errors** - Resolved 37 problems (5 errors + 32 warnings → 0)
- 🔒 **Type safety improvements** - Removed all `any` types, replaced with proper TypeScript types
- 📝 **Better code documentation** - Added explanatory comments for all intentional type assertions
- ✨ **Enhanced error handling** - Improved type guards and error type handling throughout

### 0.2.55 - 2025-01-12
- 🐛 **Fixed annotations without highlights** - Viwoods .note files with only annotations now process correctly
- 📖 **Smart metadata fallback** - Three-tier book metadata extraction: highlights → BookBean.json → ReadNoteBean.json
- ✨ **Conditional highlights processing** - Highlights only processed when present, annotations always attempted

### 0.2.54 - 2025-01-12
- 📊 **Status bar progress** - Persistent status bar indicator shows fetch progress throughout entire operation
- 🎯 **No more popups** - All notifications moved to status bar for cleaner UX
- 📝 **Fetch terminology** - Updated all "sync" references to "fetch" for clarity
- ⬇️ **Download icon** - Changed ribbon icon from sync to download

### 0.2.52 - 2025-01-11
- ⚙️ **Source file configuration** - Enable/disable downloading source files (.epub, .note) per module to save space
- 🚀 **Performance boost** - 20-50% faster fetch on slow devices when source downloads disabled
- 🔗 **BookPath linking** - File:// links to original book locations when sources disabled
- 📝 **Better source info** - Shows file extension links (e.g., `[epub](file://...)`) instead of broken links
- 🎨 **Settings reorganization** - Module-specific settings grouped with their respective modules
- 📊 **Enhanced logging** - Better tracking of file creation and processing

### 0.2.39 - 2025-01-10
- ✨ **Annotation support** - Extract handwritten notes from Viwoods .note files
- 🖼️ **Composite images** - Combine JPG page backgrounds with PNG handwriting overlays
- 📝 **Annotation markdown** - Generate one file per annotation with embedded images
- 🎯 **Accurate book names** - Use PageTextAnnotation data for better metadata
- 📁 **Organized structure** - Default annotation images in `Viwoods/Annotations/resources`

### 0.2.35 - 2025-01-10
- 🎉 **Android Large File Support** - Process large .note files (35+ MB) without crashes
- 🚀 **Streaming ZIP extraction** - Memory-efficient ZIP processing using zip.js
- 🔧 **Android compatibility** - JavaScript decompression fallback for platforms without native support
- 🐛 **Fixed DecompressionStream error** - "Unsupported compression format: 'deflate-raw'" on Android
- 🛠️ **TempFileManager utility** - Infrastructure for future chunked download features

### 0.2.32 - 2025-01-09
- 🐛 **Fixed Android chunked downloads** - Resolved 400 status error with explicit Content-Type header

### 0.2.31 - 2025-01-09
- 🔄 **HTTP Range requests** - Chunked file downloads for better performance
- 📱 **Mobile file size protection** - 10 MB default limit on mobile platforms

### 0.2.6
- ✨ **File Processors** - Intelligent file type processing system
- 📝 **viwoods Notes support** - Extract text highlights from EPUB reader .note files
- 📚 **EPUB extraction** - Automatically extract EPUB files from .note archives
- 🎨 **Custom templates** - Use Obsidian-style templates for output formatting
- 🔧 **Modular architecture** - Extensible processor system for future file types
- 📚 **Comprehensive documentation** - Setup guides and API documentation

### 0.2.1
- ✨ **Mobile support** for iOS and Android
- 🔧 Refactored OAuth to support both desktop and mobile platforms
- 📱 Custom URI scheme for mobile authentication (`obsidian://dropbox-callback`)
- 🌐 Platform detection with adaptive UI
- 🔐 Web Crypto API for cross-platform PKCE
- 📊 Platform indicator in settings
- 🐛 Better error handling and user feedback

### 0.1.0
- Initial release
- Basic Dropbox folder fetching
- OAuth 2.0 authentication with PKCE
- Multiple folder mapping support
- Automatic fetch on startup
- Manual fetch via ribbon icon and command

For detailed version history, see [CHANGELOG.md](CHANGELOG.md).

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Acknowledgments

- Thanks to the Obsidian team for their excellent plugin API
- Thanks to Dropbox for their SDK
- Based on the [obsidian-dropbox-photo-grid](https://github.com/alimoeeny/obsidian-dropbox-photo-grid) plugin
