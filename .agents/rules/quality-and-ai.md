# Quality and AI Rules

## Git Hooks Rule
GIT HOOKS RULE: The repository must enforce quality through local Git hooks. You are required to configure a pre-commit hook for formatting, a commit-msg hook for commit conventions, and a pre-push hook for testing.

## AI Output Schema Rule
AI OUTPUT SCHEMA RULE: Any integration with an LLM for parsing or evaluating candidates must output a deterministic JSON structure. You are restricted to generating JSON that contains EXACTLY these four keys: `summary`, `classification`, `suggestions`, and `riskLevel`.
