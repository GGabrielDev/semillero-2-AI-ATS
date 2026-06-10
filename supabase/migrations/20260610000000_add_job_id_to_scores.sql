-- Add job_id to scores table to decouple AI evaluations from interviews
ALTER TABLE scores ADD COLUMN IF NOT EXISTS job_id UUID REFERENCES jobs(id) ON DELETE CASCADE;
