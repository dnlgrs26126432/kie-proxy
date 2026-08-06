// Helper di ownership condivisi tra api/overlays.js e
// api/overlay-upload-token.js (entrambi devono verificare che il
// track/overlay appartenga a un progetto dell'utente autenticato).

export async function loadOwnedTrack(sql, trackId, userId) {
  const rows = await sql`
    select t.id as track_id, t.project_id
    from tracks t
    join projects p on p.id = t.project_id
    where t.id = ${trackId} and p.user_id = ${userId}
  `;
  return rows[0] || null;
}

export async function loadOwnedOverlay(sql, overlayId, userId) {
  const rows = await sql`
    select o.*
    from overlays o
    join projects p on p.id = o.project_id
    where o.id = ${overlayId} and p.user_id = ${userId}
  `;
  return rows[0] || null;
}
