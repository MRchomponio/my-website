-- ============================================================================
-- GameHub — Migration 0008: Global search (posts, users, games, rooms)
-- Run this AFTER 0001–0007 in the Supabase SQL Editor.
-- ============================================================================

-- Trigram indexes power fast partial/fuzzy ILIKE matching on short text
-- fields (usernames, game names, room titles) — full-text search (used
-- for posts in migration 0003) is overkill for single-word/short-phrase
-- fields and trigram indexes match substrings better for this use case
-- (e.g. typing "val" should find "Valorant").
create extension if not exists pg_trgm;

create index profiles_username_trgm_idx on public.profiles using gin (username gin_trgm_ops);
create index games_name_trgm_idx on public.games using gin (name gin_trgm_ops);
create index rooms_title_trgm_idx on public.rooms using gin (title gin_trgm_ops);

-- ============================================================================
-- Unified search RPC: queries all four content types in one round trip
-- and returns a single ranked list the client can render directly,
-- instead of four separate sequential queries from the browser.
-- ============================================================================

create type search_result_type as enum ('post', 'user', 'game', 'room');

create or replace function public.global_search(p_query text, p_limit integer default 8)
returns table (
  result_type search_result_type,
  id uuid,
  title text,
  subtitle text,
  accent_color text,
  image_url text,
  slug text
)
language sql
stable
as $$
  (
    select
      'post'::search_result_type,
      p.id,
      p.title,
      g.name,
      g.accent_color,
      null::text,
      null::text
    from public.posts p
    join public.games g on g.id = p.game_id
    where p.search_vector @@ websearch_to_tsquery('simple', p_query)
    order by ts_rank(p.search_vector, websearch_to_tsquery('simple', p_query)) desc
    limit p_limit
  )
  union all
  (
    select
      'user'::search_result_type,
      pr.id,
      coalesce(pr.display_name, pr.username),
      '@' || pr.username,
      null::text,
      pr.avatar_url,
      pr.username
    from public.profiles pr
    where pr.username ilike '%' || p_query || '%'
       or pr.display_name ilike '%' || p_query || '%'
    order by pr.trust_score desc
    limit p_limit
  )
  union all
  (
    select
      'game'::search_result_type,
      ga.id,
      ga.name,
      ga.description,
      ga.accent_color,
      ga.icon_url,
      ga.slug
    from public.games ga
    where ga.name ilike '%' || p_query || '%'
    order by ga.name
    limit p_limit
  )
  union all
  (
    select
      'room'::search_result_type,
      r.id,
      r.title,
      g2.name,
      g2.accent_color,
      null::text,
      null::text
    from public.rooms r
    join public.games g2 on g2.id = r.game_id
    where r.title ilike '%' || p_query || '%'
      and r.status <> 'closed'
    order by r.created_at desc
    limit p_limit
  );
$$;
