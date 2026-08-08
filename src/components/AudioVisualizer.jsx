import { useRef, useEffect } from "react";

const BAR_BG = "#1E1E35";
const LED_OFF = "#252540";
const LED_GREEN = "#00D4AA";
const LED_YELLOW = "#F5C518";
const LED_RED = "#FF4444";

// Sensibilita' del meter: l'RMS di un mix musicale tipico e' basso
// (spesso 0.05-0.3), senza un moltiplicatore i LED non si accenderebbero mai.
const SENSITIVITY = 3.5;

function ledColor(ratio) {
  if (ratio < 0.6) return LED_GREEN;
  if (ratio < 0.85) return LED_YELLOW;
  return LED_RED;
}

function rms(dataArray) {
  let sum = 0;
  for (let i = 0; i < dataArray.length; i++) {
    const v = (dataArray[i] - 128) / 128;
    sum += v * v;
  }
  return Math.sqrt(sum / dataArray.length);
}

/**
 * AudioVisualizer
 * Player <audio> nativo + VU meter LED orizzontale a 2 canali (L/R),
 * verde -> giallo -> rosso al crescere del volume, come un mixer classico.
 * Calcolato interamente lato client via Web Audio API, nessun costo server.
 *
 * Nota: createMediaElementSource() collega l'elemento <audio> a un
 * AudioContext — richiede che l'audio sia servito con CORS permissivo
 * (Vercel Blob pubblico lo e' di default) e che l'elemento abbia
 * crossOrigin="anonymous", altrimenti il meter resta spento.
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

    let audioCtx, splitter, analyserL, analyserR, dataL, dataR, source;
    try {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      source = audioCtx.createMediaElementSource(audio);
      splitter = audioCtx.createChannelSplitter(2);
      analyserL = audioCtx.createAnalyser();
      analyserR = audioCtx.createAnalyser();
      analyserL.fftSize = 512;
      analyserR.fftSize = 512;

      source.connect(splitter);
      splitter.connect(analyserL, 0);
      splitter.connect(analyserR, 1);
      source.connect(audioCtx.destination);

      dataL = new Uint8Array(analyserL.fftSize);
      dataR = new Uint8Array(analyserR.fftSize);
    } catch {
      // Web Audio non disponibile o CORS bloccato: niente meter, il player
      // normale resta comunque funzionante.
      return;
    }

    const ctx = canvas.getContext("2d");
    const SEGMENTS = 30;
    const GAP = 2;
    const ROW_GAP = 5;

    function resize() {
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width * devicePixelRatio;
      canvas.height = rect.height * devicePixelRatio;
    }
    resize();
    window.addEventListener("resize", resize);

    function drawRow(yOffset, rowH, level) {
      const segW = (canvas.width - GAP * (SEGMENTS - 1)) / SEGMENTS;
      const litCount = Math.round(Math.min(1, level) * SEGMENTS);
      for (let i = 0; i < SEGMENTS; i++) {
        const ratio = i / (SEGMENTS - 1);
        ctx.fillStyle = i < litCount ? ledColor(ratio) : LED_OFF;
        ctx.fillRect(i * (segW + GAP), yOffset, segW, rowH);
      }
    }

    function draw() {
      rafRef.current = requestAnimationFrame(draw);
      analyserL.getByteTimeDomainData(dataL);
      analyserR.getByteTimeDomainData(dataR);
      const levelL = audio.paused ? 0 : rms(dataL) * SENSITIVITY;
      const levelR = audio.paused ? 0 : rms(dataR) * SENSITIVITY;

      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const rowH = (canvas.height - ROW_GAP) / 2;
      drawRow(0, rowH, levelL);
      drawRow(rowH + ROW_GAP, rowH, levelR);
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
        style={{ width: "100%", height: 28, marginTop: 6, borderRadius: 4, background: BAR_BG, display: "block" }}
      />
    </div>
  );
}
