-- =============================================================================
-- 0002_rls.sql — Row Level Security policies
-- =============================================================================
--
-- MODEL:
--   * Reads are public but SCOPED. Anonymous ("anon") and signed-in
--     ("authenticated") roles may read only what a public visitor should see.
--   * ALL writes (insert/update/delete) are reserved for the "service_role".
--     The Next.js admin routes MUST use the Supabase service-role key (or a
--     Prisma connection using the service role / direct Postgres credentials)
--     for any mutation. The service_role bypasses RLS by default in Supabase,
--     but we additionally declare explicit write policies for clarity and so
--     the intent survives even if BYPASSRLS is ever changed.
--
--   * IMPORTANT CORRECTNESS NOTE: The public-read predicate on "Post" must
--     NEVER expose PRIVATE or DRAFT posts to anon. The predicate mirrors
--     lib/posts.ts getPublicPostWhere() exactly:
--         visibility = 'PUBLIC'
--         AND ( status = 'PUBLISHED'
--               OR (status = 'SCHEDULED' AND scheduledAt <= now()) )
--
--   NOTE: Prisma connects as the database owner/postgres role, which bypasses
--   RLS. RLS here primarily protects any path using the anon/authenticated
--   keys (e.g. PostgREST / a Supabase client in the browser). Keep the admin
--   API server-side with the service-role/owner credentials.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Enable RLS on every table
-- -----------------------------------------------------------------------------
alter table "Post"     enable row level security;
alter table "Category" enable row level security;
alter table "Tag"      enable row level security;
alter table "PostTag"  enable row level security;
alter table "Media"    enable row level security;

-- -----------------------------------------------------------------------------
-- POST policies
-- -----------------------------------------------------------------------------
-- Public read: only PUBLIC + (PUBLISHED or due-SCHEDULED) posts.
drop policy if exists "Post: public read published" on "Post";
create policy "Post: public read published"
  on "Post"
  for select
  to anon, authenticated
  using (
    "visibility" = 'PUBLIC'
    and (
      "status" = 'PUBLISHED'
      or ("status" = 'SCHEDULED' and "scheduledAt" is not null and "scheduledAt" <= now())
    )
  );

-- Service role: full read (admin listing needs DRAFT/PRIVATE/SCHEDULED).
drop policy if exists "Post: service_role read all" on "Post";
create policy "Post: service_role read all"
  on "Post" for select to service_role using (true);

-- Service role: writes.
drop policy if exists "Post: service_role insert" on "Post";
create policy "Post: service_role insert"
  on "Post" for insert to service_role with check (true);

drop policy if exists "Post: service_role update" on "Post";
create policy "Post: service_role update"
  on "Post" for update to service_role using (true) with check (true);

drop policy if exists "Post: service_role delete" on "Post";
create policy "Post: service_role delete"
  on "Post" for delete to service_role using (true);

-- -----------------------------------------------------------------------------
-- CATEGORY policies — public SELECT (needed to render), writes service_role.
-- -----------------------------------------------------------------------------
drop policy if exists "Category: public read" on "Category";
create policy "Category: public read"
  on "Category" for select to anon, authenticated using (true);

drop policy if exists "Category: service_role write" on "Category";
create policy "Category: service_role write"
  on "Category" for all to service_role using (true) with check (true);

-- -----------------------------------------------------------------------------
-- TAG policies — public SELECT, writes service_role.
-- -----------------------------------------------------------------------------
drop policy if exists "Tag: public read" on "Tag";
create policy "Tag: public read"
  on "Tag" for select to anon, authenticated using (true);

drop policy if exists "Tag: service_role write" on "Tag";
create policy "Tag: service_role write"
  on "Tag" for all to service_role using (true) with check (true);

-- -----------------------------------------------------------------------------
-- POSTTAG policies — public SELECT (needed to render tags on a post),
-- writes service_role.
-- -----------------------------------------------------------------------------
drop policy if exists "PostTag: public read" on "PostTag";
create policy "PostTag: public read"
  on "PostTag" for select to anon, authenticated using (true);

drop policy if exists "PostTag: service_role write" on "PostTag";
create policy "PostTag: service_role write"
  on "PostTag" for all to service_role using (true) with check (true);

-- -----------------------------------------------------------------------------
-- MEDIA policies — public read (assets are public URLs), writes service_role.
-- -----------------------------------------------------------------------------
drop policy if exists "Media: public read" on "Media";
create policy "Media: public read"
  on "Media" for select to anon, authenticated using (true);

drop policy if exists "Media: service_role write" on "Media";
create policy "Media: service_role write"
  on "Media" for all to service_role using (true) with check (true);
