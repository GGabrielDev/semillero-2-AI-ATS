---
name: qa-skill
description: "Guidelines for verifying codebase quality, linting status, build compliance, and Git hooks validation."
---

# QA Skill

This skill guides quality validation processes to meet the Definition of Done (DoD).

## Verification Checklist
- Run `npm run lint` and verify zero errors.
- Run `npm run build` to ensure Next.js build compilation succeeds.
- Check Tailwind styling tokens in files using `grep_search` to verify compliance with the styling whitelist.
- Verify that `pre-commit`, `commit-msg`, and `pre-push` git hooks are present and executable.
