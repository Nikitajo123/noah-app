# NOAH work order app

Test project for NOAH (contact: Matej Jurak). Owner: Nikita. Deadline 2026-10-23, 40-hour budget.
Mobile-first PWA for construction workers (work orders, time tracking, photos, daily report) plus a manager overview and an admin screen.

## Stack
- client/: React + TypeScript (Vite, PWA), TanStack Query, react-router-dom.
- server/: Node + Express + TypeScript, Prisma 6 + PostgreSQL, JWT auth, zod, multer (photos stored in the database, table PhotoFile), pdfkit (src/pdf.ts).
- API is mounted under /api. In production the same Express server serves client/dist.

## Run locally
- docker compose up -d (Postgres 16)
- server: npm run dev (port 3000), npx prisma db seed
- client: npm run dev (proxy /api -> localhost:3000)
- Demo users (password noah123): janez@noah.si (VODJA), marko@noah.si and luka@noah.si (DELAVEC)

## Deployment
- Render free web service from branch main. Every push to main redeploys the live site.
- Neon free Postgres is the live database. Local and live databases are separate.
- Build: client build, server tsc build, prisma migrate deploy. Env var TZ=Europe/Ljubljana.

## Rules of the domain
- Order statuses: NOV, V_DELU, ZAKLJUCEN, PROBLEM. One worker per order.
- One running time entry per worker. An order cannot be closed while work runs or before any work was recorded.
- Daily report = one per worker per day, built from time entries, work logs, materials and photos.
- Server accepts client-made UUIDs and times so offline sync can be added later. Offline is not built.
- Manager overview refreshes every 15 seconds while the tab is visible. Worker list does not poll.

## UI
- All user-facing text in Slovenian. Phone first, big buttons.
- Theme: black and white, accent #F7A600.

## Working rules
- Work on a branch. Never push to main and never run migrations against the live database.
- Never read, print or commit .env files or secrets.
- Do not add features outside Matej's brief. Keep changes small and explain each one briefly.

- Manager can add notes to an order, mark a PROBLEM as resolved (status back to V_DELU), and correct time entries. Every correction is stored in TimeEntryEdit (old and new times, reason, editor).

- Teams: a Team has a foreman (a DELAVEC) and members (User.teamId, a worker is in one team). The foreman writes a summary and submits one TeamReport per team per day. The personal report (DailyReport) still exists as "Moje ure". Manager tab Poročila shows team reports per day and hours per project.