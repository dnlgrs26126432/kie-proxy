import { useState, useRef, useCallback, useEffect } from "react";
import { upload } from "@vercel/blob/client";

// Stessi accenti cromatici della consolle (teal/viola), non i lime di consolle-1
const COLORS = {
  bg: "#0E0E1C",
  border: "#252540",
  accent: "#00D4AA",
  accentDim: "#00A386",
  textDim: "#5A5A80",
};

/**
 * OverlayRecorder
 * Flusso: registra voce/effetti in sincrono con un track gia' generato ->
 * mix semplice locale (nessuna AI, costo zero, passo obbligatorio prima del
 * successivo) -> rifinitura opzionale via kie.ai (upload-cover) che parte
 * dal mix, non dalla registrazione isolata, cosi' l'AI preserva la
 * performance reale invece di ignorarla generando voce da zero.
 *
 * A differenza della versione consolle-1: nessun client Supabase, upload
 * diretto client-to-blob via @vercel/blob/client (token firmato da
 * api/overlay-upload-token.js) per non sbattere contro il limite di body
 * delle funzioni serverless su file grandi, poi solo l'URL risultante va a
 * /api/overlays. Polling su /api/status gia' esistente (nessun callback).
 *
 * Props:
 *  - trackId: id del track (tabella tracks) da sovrapporre
 *  - baseAudioUrl: url del track gia' generato
 */
export default function OverlayRecorder({ trackId, baseAudioUrl }) {
  const [status, setStatus] = useState("idle"); // idle | recording | recorded | mixing | mixed | regenerating | done | error
  const [overlay, setOverlay] = useState(null);
  const [mixedUrl, setMixedUrl] = useState(null);
  const [resultUrl, setResultUrl] = useState(null);
  const [errorMsg, setErrorMsg] = useState(null);

  const basePlayerRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);
  const streamRef = useRef(null);

  const startRecording = useCallback(async () => {
    setErrorMsg(null);
    chunksRef.current = [];

    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    streamRef.current = stream;

    const mimeType = "audio/webm";
    const recorder = new MediaRecorder(stream, { mimeType });
    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };
    recorder.onstop = () => {
      stream.getTracks().forEach((t) => t.stop());
    };

    mediaRecorderRef.current = recorder;

    // Fai partire la base insieme alla registrazione, cosi' l'utente
    // canta/parla in sincrono con quello che sente.
    if (basePlayerRef.current) {
      basePlayerRef.current.currentTime = 0;
      await basePlayerRef.current.play();
    }

    recorder.start();
    setStatus("recording");
  }, []);

  const stopRecording = useCallback(async () => {
    mediaRecorderRef.current?.stop();
    basePlayerRef.current?.pause();

    // Aspetta che l'ultimo chunk arrivi
    await new Promise((resolve) => setTimeout(resolve, 300));

    try {
      // Il type forzato qui non basta da solo: alcuni browser (visto su
      // Windows) riportano "video/webm" dal MediaRecorder anche per una
      // registrazione solo audio, e senza un contentType esplicito passato
      // a upload() sotto, quel valore ambiguo puo' propagarsi fino allo
      // storage (l'estensione .webm da sola mappa di default a video/webm
      // nei database MIME standard).
      const blob = new Blob(chunksRef.current, { type: "audio/webm" });

      const uploaded = await upload(`overlays/raw-${trackId}-${Date.now()}.webm`, blob, {
        access: "public",
        contentType: "audio/webm",
        handleUploadUrl: "/api/overlay-upload-token",
        clientPayload: JSON.stringify({ kind: "raw", trackId }),
      });

      const res = await fetch("/api/overlays", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ trackId, audioUrl: uploaded.url, overlayType: "voice" }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data.error || `Errore ${res.status}`);
        setStatus("error");
        return;
      }
      setOverlay(data.overlay);
      setStatus("recorded");
    } catch (err) {
      setErrorMsg("Errore salvataggio registrazione: " + err.message);
      setStatus("error");
    }
  }, [trackId]);

  // Alternativa alla registrazione dal microfono: carica un file gia'
  // pronto dal PC (es. una registrazione fatta altrove). Utile anche per
  // isolare se un problema e' nel mixaggio/upload fatto in browser o a
  // valle (kie.ai) — con un file diverso e riconoscibile si vede subito se
  // la rigenerazione AI ne tiene conto o no.
  const uploadFromFile = useCallback(
    async (file) => {
      if (!file) return;
      setErrorMsg(null);
      setStatus("mixing"); // riusa lo stesso indicatore "in corso" del mix

      try {
        const uploaded = await upload(`overlays/raw-${trackId}-${Date.now()}-${file.name}`, file, {
          access: "public",
          contentType: file.type || "audio/mpeg",
          handleUploadUrl: "/api/overlay-upload-token",
          clientPayload: JSON.stringify({ kind: "raw", trackId }),
        });

        const res = await fetch("/api/overlays", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ trackId, audioUrl: uploaded.url, overlayType: "voice" }),
        });
        const data = await res.json();
        if (!res.ok) {
          setErrorMsg(data.error || `Errore ${res.status}`);
          setStatus("error");
          return;
        }
        setOverlay(data.overlay);
        setStatus("recorded");
      } catch (err) {
        setErrorMsg("Errore caricamento file: " + err.message);
        setStatus("error");
      }
    },
    [trackId]
  );

  // --- Mix semplice, nessuna chiamata AI, costo zero ---
  const mixSimple = useCallback(async () => {
    if (!overlay) return;
    setStatus("mixing");
    setErrorMsg(null);

    try {
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

      const [baseBuf, overlayBuf] = await Promise.all(
        [baseAudioUrl, overlay.raw_audio_url].map(async (url) => {
          const res = await fetch(url);
          const arrayBuf = await res.arrayBuffer();
          return audioCtx.decodeAudioData(arrayBuf);
        })
      );

      const duration = Math.max(baseBuf.duration, overlayBuf.duration);
      const offlineCtx = new OfflineAudioContext(2, Math.ceil(audioCtx.sampleRate * duration), audioCtx.sampleRate);

      const baseSource = offlineCtx.createBufferSource();
      baseSource.buffer = baseBuf;
      baseSource.connect(offlineCtx.destination);
      baseSource.start(0);

      const overlaySource = offlineCtx.createBufferSource();
      overlaySource.buffer = overlayBuf;
      overlaySource.connect(offlineCtx.destination);
      overlaySource.start(0);

      const mixedBuffer = await offlineCtx.startRendering();
      const wavBlob = audioBufferToWav(mixedBuffer);

      const uploaded = await upload(`overlays/mixed-${overlay.id}-${Date.now()}.wav`, wavBlob, {
        access: "public",
        contentType: "audio/wav",
        handleUploadUrl: "/api/overlay-upload-token",
        clientPayload: JSON.stringify({ kind: "mixed", overlayId: overlay.id }),
      });

      const res = await fetch(`/api/overlays?id=${overlay.id}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mixedAudioUrl: uploaded.url }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data.error || `Errore ${res.status}`);
        setStatus("error");
        return;
      }

      setOverlay(data.overlay);
      setMixedUrl(data.overlay.mixed_audio_url);
      setStatus("mixed");
    } catch (err) {
      setErrorMsg("Errore mix: " + err.message);
      setStatus("error");
    }
  }, [baseAudioUrl, overlay]);

  // --- Rifinitura AI del mix gia' fatto (upload-cover di kie.ai) ---
  const regenerateWithAI = useCallback(
    async (mode = "cover") => {
      if (!overlay) return;
      setStatus("regenerating");
      setErrorMsg(null);

      try {
        const res = await fetch("/api/regenerate-overlay", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ overlayId: overlay.id, mode }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || `Errore ${res.status}`);

        await pollRegeneration(overlay.id, data.taskId);
      } catch (err) {
        setErrorMsg("Errore rigenerazione: " + err.message);
        setStatus("error");
      }
    },
    [overlay]
  );

  const pollRegeneration = useCallback(async (overlayId, taskId) => {
    const maxAttempts = 40; // ~2 minuti a 3s di intervallo
    for (let i = 0; i < maxAttempts; i++) {
      await new Promise((r) => setTimeout(r, 3000));

      const sr = await fetch(`/api/status?taskId=${taskId}`, { credentials: "include" });
      const sd = await sr.json();
      const taskData = sd?.data || sd;
      const st = taskData?.status;
      const clips = taskData?.response?.sunoData || taskData?.sunoData || taskData?.clips || [];

      if (st === "SUCCESS" && clips.length > 0) {
        const url = clips[0]?.audio_url || clips[0]?.audioUrl || clips[0]?.url;
        await fetch(`/api/overlays?id=${overlayId}`, {
          method: "PATCH",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ regeneration_status: "completed", regenerated_audio_url: url }),
        });
        setResultUrl(url);
        setStatus("done");
        return;
      }
      if (["CREATE_TASK_FAILED", "GENERATE_AUDIO_FAILED", "CALLBACK_EXCEPTION", "SENSITIVE_WORD_ERROR"].includes(st)) {
        const msg = taskData?.errorMessage || taskData?.msg || "Rigenerazione fallita";
        await fetch(`/api/overlays?id=${overlayId}`, {
          method: "PATCH",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ regeneration_status: "failed", regeneration_error: msg }),
        });
        setErrorMsg(msg);
        setStatus("error");
        return;
      }
    }
    setErrorMsg("Timeout: la rigenerazione sta impiegando piu' del previsto, controlla tra poco");
    setStatus("error");
  }, []);

  // Al mount (anche dopo un refresh) ricostruisce lo stato da quanto gia'
  // salvato nel DB per questo track, invece di ripartire sempre da "idle":
  // senza questo, un refresh durante una rigenerazione AI in corso fa
  // perdere ogni traccia visibile del lavoro (il polling client-side muore
  // con la pagina, e regeneration_status resta "pending" per sempre senza
  // che nessuno lo riprenda).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/overlays?trackId=${trackId}`, { credentials: "include" });
        const data = await res.json();
        if (cancelled || !res.ok || !data.overlay) return;

        const ov = data.overlay;
        setOverlay(ov);

        if (ov.regeneration_status === "completed" && ov.regenerated_audio_url) {
          setResultUrl(ov.regenerated_audio_url);
          setStatus("done");
        } else if (ov.regeneration_status === "pending" && ov.regeneration_task_id) {
          setStatus("regenerating");
          pollRegeneration(ov.id, ov.regeneration_task_id);
        } else if (ov.mixed_audio_url) {
          setMixedUrl(ov.mixed_audio_url);
          setStatus("mixed");
        } else if (ov.raw_audio_url) {
          setStatus("recorded");
        }
      } catch {
        /* nessun overlay pregresso o errore di rete: si resta su idle */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [trackId, pollRegeneration]);

  // Permette di rifare la registrazione senza dover ricaricare la pagina:
  // l'overlay precedente resta nel DB (nessuna cancellazione), la prossima
  // registrazione ne crea semplicemente uno nuovo per lo stesso track.
  const resetToIdle = useCallback(() => {
    setOverlay(null);
    setMixedUrl(null);
    setResultUrl(null);
    setErrorMsg(null);
    setStatus("idle");
  }, []);

  return (
    <div
      style={{
        background: COLORS.bg,
        border: `1px solid ${COLORS.border}`,
        borderRadius: 8,
        padding: 16,
        marginTop: 10,
        fontFamily: "'JetBrains Mono', monospace",
      }}
    >
      <div style={{ color: COLORS.accent, fontSize: 11, letterSpacing: 1, marginBottom: 10, textTransform: "uppercase", fontWeight: 700 }}>
        Overlay: registra sopra questo brano
      </div>

      <audio ref={basePlayerRef} src={baseAudioUrl} style={{ display: "none" }} />

      {status === "idle" && (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <button onClick={startRecording} style={buttonStyle(COLORS.accent, "#001A16")}>
            ● Registra sopra la base
          </button>
          <label style={{ ...buttonStyle("transparent", COLORS.textDim), cursor: "pointer" }}>
            📁 Carica file dal PC
            <input
              type="file"
              accept="audio/*"
              style={{ display: "none" }}
              onChange={(e) => uploadFromFile(e.target.files?.[0])}
            />
          </label>
        </div>
      )}

      {status === "recording" && (
        <button onClick={stopRecording} style={buttonStyle("#FF4444", "#FFFFFF")}>
          ■ Stop registrazione
        </button>
      )}

      {status === "recorded" && (
        <button onClick={mixSimple} style={buttonStyle(COLORS.accentDim, "#001A16")}>
          Mix semplice (istantaneo, nessun costo AI)
        </button>
      )}

      {(status === "mixing" || status === "regenerating") && (
        <p style={{ color: COLORS.accent, fontSize: 12 }}>
          {status === "mixing" ? "Mixaggio in corso…" : "Rifinitura AI in corso, può richiedere un minuto…"}
        </p>
      )}

      {status === "mixed" && mixedUrl && (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <audio controls src={mixedUrl} style={{ width: "100%", height: 34 }} />
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <a
              href={mixedUrl}
              download={`overlay-mix-${trackId}.wav`}
              style={{ ...buttonStyle(COLORS.accentDim, "#001A16"), textDecoration: "none", display: "inline-block" }}
            >
              ↓ Scarica mix
            </a>
            <button onClick={resetToIdle} style={buttonStyle("transparent", COLORS.textDim)}>
              🔁 Registra di nuovo
            </button>
          </div>
          <p style={{ color: COLORS.textDim, fontSize: 11 }}>
            Il mix locale è già il risultato finito e salvato. In alternativa puoi provare una reinterpretazione
            AI (kie.ai riscrive voce e arrangiamento intorno alla melodia, non è una rifinitura 1:1):
          </p>
          <button onClick={() => regenerateWithAI("cover")} style={buttonStyle(COLORS.accent, "#001A16")}>
            Genera una cover AI ispirata al mix
          </button>
        </div>
      )}

      {status === "done" && resultUrl && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <p style={{ color: COLORS.accent, fontSize: 12 }}>Pronto:</p>
          <audio controls src={resultUrl} style={{ width: "100%", height: 34 }} />
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <a
              href={resultUrl}
              download={`overlay-cover-${trackId}.mp3`}
              style={{ ...buttonStyle(COLORS.accentDim, "#001A16"), textDecoration: "none", display: "inline-block" }}
            >
              ↓ Scarica
            </a>
            <button onClick={resetToIdle} style={buttonStyle("transparent", COLORS.textDim)}>
              🔁 Registra di nuovo
            </button>
          </div>
        </div>
      )}

      {status === "error" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <p style={{ color: "#FF6B6B", fontSize: 12 }}>{errorMsg}</p>
          <button onClick={resetToIdle} style={buttonStyle("transparent", COLORS.textDim)}>
            🔁 Riprova
          </button>
        </div>
      )}
    </div>
  );
}

function buttonStyle(bg, color) {
  return {
    background: bg,
    color,
    border: "none",
    borderRadius: 6,
    padding: "9px 14px",
    fontFamily: "'JetBrains Mono', monospace",
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: 0.5,
    cursor: "pointer",
    textTransform: "uppercase",
  };
}

// Utility minimale per convertire un AudioBuffer in WAV Blob
function audioBufferToWav(buffer) {
  const numChannels = buffer.numberOfChannels;
  const length = buffer.length * numChannels * 2 + 44;
  const arrBuffer = new ArrayBuffer(length);
  const view = new DataView(arrBuffer);
  const writeString = (offset, str) => {
    for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
  };

  writeString(0, "RIFF");
  view.setUint32(4, length - 8, true);
  writeString(8, "WAVE");
  writeString(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, numChannels, true);
  view.setUint32(24, buffer.sampleRate, true);
  view.setUint32(28, buffer.sampleRate * numChannels * 2, true);
  view.setUint16(32, numChannels * 2, true);
  view.setUint16(34, 16, true);
  writeString(36, "data");
  view.setUint32(40, length - 44, true);

  let offset = 44;
  for (let i = 0; i < buffer.length; i++) {
    for (let ch = 0; ch < numChannels; ch++) {
      const sample = Math.max(-1, Math.min(1, buffer.getChannelData(ch)[i]));
      view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
      offset += 2;
    }
  }

  return new Blob([arrBuffer], { type: "audio/wav" });
}
