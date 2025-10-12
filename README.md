# Dropbox Fetcher for Obsidian

This plugin automatically fetches and processes files from your Dropbox folders to your Obsidian vault. Configure folder mappings to keep your vault updated with specific Dropbox directories.

## Features

- **Automatic fetch** on Obsidian startup
- **Manual fetch** via ribbon icon or command palette
- **Multiple folder mappings** (Dropbox folder → Vault folder)
- **Recursive folder fetching** with subdirectories
- **Smart file processing** - Extract and transform different file types
- **viwoods Notes support** - Extract text highlights from EPUB reader .note files
- **Custom templates** - Customize markdown output with Obsidian-style templates
- **Skip unchanged files** (based on file size)
- **Secure OAuth 2.0** authentication with PKCE
- **Privacy-first** - No data sent to third-party servers

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
- Existing files with different sizes are overwritten

### File Processors (New!)

The plugin can intelligently process different file types during fetch:

**viwoods Notes (.note files)**
- Extract text highlights from EPUB reader format
- Extract handwritten annotations with composite images
- Extract EPUB files from .note archives
- Generate organized highlight and annotation markdown files
- Composite JPG page backgrounds with PNG handwriting overlays
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

### Development workflow

1. Clone the repository to your vault's plugins folder:
   ```
   /path/to/vault/.obsidian/plugins/drpbx-fetcher/
   ```
2. Run `npm install`
3. Run `npm run dev` to start the development build with watch mode
4. Make changes to the code
5. Reload Obsidian (Ctrl/Cmd+R) to test your changes

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
- ⚙️ **Source file configuration** - Enable/disable downloading source files (.epub, .note) to save space
- 🚀 **Performance boost** - 20-50% faster fetch on slow devices when source downloads disabled
- 🔗 **BookPath linking** - File:// links to original book locations when sources disabled
- 📝 **Better source info** - Shows file extension links (e.g., `[epub](file://...)`) instead of broken links
- 🎨 **Settings reorganization** - Dropbox authentication moved to top of General Settings
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
