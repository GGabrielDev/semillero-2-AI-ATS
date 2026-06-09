# Phase 1: Discovery & Scope

This document establishes the business boundaries, user personas, backlog of user stories, and Definition of Done (DoD) for the AI Recruitment Platform.

## User Personas

*   **Technical Recruiter**: Focuses on sourcing, intake, initial AI-assisted screening, seniority verification, and tracking candidates through the hiring pipeline.
*   **Hiring Manager**: Focuses on reviewing pre-screened and scored candidates, evaluating role suitability, and conducting structured interviews.
*   **Candidate**: Interacts with the platform to submit applications/CVs and receives automated status updates.

## Prioritized Backlog of User Stories

1.  **CV Intake**
    *   *User Story*: As a recruiter, I want to upload candidate PDFs via the Web UI so they can be processed and stored.
    *   *Acceptance Criteria*:
        *   Drag-and-drop or file selector for PDF CVs.
        *   Successful text extraction and ingestion.
        *   Parsing and storage of extracted candidate info.
2.  **Semantic Ranking**
    *   *User Story*: As a recruiter, I want a ranked list of candidates matching an open job description based on contextual relevance.
    *   *Acceptance Criteria*:
        *   Compute cosine distance between job embeddings and candidate embeddings.
        *   Display ranked matches with normalized similarity score between -1 and 1.
3.  **Profile Summary**
    *   *User Story*: As a recruiter, I want a terse AI-generated candidate summary to speed up screening.
    *   *Acceptance Criteria*:
        *   Display a short summary on candidate profiles.
        *   Synthesized from parsed resume details.
4.  **Seniority Guard**
    *   *User Story*: As a recruiter, I want automatic seniority detection to route candidates to the correct interview pool.
    *   *Acceptance Criteria*:
        *   AI-based classification (e.g., Junior, Mid, Senior).
        *   Correct pool routing matches candidate seniority level.
5.  **Unified Scoring**
    *   *User Story*: As a hiring manager, I want to compare candidate suitability using a standardized score.
    *   *Acceptance Criteria*:
        *   Standardized scoring schema with AI evaluation.
        *   JSON structure containing keys: `summary`, `classification`, `suggestions`, and `riskLevel`.
6.  **Stage Progression**
    *   *User Story*: As a recruiter, I want candidate stages to update dynamically, triggering confirmation emails.
    *   *Acceptance Criteria*:
        *   Visual stage progression pipeline.
        *   Updating stage triggers background event notifications.

## Definition of Done (DoD)

*   **Type Safety**: Fully typed Next.js App Router with TypeScript (no `any` types where avoidable).
*   **Database Schema**: Supabase relational database schema complete with verified `pgvector` distance metrics.
*   **Linting & Quality**: Zero TypeScript compilation or linting warnings/errors.
*   **Git Quality Gates**: Active Git quality gates (hooks) verifying builds, conventional commit messages, linting, and formatting.
