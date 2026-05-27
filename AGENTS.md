# AGENTS.md

## Purpose

This file defines the working contract for this repository while the personal app platform is being built and extended.

The current stack is established in the repo. Do not invent additional frameworks, tooling, deployment rules, or folder conventions beyond what is already committed without documenting the reason.

## Core Principles

- Keep changes small, focused, and easy to review.
- Make changes in small, logically coherent chunks; commit and push each chunk separately.
- Prefer clear, maintainable solutions over clever ones.
- Extend existing conventions once they exist; do not replace them casually.
- Treat documentation as part of the work, not optional cleanup.
- Avoid introducing new tools or structure without recording the reason.

## Bootstrap Phase Rules

- This repo may begin empty or partially initialized. Verify the actual state before making assumptions.
- If a framework or toolchain is added later, update this file only when the new rule is intended to be ongoing policy.
- Do not reference commands, scripts, or directories as standards until they exist in the repository.

## Formatting

- Enable editor format-on-save and keep it on.
- Once the repo includes a formatter or linter configuration, follow the committed tool configuration as the source of truth.
- Until formatter configuration exists, preserve local consistency and avoid style churn.
- Do not reformat unrelated files just because formatting tooling becomes available.

## Git And GitHub Workflow

- Use Git and GitHub as the system of record for code, docs, and decision history.
- Prefer short-lived branches, even for solo development.
- Use `main` as the protected default branch.
- Keep commits small and logically grouped.
- Write meaningful commit messages in plain English that describe the change and intent.
- Avoid vague commit messages such as `update`, `misc`, or `fix stuff`.
- Before making a commit, confirm the diff contains only intentional changes.
- Do not rewrite published history unless there is a clear reason and it is explicitly intended.
- Prefer merging reviewed or intentionally finalized work into `main` rather than pushing incomplete work directly.

## GitHub Repository Settings

- Configure branch protection for `main`.
- Require pull requests before merging into `main`, even if the repo is primarily solo-maintained.
- Require the branch to be up to date before merging once CI exists.
- Restrict force pushes to `main`.
- Restrict branch deletion for `main`.
- Enable conversation resolution before merge once pull-request review becomes part of the workflow.
- Enable automatic deletion of head branches after merge.
- Keep repository visibility and access scoped intentionally; do not leave collaborator access broader than needed.
- Store production secrets in GitHub or hosting-provider secret managers, never in committed files.
- When CI is added, wire required status checks into branch protection and keep AGENTS.md aligned with the exact check names.

## Documentation Expectations

- Keep project knowledge in repo-local Markdown files.
- Record meaningful specs, decisions, session summaries, and codebase notes as the project evolves.
- Update documentation alongside meaningful implementation changes, not long after.
- When introducing a new tool, architecture choice, or workflow rule, document the decision close to when it is made.
- Keep docs concise, current, and easy to scan.
- Use the structured docs layout once it exists as the default system of record:
  - `docs/vision/` for product direction and durable goals
  - `docs/features/` for feature specs and implementation notes
  - `docs/decisions/` for architecture and workflow decisions
  - `docs/sessions/` for dated session summaries
  - `docs/codebase/` for repo structure and operational notes

## Agent Working Rules

- Start by inspecting the repository state before proposing or making changes.
- Match any established repo conventions once they exist.
- If the repo does not yet define a standard, choose the simplest reasonable default and document it when it becomes important.
- Make documentation updates part of task completion when the task changes behavior, structure, or decisions.
- Flag gaps or ambiguities instead of silently inventing policy where the project has not decided yet.
- Add meaningful comments for each non-trivial code logic block, especially validation, branching rules, data transformations, persistence, sorting, and side effects.
- Add comments for each logically coherent non-trivial code chunk explaining what it does and why.
- Comments should explain intent and constraints; do not add comments that merely restate obvious syntax.

## Future Evolution

- When the app stack is chosen, add stack-specific instructions only after the relevant config and scripts are committed.
- When a stable docs structure is introduced, document the expected locations for specs, decisions, and session notes here.
- When CI, tests, deployment, or release workflows are added, extend this file to capture the durable rules rather than one-off setup steps.

## Current Stack

- Monorepo with `apps/web` and `apps/android`
- `Next.js` for web
- `Expo` / `React Native` for Android
- `Supabase` for backend services
- `Vercel` as the intended web hosting target
