/**
 * Default templates for viwoods processor
 */
export class TemplateDefaults {
	private static templates: Record<string, string> = {
		// Learning module templates
		"viwoods-highlight.md": `---
created: {{date:YYYY-MM-DD}}
page: {{pageNumber}}/{{totalPages}}
source: "{{noteTitle}}"
tags:
  - highlight
  - Viwoods/{{noteSlug}}
  - {{date}}
---

## {{noteTitle}}

**Source:** [Open Note]({{sourceLink}})

![[{{pageImagePath}}]]

### Handwriting Data

Strokes: {{strokeCount}}
Points: {{pointCount}}

### Notes

*Add your thoughts here*`,
		"viwoods-annotation.md": `---
created: {{date:YYYY-MM-DD}}
page: {{pageNumber}}/{{totalPages}}
source: "{{noteTitle}}"
tags:
  - annotation
  - Viwoods/{{noteSlug}}
  - {{date}}
---

## {{noteTitle}} - Annotation

**Source:** [Open Note]({{sourceLink}})

### Text Content

{{textContent}}

### Notes

*Add your thoughts here*`,
		"viwoods-epub-annotation.md": `---
created: {{dateAnnotated}}
location: "{{location}}"
page: {{pageNumber}}/{{totalPages}}
source: "{{bookName}}"
tags:
  - annotation
  - book
  - {{bookSlug}}
  - {{date}}
---

## {{bookName}}

**Source:** {{sourceInfo}}

![[{{annotationImagePath}}]]

### Notes

*Add your thoughts here*`,

		// Paper module templates
		"viwoods-paper-note.md": `---
created: {{createTime}}
modified: {{modifiedTime}}
total_pages: {{totalPages}}
tags:
  - scribbling
  - {{date}}
---

{{screenshotSections}}`,
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

		// Daily module templates
		"viwoods-daily-note.md": `---
created: {{createTime}}
modified: {{modifiedTime}}
tags:
  - daily-note
  - {{date}}
---

## Related Notes

{{relatedNotesContent}}

## Tasks & Notes

*Add additional tasks / notes here*

{{pageImages}}`,

		// Meeting module templates
		"viwoods-meeting-note.md": `---
created: {{createTime}}
modified: {{modifiedTime}}
meeting_date: {{meetingDate}}
total_pages: {{totalPages}}
tags:
  - meeting
  - {{date}}
---

## Attendees

*Add attendees here*

## Agenda

*Add agenda items here*

## Meeting Notes

{{screenshotSections}}

## Action Items

- [ ] *Add action items here*

## Summary

*Add meeting summary here*`,

		// Picking module templates
		"viwoods-picking-capture.md": `---
created: {{createTime}}
type: Quick Capture
total_items: {{totalPages}}
tags:
  - picking
  - {{date}}
---

# {{noteName}}

{{screenshotSections}}`,

		// Memo module templates
		"viwoods-memo.md": `---
created: {{created}}
modified: {{modified}}
type: {{memoType}}
{{reminderLine}}
tags:
  - memo{{todoTag}}
  - {{date}}
---

## Content

![[{{memoImagePath}}]]

{{memoContent}}

## Notes

*Add your notes here*`,

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
