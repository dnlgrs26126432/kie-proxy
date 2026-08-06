import { handleUpload } from "@vercel/blob/client";
import { sql, cors } from "./_db.js";
import { getUserFromRequest } from "./_auth.js";
import { loadOwnedTrack, loadOwnedOverlay } from "./_overlays.js";

// POST /api/overlay-upload-token -> genera un token firmato per l'upload
// client-to-blob (@vercel/blob/client). Evita di far passare l'audio (che
// puo' essere grosso, es. voce + intero brano mixato) dentro il body di una
// funzione serverless, dove sbatterebbe contro il limite di ~4.5MB.
//
// Il client (OverlayRecorder.jsx) chiama upload() con handleUploadUrl
// puntato qui; @vercel/blob/client fa lei stessa la richiesta a questo
// endpoint per ottenere il token PRIMA di caricare — l'ownership va quindi
// verificata qui, non dopo.
export default async function handler(req, res) {
  cors(res);
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST, OPTIONS");
    return res.status(405).json({ error: "Metodo non consentito" });
  }

  try {
    const user = await getUserFromRequest(req);
    if (!user) return res.status(401).json({ error: "Devi accedere" });

    const jsonResponse = await handleUpload({
      body: req.body,
      request: req,
      onBeforeGenerateToken: async (pathname, clientPayloadRaw) => {
        let payload;
        try {
          payload = JSON.parse(clientPayloadRaw || "{}");
        } catch {
          throw new Error("clientPayload non valido");
        }

        if (payload.kind === "raw") {
          const owned = await loadOwnedTrack(sql, payload.trackId, user.id);
          if (!owned) throw new Error("Track non trovato");
        } else if (payload.kind === "mixed") {
          const owned = await loadOwnedOverlay(sql, payload.overlayId, user.id);
          if (!owned) throw new Error("Overlay non trovato");
        } else {
          throw new Error("clientPayload.kind non riconosciuto");
        }

        return {
          allowedContentTypes: ["audio/webm", "audio/wav", "audio/ogg", "audio/mpeg"],
          maximumSizeInBytes: 50 * 1024 * 1024, // 50MB, generoso per qualche minuto di audio
          addRandomSuffix: true,
        };
      },
      // Il client ottiene gia' l'URL in modo sincrono dal ritorno di
      // upload(): non serve fare nulla qui, ma la callback e' obbligatoria.
      onUploadCompleted: async () => {},
    });

    return res.status(200).json(jsonResponse);
  } catch (e) {
    return res.status(400).json({ error: e.message });
  }
}
