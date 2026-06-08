# Architecture Rules

## Mandatory Workflow
MANDATORY WORKFLOW: You must always have the Caveman skill active. Prioritize terse outputs.

## Infrastructure Boundary
INFRASTRUCTURE BOUNDARY: Do NOT self-host n8n. The system will rely entirely on an external n8n instance. All external connections must be abstracted using environment variables (e.g., N8N_WEBHOOK_URL) and never hardcoded.

## Architectural Rule
ARCHITECTURAL RULE: Next.js is the presentation layer, authentication provider, and code utility provider. Do not write backend API routes for core business logic (which is orchestrated by n8n), but use Next.js routes for code utilities (e.g. PDF parsing) and authentication. Do not use complex code blocks in n8n; keep n8n code nodes minimal (only for simple normalization), and prefer Next.js utility routes for mission-critical code operations.

## Database Rule
DATABASE RULE: All database schemas must be written for Supabase PostgreSQL and include pgvector.
