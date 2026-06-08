# Architecture Rules

## Mandatory Workflow
MANDATORY WORKFLOW: You must always have the Caveman skill active. Prioritize terse outputs.

## Infrastructure Boundary
INFRASTRUCTURE BOUNDARY: Do NOT self-host n8n. The system will rely entirely on an external n8n instance. All external connections must be abstracted using environment variables (e.g., N8N_WEBHOOK_URL) and never hardcoded.

## Architectural Rule
ARCHITECTURAL RULE: Next.js must be treated purely as a presentation layer. Do not write backend API routes for business logic. n8n is the central orchestrator.

## Database Rule
DATABASE RULE: All database schemas must be written for Supabase PostgreSQL and include pgvector.
