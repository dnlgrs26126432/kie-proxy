import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";

const GENRES = ["Trap","Hip-Hop","Drill","Pop","R&B","House","Phonk","Soul","Afrobeat","Indie"];
const MOODS  = ["Dark","Euphoric","Melancholic","Aggressive","Dreamy","Romantic","Mysterious","Cinematic"];
const KEYS   = ["C","C#","D","D#","E","F","F#","G","G#","A","A#","B"];
const SCALES = ["Minore","Maggiore","Dorica","Frigia","Pentatonica min"];
const SECS   = ["Intro","Verse 1","Pre-Chorus","Chorus","Verse 2","Bridge","Outro"];
const BPM_DEF= {Trap:145,"Hip-Hop":95,Drill:140,Pop:118,House:128,Phonk:142,Soul:88,Afrobeat:104,Indie:114};
const DURATIONS = [{v:30,l:"30s"},{v:60,l:"1 min"},{v:120,l:"2 min"},{v:180,l:"3 min"}];

const CNT_KEY = "msp_gen_count";
function loadCount(){ return parseInt(sessionStorage.getItem(CNT_KEY)||"0",10)||0; }
function bumpCount(){ const n=loadCount()+1; sessionStorage.setItem(CNT_KEY,String(n)); return n; }

function getChords(key,scale){
const N=["C","C#","D","D#","E","F","F#","G","G#","A","A#","B"];
const i=N.indexOf(key);
const M={
Minore:{s:[0,2,3,5,7,8,10],f:["m","°","","m","m","",""]},
Maggiore:{s:[0,2,4,5,7,9,11],f:["","m","m","","","m","°"]},
Dorica:{s:[0,2,3,5,7,9,10],f:["m","m","","","m","°",""]},
Frigia:{s:[0,1,3,5,7,8,10],f:["m","","m","m","°","","m"]},
"Pentatonica min":{s:[0,3,5,7,10],f:["m","","m","m",""]},
};
const {s,f}=M[scale]||M.Minore;
return s.map((v,j)=>N[(i+v)%12]+f[j]);
}

function parseChordToMidi(sym){
const N=["C#","D#","F#","G#","A#","C","D","E","F","G","A","B"];
let root="C", rest=sym;
for(const n of N){ if(sym.startsWith(n)){ root=n; rest=sym.slice(n.length); break; } }
const IDX=["C","C#","D","D#","E","F","F#","G","G#","A","A#","B"];
const base=60+IDX.indexOf(root);
const quality=rest.includes("m")?"min":rest.includes("°")?"dim":"maj";
const third=quality==="maj"?base+4:base+3;
const fifth=quality==="dim"?base+6:base+7;
return [base,third,fifth];
}

function varLen(value){
const bytes=[value & 0x7f];
value >>= 7;
while(value>0){ bytes.unshift((value & 0x7f)|0x80); value >>= 7; }
return bytes;
}

function Dot({bpm}){
const [on,setOn]=useState(false);
useEffect(()=>{
const id=setInterval(()=>{setOn(true);setTimeout(()=>setOn(false),80)},60000/bpm);
return()=>clearInterval(id);
},[bpm]);
return <div style={{width:8,height:8,borderRadius:"50%",background:on?"#00D4AA":"#1E2A28",boxShadow:on?"0 0 8px #00D4AA":"none",transition:"all 0.06s"}}/>;
}

function RefUpload({track,onSet,onClear,s}){
const inputRef=useRef(null);
const [err,setErr]=useState("");
function handleFile(e){
const f=e.target.files?.[0];
if(!f)return;
const ok=/\.(mp3|wav)$/i.test(f.name)||["audio/mpeg","audio/wav","audio/x-wav"].includes(f.type);
if(!ok){setErr("Formato non supportato: usa MP3 o WAV.");return;}
setErr("");
const url=URL.createObjectURL(f);
const a=new Audio(url);
a.onloadedmetadata=()=>onSet({url,name:f.name,duration:a.duration,size:f.size});
}
return(
<div>
<span style={s.lbl}>Traccia di riferimento</span>
{!track?(
<>
<input ref={inputRef} type="file" accept=".mp3,.wav,audio/mpeg,audio/wav,audio/x-wav" style={{display:"none"}} onChange={handleFile}/>
<button style={{...s.btn("g"),width:"100%",padding:"9px"}} onClick={()=>inputRef.current?.click()}>↑ Carica MP3/WAV</button>
{err&&<div style={{fontSize:10,color:"#FF5757",marginTop:5}}>{err}</div>}
</>
):(
<div style={{background:"#161628",border:"1px solid #252540",borderRadius:8,padding:10}}>
<div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6,gap:8}}>
<span style={{fontSize:11,color:"#F0F0FF",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{track.name}</span>
<button style={{background:"none",border:"none",color:"#5A5A80",cursor:"pointer",fontSize:13,flexShrink:0}} onClick={onClear} aria-label="Elimina traccia">✕</button>
</div>
<audio src={track.url} controls style={{width:"100%",height:28}}/>
<div style={{fontSize:9,color:"#5A5A80",marginTop:4,fontFamily:"'JetBrains Mono',monospace"}}>
{Number.isFinite(track.duration)?`${Math.floor(track.duration/60)}:${String(Math.round(track.duration%60)).padStart(2,"0")}`:"--:--"}
</div>
</div>
)}
</div>
);
}

export default function Studio(){
const params=useParams();
const navigate=useNavigate();
const routeId=params.id&&params.id!=="new"?params.id:null;

const [projectId,setProjectId]=useState(routeId);
const [loadingProject,setLoadingProject]=useState(!!routeId);
const [saving,setSaving]=useState(false);

const [tab,setTab]=useState("progetto");
const [genre,setGenre]=useState("Trap");
const [customGenre,setCustomGenre]=useState("");
const [mood,setMood]=useState("Dark");
const [bpm,setBpm]=useState(145);
const [key,setKey]=useState("F#");
const [scale,setScale]=useState("Minore");
const [title,setTitle]=useState("");
const [titleLoading,setTitleLoading]=useState(false);
const [concept,setConcept]=useState("");
const [sections,setSections]=useState(["Intro","Verse 1","Chorus","Verse 2","Bridge","Outro"]);
const [lyrics,setLyrics]=useState({});
const [activeSec,setActiveSec]=useState("Verse 1");
const [energy,setEnergy]=useState(80);
const [darkness,setDarkness]=useState(70);
const [refArtist,setRefArtist]=useState("");
const [duration,setDuration]=useState(120);
const [instrumental,setInstrumental]=useState(false);
const [directorNotes,setDirectorNotes]=useState("");
const [refTrack,setRefTrack]=useState(null);
const [showPreview,setShowPreview]=useState(false);
const [genCount,setGenCount]=useState(()=>loadCount());
const [aiOut,setAiOut]=useState("");
const [aiLoad,setAiLoad]=useState(false);
const [aiMode,setAiMode]=useState("");
const [genStatus,setGenStatus]=useState("");
const [generating,setGenerating]=useState(false);
const [tracks,setTracks]=useState([]);

const ch=getChords(key,scale);
const toggle=s=>setSections(p=>p.includes(s)?p.filter(x=>x!==s):[...p,s]);
const moveSection=(idx,dir)=>setSections(prev=>{
const next=[...prev];
const target=idx+dir;
if(target<0||target>=next.length)return prev;
[next[idx],next[target]]=[next[target],next[idx]];
return next;
});
const genreFull=genre+(customGenre.trim()?` / ${customGenre.trim()}`:"");
const durLabel=DURATIONS.find(d=>d.v===duration)?.l||"";

const V="#6C3BFF",M="#00D4AA",BG="#07070E",SF="#0E0E1C",CD="#161628",BR="#252540",TX="#F0F0FF",MU="#5A5A80";

// Carica il progetto salvato quando si apre /studio/:id
useEffect(()=>{
if(!routeId)return;
(async()=>{
setLoadingProject(true);
try{
const r=await fetch(`/api/projects/${routeId}`);
const d=await r.json();
if(d.project){
const p=d.project;
setTitle(p.title||"");
setGenre(p.genre||"Trap");
setCustomGenre(p.custom_genre||"");
setMood(p.mood||"Dark");
setBpm(p.bpm||120);
setKey(p.key_signature||"F#");
setScale(p.scale||"Minore");
setSections(p.sections&&p.sections.length?p.sections:["Intro","Verse 1","Chorus","Verse 2","Bridge","Outro"]);
setLyrics(p.lyrics||{});
setEnergy(p.energy??80);
setDarkness(p.darkness??70);
setRefArtist(p.reference_artist||"");
setDuration(p.duration_seconds||120);
setInstrumental(!!p.instrumental);
setDirectorNotes(p.director_notes||"");
setConcept(p.concept||"");
}
if(d.tracks)setTracks(d.tracks);
}catch{ /* progetto non trovato o errore rete: si resta su una sessione vuota */ }
setLoadingProject(false);
})();
},[routeId]);

function buildProjectPayload(){
return { title,genre,customGenre,mood,bpm,key,scale,sections,lyrics,energy,darkness,refArtist,duration,instrumental,directorNotes,concept };
}

const ensureProjectId=useCallback(async()=>{
if(projectId)return projectId;
const r=await fetch("/api/projects",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(buildProjectPayload())});
const d=await r.json();
if(!d.project)throw new Error(d.error||"Impossibile creare il progetto");
setProjectId(d.project.id);
navigate(`/studio/${d.project.id}`,{replace:true});
return d.project.id;
// eslint-disable-next-line react-hooks/exhaustive-deps
},[projectId,title,genre,customGenre,mood,bpm,key,scale,sections,lyrics,energy,darkness,refArtist,duration,instrumental,directorNotes,concept]);

async function saveProject(){
setSaving(true);
try{
const pid=projectId;
if(!pid){
await ensureProjectId();
}else{
const r=await fetch(`/api/projects/${pid}`,{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify(buildProjectPayload())});
const d=await r.json();
if(d.error)throw new Error(d.error);
}
}catch(e){ alert(e.message); }
setSaving(false);
}

const callAI=async(mode)=>{
setAiLoad(true);setAiMode(mode);setAiOut("");
const P={
testo:`Sei il ghostwriter italiano più forte. Scrivi testi COMPLETI per ogni sezione:
Titolo: "${title||"Untitled"}" | ${genreFull} | ${mood} | ${bpm} BPM | ${key} ${scale}
Concept: "${concept||"tema emotivo universale"}" | E:${energy}% D:${darkness}%${refArtist?`\nIspirati anche a: ${refArtist}.`:""}${directorNotes?`\nNote di regia: ${directorNotes}.`:""}
Struttura: ${sections.join(" → ")}
Formato: [SEZIONE]\ntesto...\nCrea hook memorabili, rime interne, flow perfetto per ${genreFull}.`,
idee:`Sei l'A&R italiano più influente. 5 concept hit pronti:
${genreFull} | ${mood} | ${bpm} BPM | E${energy}% D${darkness}% | Seed: "${concept||"nessun limite"}"${refArtist?` | Suona come: ${refArtist}`:""}
Per ognuno: 🎯 TITOLO · 📖 STORIA 2 righe · 🎤 HOOK 4 battute esatte · 🔗 DNA artista A x artista B`,
produzione:`Sei Metro Boomin + Charlie Charles. Breakdown tecnica per:
${genreFull} | ${mood} | ${bpm} BPM | ${key} ${scale} | Accordi: ${ch.slice(0,4).join("-")}${directorNotes?`\nNote di regia: ${directorNotes}.`:""}
• DRUM PATTERN · • MELODIA synth · • 808/BASSLINE · • ATMOSFERA fx · • 3 ref italiane + 3 internazionali`,
mood:`Direttore creativo sonoro XO/Republic Italy. Mood "${mood}" nel ${genreFull} | ${bpm} BPM | ${key} ${scale}
• Palette sonora dettagliata · • Processing chain · • Mood board 7 immagini · • Come differenziarsi nel 2025`,
titolo:`Genera SOLO un titolo di canzone (massimo 5 parole, senza virgolette, senza spiegazioni) per un brano ${genreFull}, mood ${mood}${concept?`, concept: "${concept}"`:""}. Rispondi solo col titolo.`,
};
try{
const r=await fetch("https://kie-proxy-three.vercel.app/api/ai",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({model:"claude-sonnet-5",max_tokens:mode==="titolo"?30:1000,messages:[{role:"user",content:P[mode]}]})});
const d=await r.json();
const text=d.content?.map(b=>b.text||"").join("")||"";
if(mode==="titolo"){
const t=text.replace(/^["'“”]+|["'“”]+$/g,"").split("\n")[0].trim();
if(t)setTitle(t);
}else{
setAiOut(text||"Nessuna risposta.");
}
setGenCount(bumpCount());
}catch{setAiOut(mode==="titolo"?"":"⚠ Errore connessione.");}
setAiLoad(false);
};

const generateTitle=async()=>{
setTitleLoading(true);
await callAI("titolo");
setTitleLoading(false);
};

const generateMusic=async()=>{
setGenerating(true);setGenStatus("⏳ Salvo il progetto...");
let pid;
try{ pid=await ensureProjectId(); }
catch(e){ setGenStatus(`❌ ${e.message}`); setGenerating(false); return; }

setGenStatus("⏳ Invio richiesta a kie.ai...");
const lyricsText=sections.map(s=>lyrics[s]?`[${s}]\n${lyrics[s]}`:"").filter(Boolean).join("\n\n");
const hasLyrics=lyricsText.length>0;
const stylePrompt=`${genreFull}, ${mood}, ${bpm} BPM, ${key} ${scale}, ${energy>60?"high energy":"moderate energy"}, ${darkness>60?"dark":"bright"} atmosphere${refArtist?`, sounds like ${refArtist}`:""}, target length ${durLabel}`;
const body={
model:"V4",
customMode:true,
instrumental:instrumental,
title:title||"Untitled",
style:stylePrompt.slice(0,200),
prompt:hasLyrics?lyricsText:`${genreFull} ${mood} song about ${concept||"emotions and life"}. ${bpm} BPM, ${key} ${scale}. Energy: ${energy}%.${directorNotes?` Direction: ${directorNotes}.`:""} Write powerful lyrics with a memorable hook.`,
negativeTags:"Heavy Metal, Noise, Distortion",
callBackUrl:"https://example.com/callback",
};
try{
const res=await fetch("https://kie-proxy-three.vercel.app/api/generate",{
method:"POST",
headers:{"Content-Type":"application/json"},
credentials:"include",
body:JSON.stringify(body),
});
if(!res.ok){
const e=await res.json().catch(()=>({}));
setGenStatus(`❌ ${e.error||e.message||e.msg||`Errore ${res.status}`}`);
setGenerating(false);return;
}
const data=await res.json();
const taskId=data?.data?.taskId||data?.taskId;
if(!taskId){setGenStatus("❌ Nessun taskId ricevuto — riprova");setGenerating(false);return;}
setGenStatus("⏳ Generazione in corso (~60-90s)...");
let att=0;
const poll=async()=>{
if(att++>50){setGenStatus("⏱ Timeout — riprova tra poco");setGenerating(false);return;}
try{
const sr=await fetch(`https://kie-proxy-three.vercel.app/api/status?taskId=${taskId}`,{
credentials:"include"
});
const sd=await sr.json();
const taskData=sd?.data||sd;
const status=taskData?.status;
const clips=taskData?.response?.sunoData||taskData?.sunoData||taskData?.clips||[];
if(status==="SUCCESS"&&clips.length>0){
setGenStatus("⏳ Salvataggio brani...");
const saved=[];
for(let i=0;i<clips.length;i++){
const clip=clips[i];
const url=clip?.audio_url||clip?.audioUrl||clip?.url;
if(!url)continue;
try{
const tr=await fetch("/api/tracks",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({project_id:pid,title:clip?.title||title||"Track",source_url:url,take_index:i,duration_seconds:clip?.duration||null})});
const td=await tr.json();
if(td.track)saved.push(td.track);
}catch{ /* singola take non salvata, si continua con le altre */ }
}
if(saved.length>0){
setTracks(p=>[...saved,...p]);
setGenStatus(`✓ ${saved.length} take pronte!`);
setTab("tracks");setGenerating(false);
setGenCount(bumpCount());
}else{
setGenStatus("❌ Audio generato ma non salvato — riprova");setGenerating(false);
}
}else if(status==="CREATE_TASK_FAILED"||status==="GENERATE_AUDIO_FAILED"||status==="CALLBACK_EXCEPTION"||status==="SENSITIVE_WORD_ERROR"){
setGenStatus("❌ Errore nella generazione — riprova");setGenerating(false);
}else{
const pct=Math.min(att*2,88);
setGenStatus(`⏳ ${pct}% — ${status||"elaborazione"}...`);
setTimeout(poll,3000);
}
}catch{setTimeout(poll,4000);}
};
setTimeout(poll,8000);
}catch(e){setGenStatus(`❌ ${e.message}`);setGenerating(false);}
};

const confirmGenerate=()=>{setShowPreview(false);generateMusic();};

async function deleteTrack(id){
setTracks(p=>p.filter(t=>t.id!==id));
try{ await fetch(`/api/tracks?id=${id}`,{method:"DELETE"}); }catch{ /* rimosso lato client comunque */ }
}

// Export PDF scheda tecnica
const exportPDF=()=>{
const win=window.open("","_blank");
if(!win)return;
const esc=t=>String(t||"").replace(/</g,"&lt;");
const rows=sections.map((sec,i)=>{
const cc=(i%2===0?ch:[...ch].reverse()).slice(0,4).join(" - ");
return `<div style="margin-bottom:14px"><div style="font-size:11px;font-weight:700;color:#555;text-transform:uppercase;letter-spacing:1px;margin-bottom:4px">${esc(sec)}</div><div style="font-size:12px;color:#333;margin-bottom:6px;font-family:monospace">${esc(cc)}</div><div style="white-space:pre-wrap;font-size:13px;color:#111;line-height:1.6">${esc(lyrics[sec]||"—")}</div></div>`;
}).join("");
win.document.write(`<!doctype html><html lang="it"><head><meta charset="utf-8"><title>Scheda tecnica — ${esc(title||"Untitled")}</title>
<style>body{font-family:Arial,sans-serif;color:#111;max-width:700px;margin:40px auto;padding:0 20px}
h1{font-size:24px;margin-bottom:4px}.sub{color:#666;font-size:12px;margin-bottom:24px}
.section{border:1px solid #ddd;border-radius:8px;padding:14px 16px;margin-bottom:16px}
.section h2{font-size:11px;text-transform:uppercase;letter-spacing:1px;color:#666;margin-bottom:10px}
.grid{display:grid;grid-template-columns:1fr 1fr;gap:8px 20px;font-size:13px}
.grid div span{color:#666;font-weight:600;margin-right:6px}
.pbtn{float:right;padding:8px 14px;background:#6C3BFF;color:#fff;border:none;border-radius:6px;cursor:pointer;font-family:Arial,sans-serif}
@media print{.pbtn{display:none}}
</style></head><body>
<button class="pbtn" onclick="window.print()">Stampa / Esporta PDF</button>
<h1>${esc(title||"Untitled")}</h1>
<div class="sub">Scheda tecnica — Music Studio Pro</div>
<div class="section"><h2>Parametri</h2><div class="grid">
<div><span>Genere:</span>${esc(genreFull)}</div>
<div><span>Mood:</span>${esc(mood)}</div>
<div><span>BPM:</span>${esc(bpm)}</div>
<div><span>Tonalità:</span>${esc(key+" "+scale)}</div>
<div><span>Energia:</span>${energy}%</div>
<div><span>Dark:</span>${darkness}%</div>
<div><span>Durata:</span>${esc(durLabel)}</div>
<div><span>Strumentale:</span>${instrumental?"Sì":"No"}</div>
</div></div>
<div class="section"><h2>Riferimento artistico</h2><div>${esc(refArtist||"—")}</div></div>
<div class="section"><h2>Note di regia</h2><div style="white-space:pre-wrap">${esc(directorNotes||"—")}</div></div>
<div class="section"><h2>Struttura e accordi</h2><div style="font-size:13px;margin-bottom:10px">${esc(sections.join(" → "))}</div>${rows}</div>
</body></html>`);
win.document.close();
};

// Export MIDI della progressione di accordi calcolata per la struttura corrente.
// Scritto a mano (nessuna libreria): Standard MIDI File formato 0, un accordo a
// blocco per battuta, tempo impostato sul BPM del progetto.
const exportMIDI=()=>{
const ticksPerBeat=480;
const durTicks=ticksPerBeat*4;
const chordSeq=[];
sections.forEach((sec,i)=>{
(i%2===0?ch:[...ch].reverse()).slice(0,4).forEach(c=>chordSeq.push(c));
});
if(chordSeq.length===0){alert("Aggiungi almeno una sezione alla struttura per esportare gli accordi.");return;}

const track=[];
const microsPerBeat=Math.round(60000000/bpm);
track.push(...varLen(0),0xFF,0x51,0x03,(microsPerBeat>>16)&0xff,(microsPerBeat>>8)&0xff,microsPerBeat&0xff);
chordSeq.forEach(sym=>{
const notes=parseChordToMidi(sym);
notes.forEach(n=>track.push(...varLen(0),0x90,n,90));
notes.forEach((n,ni)=>track.push(...varLen(ni===0?durTicks:0),0x80,n,64));
});
track.push(...varLen(0),0xFF,0x2F,0x00);

const header=[0x4D,0x54,0x68,0x64,0,0,0,6,0,0,0,1,(ticksPerBeat>>8)&0xff,ticksPerBeat&0xff];
const trackHeader=[0x4D,0x54,0x72,0x6B,(track.length>>>24)&0xff,(track.length>>>16)&0xff,(track.length>>>8)&0xff,track.length&0xff];
const bytes=new Uint8Array([...header,...trackHeader,...track]);
const blob=new Blob([bytes],{type:"audio/midi"});
const url=URL.createObjectURL(blob);
const a=document.createElement("a");
a.href=url;a.download=`${(title||"progressione").replace(/[^a-z0-9]/gi,"_")||"progressione"}.mid`;
document.body.appendChild(a);a.click();a.remove();
setTimeout(()=>URL.revokeObjectURL(url),1000);
};

const s={
inp:{background:SF,border:`1px solid ${BR}`,borderRadius:8,color:TX,fontFamily:"Inter,sans-serif",fontSize:13,padding:"9px 12px",outline:"none",width:"100%"},
lbl:{fontSize:10,fontWeight:700,letterSpacing:"1.5px",color:MU,textTransform:"uppercase",display:"block",marginBottom:8},
card:(g=false)=>({background:CD,border:`1px solid ${g?V+"55":BR}`,borderRadius:12,padding:16,...(g?{boxShadow:`0 0 20px ${V}11`}:{})}),
chip:(on,c=V)=>({padding:"5px 11px",borderRadius:6,border:`1px solid ${on?c:BR}`,background:on?c+"18":"transparent",color:on?c:MU,cursor:"pointer",fontSize:11,fontWeight:on?600:400,fontFamily:"Inter,sans-serif",transition:"all 0.12s"}),
btn:(v="p",full=false)=>{
const b={border:"none",borderRadius:8,cursor:"pointer",fontFamily:"Inter,sans-serif",fontWeight:700,fontSize:13,display:"flex",alignItems:"center",justifyContent:"center",gap:7,transition:"all 0.15s",...(full?{width:"100%",padding:"12px"}:{padding:"10px 16px"})};
if(v==="p")return{...b,background:`linear-gradient(135deg,${V},#9B6BFF)`,color:"#fff"};
if(v==="m")return{...b,background:`linear-gradient(135deg,${M},#00B8A0)`,color:"#001A16"};
if(v==="g")return{...b,background:"transparent",color:MU,border:`1px solid ${BR}`};
return{...b,background:"#1E1E35",color:TX,border:`1px solid ${BR}`,padding:"7px 12px",fontSize:12};
},
};

if(loadingProject){
return(
<div style={{height:"100vh",display:"flex",alignItems:"center",justifyContent:"center",background:BG,color:MU,fontFamily:"Inter,sans-serif",fontSize:13}}>
Caricamento progetto...
</div>
);
}

return(
<div style={{display:"flex",flexDirection:"column",height:"100vh",background:BG,fontFamily:"Inter,sans-serif",overflow:"hidden",color:TX}}>
<style>{`
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;600&display=swap');
*{box-sizing:border-box;margin:0;padding:0;}
::-webkit-scrollbar{width:3px}::-webkit-scrollbar-thumb{background:#6C3BFF88;border-radius:2px}
input[type=range]{-webkit-appearance:none;height:3px;border-radius:2px;outline:none;cursor:pointer;width:100%;background:#252540}
input[type=range]::-webkit-slider-thumb{-webkit-appearance:none;width:14px;height:14px;border-radius:50%;background:#F0F0FF;cursor:pointer}
textarea{resize:vertical}
@keyframes spin{to{transform:rotate(360deg)}}
`}</style>

{/* TOP BAR */}
<div style={{height:52,display:"flex",alignItems:"center",justifyContent:"space-between",padding:"0 16px",background:SF,borderBottom:`1px solid ${BR}`,flexShrink:0}}>
<div style={{display:"flex",alignItems:"center",gap:10}}>
<Link to="/dashboard" style={{textDecoration:"none",color:"inherit",display:"flex",alignItems:"center",gap:10}}>
<div style={{width:32,height:32,borderRadius:8,background:`linear-gradient(135deg,${V},#9B6BFF)`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:16}}>◈</div>
<div>
<div style={{fontSize:13,fontWeight:700}}>Music Studio <span style={{color:V}}>Pro</span></div>
<div style={{fontSize:9,color:MU,letterSpacing:"2px"}}>PROMO MUSIC ITALIA</div>
</div>
</Link>
</div>
<div style={{display:"flex",alignItems:"center",gap:12}}>
<div style={{display:"flex",alignItems:"center",gap:7}}><Dot bpm={bpm}/><span style={{fontFamily:"'JetBrains Mono',monospace",fontSize:16,color:M,fontWeight:600}}>{bpm}</span><span style={{color:MU,fontSize:10}}>BPM</span></div>
<div style={{width:1,height:16,background:BR}}/>
<span style={{fontFamily:"'JetBrains Mono',monospace",fontSize:13}}>{key} <span style={{color:MU}}>{scale.split(" ")[0]}</span></span>
<div style={{width:1,height:16,background:BR}}/>
<span style={{color:V,fontWeight:600,fontSize:12}}>{genre}{customGenre?` +${customGenre}`:""} · <span style={{color:MU,fontWeight:400}}>{mood}</span></span>
<div style={{width:1,height:16,background:BR}}/>
<span style={{display:"flex",alignItems:"center",gap:5,fontSize:11,color:MU,fontFamily:"'JetBrains Mono',monospace"}}>⚡ {genCount}</span>
{genStatus&&<span style={{fontSize:11,fontFamily:"'JetBrains Mono',monospace",color:genStatus.includes("✓")?M:genStatus.includes("❌")?"#FF5757":M,maxWidth:180,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{genStatus}</span>}
</div>
<div style={{display:"flex",gap:8}}>
<Link to="/dashboard" style={{...s.btn("g"),textDecoration:"none"}}>📁 Progetti</Link>
<button style={s.btn("g")} onClick={saveProject} disabled={saving}>{saving?"…":"💾 Salva"}</button>
<button style={s.btn("g")} onClick={exportMIDI} title="Esporta accordi in MIDI">🎼 MIDI</button>
<button style={s.btn("g")} onClick={exportPDF} title="Esporta scheda tecnica in PDF">📄 Scheda</button>
<button style={{...s.btn("m"),minWidth:150,opacity:generating?0.7:1}} onClick={()=>setShowPreview(true)} disabled={generating}>
{generating?<><div style={{width:12,height:12,border:"2px solid #00000033",borderTop:"2px solid #001A16",borderRadius:"50%",animation:"spin 0.7s linear infinite"}}/>Generazione...</>:<>◈ Genera Canzone</>}
</button>
</div>
</div>

{/* BODY */}
<div style={{display:"flex",flex:1,overflow:"hidden"}}>

{/* SIDEBAR */}
<div style={{width:225,flexShrink:0,background:SF,borderRight:`1px solid ${BR}`,overflowY:"auto",padding:"14px 12px",display:"flex",flexDirection:"column",gap:14}}>
<div>
<span style={s.lbl}>Titolo</span>
<div style={{display:"flex",gap:6}}>
<input style={{...s.inp,fontWeight:600}} placeholder="Nome brano..." value={title} onChange={e=>setTitle(e.target.value)}/>
<button style={{...s.btn("g"),padding:"0 12px",flexShrink:0}} onClick={generateTitle} disabled={titleLoading} title="Genera titolo con AI">{titleLoading?"…":"✦"}</button>
</div>
</div>
<div>
<span style={s.lbl}>Genere</span>
<div style={{display:"flex",flexWrap:"wrap",gap:4,marginBottom:6}}>{GENRES.map(g=><button key={g} style={s.chip(genre===g)} onClick={()=>{setGenre(g);setBpm(BPM_DEF[g]||120);}}>{g}</button>)}</div>
<input style={{...s.inp,fontSize:12}} placeholder="Genere personalizzato..." value={customGenre} onChange={e=>setCustomGenre(e.target.value)}/>
</div>
<div><span style={s.lbl}>Mood</span><div style={{display:"flex",flexWrap:"wrap",gap:4}}>{MOODS.map(m=><button key={m} style={s.chip(mood===m,M)} onClick={()=>setMood(m)}>{m}</button>)}</div></div>
<div>
<div style={{display:"flex",justifyContent:"space-between",marginBottom:8}}><span style={s.lbl}>BPM</span><span style={{fontFamily:"'JetBrains Mono',monospace",fontSize:18,color:M,fontWeight:600,lineHeight:1}}>{bpm}</span></div>
<input type="range" min={60} max={200} value={bpm} onChange={e=>setBpm(+e.target.value)} style={{accentColor:M}}/>
</div>
<div><span style={s.lbl}>Tonalità</span>
<div style={{display:"flex",gap:6}}>
<select style={{...s.inp,cursor:"pointer",flex:1}} value={key} onChange={e=>setKey(e.target.value)}>{KEYS.map(k=><option key={k}>{k}</option>)}</select>
<select style={{...s.inp,cursor:"pointer",flex:1.4,fontSize:11}} value={scale} onChange={e=>setScale(e.target.value)}>{SCALES.map(sc=><option key={sc}>{sc}</option>)}</select>
</div>
</div>
<div><span style={s.lbl}>Accordi</span><div style={{display:"flex",flexWrap:"wrap",gap:4}}>{ch.map((c,i)=><span key={i} style={{padding:"3px 8px",background:"#1E1E35",border:`1px solid ${BR}`,borderRadius:5,fontFamily:"'JetBrains Mono',monospace",fontSize:11,color:i===0?M:i===4?V:TX,fontWeight:i===0?700:400}}>{c}</span>)}</div></div>
<div><span style={s.lbl}>Energia <span style={{color:M,fontFamily:"'JetBrains Mono',monospace"}}>{energy}%</span></span><input type="range" min={0} max={100} value={energy} onChange={e=>setEnergy(+e.target.value)} style={{accentColor:M}}/></div>
<div><span style={s.lbl}>Dark <span style={{color:V,fontFamily:"'JetBrains Mono',monospace"}}>{darkness}%</span></span><input type="range" min={0} max={100} value={darkness} onChange={e=>setDarkness(+e.target.value)} style={{accentColor:V}}/></div>
<div><span style={s.lbl}>Riferimento artistico</span><input style={{...s.inp,fontSize:12}} placeholder="Suona come... es. Shiva x Drake" value={refArtist} onChange={e=>setRefArtist(e.target.value)}/></div>
<div><span style={s.lbl}>Durata</span><div style={{display:"flex",gap:4}}>{DURATIONS.map(d=><button key={d.v} style={s.chip(duration===d.v)} onClick={()=>setDuration(d.v)}>{d.l}</button>)}</div></div>
<div><span style={s.lbl}>Voce</span><div style={{display:"flex",gap:4}}><button style={s.chip(!instrumental,M)} onClick={()=>setInstrumental(false)}>Con voce</button><button style={s.chip(instrumental,V)} onClick={()=>setInstrumental(true)}>Strumentale</button></div></div>
<div><span style={s.lbl}>Concept</span><textarea style={{...s.inp,minHeight:72,lineHeight:1.6,fontSize:12}} placeholder="Tema, storia, emozione..." value={concept} onChange={e=>setConcept(e.target.value)}/></div>
<RefUpload track={refTrack} onSet={setRefTrack} onClear={()=>setRefTrack(null)} s={s}/>
<div><span style={s.lbl}>Note di regia</span><textarea style={{...s.inp,minHeight:56,fontSize:12}} placeholder="Istruzioni extra per il producer..." value={directorNotes} onChange={e=>setDirectorNotes(e.target.value)}/></div>
</div>

{/* MAIN */}
<div style={{flex:1,display:"flex",flexDirection:"column",overflow:"hidden"}}>
<div style={{display:"flex",background:SF,borderBottom:`1px solid ${BR}`,flexShrink:0}}>
{[["progetto","◈ Progetto"],["testi","✍ Testi"],["ai","✦ AI Studio"],["tracks","▶ Brani"]].map(([id,l])=>(
<button key={id} onClick={()=>setTab(id)} style={{padding:"12px 18px",background:"transparent",border:"none",cursor:"pointer",fontFamily:"Inter,sans-serif",fontSize:12,fontWeight:tab===id?700:500,color:tab===id?TX:MU,borderBottom:tab===id?`2px solid ${V}`:"2px solid transparent",transition:"all 0.15s"}}>
{l}{id==="tracks"&&tracks.length>0&&<span style={{marginLeft:5,background:V,color:"#fff",borderRadius:10,padding:"1px 6px",fontSize:10}}>{tracks.length}</span>}
</button>
))}
</div>

<div style={{flex:1,overflowY:"auto",padding:18,display:"flex",flexDirection:"column",gap:14}}>

{tab==="progetto"&&<>
<div style={s.card(true)}>
<span style={s.lbl}>Struttura brano</span>
<div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:7,marginBottom:14}}>
{SECS.map(sec=><button key={sec} onClick={()=>toggle(sec)} style={{padding:"9px 6px",border:`1px solid ${sections.includes(sec)?V:BR}`,borderRadius:8,background:sections.includes(sec)?V+"18":SF,color:sections.includes(sec)?V:MU,cursor:"pointer",fontSize:11,fontWeight:600,fontFamily:"Inter,sans-serif",transition:"all 0.12s",textAlign:"center"}}>{sec}</button>)}
</div>
<span style={s.lbl}>Flow <span style={{textTransform:"none",letterSpacing:0,fontWeight:400}}>(usa le frecce per riordinare)</span></span>
<div style={{display:"flex",flexWrap:"wrap",gap:6,alignItems:"center",padding:"10px 12px",background:SF,borderRadius:8,border:`1px solid ${BR}`}}>
{sections.map((sec,i)=>(
<span key={sec+i} style={{display:"flex",alignItems:"center",gap:3}}>
<span style={{display:"flex",alignItems:"center",gap:4,padding:"3px 4px 3px 9px",background:V+"18",border:`1px solid ${V}44`,borderRadius:5,fontSize:11,fontWeight:700,color:V}}>
{sec}
<button onClick={()=>moveSection(i,-1)} disabled={i===0} style={{background:"none",border:"none",color:i===0?BR:V,cursor:i===0?"default":"pointer",fontSize:10,padding:"0 2px"}}>◀</button>
<button onClick={()=>moveSection(i,1)} disabled={i===sections.length-1} style={{background:"none",border:"none",color:i===sections.length-1?BR:V,cursor:i===sections.length-1?"default":"pointer",fontSize:10,padding:"0 2px"}}>▶</button>
</span>
{i<sections.length-1&&<span style={{color:BR}}>→</span>}
</span>
))}
</div>
</div>
<div style={s.card()}>
<span style={s.lbl}>Accordi per sezione</span>
<div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
{sections.map((sec,i)=>(
<div key={i} style={{padding:"9px 12px",background:SF,borderRadius:8,border:`1px solid ${BR}`}}>
<div style={{fontSize:9,fontWeight:700,color:MU,letterSpacing:"1px",marginBottom:5,textTransform:"uppercase"}}>{sec}</div>
<div style={{display:"flex",gap:6,fontFamily:"'JetBrains Mono',monospace",fontSize:12}}>
{(i%2===0?ch:[...ch].reverse()).slice(0,4).map((c,j)=><span key={j} style={{color:j===0?M:j===2?V:TX,fontWeight:j===0?700:400}}>{c}{j<3?" –":""}</span>)}
</div>
</div>
))}
</div>
</div>
<div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:8}}>
{[[bpm,"BPM",M],[key,scale.split(" ")[0],V],[sections.length,"Sezioni",TX],[`${Object.values(lyrics).filter(Boolean).length}/${sections.length}`,"Testi","#FFB347"]].map(([v,l,col])=>(
<div key={l} style={{background:CD,border:`1px solid ${BR}`,borderRadius:10,padding:"12px 8px",textAlign:"center"}}>
<div style={{fontFamily:"'JetBrains Mono',monospace",fontSize:15,fontWeight:700,color:col}}>{v}</div>
<div style={{fontSize:10,color:MU,marginTop:2}}>{l}</div>
</div>
))}
</div>
<button style={s.btn("p",true)} onClick={()=>callAI("produzione")} disabled={aiLoad}>{aiLoad&&aiMode==="produzione"?"⏳ Analisi...":"✦ Analizza produzione con AI"}</button>
{aiOut&&aiMode==="produzione"&&<div style={{...s.card(true),position:"relative"}}><div style={{position:"absolute",top:-9,left:12,background:V,color:"#fff",fontSize:9,fontWeight:800,padding:"2px 8px",borderRadius:4,letterSpacing:"1.5px"}}>AI PRODUCER</div><pre style={{whiteSpace:"pre-wrap",fontFamily:"Inter,sans-serif",fontSize:13,lineHeight:1.8,color:TX,paddingTop:4}}>{aiOut}</pre></div>}
</>}

{tab==="testi"&&<>
<div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
{sections.map(sec=><button key={sec} onClick={()=>setActiveSec(sec)} style={{...s.btn(activeSec===sec?"p":"s"),padding:"7px 12px",fontSize:11}}>{sec}{lyrics[sec]?" ✓":""}</button>)}
</div>
<div style={s.card(activeSec==="Chorus")}>
<div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
<span style={{...s.lbl,margin:0,color:activeSec==="Chorus"?V:MU}}>{activeSec}</span>
<span style={{fontSize:10,color:MU,fontFamily:"'JetBrains Mono',monospace"}}>{(lyrics[activeSec]||"").split(/\s+/).filter(Boolean).length} parole</span>
</div>
<textarea style={{...s.inp,minHeight:180,lineHeight:1.85,fontFamily:"'JetBrains Mono',monospace",fontSize:13}} placeholder={`Scrivi ${activeSec}...\no genera con AI ↓`} value={lyrics[activeSec]||""} onChange={e=>setLyrics(p=>({...p,[activeSec]:e.target.value}))}/>
</div>
<div style={{display:"flex",gap:10}}>
<button style={{...s.btn("p"),flex:1,padding:"12px"}} onClick={()=>callAI("testo")} disabled={aiLoad}>{aiLoad&&aiMode==="testo"?"⏳ Scrittura...":"✍ Genera testi AI"}</button>
{aiOut&&aiMode==="testo"&&<button style={{...s.btn("g"),padding:"12px 16px"}} onClick={()=>{const nl={...lyrics};let cur=null;aiOut.split("\n").forEach(l=>{const m=sections.find(sec=>l.toUpperCase().includes(sec.toUpperCase()));if(m)cur=m;else if(cur&&l.trim())nl[cur]=(nl[cur]||"")+(nl[cur]?"\n":"")+l;});setLyrics(nl);}}>↓ Importa</button>}
</div>
{aiOut&&aiMode==="testo"&&<div style={{...s.card(true),position:"relative"}}><div style={{position:"absolute",top:-9,left:12,background:M,color:"#001A16",fontSize:9,fontWeight:800,padding:"2px 8px",borderRadius:4,letterSpacing:"1.5px"}}>AI GHOSTWRITER</div><pre style={{whiteSpace:"pre-wrap",fontFamily:"'JetBrains Mono',monospace",fontSize:12,lineHeight:1.85,color:TX,paddingTop:4}}>{aiOut}</pre></div>}
</>}

{tab==="ai"&&<>
<div style={{...s.card(true),display:"flex",justifyContent:"space-between",alignItems:"center"}}>
<div>
<div style={{fontSize:17,fontWeight:700,marginBottom:4}}>{title||"Untitled Project"}</div>
<div style={{display:"flex",gap:8,fontSize:12,color:MU}}><span style={{color:V}}>{genreFull}</span>·<span>{mood}</span>·<span style={{fontFamily:"'JetBrains Mono',monospace",color:M}}>{bpm} BPM</span>·<span>{key} {scale}</span></div>
</div>
<div style={{display:"flex",gap:6}}>
{[[energy,"ENERGIA",M],[darkness,"DARK",V]].map(([v,l,col])=>(
<div key={l} style={{textAlign:"center",padding:"8px 12px",background:SF,borderRadius:8,border:`1px solid ${BR}`}}>
<div style={{fontFamily:"'JetBrains Mono',monospace",fontSize:14,color:col,fontWeight:700}}>{v}%</div>
<div style={{fontSize:9,color:MU,marginTop:1}}>{l}</div>
</div>
))}
</div>
</div>
<div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
{[["idee","✦","5 Concept Hit","Titoli, hook, storie, DNA sonoro",V],["mood","◎","Palette Sonora","Texture, effetti, riferimenti",M],["testo","✍","Testi Completi","Ghostwriting professionale","#FF5757"],["produzione","◈","Breakdown Beat","Drum, accordi, arrangiamento","#FFB347"]].map(([mode,icon,t,desc,col])=>(
<button key={mode} onClick={()=>callAI(mode)} disabled={aiLoad} style={{padding:"14px 16px",background:aiMode===mode?col+"12":"#1E1E35",border:`1px solid ${aiMode===mode?col:BR}`,borderRadius:10,cursor:"pointer",textAlign:"left",transition:"all 0.2s",fontFamily:"Inter,sans-serif"}}>
<div style={{fontSize:18,marginBottom:6}}>{icon}</div>
<div style={{fontSize:13,fontWeight:700,color:aiMode===mode?col:TX,marginBottom:3}}>{t}</div>
<div style={{fontSize:11,color:MU,lineHeight:1.4}}>{desc}</div>
</button>
))}
</div>
{aiLoad&&<div style={{...s.card(),display:"flex",alignItems:"center",gap:12}}><div style={{width:10,height:10,border:`2px solid ${V}44`,borderTop:`2px solid ${V}`,borderRadius:"50%",animation:"spin 0.7s linear infinite",flexShrink:0}}/><span style={{color:MU,fontSize:13}}>AI elabora il progetto...</span></div>}
{aiOut&&!aiLoad&&<div style={{...s.card(true),position:"relative"}}><div style={{position:"absolute",top:-9,left:12,background:`linear-gradient(90deg,${V},${M})`,color:"#fff",fontSize:9,fontWeight:800,padding:"2px 10px",borderRadius:4,letterSpacing:"1.5px"}}>✦ AI STUDIO</div><pre style={{whiteSpace:"pre-wrap",fontFamily:"Inter,sans-serif",fontSize:13,lineHeight:1.8,color:TX,paddingTop:4}}>{aiOut}</pre></div>}
<div style={s.card()}>
<span style={s.lbl}>Genera audio diretto</span>
<div style={{fontSize:12,color:MU,marginBottom:10,lineHeight:1.5}}>{`✓ Pronto a generare · ${genreFull}, ${mood}, ${bpm} BPM`}</div>
{genStatus&&<div style={{fontSize:12,fontFamily:"'JetBrains Mono',monospace",color:genStatus.includes("✓")?M:genStatus.includes("❌")?"#FF5757":M,marginBottom:10}}>{genStatus}</div>}
<button style={s.btn("m",true)} onClick={()=>setShowPreview(true)} disabled={generating}>{generating?<><div style={{width:12,height:12,border:"2px solid #00000033",borderTop:"2px solid #001A16",borderRadius:"50%",animation:"spin 0.7s linear infinite"}}/>In corso...</>:"◈ Genera Canzone"}</button>
</div>
</>}

{tab==="tracks"&&<>
{tracks.length===0?(
<div style={{...s.card(),textAlign:"center",padding:"48px 20px"}}>
<div style={{fontSize:40,marginBottom:12}}>◈</div>
<div style={{fontSize:15,fontWeight:700,marginBottom:6}}>Nessun brano ancora</div>
<div style={{fontSize:13,color:MU,marginBottom:16}}>Premi "Genera Canzone" per creare il tuo primo brano — ogni generazione salva tutte le take, non solo la prima</div>
<button style={s.btn("m")} onClick={()=>setTab("ai")}>→ Vai ad AI Studio</button>
</div>
):tracks.map((t,i)=>(
<div key={t.id||i} style={s.card(i===0)}>
<div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
<div>
<div style={{fontSize:14,fontWeight:700}}>{t.title}{t.take_index!=null&&<span style={{color:MU,fontWeight:400}}> · take {t.take_index+1}</span>}</div>
<div style={{fontSize:11,color:MU,marginTop:2}}>{genreFull} · {mood} · <span style={{fontFamily:"'JetBrains Mono',monospace",color:M}}>{bpm} BPM</span> · {key} · {new Date(t.created_at||Date.now()).toLocaleString("it-IT")}</div>
</div>
<div style={{display:"flex",alignItems:"center",gap:8}}>
{i===0&&<span style={{fontSize:10,background:M+"22",color:M,border:`1px solid ${M}44`,padding:"2px 8px",borderRadius:4,fontWeight:700}}>NUOVO</span>}
{t.id&&<button onClick={()=>deleteTrack(t.id)} style={{background:"none",border:"none",color:MU,cursor:"pointer",fontSize:13}} aria-label="Elimina brano">✕</button>}
</div>
</div>
<audio src={t.audio_url||t.url} controls style={{width:"100%",height:36,borderRadius:8}}/>
<div style={{marginTop:10}}>
<a href={t.audio_url||t.url} download={`${t.title||"track"}.mp3`} style={{...s.btn("g"),textDecoration:"none",width:"fit-content",padding:"7px 14px",fontSize:12}}>↓ Download MP3</a>
</div>
</div>
))}
</>}

</div>
</div>
</div>

<div style={{height:26,background:SF,borderTop:`1px solid ${BR}`,display:"flex",alignItems:"center",justifyContent:"space-between",padding:"0 16px",fontSize:10,color:MU,flexShrink:0}}>
<span style={{display:"flex",alignItems:"center",gap:6}}><span style={{width:5,height:5,borderRadius:"50%",background:M,display:"inline-block"}}/>Music Studio Pro · Promo Music Italia</span>
<div style={{display:"flex",gap:12}}><span>{sections.length} sezioni</span><span style={{color:BR}}>|</span><span style={{color:M}}>{key} {scale}</span><span style={{color:BR}}>|</span><span>{tracks.length} brani</span></div>
</div>

{showPreview&&(
<div style={{position:"fixed",inset:0,background:"#000000CC",display:"flex",alignItems:"center",justifyContent:"center",zIndex:50,padding:16}} onClick={()=>setShowPreview(false)}>
<div style={{...s.card(true),width:"100%",maxWidth:480,maxHeight:"85vh",overflowY:"auto"}} onClick={e=>e.stopPropagation()}>
<div style={{fontSize:10,fontWeight:700,letterSpacing:"1.5px",color:MU,textTransform:"uppercase",marginBottom:4}}>Prima di generare</div>
<div style={{fontSize:17,fontWeight:700,marginBottom:14}}>Riepilogo generazione</div>
<div style={{display:"flex",flexDirection:"column",border:`1px solid ${BR}`,borderRadius:8,overflow:"hidden",marginBottom:14}}>
{[
["Titolo",title||"Untitled"],
["Genere",genreFull],
["Mood",mood],
["BPM",String(bpm)],
["Tonalità",`${key} ${scale}`],
["Struttura",sections.join(" → ")],
["Testi",`${Object.values(lyrics).filter(Boolean).length}/${sections.length} sezioni scritte`],
["Energia",`${energy}%`],
["Dark",`${darkness}%`],
["Durata",durLabel],
["Voce",instrumental?"Strumentale":"Con voce"],
["Riferimento artistico",refArtist||"—"],
["Note di regia",directorNotes||"—"],
["Traccia di riferimento",refTrack?.name||"—"],
].map(([l,v],i)=>(
<div key={l} style={{display:"flex",justifyContent:"space-between",gap:10,padding:"8px 12px",borderTop:i?`1px solid ${BR}`:"none",fontSize:12}}>
<span style={{color:MU,fontWeight:700,textTransform:"uppercase",fontSize:10,letterSpacing:"0.5px",flexShrink:0}}>{l}</span>
<span style={{color:TX,textAlign:"right"}}>{v}</span>
</div>
))}
</div>
<div style={{display:"flex",gap:10}}>
<button style={{...s.btn("m"),flex:1}} onClick={confirmGenerate}>◈ Conferma e Genera</button>
<button style={s.btn("g")} onClick={()=>setShowPreview(false)}>Modifica</button>
</div>
</div>
</div>
)}
</div>
);
}
