import { neon } from "@neondatabase/serverless";

// Client SQL condiviso dalle funzioni serverless. DATABASE_URL viene
// iniettata automaticamente da Vercel dopo aver collegato il database Neon.
export const sql = neon(process.env.DATABASE_URL);

export function cors(res) {
res.setHeader("Access-Control-Allow-Origin", "*");
res.setHeader("Access-Control-Allow-Methods", "GET, POST, PATCH, DELETE, OPTIONS");
res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
}
