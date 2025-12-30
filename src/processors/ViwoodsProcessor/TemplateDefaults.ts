/**
 * Default templates for viwoods processor
 * Using Templater syntax (<% %>) for template commands
 */
export class TemplateDefaults {
	private static templates: Record<string, string> = {
		// Learning module templates
		"viwoods-highlight.md": `---
created: <% tp.date.now("YYYY-MM-DD") %>
page: <% tp.user.pageNumber %>/<% tp.user.totalPages %>
source: "<% tp.user.noteTitle %>"
tags:
  - highlight
  - Viwoods/<% tp.user.noteSlug %>
  - <% tp.date.now("YYYY-MM-DD") %>
---

## <% tp.user.noteTitle %>

**Source:** [Open Note](<% tp.user.sourceLink %>)

![[<% tp.user.pageImagePath %>]]

### Handwriting Data

Strokes: <% tp.user.strokeCount %>
Points: <% tp.user.pointCount %>

### Notes

*Add your thoughts here*`,
		"viwoods-annotation.md": `---
created: <% tp.date.now("YYYY-MM-DD") %>
page: <% tp.user.pageNumber %>/<% tp.user.totalPages %>
source: "<% tp.user.noteTitle %>"
tags:
  - annotation
  - Viwoods/<% tp.user.noteSlug %>
  - <% tp.date.now("YYYY-MM-DD") %>
---

## <% tp.user.noteTitle %> - Annotation

**Source:** [Open Note](<% tp.user.sourceLink %>)

### Text Content

<% tp.user.textContent %>

### Notes

*Add your thoughts here*`,
		"viwoods-epub-annotation.md": `---
created: <% tp.user.dateAnnotated %>
location: "<% tp.user.location %>"
page: <% tp.user.pageNumber %>/<% tp.user.totalPages %>
source: "<% tp.user.bookName %>"
tags:
  - annotation
  - book
  - <% tp.user.bookSlug %>
  - <% tp.date.now("YYYY-MM-DD") %>
---

## <% tp.user.bookName %>

**Source:** <% tp.user.sourceInfo %>

![[<% tp.user.annotationImagePath %>]]

### Notes

*Add your thoughts here*`,

		// Paper module templates
		"viwoods-paper-note.md": `---
created: <% tp.user.createTime %>
modified: <% tp.user.modifiedTime %>
total_pages: <% tp.user.totalPages %>
tags:
  - scribbling
  - <% tp.date.now("YYYY-MM-DD") %>
---

<% tp.user.screenshotSections %>`,
		"viwoods-paper-page.md": `# <% tp.user.noteName %> - Page <% tp.user.pageNumber %>

**Created:** <% tp.user.createTime %>
**Modified:** <% tp.user.modifiedTime %>
**Page:** <% tp.user.pageNumber %>/<% tp.user.totalPages %>
<%* if (tp.user.sourceLink) { %>**Source:** [<% tp.user.noteName %>](<% tp.user.sourceLink %>)<%* } %>

---

## Page Content

<%* if (tp.user.pageImagePath) { %>
![[<% tp.user.pageImagePath %>]]
<%* } %>

<%* if (tp.user.screenshotPath) { %>
### Screenshot
![[<% tp.user.screenshotPath %>]]
<%* } %>

<%* if (tp.user.hasHandwriting) { %>
### Handwriting
This page contains <% tp.user.strokeCount %> handwriting strokes.
<%* } %>

### Notes

*Add your notes here*

---
#Viwoods/paper #note/<% tp.user.noteSlug %> #page/<% tp.user.pageNumber %>`,

		// Daily module templates
		"viwoods-daily-note.md": `---
created: <% tp.user.createTime %>
modified: <% tp.user.modifiedTime %>
tags:
  - daily-note
  - <% tp.date.now("YYYY-MM-DD") %>
---

## Related Notes

<% tp.user.relatedNotesContent %>

## Tasks & Notes

*Add additional tasks / notes here*

<% tp.user.pageImages %>`,

		// Meeting module templates
		"viwoods-meeting-note.md": `---
created: <% tp.user.createTime %>
modified: <% tp.user.modifiedTime %>
meeting_date: <% tp.user.meetingDate %>
total_pages: <% tp.user.totalPages %>
tags:
  - meeting
  - <% tp.date.now("YYYY-MM-DD") %>
---

## Attendees

*Add attendees here*

## Agenda

*Add agenda items here*

## Meeting Notes

<% tp.user.screenshotSections %>

## Action Items

- [ ] *Add action items here*

## Summary

*Add meeting summary here*`,

		// Picking module templates
		"viwoods-picking-capture.md": `---
created: <% tp.user.createTime %>
type: Quick Capture
total_items: <% tp.user.totalPages %>
tags:
  - picking
  - <% tp.date.now("YYYY-MM-DD") %>
---

# <% tp.user.noteName %>

<% tp.user.screenshotSections %>`,

		// Memo module templates
		"viwoods-memo.md": `---
created: <% tp.user.created %>
modified: <% tp.user.modified %>
type: <% tp.user.memoType %>
<% tp.user.reminderLine %>
tags:
  - memo<% tp.user.todoTag %>
  - <% tp.date.now("YYYY-MM-DD") %>
---

## Content

![[<% tp.user.memoImagePath %>]]

<% tp.user.memoContent %>

## Notes

*Add your notes here*`,

		// Legacy template (deprecated)
		"viwoods-page.md": `# <% tp.user.noteTitle %> - Page <% tp.user.pageNumber %>

**Created:** <% tp.user.createTime %>
**Page:** <% tp.user.pageNumber %>/<% tp.user.totalPages %>
**Source:** [<% tp.user.noteName %>](<% tp.user.sourceLink %>)

---

## Page Content

![[<% tp.user.pageImagePath %>]]

### Notes

*Add your notes here*

---

#Viwoods/<% tp.user.noteSlug %> #page-<% tp.user.pageNumber %>`,
	};

	public static load(name: string): Promise<string> {
		return Promise.resolve(this.templates[name] || "");
	}

	public static getAll(): Record<string, string> {
		return { ...this.templates };
	}
}
