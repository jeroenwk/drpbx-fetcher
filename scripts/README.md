# Scripts

This directory contains utility scripts for development and testing.

## test-reset.sh

A comprehensive testing cleanup script that resets the plugin to a fresh state for testing purposes.

### What it does:

1. **Kills Obsidian** - Closes the Obsidian application
2. **Clears tracked files** - Empties the `processedFiles` object in `data.json`
3. **Deletes Viwoods Attachments folder** - Removes `Attachments/Viwoods` from the vault
4. **Deletes module folders** - Removes all enabled Viwoods module output folders:
   - `Viwoods/Paper`
   - `Viwoods/Daily`
   - `Viwoods/Meeting`
   - `Viwoods/Learning`
   - `Viwoods/Picking`
   - `Viwoods/Memo`
5. **Restarts Obsidian** - Opens Obsidian again

### Usage:

```bash
npm run test:reset
```

### Why use this?

When testing the Viwoods processor or any file fetching functionality, you often want to start from a clean slate without any previously processed files. This script automates all the cleanup steps so you can quickly reset to test the full fetch-and-process flow.

### Requirements:

- `jq` command-line JSON processor must be installed
- Vault path is hardcoded to `/Users/jeroendezwart/2th Brain`
- Obsidian must be installed in `/Applications/Obsidian.app`
