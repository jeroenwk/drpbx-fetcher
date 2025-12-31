# Viwoods Module Templates

This directory contains the default templates for each Viwoods module. Templates use [Templater](https://github.com/SilentVoid13/Templater) syntax (`<% %>`) for dynamic content.

## Template Organization

Each module has its own subdirectory with corresponding template files:

### Learning Module
- **Highlight Template.md** - Template for text highlights from EPUB/PDF reading
- **Annotation Template.md** - Template for handwritten annotations
- **EPUB Annotation Template.md** - Template for EPUB-specific annotations

### Paper Module
- **Note Template.md** - Template for handwritten notes (main note file)
- **Page Template.md** - Template for individual note pages

### Daily Module
- **Daily Template.md** - Template for daily journal entries

### Meeting Module
- **Meeting Template.md** - Template for meeting notes

### Picking Module
- **Picking Template.md** - Template for quick captures

### Memo Module
- **Memo Template.md** - Template for text memos

## How Templates Work

1. **Build Time**: Templates are imported as text strings during the build process using esbuild's text loader (configured in `esbuild.config.mjs`)
2. **Runtime**: The `TemplateDefaults` class provides access to templates via `load()` and `getAll()` methods
3. **Processing**: Each module processor uses templates to generate markdown files with user data

## Editing Templates

You can modify templates directly in these `.md` files. After editing:

1. Run `npm run build` to rebuild the plugin with updated templates
2. Install the updated plugin: `npm run install-plugin`
3. Reload Obsidian to see the changes

## Templater Syntax

Templates support the full Templater syntax:

- `<% tp.user.variableName %>` - Insert variable content
- `<%* if (condition) { %>...<%* } %>` - Conditional blocks
- `<% tp.date.now("YYYY-MM-DD") %>` - Date formatting
- And more (see Templater documentation)

## Available Template Variables

Each module provides specific variables to templates. Check the respective processor file for available variables:

- `LearningProcessor.ts` - Learning module variables
- `PaperProcessor.ts` - Paper module variables
- `DailyProcessor.ts` - Daily module variables
- `MeetingProcessor.ts` - Meeting module variables
- `PickingProcessor.ts` - Picking module variables
- `MemoProcessor.ts` - Memo module variables
