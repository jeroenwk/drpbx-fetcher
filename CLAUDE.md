# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is an Obsidian plugin that syncs files from Dropbox folders to the Obsidian vault. Users configure folder mappings (remote Dropbox path → local vault path) in the settings, and the plugin automatically downloads files on startup and via manual sync.

## Build and Development Commands

- **Development with watch mode**: `npm run dev`
- **Production build**: `npm run build` (cleans, type checks, builds with esbuild, auto-bumps version, copies assets)
- **Type checking**: `tsc -noEmit -skipLibCheck`
- **Linting**: `npm run lint`
- **Clean build artifacts**: `npm run clean`

The build uses esbuild with configuration in `esbuild.config.mjs`. Output goes to `dist/` directory.

## Architecture

### Core Plugin Flow

1. **On plugin load** (`onload` method):
   - Loads settings from disk
   - Adds settings tab to Obsidian settings
   - Adds ribbon icon (sync button)
   - Adds command palette command for manual sync
   - Schedules initial sync (3 second delay) if folder mappings are configured

2. **Sync process** (`syncFiles` method):
   - Checks if sync is already in progress (prevents concurrent syncs)
   - Validates that folder mappings exist
   - Gets Dropbox client with fresh access token
   - For each folder mapping:
     - Fetches all files recursively from Dropbox folder (`getAllFiles`)
     - Filters to only file entries (not folders)
     - Creates local folder structure
     - Downloads each file from Dropbox
     - Writes to vault using Obsidian Vault API
     - Skips files that already exist with same size (optimization)
   - Shows notice with sync results

### Dropbox Authentication

- Uses OAuth 2.0 with PKCE (Proof Key for Code Exchange)
- Stores `clientId`, `accessToken`, `refreshToken`, and `codeVerifier` in settings
- OAuth callback handled via local HTTP server on port 53134 (see `startOAuthServer`)
- Token refresh logic in `getDropboxClient` automatically obtains new access tokens using the refresh token

### Key Design Patterns

- **Pure functions** for creating fetch-compatible responses (see `createFetchResponse`)
- **Obsidian's requestUrl wrapper** used instead of native fetch to handle CORS/network restrictions (see `obsidianFetch`)
- **Pagination support** when fetching large folders via `getAllFiles` using Dropbox API cursors
- **Sync flag** (`isSyncing`) prevents concurrent sync operations
- **File size comparison** to skip re-downloading unchanged files

### File Structure

- `main.ts` - Single-file plugin containing all logic (Plugin class, Settings tab, OAuth handling, sync logic)
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
6. **Sync now button** - Manual trigger for sync

### File Sync Details

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
