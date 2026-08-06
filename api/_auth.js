import crypto from "crypto";
import bcrypt from "bcryptjs";
import { sql } from "./_db.js";

// Segreto derivato da DATABASE_URL: stabile per questo deployment, senza dover
// aggiungere una nuova env var. Se DATABASE_URL non e' presente si usa un
// fallback fisso (solo per sviluppo locale).
const SECRET = crypto
  .createHmac("sha256", process.env.DATABASE_URL || "kie-proxy-fallback-secret")
  .update("jwt-secret-v1")
  .digest("hex");

function base64url(input) {
  return Buffer.from(input).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function base64urlDecode(input) {
  input = input.replace(/-/g, "+").replace(/_/g, "/");
  while (input.length % 4) input += "=";
  return Buffer.from(input, "base64").toString();
}
function sign(data) {
  return crypto.createHmac("sha256", SECRET).update(data).digest("base64")
    .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function signToken(payload, expiresInSec = 60 * 60 * 24 * 30) {
  const header = { alg: "HS256", typ: "JWT" };
  const body = { ...payload, exp: Math.floor(Date.now() / 1000) + expiresInSec };
  const h = base64url(JSON.stringify(header));
  const p = base64url(JSON.stringify(body));
  return `${h}.${p}.${sign(`${h}.${p}`)}`;
}

export function verifyToken(token) {
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [h, p, sig] = parts;
  if (sig !== sign(`${h}.${p}`)) return null;
  try {
    const payload = JSON.parse(base64urlDecode(p));
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}

export function parseCookies(req) {
  const header = req.headers.cookie;
  const out = {};
  if (!header) return out;
  header.split(";").forEach((pair) => {
    const idx = pair.indexOf("=");
    if (idx === -1) return;
    out[pair.slice(0, idx).trim()] = decodeURIComponent(pair.slice(idx + 1).trim());
  });
  return out;
}

export function setAuthCookie(res, token) {
  const maxAge = 60 * 60 * 24 * 30;
  const secure = process.env.VERCEL ? "; Secure" : "";
  res.setHeader("Set-Cookie", `msp_session=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure}`);
}

export function clearAuthCookie(res) {
  const secure = process.env.VERCEL ? "; Secure" : "";
  res.setHeader("Set-Cookie", `msp_session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secure}`);
}

export async function getUserFromRequest(req) {
  const cookies = parseCookies(req);
  const payload = verifyToken(cookies.msp_session);
  if (!payload || !payload.uid) return null;
  const rows = await sql`
    select id, name, email, plan, generation_count, ai_text_count, generation_reset_at, created_at
    from users where id = ${payload.uid}
  `;
  return rows[0] || null;
}

export async function hashPassword(pw) {
  return bcrypt.hash(pw, 10);
}
export async function comparePassword(pw, hash) {
  return bcrypt.compare(pw, hash);
}

// Token di reset password: generato casualmente, mai salvato in chiaro nel DB
// (solo il suo hash), scade dopo RESET_TOKEN_TTL_MIN minuti, uso singolo.
export const RESET_TOKEN_TTL_MIN = 60;

export function generateResetToken() {
  return crypto.randomBytes(32).toString("hex");
}

export function hashResetToken(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

function currentMonthKey(d = new Date()) {
  return `${d.getUTCFullYear()}-${d.getUTCMonth()}`;
}

// Controlla il contatore mensile indicato (generation_count o ai_text_count),
// azzerando entrambi i contatori insieme se e' iniziato un nuovo mese solare.
// Ritorna { ok, count } senza incrementare: l'incremento resta a carico
// dell'endpoint chiamante dopo che l'operazione e' andata a buon fine.
export async function checkMonthlyLimit(user, field, limit) {
  if (!Number.isFinite(limit)) return { ok: true, count: 0 };
  const resetKey = user.generation_reset_at ? currentMonthKey(new Date(user.generation_reset_at)) : null;
  const nowKey = currentMonthKey();
  let audioCount = user.generation_count || 0;
  let textCount = user.ai_text_count || 0;
  if (resetKey !== nowKey) {
    audioCount = 0;
    textCount = 0;
    await sql`update users set generation_count = 0, ai_text_count = 0, generation_reset_at = now() where id = ${user.id}`;
  }
  const count = field === "generation_count" ? audioCount : textCount;
  return { ok: count < limit, count };
}

// Limiti dei piani. Infinity = illimitato (usato solo per i progetti salvati:
// generazioni audio e testi AI hanno sempre un tetto, anche generoso, per
// proteggere il margine dai casi limite).
export const PLAN_LIMITS = {
  free: { projects: 2, generationsPerMonth: 5, aiTextCallsPerMonth: 20 },
  pro: { projects: Infinity, generationsPerMonth: 50, aiTextCallsPerMonth: 300 },
  studio: { projects: Infinity, generationsPerMonth: 500, aiTextCallsPerMonth: 800 },
};
