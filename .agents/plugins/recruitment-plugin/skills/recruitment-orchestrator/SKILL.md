---
name: recruitment-orchestrator
description: "Orchestrator skill coordinating recruitment-developer, db-architect, and qa-validator to implement initial features. Trigger this skill whenever any recruitment platform setups, migrations, dashboard pages, components, or pipeline workflows are requested or updated."
---

# Recruitment Orchestrator

This orchestrator coordinates the recruitment developer, database architect, and QA validator subagents.

## Subagents Team

| Subagent TypeName | Role | Output Artifacts |
|:---|:---|:---|
| db-architect | Relational & Vector DB design | `supabase/migrations/` SQL files |
| recruitment-developer | Front-end Next.js and Components | `/app` layouts, `/components` React pages |
| qa-validator | Code verification & Git Hooks QA | Build outputs, lint status, hook verification |

## Workflow

### Phase 0: Context Assessment
1. Check if `supabase/migrations/` or `_workspace/` already exist.
2. Determine run mode:
   - **Initial execution**: Generate all schema and scaffold routes.
   - **Incremental update**: Target only the requested developer/db/QA subagent, keeping existing files intact.

### Phase 1: Database Foundation
1. Invoke `db-architect` subagent:
   - Prompt: "Generate schema database migrations in `supabase/migrations/` implementing recruiters, jobs, candidates, interviews, scores with pgvector and similarity search functions."
2. Await completion and review migration file.

### Phase 2: Frontend Implementation
1. Invoke `recruitment-developer` subagent:
   - Prompt: "Create whitelisted Tailwind styled pages in Next.js App Router for jobs, candidates, interviews, workflows. Implement core buttons, status badges, and data card components."
2. Await completion and review page structures.

### Phase 3: Quality Gates Verification
1. Invoke `qa-validator` subagent:
   - Prompt: "Verify formatting/linting status, compile the build, and check git hooks installation. Ensure zero typescript warnings exist."
2. Await completion and consolidate QA report.

### Phase 4: Final Consolidation
1. Consolidate results and output the status.
