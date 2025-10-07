# Submit Plugin to Obsidian Community Plugins

This guide explains how to submit the Dropbox Fetcher plugin to the official Obsidian Community Plugins directory.

## Prerequisites

Before submitting, ensure you have:

- ✅ Published release v0.2.1 on GitHub with `main.js` and `manifest.json`
- ✅ README.md with setup instructions
- ✅ LICENSE file
- ✅ No obfuscated code, ads, or telemetry (complies with Obsidian developer policies)

## Step-by-Step Submission Process

### 1. Fork the obsidian-releases repository

1. Navigate to https://github.com/obsidianmd/obsidian-releases
2. Click the **"Fork"** button in the top-right corner
3. This creates your own copy at `https://github.com/jeroenwk/obsidian-releases`

### 2. Clone your fork locally

```bash
git clone https://github.com/jeroenwk/obsidian-releases.git
cd obsidian-releases
```

### 3. Edit community-plugins.json

1. Open the file `community-plugins.json`
2. Scroll to the **END** of the array (just before the closing `]`)
3. Add a comma after the last entry, then add this new entry:

```json
{
  "id": "drpbx-fetcher",
  "name": "Dropbox Fetcher",
  "author": "Jeroen de Zwart",
  "description": "Sync files from Dropbox folders to your Obsidian vault",
  "repo": "jeroenwk/drpbx-fetcher"
}
```

**Important:**
- Make sure to add a comma after the previous last entry
- The `id` must match the `id` in your `manifest.json`
- The `repo` format is `username/repository-name` (no full URL)

### 4. Commit and push your changes

```bash
git add community-plugins.json
git commit -m "Add Dropbox Fetcher plugin"
git push origin master
```

### 5. Create a Pull Request

1. Go to your fork on GitHub: https://github.com/jeroenwk/obsidian-releases
2. You should see a banner saying "This branch is 1 commit ahead of obsidianmd:master"
3. Click **"Contribute"** → **"Open pull request"**
4. Fill in the PR details:
   - **Title**: `Add Dropbox Fetcher plugin`
   - **Description**:
     ```markdown
     This PR adds the Dropbox Fetcher plugin to the community plugins directory.

     **Plugin repository:** https://github.com/jeroenwk/drpbx-fetcher
     **Release:** https://github.com/jeroenwk/drpbx-fetcher/releases/tag/v0.2.1

     ### Plugin Description
     Dropbox Fetcher allows users to sync files from Dropbox folders to their Obsidian vault with automatic and manual sync options.

     ### Checklist
     - [x] I have published a release on GitHub with main.js and manifest.json
     - [x] My plugin follows Obsidian developer policies (no obfuscation, ads, or telemetry)
     - [x] I have included a README.md with setup instructions
     - [x] I have included a LICENSE file
     - [x] The plugin supports desktop and mobile platforms (iOS and Android)
     ```
5. Click **"Create pull request"**

### 6. Wait for Review

- The Obsidian team will review your submission
- They may request changes or ask questions via PR comments
- Respond to any feedback promptly
- Once approved and merged, your plugin will appear in the community plugins browser within a few hours

### 7. Announce Your Plugin (Optional)

After your plugin is accepted:
- Share it on the [Obsidian Forum](https://forum.obsidian.md/)
- Announce it in the Obsidian Discord server
- Write a blog post or documentation

## Obsidian Developer Policies

Your plugin must comply with these policies:

### ✅ Allowed
- Open source code
- Local data processing
- Desktop-only plugins
- Using Obsidian's built-in APIs
- Free plugins with optional donations

### ❌ Not Allowed
- Obfuscated code to hide functionality
- Dynamic or static ads outside the plugin interface
- Client-side telemetry without explicit user consent
- Malicious code or security vulnerabilities
- Violating user privacy

## Common Submission Issues

### "Plugin ID already exists"
- Choose a unique ID that's not already in use
- Check `community-plugins.json` to verify

### "Release files missing"
- Ensure your GitHub release includes `main.js` and `manifest.json`
- Tag must match the version in `manifest.json`

### "Invalid manifest.json"
- Verify all required fields are present
- Check JSON syntax is valid

### "Repository not accessible"
- Make sure your repository is public
- Verify the repo URL is correct

## Resources

- [Obsidian Plugin Developer Docs](https://docs.obsidian.md/)
- [Developer Policies](https://docs.obsidian.md/Developer+policies)
- [Plugin Guidelines](https://docs.obsidian.md/Plugins/Releasing/Plugin%20guidelines)
- [Obsidian Releases Repository](https://github.com/obsidianmd/obsidian-releases)
- [Obsidian Forum](https://forum.obsidian.md/)
