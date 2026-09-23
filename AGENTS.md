# Seed Gallery — Project Instructions

This public file contains shared project guidance. Keep personal plans, test budgets, API keys, and local test records out of this file and the repository.

## Communication and code

- Communicate with the project owner in Traditional Chinese. Keep technical terms in English.
- Write code comments, variable names, and commit messages in English.
- Clarify requirements when a material ambiguity could change the result.
- Preserve the configured human Git identity. Do not add AI authorship or generated-by attribution.

## Product and privacy

- This is a mobile-first browser interface for creating images and videos through Runware. Do not add a project-owned generation backend or another provider without an explicit request.
- Users supply their own API Key. Never place a real Key in source, logs, URLs, tests, or deployment artifacts.
- Explain data flow accurately: prompts and reference images go to Runware and necessary upstream services during generation. Browser storage does not imply that API providers retain nothing.
- Preserve saved work, media, and settings when changing application code. Existing `img-generator` IndexedDB and localStorage identifiers are compatibility names; changing the repository name does not require changing them.
- Keep the first-use tour available to both guests and users who validate an API Key, and remember dismissal on the current device.

## Development and delivery

- Use `npm ci` to install dependencies, `npm run dev` for local development, `npm test` for unit tests, `npm run build` for production validation, and `npm run test:e2e` for browser flows.
- Run checks relevant to the change and report anything that could not be verified. Do not run paid generation tests without a separately authorized budget.
- Keep paths portable. Use relative paths or repository-aware configuration instead of hard-coded local workspace paths.
- Start a local server after changes so the owner can review the result. Push, pull requests, and remote branch changes require the owner's explicit consent.
- Only `dist/` is deployed to GitHub Pages; do not copy local planning files or credentials into it.

## Local additions

An optional, Git-ignored `AGENTS.override.md` can hold the owner's private instructions. Codex selects that file instead of this one when both are present in the same directory, so the override must explicitly instruct Codex to read this public file before working.
