-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Recruiters table
CREATE TABLE IF NOT EXISTS recruiters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Jobs table
CREATE TABLE IF NOT EXISTS jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  requirements JSONB NOT NULL,
  embedding vector(1536),
  recruiter_id UUID REFERENCES recruiters(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Candidates table
CREATE TABLE IF NOT EXISTS candidates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  contact_info JSONB NOT NULL,
  embedding vector(1536),
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Interviews table
CREATE TABLE IF NOT EXISTS interviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id UUID NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
  job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  interview_date TIMESTAMPTZ NOT NULL,
  stage TEXT NOT NULL, -- Technical, Cultural, etc.
  feedback TEXT,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Scores table
CREATE TABLE IF NOT EXISTS scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id UUID NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
  interview_id UUID REFERENCES interviews(id) ON DELETE CASCADE,
  ai_score FLOAT NOT NULL,
  evaluation JSONB NOT NULL, -- Hold summary, classification, suggestions, riskLevel
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  CONSTRAINT check_evaluation_schema CHECK (
    evaluation ? 'summary' AND
    evaluation ? 'classification' AND
    evaluation ? 'suggestions' AND
    evaluation ? 'riskLevel'
  )
);

-- Cosine distance match function
CREATE OR REPLACE FUNCTION match_candidates(
  query_embedding vector(1536),
  match_threshold float,
  match_count int
)
RETURNS TABLE (
  id uuid,
  name text,
  contact_info jsonb,
  embedding vector(1536),
  similarity float
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    candidates.id,
    candidates.name,
    candidates.contact_info,
    candidates.embedding,
    (1 - (candidates.embedding <=> query_embedding))::float AS similarity
  FROM candidates
  WHERE (1 - (candidates.embedding <=> query_embedding)) > match_threshold
  ORDER BY similarity DESC
  LIMIT match_count;
END;
$$;
