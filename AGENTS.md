
## Recap
- The goal is to have an Electron + React application that runs on Mac / Windows / Linux to manage tasks in a simple and direct way (no frills).
- The app is still work in progress. The React webapp is considered done for now, and the next major focus is wiring the Electron / database part.

## Core Constraints
- Work only in this repository and only on the current branch.
- `README.md` just contains minimal information about the application and how to run it.
- `DOCUMENTATION.md` contains the detailed application documentation.
- Keep `AGENTS.md` and `DOCUMENTATION.md` aligned and up to date. If either becomes stale or contradicts the project state, fix it as part of the task.
- Do NOT edit `TODO.md` and `README.md`.
- Do NOT introduce extra libraries unless you justify them briefly and they clearly reduce work or risk.
- `package.json` dependencies must always use exact versions; do not use modifiers such as `^` or `~`.
- Prefer existing project patterns over new abstractions when they are available. However, do centralize behavior into shared components/utilities whenever convenient.
- Use absolute imports from `src/...` for in-repository React source files and assets instead of relative `./` or `../` imports.
- Define TypeScript types in the owning `.ts`/`.tsx` file whenever practical. Shared cross-owner types live under `src/types` in semantic files such as `TaskTypes.ts`, `DomainTypes.ts`, or `FilterTypes.ts`.
- Use plain React with TypeScript and CSS only. Do not add frameworks such as Vite or Next.js.
- Keep the code style consistent with the existing codebase, including spacing and newline conventions.
- `eslint.config.js` contains the flat ESLint configuration used by `npm run lint`.

## Testing And Validation
- Testing should stay minimal but meaningful: focused unit tests for important logic plus at least 1-2 smoke tests for critical user flows.
- All relevant checks must pass before closing a feature or fix:
  - `npm run lint`
  - `npm run typecheck`
  - `npm test`

## Delivery Rules
- You MUST commit the code when you complete any task.
- Every commit message must start with `Codex: `.
- Leave ignored files and `.gitignore` patterns alone.
