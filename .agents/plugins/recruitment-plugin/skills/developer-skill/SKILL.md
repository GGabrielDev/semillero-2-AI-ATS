---
name: developer-skill
description: "Guidelines for implementing whitelisted Tailwind CSS styling and Next.js App Router layout/page components."
---

# Developer Skill

This skill guides the implementation of Next.js frontend pages, whitelisted styles, and dry React components.

## Styling System Whitelist
You must restrict colors and design tokens to:
- **Backgrounds:** `bg-slate-50` (layouts), `bg-white` (cards/surfaces)
- **Text:** `text-slate-900` (headings), `text-slate-600` (body), `text-slate-500` (secondary labels)
- **Actions:** `bg-blue-600` (primary buttons), `hover:bg-blue-700` (hovers), `text-white` (button text)
- **Dividers:** `border-slate-200`
- **Radii:** `rounded-md` or `rounded-lg`
- **Shadows:** `shadow-sm` (cards), `shadow-md` (modals)

## Domain Layout Structure
Strictly align routes with business domains:
- `/app/(dashboard)/jobs`
- `/app/(dashboard)/candidates`
- `/app/(dashboard)/interviews`
- `/app/(dashboard)/workflows`

## Type Safety
Ensure all page exports and component props are strictly typed. Avoid `any` types. Ensure linter rules are satisfied.
