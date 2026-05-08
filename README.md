# Cabinet Cut Optimizer

React + Next.js + TypeScript workspace for a cabinet cut list optimizer with sheet layout planning and 3D preview features.

## Current Setup

- Next.js 15 on Node.js with React 19 and TypeScript 6
- Tailwind CSS v4 via `@tailwindcss/postcss`
- `shadcn/ui` initialized and ready for component generation
- App Router entrypoint in `app/`
- Path alias configured as `@/* -> src/*`
- Auth and project persistence run on PostgreSQL and require `DATABASE_URL`
- VS Code task added for local development

## Scripts

- `npm run dev` starts the Next.js dev server on port 5173
- `npm run build` creates a production build
- `npm run start` runs the production server on port 5173
- `npm run lint` runs ESLint

## Status

The workspace now runs as a Node.js React web app using Next.js. The current UI remains client-rendered, while the 3D preview is loaded dynamically on the client to avoid SSR issues.

## Database Setup

- Set `DATABASE_URL` to a PostgreSQL connection string for local development and production.
- The API routes use PostgreSQL and create the required tables automatically on first use.
- If `DATABASE_URL` is missing, auth and persistence requests fail clearly instead of silently writing to local JSON.
- For access "from anywhere at any time", you still need both:
  - a hosted Next.js app
  - a hosted PostgreSQL database
- Supabase is a good fit here because it gives you managed PostgreSQL, and the app can use it directly through `DATABASE_URL`.

Example environment file:

```env
DATABASE_URL=postgres://USER:PASSWORD@HOST:5432/DB_NAME?sslmode=require
```

## Supabase Steps

1. Create a Supabase project.
2. Open Project Settings > Database > Connection string.
3. Copy the transaction pooler or direct connection URI.
4. Put that value in `DATABASE_URL`.
5. Start the app once or call any API route to let the server create the required tables automatically.
6. If you already have local users/projects in `data/cutlist-db.json`, run the migration command below.

## Local Data Migration

- Existing legacy data in `data/cutlist-db.json` can be copied into PostgreSQL or Supabase.
- The migration keeps users, password hashes, settings, and saved projects.
- Existing sessions are intentionally dropped so users log in again on the hosted app.
- The JSON file is now treated as a migration source, not the active runtime database.

Run:

```bash
npm run migrate:file-store
```

Optional environment override:

```env
LEGACY_STORE_PATH=./data/cutlist-db.json
```
