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
#highlight #Viwoods/{{noteSlug}} #{{date}}`,
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
#annotation #Viwoods/{{noteSlug}} #{{date}}`,
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
#annotation #book #{{bookSlug}} #{{date}}`,

		// Paper module templates
		"viwoods-paper-note.md": `**Created:** {{createTime}}
**Modified:** {{modifiedTime}}
**Total Pages:** {{totalPages}}

---

{{screenshotSections}}
#scribbling #{{date}}`,
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
		"viwoods-daily-note.md": `**Created:** {{createTime}}
**Modified:** {{modifiedTime}}

---
## Related Notes

{{relatedNotesContent}}

## Tasks & Notes

*Add additional tasks / notes here*

{{pageImages}}

---
#daily-note #{{date}}`,

		// Meeting module templates
		"viwoods-meeting-note.md": `**Created:** {{createTime}}
**Modified:** {{modifiedTime}}
**Meeting Date:** {{meetingDate}}
**Total Pages:** {{totalPages}}

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

*Add meeting summary here*

---
#meeting #{{date}}`,

		// Picking module templates
		"viwoods-picking-capture.md": `# {{noteName}}

**Captured:** {{createTime}}
**Type:** Quick Capture
**Total Items:** {{totalPages}}

---

{{screenshotSections}}

---
#picking #{{date}}`,

		// Memo module templates
		"viwoods-memo.md": `**Created:** {{created}}
**Modified:** {{modified}}
**Type:** {{memoType}}
{{reminderLine}}

---

## Content

![[{{memoImagePath}}]]

{{memoContent}}

## Notes

*Add your notes here*

---

#memo{{todoTag}} #{{date}}`,

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
