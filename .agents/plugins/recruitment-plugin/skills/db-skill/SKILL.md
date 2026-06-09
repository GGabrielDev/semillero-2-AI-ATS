---
name: db-skill
description: "Guidelines for writing Supabase PostgreSQL vector and relational migrations."
---

# Database Skill

This skill guides the design of relational database migrations and pgvector vector configurations.

## Schema Migrations
1. Always enable the pgvector extension using `CREATE EXTENSION IF NOT EXISTS vector;`.
2. Define core entities using strict UUID primary keys:
   - `recruiters` (internal user management)
   - `jobs` (includes UUID, title text, requirements JSONB, and `embedding` vector(1536))
   - `candidates` (includes UUID, name, contact_info JSONB, and `embedding` vector(1536))
   - `interviews` (links jobs and candidates, tracks dates, stages, feedback)
   - `scores` (tracks standard evaluations with ai_score float and structured JSONB evaluation containing summary, classification, suggestions, riskLevel keys)
3. Enforce schema keys on scores table evaluation column via check constraints.

## Similarity search SQL Function
Write RPC math function `match_candidates` computing cosine distance using `<=>` operator, formulated exactly as `1 - (candidate.embedding <=> query_embedding)` to return normalized scores.
