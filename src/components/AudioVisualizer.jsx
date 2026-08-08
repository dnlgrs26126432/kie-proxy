import { useRef, useEffect } from "react";

// Stessi accenti cromatici della consolle (teal/viola)
const M = "#00D4AA", V = "#6C3BFF", BAR_BG = "#1E1E35";

/**
 * AudioVisualizer
 * Player <audio> nativo + barra LED che reagisce in tempo reale al ritmo,
 * via Web Audio API (AnalyserNode sui dati di frequenza). Nessun costo
 * server: tutto calcolato lato client mentre il brano suona.
 *
 * Nota: createMediaElementSource() collega l'elemento <audio> a un
 * AudioContext — richiede che l'audio sia servito con CORS permissivo
 * (Vercel Blob pubblico lo e' di default) e che l'elemento abbia
 * crossOrigin="anonymous", altrimenti l'analyser resta a zero.
 *
 * Props:
 *  - src: url del brano
 *  - style: stile extra opzionale per l'elemento <audio>
 */
export default function AudioVisualizer({ src, style }) {
  const audioRef = useRef(null);
  const canvasRef = useRef(null);
  const rafRef = useRef(null);

  useEffect(() => {
    const audio = audioRef.current;
    const canvas = canvasRef.current;
    if (!audio || !canvas) return;

    let audioCtx, analyser, dataArray, source;
    try {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      source = audioCtx.createMediaElementSource(audio);
      analyser = audioCtx.createAnalyser();
      analyser.fftSize = 64;
      analyser.smoothingTimeConstant = 0.75;
      source.connect(analyser);
      analyser.connect(audioCtx.destination);
      dataArray = new Uint8Array(analyser.frequencyBinCount);
    } catch {
      // Web Audio non disponibile o CORS bloccato: niente barra, il player
      // normale resta comunque funzionante.
      return;
    }

    const ctx = canvas.getContext("2d");
    const BAR_COUNT = 28;
    const GAP = 2;

    function resize() {
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width * devicePixelRatio;
      canvas.height = rect.height * devicePixelRatio;
    }
    resize();
    window.addEventListener("resize", resize);

    function draw() {
      rafRef.current = requestAnimationFrame(draw);
      analyser.getByteFrequencyData(dataArray);

      const w = canvas.width, h = canvas.height;
      ctx.clearRect(0, 0, w, h);

      const barWidth = (w - GAP * (BAR_COUNT - 1)) / BAR_COUNT;
      for (let i = 0; i < BAR_COUNT; i++) {
        const idx = Math.floor((i * dataArray.length) / BAR_COUNT);
        const value = audio.paused ? 0 : dataArray[idx] / 255;
        const barH = Math.max(h * 0.06, value * h);
        const x = i * (barWidth + GAP);
        const y = h - barH;

        const grad = ctx.createLinearGradient(0, h, 0, 0);
        grad.addColorStop(0, M);
        grad.addColorStop(0.7, M);
        grad.addColorStop(1, V);
        ctx.fillStyle = grad;
        ctx.fillRect(x, y, barWidth, barH);
      }
    }
    draw();

    const resumeCtx = () => {
      if (audioCtx.state === "suspended") audioCtx.resume();
    };
    audio.addEventListener("play", resumeCtx);

    return () => {
      window.removeEventListener("resize", resize);
      audio.removeEventListener("play", resumeCtx);
      cancelAnimationFrame(rafRef.current);
      audioCtx.close().catch(() => {});
    };
  }, []);

  return (
    <div>
      <audio
        ref={audioRef}
        src={src}
        controls
        crossOrigin="anonymous"
        style={{ width: "100%", height: 36, borderRadius: 8, ...style }}
      />
      <canvas
        ref={canvasRef}
        style={{ width: "100%", height: 32, marginTop: 6, borderRadius: 4, background: BAR_BG, display: "block" }}
      />
    </div>
  );
}
