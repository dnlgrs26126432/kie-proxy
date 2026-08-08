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

const DEFAULT_LAYER_PARAMS = { volume: 1, pan: 0 };

/**
 * OverlayRecorder
 * Flusso multi-traccia: registra/carica piu' layer (voce, strumento,
 * effetto) sopra un track gia' generato, regola volume/pan di ciascuno,
 * poi mixa tutto insieme (base + tutti i layer) in un unico file locale —
 * nessuna AI, costo zero, istantaneo. Il mix e' il risultato finito:
 * scaricabile e salvato automaticamente su tracks.overlay_mix_url.
 *
 * Volume/pan dei singoli layer sono stato locale (non persistito): si
 * regolano prima di "Mixa tutto", che li applica nel render finale.
 * Rifare il mix con impostazioni diverse sovrascrive semplicemente il
 * risultato precedente.
 *
 * Niente rifinitura AI (kie.ai upload-cover): abbandonata dopo vari
 * tentativi (audioWeight, prompt persistito, resume del polling) perche'
 * per design quell'endpoint reinterpreta l'intera canzone invece di
 * rifinire il mix 1:1, ed era comunque inaffidabile (timeout frequenti).
 * Non tocca in alcun modo la generazione AI della base sulla pagina
 * principale (Studio.jsx / api/generate.js), che resta separata e invariata.
 *
 * Props:
 *  - trackId: id del track (tabella tracks) da sovrapporre
 *  - baseAudioUrl: url del track gia' generato
 *  - initialMixUrl: tracks.overlay_mix_url gia' noto al caricamento (evita
 *    una fetch extra: il componente padre ce l'ha gia' nella riga track)
 */
export default function OverlayRecorder({ trackId, baseAudioUrl, initialMixUrl }) {
  const [layers, setLayers] = useState([]);
  const [layerParams, setLayerParams] = useState({}); // { [layerId]: { volume, pan } }
  const [mixUrl, setMixUrl] = useState(initialMixUrl || null);
  const [recording, setRecording] = useState(false);
  const [mixing, setMixing] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);

  const basePlayerRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);
  const streamRef = useRef(null);

  // Al mount ricarica i layer gia' salvati per questo track, invece di
  // ripartire sempre vuoto ignorando registrazioni fatte in una sessione
  // precedente.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/overlays?trackId=${trackId}`, { credentials: "include" });
        const data = await res.json();
        if (cancelled || !res.ok) return;
        const loaded = data.layers || [];
        setLayers(loaded);
        setLayerParams((prev) => {
          const next = { ...prev };
          loaded.forEach((l) => {
            if (!next[l.id]) next[l.id] = { ...DEFAULT_LAYER_PARAMS };
          });
          return next;
        });
      } catch {
        /* nessun layer pregresso o errore di rete: si resta vuoti */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [trackId]);

  const addLayer = useCallback((overlay) => {
    setLayers((prev) => [...prev, overlay]);
    setLayerParams((prev) => ({ ...prev, [overlay.id]: { ...DEFAULT_LAYER_PARAMS } }));
  }, []);

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
    setRecording(true);
  }, []);

  const stopRecording = useCallback(async () => {
    mediaRecorderRef.current?.stop();
    basePlayerRef.current?.pause();
    setRecording(false);

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
        return;
      }
      addLayer(data.overlay);
    } catch (err) {
      setErrorMsg("Errore salvataggio registrazione: " + err.message);
    }
  }, [trackId, addLayer]);

  // Alternativa alla registrazione dal microfono: carica un file gia'
  // pronto dal PC (es. uno strumento registrato altrove) come nuovo layer.
  const uploadFromFile = useCallback(
    async (file) => {
      if (!file) return;
      setErrorMsg(null);
      setUploading(true);

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
          return;
        }
        addLayer(data.overlay);
      } catch (err) {
        setErrorMsg("Errore caricamento file: " + err.message);
      } finally {
        setUploading(false);
      }
    },
    [trackId, addLayer]
  );

  const removeLayer = useCallback(async (id) => {
    setErrorMsg(null);
    try {
      const res = await fetch(`/api/overlays?id=${id}`, { method: "DELETE", credentials: "include" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setErrorMsg(data.error || `Errore ${res.status}`);
        return;
      }
      setLayers((prev) => prev.filter((l) => l.id !== id));
      setLayerParams((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
    } catch (err) {
      setErrorMsg("Errore rimozione layer: " + err.message);
    }
  }, []);

  const setLayerParam = useCallback((id, key, value) => {
    setLayerParams((prev) => ({ ...prev, [id]: { ...(prev[id] || DEFAULT_LAYER_PARAMS), [key]: value } }));
  }, []);

  // --- Mix multi-traccia: base + tutti i layer, ciascuno col proprio
  // volume/pan, renderizzati insieme offline. Nessuna chiamata AI. ---
  const mixAll = useCallback(async () => {
    if (layers.length === 0) return;
    setMixing(true);
    setErrorMsg(null);

    try {
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

      const urls = [baseAudioUrl, ...layers.map((l) => l.raw_audio_url)];
      const buffers = await Promise.all(
        urls.map(async (url) => {
          const res = await fetch(url);
          const arrayBuf = await res.arrayBuffer();
          return audioCtx.decodeAudioData(arrayBuf);
        })
      );

      const duration = Math.max(...buffers.map((b) => b.duration));
      const offlineCtx = new OfflineAudioContext(2, Math.ceil(audioCtx.sampleRate * duration), audioCtx.sampleRate);

      const baseSource = offlineCtx.createBufferSource();
      baseSource.buffer = buffers[0];
      baseSource.connect(offlineCtx.destination);
      baseSource.start(0);

      layers.forEach((layer, i) => {
        const params = layerParams[layer.id] || DEFAULT_LAYER_PARAMS;
        const source = offlineCtx.createBufferSource();
        source.buffer = buffers[i + 1];
        const gain = offlineCtx.createGain();
        gain.gain.value = params.volume;
        const panner = offlineCtx.createStereoPanner();
        panner.pan.value = params.pan;
        source.connect(gain).connect(panner).connect(offlineCtx.destination);
        source.start(0);
      });

      const mixedBuffer = await offlineCtx.startRendering();
      const wavBlob = audioBufferToWav(mixedBuffer);

      const uploaded = await upload(`overlays/mix-${trackId}-${Date.now()}.wav`, wavBlob, {
        access: "public",
        contentType: "audio/wav",
        handleUploadUrl: "/api/overlay-upload-token",
        clientPayload: JSON.stringify({ kind: "mixed", trackId }),
      });

      const res = await fetch(`/api/tracks?id=${trackId}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ overlay_mix_url: uploaded.url }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data.error || `Errore ${res.status}`);
        return;
      }
      setMixUrl(data.track.overlay_mix_url);
    } catch (err) {
      setErrorMsg("Errore mix: " + err.message);
    } finally {
      setMixing(false);
    }
  }, [baseAudioUrl, trackId, layers, layerParams]);

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

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginBottom: layers.length ? 14 : 0 }}>
        {!recording ? (
          <button onClick={startRecording} style={buttonStyle(COLORS.accent, "#001A16")}>
            ● Registra un layer
          </button>
        ) : (
          <button onClick={stopRecording} style={buttonStyle("#FF4444", "#FFFFFF")}>
            ■ Stop registrazione
          </button>
        )}
        <label style={{ ...buttonStyle("transparent", COLORS.textDim), cursor: uploading ? "default" : "pointer", opacity: uploading ? 0.6 : 1 }}>
          {uploading ? "⏳ Caricamento…" : "📁 Carica file dal PC"}
          <input
            type="file"
            accept="audio/*"
            disabled={uploading}
            style={{ display: "none" }}
            onChange={(e) => uploadFromFile(e.target.files?.[0])}
          />
        </label>
      </div>

      {layers.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 14 }}>
          {layers.map((layer, i) => {
            const params = layerParams[layer.id] || DEFAULT_LAYER_PARAMS;
            return (
              <div key={layer.id} style={{ background: "#161628", border: `1px solid ${COLORS.border}`, borderRadius: 6, padding: 10 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                  <span style={{ fontSize: 10, color: COLORS.textDim, textTransform: "uppercase" }}>
                    Layer {i + 1} · {layer.overlay_type}
                  </span>
                  <button onClick={() => removeLayer(layer.id)} style={{ background: "none", border: "none", color: "#FF6B6B", cursor: "pointer", fontSize: 12 }} aria-label="Rimuovi layer">
                    ✕
                  </button>
                </div>
                <audio controls src={layer.raw_audio_url} style={{ width: "100%", height: 30, marginBottom: 8 }} />
                <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
                  <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 10, color: COLORS.textDim, flex: 1, minWidth: 140 }}>
                    Volume
                    <input
                      type="range"
                      min={0}
                      max={1.5}
                      step={0.01}
                      value={params.volume}
                      onChange={(e) => setLayerParam(layer.id, "volume", Number(e.target.value))}
                      style={{ flex: 1, accentColor: COLORS.accent }}
                    />
                  </label>
                  <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 10, color: COLORS.textDim, flex: 1, minWidth: 140 }}>
                    Pan
                    <input
                      type="range"
                      min={-1}
                      max={1}
                      step={0.01}
                      value={params.pan}
                      onChange={(e) => setLayerParam(layer.id, "pan", Number(e.target.value))}
                      style={{ flex: 1, accentColor: COLORS.accent }}
                    />
                  </label>
                </div>
              </div>
            );
          })}

          <button onClick={mixAll} disabled={mixing} style={{ ...buttonStyle(COLORS.accentDim, "#001A16"), opacity: mixing ? 0.6 : 1 }}>
            {mixing ? "Mixaggio in corso…" : "🎚 Mixa tutto"}
          </button>
        </div>
      )}

      {mixUrl && (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <p style={{ color: COLORS.accent, fontSize: 12, margin: 0 }}>Mix finale:</p>
          <audio controls src={mixUrl} style={{ width: "100%", height: 34 }} />
          <a
            href={mixUrl}
            download={`overlay-mix-${trackId}.wav`}
            style={{ ...buttonStyle(COLORS.accentDim, "#001A16"), textDecoration: "none", display: "inline-block", width: "fit-content" }}
          >
            ↓ Scarica mix
          </a>
        </div>
      )}

      {errorMsg && <p style={{ color: "#FF6B6B", fontSize: 12 }}>{errorMsg}</p>}
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
