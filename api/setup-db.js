import { sql, cors } from "./_db.js";

// GET /api/setup-db  -> crea le tabelle projects/tracks se non esistono (idempotente).
// Endpoint di bootstrap: da rimuovere una volta creato lo schema sul database.
export default async function handler(req, res) {
  cors(res);
  if (req.method === "OPTIONS") return res.status(200).end();

  try {
    await sql`create extension if not exists "pgcrypto"`;

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

    return res.status(200).json({ ok: true, message: "Schema creato o gia' esistente." });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
