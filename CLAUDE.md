@AGENTS.md

# Project notes

- Roles and flows are documented in README.md. Every page/action must enforce its role with `requireUser` / `requireCompanyUser` from `src/lib/auth.ts`; company data is always scoped by `user.companyId`.
- `costPerPerson`, `totalCost` and profit are owner-only. Never expose them to employees, customers or the AI tools.
- `Conversation.aiHistory` is the raw Claude transcript: append only, never edit earlier entries.
- Checks before committing: `npm run typecheck && npm run lint && npm run build`.
