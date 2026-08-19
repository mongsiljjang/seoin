---
name: wrap
description: Finish a working session by reconciling repository state, updating durable project context, writing a restart-ready handoff, committing completed work, and reporting the exact next starting point. Use only when the user explicitly asks to wrap, end the session, prepare a handoff, commit and summarize, or preserve context for a new session.
---

# Wrap

Leave the project so a fresh session can resume without chat history or needless rediscovery.

## 1. Read project rules

Read the nearest `AGENTS.md` and the existing README, decision log, workflow, handoff, review, plan, issue, and ADR conventions.

If the user supplies a next-session focus, use it to prioritize the handoff. Do not broaden the current task.

Do not use a planning, brainstorming, or superpower plugin unless the user explicitly requests it.

## 2. Reconcile repository state

Run the snapshot script for your platform. Both emit the same JSON. Paths are relative to this skill's own directory, so use the base directory given when the skill was invoked — the working directory is the project, not the skill.

Windows:

`powershell.exe -NoProfile -ExecutionPolicy Bypass -File <skill-dir>/scripts/repo_snapshot.ps1 -ProjectPath <path>`

Linux and macOS:

`<skill-dir>/scripts/repo_snapshot.sh <path> [max-depth]`

The script searches for repositories up to three directory levels below the project and stops descending once it finds one. Increase the max depth only when the known workspace layout requires it.

Read the output critically:

- Confirm `repository_count` matches the repositories you expect. Never trust an unexpectedly empty or incomplete snapshot.
- Check `unreadable_git_dirs`. Entries there hold a `.git` that git refuses to open as a repository root — a corrupt, partial, or copied checkout. Investigate before committing anything near them.
- Treat `ok: false` as unknown state, not as clean. `clean` is only meaningful when `ok` is true.
- Repositories outside the project path — a second checkout elsewhere on disk — are not discovered. Snapshot those separately.

If neither script can run, inspect each repository by hand: current branch, HEAD, staged and unstaged changes, recent commits, and directly nested repositories.

Treat each Git repository independently. Never accidentally commit an embedded repository as a gitlink. Preserve unrelated user changes and never rewrite history.

## 3. Build the handoff from durable evidence

Prefer links and paths over duplicated content. Reference existing specs, plans, ADRs, issues, commits, diffs, and deployed artifacts instead of re-summarizing them at length.

Redact secrets, credentials, tokens, private identifiers, and unnecessary personal data. Never place them in the handoff or commit.

Update the project's established status documents. When no convention exists, create:

`review/session-handoff-YYYY-MM-DD.md`

Use a suffix such as `-02` when a same-day handoff already exists. If the workspace must remain unchanged or there is no project, write the handoff to the OS temporary directory instead.

Include:

1. Session goal and completed outcomes
2. Decisions with short rationale
3. Deliverables and durable links
4. Validation performed and exact result
5. Repository and deployment state
6. Open questions, risks, and intentionally deferred work
7. Next tasks in priority order
8. Suggested skills for the next session, limited to skills that are actually available
9. A copy-ready next-session start prompt

Update a decision log for durable choices. Update README progress only when completion was verified.

## 4. Prepare commits

For every repository changed in scope:

1. Remove or ignore temporary logs, archives, credentials, and generated caches.
2. Review the diff and untracked files.
3. Stage only session work.
4. Run `git diff --cached --check`.
5. Commit with an outcome-based message.
6. Record the resulting short SHA.

Do not push, deploy, create a PR, or change sharing unless the user requested it, the project's own rules require it, or that external action was already part of the active task. Project rules read in step 1 take precedence over this default — some projects require every session to end pushed, and following this line instead would leave the work stranded.

## 5. Verify and report

Confirm that required documents exist, commits contain the intended files, sensitive data and temporary packages were not committed, and every in-scope repository is clean or explained.

Report:

- handoff document path
- commit SHA for each repository
- deployed or local deliverable link when applicable
- first recommended action for next time
- suggested next-session skills
- remaining dirty files or blockers
- the copy-ready next-session start prompt, in a fenced code block

The start prompt goes in the chat message itself, not only inside the handoff file. The user is about to open a fresh session and needs to copy it without opening the repository first. Anything else the project rules require in the final message goes here too.

Keep the rest of the final message concise; the handoff document carries the detail.
