# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is an Obsidian plugin that fetches and processes files from Dropbox folders to the Obsidian vault. Users configure folder mappings (remote Dropbox path → local vault path) in the settings, and the plugin automatically downloads files on startup and via manual fetch.

## Build and Development Commands

- **Development with watch mode**: `npm run dev`
- **Production build**: `npm run build` (cleans, type checks, builds with esbuild, auto-bumps version, copies assets)
- **Install plugin to vault**: `npm run install-plugin` (copies built files to Obsidian plugin folder)
- **Type checking**: `npx tsc -noEmit -skipLibCheck`
- **Linting**: `npm run lint`
- **Clean build artifacts**: `npm run clean`

The build uses esbuild with configuration in `esbuild.config.mjs`. Output goes to `dist/` directory.

### Installing the Plugin to Obsidian

After building (`npm run build`), install the plugin to your vault:

```bash
npm run install-plugin
```

Then reload Obsidian or use the "Reload app without saving" command (Ctrl/Cmd + R) to load the new version.

## Architecture

### Core Plugin Flow

1. **On plugin load** (`onload` method):
   - Loads settings from disk
   - Initializes status bar item for progress display
   - Adds settings tab to Obsidian settings
   - Adds ribbon icon (download button)
   - Adds command palette command for manual fetch
   - Schedules initial fetch (3 second delay) if folder mappings are configured

2. **Fetch process** (`syncFiles` method - note: method name kept for backward compatibility):
   - Checks if fetch is already in progress (prevents concurrent fetches)
   - Validates that folder mappings exist
   - Updates status bar with "⏳ Fetching from Dropbox..."
   - Gets Dropbox client with fresh access token
   - For each folder mapping:
     - Fetches all files recursively from Dropbox folder (`getAllFiles`)
     - Filters to only file entries (not folders)
     - Creates local folder structure
     - Downloads each file from Dropbox
     - Updates status bar with progress: "⏳ Fetching... X/Y files"
     - Writes to vault using Obsidian Vault API
     - Skips files that already exist with same size (optimization)
   - Shows completion summary in status bar for 10 seconds

### Status Bar Progress

- **Persistent visibility** - Status bar shows fetch progress throughout entire operation
- **Progress updates** - Displays current file count (e.g., "⏳ Fetching... 5/10 files")
- **Completion summary** - Shows results for 10 seconds before clearing
- **Error handling** - Error messages displayed in status bar for 8-10 seconds
- **No popups** - All notifications use status bar instead of intrusive popups

### Dropbox Authentication

- Uses OAuth 2.0 with PKCE (Proof Key for Code Exchange)
- Stores `clientId`, `accessToken`, `refreshToken`, and `codeVerifier` in settings
- OAuth callback handled via local HTTP server on port 53134 (see `startOAuthServer`)
- Token refresh logic in `getDropboxClient` automatically obtains new access tokens using the refresh token

### Key Design Patterns

- **Pure functions** for creating fetch-compatible responses (see `createFetchResponse`)
- **Obsidian's requestUrl wrapper** used instead of native fetch to handle CORS/network restrictions (see `obsidianFetch`)
- **Pagination support** when fetching large folders via `getAllFiles` using Dropbox API cursors
- **Fetch flag** (`isSyncing`) prevents concurrent fetch operations
- **File size comparison** to skip re-downloading unchanged files
- **Status bar integration** for persistent user feedback

### File Structure

- `main.ts` - Single-file plugin containing all logic (Plugin class, Settings tab, OAuth handling, fetch logic)
- `esbuild.config.mjs` - Build configuration that bundles to `dist/main.js`
- `auto-version-bump.mjs` - Automatic version bumping during build
- `version-bump.mjs` - Manual version bump script

### Folder Mappings

Interface: `{ remotePath: string, localPath: string }[]`

- **Remote paths** must start with `/` (Dropbox convention)
- **Local paths** are relative to vault root, without leading `/`
- Example: `/Documents/Notes` → `ImportedNotes` creates files in `vault/ImportedNotes/`

### Settings UI

The settings tab includes:
1. **Dropbox Client ID** - Text input for Dropbox app key
2. **Authenticate button** - Triggers OAuth flow
3. **Authentication status** - Shows if connected, with clear auth button
4. **Folder mappings list** - Shows existing mappings with delete buttons
5. **Add new mapping** - Two text inputs (remote + local) with add button
6. **Fetch now button** - Manual trigger for fetch

### File Fetch Details

- Uses `filesListFolder` with `recursive: true` to get all files in a folder tree
- Uses `filesDownload` to get file content as Blob
- Converts Blob to ArrayBuffer to Uint8Array for Vault API
- Uses `vault.createBinary()` for new files, `vault.adapter.writeBinary()` for existing files
- Creates parent directories automatically using `vault.createFolder()`
- Path mapping: removes remote path prefix, prepends local path

### OAuth Flow

1. User clicks "Authenticate" button
2. Generate PKCE code verifier and challenge
3. Open browser to Dropbox authorization URL
4. Start local HTTP server on port 53134
5. User authorizes app in browser
6. Dropbox redirects to `http://localhost:53134/callback?code=...`
7. Exchange authorization code for access + refresh tokens
8. Store tokens in settings
9. Close HTTP server
10. Update UI to show authenticated status
- on this pc the vault is in /Users/jeroendezwart/2th Brain
- when pushing to github always update readme and changelog
- remember to run the tests before to build a new version and fix issues if needed
- typescript checking and eslinting must always be proceeded before to create a new version or release
- All specifications will go to the specs folder
- When coding Viwoods processors always make sure you have read specs/VIWOODS_SPECIFICATION.md
- data.json is the plugin configuration file in the plugin folder
- log.txt in the root of the project can be analysed for debugging purposes
- never push a release to github without have updated the changelog and readme
- when i say i want to test the changes, first commit, build and install the plugin
- never use the any type in typescript
- if you need to analyse .note files. They are in the samples folder.
- When debugging an issue, make sure to add extensive verbose logging in usefull places and have them in a seperate commit that can easially reverted as soon as the debugging is over. Those verbose logs can be analysed by inspecting the log.txt. Also check the actual contents of md files generated by the fetching process in the vault to see if they match the expected content.