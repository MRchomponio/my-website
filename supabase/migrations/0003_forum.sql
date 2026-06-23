-- ============================================================================
-- GameHub — Migration 0003: Game forum system (posts, replies, voting)
-- Run this AFTER 0001 and 0002 in the Supabase SQL Editor.
-- ============================================================================

-- Enum types --------------------------------------------------------------
create type post_category as enum ('question', 'tutorial', 'bug', 'discussion');

-- posts -----------------------------------------------------------------
create table public.posts (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references public.games (id) on delete cascade,
  author_id uuid not null references public.profiles (id) on delete cascade,
  title text not null check (char_length(title) between 5 and 150),
  body text not null check (char_length(body) between 1 and 10000),
  category post_category not null default 'discussion',
  is_pinned boolean not null default false,
  accepted_reply_id uuid, -- FK added after replies table exists (circular ref)
  view_count integer not null default 0,
  reply_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index posts_game_id_idx on public.posts (game_id, created_at desc);
create index posts_pinned_idx on public.posts (game_id, is_pinned desc, created_at desc);
create index posts_category_idx on public.posts (game_id, category);
create index posts_author_id_idx on public.posts (author_id);

-- Full text search index (title + body, weighted)
alter table public.posts add column search_vector tsvector
  generated always as (
    setweight(to_tsvector('simple', coalesce(title, '')), 'A') ||
    setweight(to_tsvector('simple', coalesce(body, '')), 'B')
  ) stored;

create index posts_search_idx on public.posts using gin (search_vector);

-- replies -----------------------------------------------------------------
create table public.replies (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts (id) on delete cascade,
  author_id uuid not null references public.profiles (id) on delete cascade,
  body text not null check (char_length(body) between 1 and 5000),
  upvote_count integer not null default 0,
  created_at timestamptz not null default now()
);

create index replies_post_id_idx on public.replies (post_id, created_at);

-- Now that replies exists, add the FK from posts.accepted_reply_id
alter table public.posts
  add constraint posts_accepted_reply_id_fkey
  foreign key (accepted_reply_id) references public.replies (id) on delete set null;

-- reply_votes (one upvote per user per reply) ------------------------------
create table public.reply_votes (
  reply_id uuid not null references public.replies (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (reply_id, user_id)
);

-- ============================================================================
-- Triggers: keep posts.reply_count and replies.upvote_count in sync
-- ============================================================================

create function public.handle_reply_change()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if (tg_op = 'INSERT') then
    update public.posts set reply_count = reply_count + 1 where id = new.post_id;
  elsif (tg_op = 'DELETE') then
    update public.posts set reply_count = greatest(reply_count - 1, 0) where id = old.post_id;
  end if;
  return null;
end;
$$;

create trigger on_reply_change
  after insert or delete on public.replies
  for each row execute function public.handle_reply_change();

create function public.handle_reply_vote_change()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if (tg_op = 'INSERT') then
    update public.replies set upvote_count = upvote_count + 1 where id = new.reply_id;
  elsif (tg_op = 'DELETE') then
    update public.replies set upvote_count = greatest(upvote_count - 1, 0) where id = old.reply_id;
  end if;
  return null;
end;
$$;

create trigger on_reply_vote_change
  after insert or delete on public.reply_votes
  for each row execute function public.handle_reply_vote_change();

-- Keep posts.updated_at fresh on edit
create function public.handle_post_update()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger on_post_update
  before update on public.posts
  for each row execute function public.handle_post_update();

-- ============================================================================
-- Row Level Security
-- ============================================================================

alter table public.posts enable row level security;
alter table public.replies enable row level security;
alter table public.reply_votes enable row level security;

-- posts: publicly readable; logged-in users can create; only the author can
-- edit their own post body/title/category; pinning and accepted-reply are
-- restricted to either the author (accepted reply) or an admin (pinning) —
-- enforced below with two separate, narrower update policies plus a check
-- in application code for which columns are being changed.
create policy "posts are publicly readable"
  on public.posts for select
  using (true);

create policy "logged in users can create posts"
  on public.posts for insert
  with check (auth.uid() = author_id);

create policy "author can update their own post"
  on public.posts for update
  using (auth.uid() = author_id)
  with check (auth.uid() = author_id);

create policy "admins can update any post"
  on public.posts for update
  using (exists (select 1 from public.profiles where id = auth.uid() and is_admin = true))
  with check (exists (select 1 from public.profiles where id = auth.uid() and is_admin = true));

create policy "author or admin can delete a post"
  on public.posts for delete
  using (
    auth.uid() = author_id
    or exists (select 1 from public.profiles where id = auth.uid() and is_admin = true)
  );

-- replies: publicly readable; logged-in users can create; only the author
-- can edit/delete their own reply (admins can also delete, for moderation).
create policy "replies are publicly readable"
  on public.replies for select
  using (true);

create policy "logged in users can create replies"
  on public.replies for insert
  with check (auth.uid() = author_id);

create policy "author can update their own reply"
  on public.replies for update
  using (auth.uid() = author_id)
  with check (auth.uid() = author_id);

create policy "author or admin can delete a reply"
  on public.replies for delete
  using (
    auth.uid() = author_id
    or exists (select 1 from public.profiles where id = auth.uid() and is_admin = true)
  );

-- reply_votes: publicly readable (to show vote counts/who voted); a user
-- can only insert/delete THEIR OWN vote.
create policy "reply votes are publicly readable"
  on public.reply_votes for select
  using (true);

create policy "users can upvote a reply themselves"
  on public.reply_votes for insert
  with check (auth.uid() = user_id);

create policy "users can remove their own upvote"
  on public.reply_votes for delete
  using (auth.uid() = user_id);

-- ============================================================================
-- Helper RPC: full text search across posts (used by the search bar)
-- ============================================================================

create function public.search_posts(search_query text, game_filter uuid default null)
returns setof public.posts
language sql
stable
as $$
  select *
  from public.posts
  where search_vector @@ websearch_to_tsquery('simple', search_query)
    and (game_filter is null or game_id = game_filter)
  order by ts_rank(search_vector, websearch_to_tsquery('simple', search_query)) desc
  limit 50;
$$;
