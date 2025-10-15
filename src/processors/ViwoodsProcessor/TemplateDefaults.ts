/**
 * Default templates for viwoods processor
 */
export class TemplateDefaults {
	private static templates: Record<string, string> = {
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
