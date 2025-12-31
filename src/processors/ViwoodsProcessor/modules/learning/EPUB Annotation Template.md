---
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

*Add your thoughts here*
