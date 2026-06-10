# AI Recruitment Platform (ATS)

## Project Description
A modern ATS platform designed to parse PDF CVs using multimodal AI, rank candidates against job vacancies using semantic vector search, and orchestrate automated recruitment stages via an external n8n hub.

## Core User Stories
- **Recruiter - CV Upload:** As a recruiter, I want to upload CVs in PDF format so they can be evaluated automatically.
- **Recruiter - Vacancy Ranking:** As a recruiter, I want a ranking of candidates per job vacancy.
- **Recruiter - Seniority Detection:** As a recruiter, I want the system to detect seniority to adjust interviews.
- **Recruiter - Profile Summary:** As a recruiter, I want a concise AI summary of the profile for quick review.
- **Hiring Manager - Comparative Scoring:** As a hiring manager, I want a comparative score between candidates.
- **Recruiter - Stage Automation:** As a recruiter, I want candidates to move through recruitment stages automatically.
- **Candidate - Automated Emails:** As a candidate, I want to receive automated email confirmations for every stage change.
- **Talent Team - Vacancy Metrics:** As a talent team, we want metrics on the progress per vacancy.

## Setup & Prerequisites

### 1. Google AI Studio Account (Mandatory)
Vector embeddings matching and search operations require a direct call to the Google Gemini Embeddings API (`models/gemini-embedding-001`). 
*   **Prerequisite**: You must obtain a free-tier or paid-tier Gemini API key from [Google AI Studio](https://aistudio.google.com/).
*   **Usage**: The embedding model is free for up to 1,500 requests per day (15 requests per minute), which covers standard development and testing requirements.
*   **Configuration**: Add your key to the `.env` file at the root of the project:
    ```env
    GEMINI_API_KEY=your_google_ai_studio_api_key_here
    ```

