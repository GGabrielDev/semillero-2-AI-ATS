# Frontend Design Rules

## Routing Rule
ROUTING RULE: You must structure the Next.js App Router strictly by business domains. The allowed directories are exactly: /app/(dashboard)/jobs, /app/(dashboard)/candidates, /app/(dashboard)/interviews, and /app/(dashboard)/workflows.

## Styling Whitelist
STYLING WHITELIST: You are restricted to a neutral, professional Human Resources design system. You must ONLY use the following Tailwind CSS tokens:
- **Backgrounds:** `bg-slate-50` for main layouts, `bg-white` for cards/surfaces.
- **Text:** `text-slate-900` for headings, `text-slate-600` for body text, `text-slate-500` for secondary labels.
- **Primary Actions (Buttons/Links):** `bg-blue-600` for backgrounds, `hover:bg-blue-700` for hover states, `text-white` for text.
- **Borders & Dividers:** `border-slate-200`.
- **Border Radius:** strictly `rounded-md` or `rounded-lg`. Do not use full rounding unless it is an avatar.
- **Shadows:** strictly `shadow-sm` for cards, `shadow-md` for modals/dropdowns.

## UI Component Rule
UI COMPONENT RULE: Build and reuse standard components (e.g., `<PrimaryButton>`, `<StatusBadge>`, `<DataCard>`). Do not invent new visual styles outside of the allowed tokens.
