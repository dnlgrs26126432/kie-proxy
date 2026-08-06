import { sql, cors } from "./_db.js";

// GET /api/setup-db  -> crea/aggiorna lo schema (idempotente): utenti, progetti, brani.
// Endpoint di bootstrap: da rimuovere una volta completata la migrazione.
export default async function handler(req, res) {
  cors(res);
  if (req.method === "OPTIONS") return res.status(200).end();

  try {
    await sql`create extension if not exists "pgcrypto"`;

    await sql`
      create table if not exists users (
        id uuid primary key default gen_random_uuid(),
        name text not null,
        email text not null unique,
        password_hash text not null,
        plan text not null default 'free',
        generation_count integer not null default 0,
        generation_reset_at timestamptz not null default now(),
        created_at timestamptz not null default now()
      )
    `;
    // migrazione da versione precedente senza contatore testi AI
    await sql`alter table users add column if not exists ai_text_count integer not null default 0`;
    // migrazione: blocco account dopo troppi login falliti
    await sql`alter table users add column if not exists failed_login_count integer not null default 0`;
    await sql`alter table users add column if not exists locked_until timestamptz`;
    // migrazione: recupero password
    await sql`alter table users add column if not exists reset_token_hash text`;
    await sql`alter table users add column if not exists reset_token_expires timestamptz`;

    await sql`
      create table if not exists projects (
        id uuid primary key default gen_random_uuid(),
        title text not null default 'Untitled',
        genre text not null default 'Trap',
        custom_genre text,
        mood text not null default 'Dark',
        bpm integer not null default 120,
        key_signature text not null default 'C',
        scale text not null default 'Minore',
        sections jsonb not null default '[]'::jsonb,
        lyrics jsonb not null default '{}'::jsonb,
        energy integer not null default 80,
        darkness integer not null default 70,
        reference_artist text,
        duration_seconds integer not null default 120,
        instrumental boolean not null default false,
        director_notes text,
        concept text,
        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now()
      )
    `;
    // migrazione da versione precedente senza collegamento all'utente
    await sql`alter table projects add column if not exists user_id uuid references users(id) on delete cascade`;

    await sql`
      create table if not exists tracks (
        id uuid primary key default gen_random_uuid(),
        project_id uuid not null references projects(id) on delete cascade,
        title text,
        audio_url text not null,
        source_url text,
        take_index integer not null default 0,
        duration_seconds numeric,
        created_at timestamptz not null default now()
      )
    `;

    await sql`create index if not exists idx_tracks_project_id on tracks(project_id)`;
    await sql`create index if not exists idx_projects_updated_at on projects(updated_at desc)`;
    await sql`create index if not exists idx_projects_user_id on projects(user_id)`;

    return res.status(200).json({ ok: true, message: "Schema creato/aggiornato." });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
