/**
 * Default templates for viwoods processor
 */
export class TemplateDefaults {
	private static templates: Record<string, string> = {
		// Learning module templates
		"viwoods-highlight.md": `## {{noteTitle}}

**Page:** {{pageNumber}}/{{totalPages}}
**Date:** {{date:YYYY-MM-DD}}
**Source:** [Open Note]({{sourceLink}})

---

![[{{pageImagePath}}]]

### Handwriting Data

Strokes: {{strokeCount}}
Points: {{pointCount}}

### Notes

*Add your thoughts here*

---
#highlight #Viwoods/{{noteSlug}}`,
		"viwoods-annotation.md": `## {{noteTitle}} - Annotation

**Page:** {{pageNumber}}/{{totalPages}}
**Date:** {{date:YYYY-MM-DD}}
**Source:** [Open Note]({{sourceLink}})

---

### Text Content

{{textContent}}

### Notes

*Add your thoughts here*

---
#annotation #Viwoods/{{noteSlug}}`,
		"viwoods-epub-annotation.md": `## {{bookName}}

**Location:** {{location}}
**Page:** {{pageNumber}}/{{totalPages}}
**Date:** {{dateAnnotated}}
**Source:** {{sourceInfo}}

---

![[{{annotationImagePath}}]]

### Notes

*Add your thoughts here*

---
#annotation #book/{{bookSlug}} #page/{{pageNumber}}`,

		// Paper module templates
		"viwoods-paper-note.md": `---
viwoods-file-id: "{{fileId}}"
viwoods-last-modified: {{lastModified}}
viwoods-pages: {{pagesMetadata}}
---

# {{noteName}}

**Created:** {{createTime}}
**Modified:** {{modifiedTime}}
**Total Pages:** {{totalPages}}

---

{{screenshotSections}}
#Viwoods/paper #note/{{noteSlug}}`,
		"viwoods-paper-page.md": `# {{noteName}} - Page {{pageNumber}}

**Created:** {{createTime}}
**Modified:** {{modifiedTime}}
**Page:** {{pageNumber}}/{{totalPages}}
{{#if sourceLink}}**Source:** [{{noteName}}]({{sourceLink}}){{/if}}

---

## Page Content

{{#if pageImagePath}}
![[{{pageImagePath}}]]
{{/if}}

{{#if screenshotPath}}
### Screenshot
![[{{screenshotPath}}]]
{{/if}}

{{#if hasHandwriting}}
### Handwriting
This page contains {{strokeCount}} handwriting strokes.
{{/if}}

### Notes

*Add your notes here*

---
#Viwoods/paper #note/{{noteSlug}} #page/{{pageNumber}}`,

		// Daily module templates (stub)
		"viwoods-daily-note.md": `# {{date}}

**Created:** {{createTime}}
{{#if lastTab}}**Last Active Tab:** {{lastTab}}{{/if}}

---

## Journal

*Your daily journal entry*

{{#if pageImagePath}}
![[{{pageImagePath}}]]
{{/if}}

## Tasks

{{#if taskData}}
{{taskData}}
{{else}}
*No tasks for today*
{{/if}}

---
#daily-note #Viwoods/daily`,

		// Meeting module templates (stub)
		"viwoods-meeting-note.md": `# {{noteName}}

**Created:** {{createTime}}
**Modified:** {{modifiedTime}}
{{#if sourceLink}}**Source:** [Original Note]({{sourceLink}}){{/if}}

---

## Attendees

*Add attendees here*

## Agenda

*Add agenda items here*

## Notes

{{#if pageImagePath}}
![[{{pageImagePath}}]]
{{/if}}

*Add meeting notes here*

## Action Items

- [ ] *Add action items here*

---
#Viwoods/meeting #meeting/{{noteSlug}}`,

		// Picking module templates
		"viwoods-picking-capture.md": `# {{noteName}}

**Captured:** {{createTime}}
**Type:** Quick Capture
**Total Items:** {{totalPages}}

---

{{screenshotSections}}

---
#Viwoods/picking #capture/{{noteSlug}}`,

		// Memo module templates (stub)
		"viwoods-memo.md": `# {{memoTitle}}

**Created:** {{createTime}}

---

{{memoContent}}

---
#Viwoods/memo #memo/{{noteSlug}}`,

		// Legacy template (deprecated)
		"viwoods-page.md": `# {{noteTitle}} - Page {{pageNumber}}

**Created:** {{createTime}}
**Page:** {{pageNumber}}/{{totalPages}}
**Source:** [{{noteName}}]({{sourceLink}})

---

## Page Content

![[{{pageImagePath}}]]

### Notes

*Add your notes here*

---

#Viwoods/{{noteSlug}} #page-{{pageNumber}}`,
	};

	public static load(name: string): Promise<string> {
		return Promise.resolve(this.templates[name] || "");
	}

	public static getAll(): Record<string, string> {
		return { ...this.templates };
	}
}
