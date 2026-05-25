# AGENTS.md

## Purpose

This file defines the working contract for this repository while the personal app is still being bootstrapped.

The repo is currently stack-agnostic. Do not assume a framework, package manager, formatter, linter, test runner, deployment target, or folder structure until those choices are committed to the repo.

## Core Principles

- Keep changes small, focused, and easy to review.
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
- Initialize Git before meaningful implementation work if it is not already initialized.
- Prefer short-lived branches, even for solo development.
- Keep commits small and logically grouped.
- Write meaningful commit messages in plain English that describe the change and intent.
- Avoid vague commit messages such as `update`, `misc`, or `fix stuff`.
- Before making a commit, confirm the diff contains only intentional changes.
- Do not rewrite published history unless there is a clear reason and it is explicitly intended.

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
