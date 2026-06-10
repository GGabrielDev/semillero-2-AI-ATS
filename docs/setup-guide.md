# Setup and Configuration Guide: AI Recruitment Platform

This guide covers the complete step-by-step setup process for the database (Supabase), the automation engine (n8n), the AI models, and the Next.js application.

---

## 1. Supabase (Database Setup)

Supabase provides the relational database, vector store, and API services.

### A. Extensions Needed
The semantic similarity matching uses vector calculations. You must enable the `vector` extension.
*   Go to **Database** -> **Extensions** -> Search for `vector` -> Click **Enable**.

### B. Table Schemas
You need to create the following five tables. Run these SQL commands in the Supabase **SQL Editor**:

```sql
-- 1. Jobs Table
CREATE TABLE jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  requirements JSONB NOT NULL DEFAULT '{}'::jsonb, -- Store raw text + lowercase buzzwords list
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Candidates Table
CREATE TABLE candidates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  phone TEXT,
  embedding VECTOR(1536), -- 1536 dimensions matching gemini-embedding-001
  contact_info JSONB DEFAULT '{}'::jsonb, -- Store A-Z summary, skills list, phone, etc.
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. Scores Table (Decoupled Evaluations)
CREATE TABLE scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id UUID REFERENCES candidates(id) ON DELETE CASCADE NOT NULL,
  job_id UUID REFERENCES jobs(id) ON DELETE CASCADE NOT NULL,
  ai_score INTEGER NOT NULL CHECK (ai_score >= 0 AND ai_score <= 100),
  risk_level TEXT NOT NULL, -- 'Low', 'Medium', 'High'
  evaluation JSONB NOT NULL DEFAULT '{}'::jsonb, -- Store { summary, classification, suggestions }
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 4. Interviews Table
CREATE TABLE interviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id UUID REFERENCES candidates(id) ON DELETE CASCADE NOT NULL,
  job_id UUID REFERENCES jobs(id) ON DELETE CASCADE NOT NULL,
  interview_date TIMESTAMP WITH TIME ZONE NOT NULL,
  stage TEXT DEFAULT 'Screening'::text NOT NULL, -- 'Screening', 'Technical', 'Cultural', 'Offer', 'Hired', 'Rejected'
  feedback TEXT, -- Stores JSON string comments timeline array [{ id, text, timestamp, author, stage, isAi }]
  pinned BOOLEAN DEFAULT false NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);
```

### C. pgvector Similarity Match Function
Next, create the PostgreSQL RPC function to rank candidates against job requirements using cosine distance. Run this in the SQL Editor:

```sql
CREATE OR REPLACE FUNCTION match_candidates (
  query_embedding VECTOR(1536),
  match_threshold DOUBLE PRECISION,
  match_count INT
)
RETURNS TABLE (
  id UUID,
  name TEXT,
  email TEXT,
  phone TEXT,
  contact_info JSONB,
  similarity DOUBLE PRECISION
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    candidates.id,
    candidates.name,
    candidates.email,
    candidates.phone,
    candidates.contact_info,
    1 - (candidates.embedding <=> query_embedding) AS similarity
  FROM candidates
  WHERE 1 - (candidates.embedding <=> query_embedding) > match_threshold
  ORDER BY candidates.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;
```

---

## 2. n8n (Automation Engine Setup)

n8n acts as the central automation orchestrator, receiving hooks from Next.js, calling LLM chains, and saving responses.

### A. Minimum Requirements
*   **n8n instance**: Self-hosted (Docker / npm package) or n8n Cloud.
*   **Version**: n8n v1.0.0 or later (v1.30+ recommended for advanced LangChain integration features).
*   **Network Access**: The n8n instance must be publicly reachable (using domain/tunnel like ngrok/Cloudflare) so Vercel can post webhook payloads.

### B. Supported LLM Models & Providers
The n8n Kickstarter script (`deploy-n8n-v2.ts`) supports credentials setup and deployment for:

| Provider | Choice ID | Default Model | Node Type | API Key Env Var |
| :--- | :--- | :--- | :--- | :--- |
| **Deepseek** | `1` | `deepseek-chat` | `@n8n/n8n-nodes-langchain.lmChatDeepSeek` | `DEEPSEEK_API_KEY` |
| **OpenAI** | `2` | `gpt-4o-mini` | `@n8n/n8n-nodes-langchain.lmChatOpenAi` | `OPENAI_API_KEY` |
| **Google Gemini** | `3` | `gemini-1.5-flash` | `@n8n/n8n-nodes-langchain.lmChatGoogleGemini` | `GEMINI_API_KEY` |
| **Anthropic** | `4` | `claude-3-5-sonnet-latest` | `@n8n/n8n-nodes-langchain.lmChatAnthropic` | `ANTHROPIC_API_KEY` |

### C. Deploying via Script
1.  Configure the `.env` variables (`N8N_HOST`, `N8N_API_KEY`).
2.  Run the deployment script:
    ```bash
    npx ts-node -O '{"module": "commonjs"}' scripts/deploy-n8n-v2.ts \
      --primary-provider=deepseek \
      --fallback \
      --fallback-provider=gemini
    ```
    *Note: The script dynamically detects if a credential exists in n8n. If found, it safely reuses the credential to avoid entering keys repeatedly.*

### D. Email Ingestion & Notification Workflows
To deploy the email-based workflows (receiving CVs via IMAP and notifying candidates via SMTP on stage changes), run the dedicated email deployment script:
```bash
npx tsx scripts/deploy-email-automation.ts
```

This script will:
1. Create or update `Semillero2_IMAP_V2` credentials in n8n (utilizes standard secure port `993`).
2. Create or update `Semillero2_SMTP` credentials in n8n (utilizes `.env` SMTP variables).
3. Deploy and activate **Semillero2: Email Ingestion Listener** (listens for emails with PDF attachments, extracts text, and triggers candidate evaluation).
4. Deploy and activate **Semillero2: Stage Change Email Notifier** (listens for database webhooks on stage updates and sends templated HTML emails to candidates).

### E. Supabase Database Webhook Setup (Stage Changes)
The email notifier workflow is triggered by a Supabase Database Webhook when candidate stages are updated. 
Run the following SQL in your Supabase SQL Editor to enable the trigger:
```sql
-- Enable pg_net extension for network calls
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Create trigger function
CREATE OR REPLACE FUNCTION notify_interview_stage_change()
RETURNS TRIGGER AS $$
DECLARE
  payload_body JSONB;
BEGIN
  IF (TG_OP = 'INSERT' OR OLD.stage IS DISTINCT FROM NEW.stage) THEN
    payload_body := jsonb_build_object(
      'old_record', CASE WHEN TG_OP = 'INSERT' THEN NULL ELSE to_jsonb(OLD) END,
      'new_record', to_jsonb(NEW)
    );

    PERFORM net.http_post(
      url := 'https://n8n.gaboggamer.online/webhook/stage-changed',
      headers := '{"Content-Type": "application/json"}'::jsonb,
      body := payload_body
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS tr_interview_stage_change ON public.interviews;

-- Bind trigger to public.interviews table
CREATE TRIGGER tr_interview_stage_change
AFTER INSERT OR UPDATE ON public.interviews
FOR EACH ROW
EXECUTE FUNCTION notify_interview_stage_change();
```

---

## 3. Supported Webhooks / API Endpoints

The n8n workflow exposes the following endpoints (automatically registered upon deployment):

### 1. `POST /webhook/evaluate-candidate`
Triggered by Next.js when parsing CVs or running AI evaluations.
*   **Payload**:
    ```json
    {
      "candidateId": "uuid-here",
      "jobId": "uuid-here",
      "candidateName": "John Doe",
      "jobTitle": "React Developer",
      "jobRequirements": "Stack: React, TypeScript, Tailwind...",
      "text": "Extracted text contents of candidate resume..."
    }
    ```
*   **Workflow Operations**:
    *   Extracts resume data (Structured Output Parser).
    *   Inserts parsed details (skills list, summary) into `candidates` table.
    *   Runs the primary evaluation chain (Deepseek) with a fallback to Google Gemini.
    *   Calculates calibrated scores (0-100), risk classifications (`Qualified`, `Unqualified`, `Review`), and appends next-step suggestions.
    *   Stores result in `scores` table.

### 2. `POST /webhook/suggest-next-steps`
Triggered by Next.js when clicking "Get AI Suggestion" inside Interviews.
*   **Payload**:
    ```json
    {
      "candidateName": "John Doe",
      "jobTitle": "React Developer",
      "currentStage": "Technical",
      "candidateSummary": "Extracted summary...",
      "candidateSkills": ["react", "typescript"],
      "jobRequirements": "Stack: React...",
      "commentHistory": [ ... ],
      "lang": "en" | "es"
    }
    ```
*   **Workflow Operations**:
    *   Assembles context of the candidate, job description, and interview timeline.
    *   Queries LLM to output a brief, actionable list of next steps.
    *   Instructs LLM to write in Spanish if `lang` is `"es"`, otherwise English.

---

## 4. Next.js (Application Setup)

### A. Environment variables
Make sure all items in `.env` are configured:
*   `APP_PASSWORD`: Protects the lock screen. Default fallback is `Semillero2026!`.
*   `GEMINI_API_KEY`: Mandatory for client-side embedding generation (`models/gemini-embedding-001`) and candidate comparisons.
*   `NEXT_PUBLIC_SUPABASE_URL` & `SUPABASE_SECRET_KEY`: Service role keys to read/write without RLS checks.

### B. Deployment
Deploy to Vercel with all environment variables matching your local setup. Ensure the API routes can freely reach the database and the n8n webhooks.
