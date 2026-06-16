# Supabase migration

This directory holds the PostgreSQL schema for migrating the blog off SQLite.

## Files

- `migrations/0001_init.sql` — tables, native enums, indexes, `updatedAt` trigger.
- `migrations/0002_rls.sql` — Row Level Security: scoped public reads, service-role writes.
- `../prisma/schema.supabase.prisma` — Postgres Prisma schema (swap in for `schema.prisma`).

## Applying the migration

Either approach works on a fresh Postgres 15 / Supabase instance:

**Supabase CLI**

```bash
supabase link --project-ref <your-project-ref>
supabase db push          # applies everything under supabase/migrations in order
```

**SQL editor (manual)**

Open the Supabase dashboard → SQL Editor and paste/run `0001_init.sql`, then
`0002_rls.sql` (in that order).

## Required env vars

Supabase gives two connection strings. Set both:

```bash
# Pooled (PgBouncer, port 6543) — used by the app at runtime.
DATABASE_URL="postgresql://postgres.<ref>:<pw>@<host>:6543/postgres?pgbouncer=true&connection_limit=1"

# Direct (port 5432) — required by Prisma for migrations / introspection.
DIRECT_URL="postgresql://postgres.<ref>:<pw>@<host>:5432/postgres"
```

`schema.supabase.prisma` reads `DATABASE_URL` (pooled) for queries and
`DIRECT_URL` for migrate.

## Admin writes MUST use the service role

RLS allows the public/anon and authenticated roles to **read** only published,
public content. Every **write** (insert/update/delete) is restricted to the
`service_role`.

- The Next.js admin API routes must run server-side and connect with the
  Supabase **service-role key** (or a Prisma connection using the database
  owner / service-role credentials).
- Never expose the service-role key to the browser.
- The public-read predicate on `Post` exactly mirrors
  `lib/posts.ts` `getPublicPostWhere()`:
  `visibility='PUBLIC' AND (status='PUBLISHED' OR (status='SCHEDULED' AND scheduledAt <= now()))`.
  DRAFT and PRIVATE posts are never readable by anon.
