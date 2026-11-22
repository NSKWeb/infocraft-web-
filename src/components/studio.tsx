"use client";

import { useEffect, useMemo, useState } from "react";
import { onAuthStateChanged, signInWithPopup, signOut, type User } from "firebase/auth";
import { collection, deleteDoc, doc, onSnapshot, orderBy, query, setDoc } from "firebase/firestore";
import { auth, db, firebaseConfigured, googleProvider } from "@/lib/firebase";
import {
  ArrowDownToLine, ArrowRight, BookOpen, Check, Plus, Undo2, Redo2, Trash2, ChevronUp, ChevronDown,
  FileImage, FolderOpen, ImagePlus, LayoutDashboard, LoaderCircle, MessageCircle,
  Moon, Search, Settings2, Sparkles, Sun, WandSparkles, X
} from "lucide-react";
import type { InfographicProject, InfographicSection, PaletteId, TemplateType } from "@/lib/types";
import { PALETTE_LABELS, TEMPLATE_LABELS } from "@/lib/types";
import "./studio.css";

const templates: TemplateType[] = ["KPI_STACK", "PROCESS_FLOW", "COMPARISON", "DIGEST"];
const palettes: PaletteId[] = ["SWISS_VERMILION", "COBALT_BLUEPRINT", "CHARCOAL_PRESS", "FOREST_OCHRE"];
const samples = [
  { label: "Climate & energy", text: "Global renewable energy capacity grew rapidly in 2024. Solar and wind led new additions. Grid modernization and storage remain important to reliability." },
  { label: "Startup metrics", text: "A product team grew monthly active users from 12000 to 18600 in six months, improved activation from 24% to 37%, and reduced churn from 5.2% to 3.8%." },
  { label: "Learning science", text: "Spaced practice, retrieval practice, feedback, and sleep support long-term learning. Short, repeated sessions often improve recall compared with one long cram session." }
];

const demoProject: InfographicProject = {
  id: "demo-01", title: "The new energy equation", subtitle: "A visual briefing on the forces reshaping the global energy transition.",
  kickerTag: "ENERGY / 2026", sourceText: samples[0].text, templateType: "KPI_STACK",
  paletteId: "SWISS_VERMILION", generationMode: "FAST", searchGrounded: false,
  heroStatValue: "3×", heroStatLabel: "More clean power", heroStatDelta: "DEMO METRIC",
  takeawayQuote: "The next energy era will be built as much on smarter grids as on new generation.",
  sections: [
    { indexLabel: "01", heading: "Solar scales up", summary: "Falling costs and faster installations are changing the economics of electricity.", metricValue: "01", metricUnit: "Generation", barRatio: .9 },
    { indexLabel: "02", heading: "Wind adds depth", summary: "Onshore and offshore projects diversify clean energy supply across regions.", metricValue: "02", metricUnit: "Infrastructure", barRatio: .72 },
    { indexLabel: "03", heading: "Storage matters", summary: "Flexible storage helps balance variable generation and demand throughout the day.", metricValue: "03", metricUnit: "Flexibility", barRatio: .58 }
  ], citations: [], createdAt: Date.now(), updatedAt: Date.now()
};

function makeProject(text: string): InfographicProject {
  const sentences = text.split(/[.!?\n]+/).map(s => s.trim()).filter(Boolean);
  const title = (sentences[0] || "A clearer view").split(" ").slice(0, 8).join(" ").replace(/^./, c => c.toUpperCase());
  const sections: InfographicSection[] = (sentences.slice(1, 7).length ? sentences.slice(1, 7) : ["Define the context", "Identify the signal", "Turn insight into action"]).map((s, i, a) => ({
    indexLabel: String(i + 1).padStart(2, "0"),
    heading: s.split(" ").slice(0, 5).join(" "),
    summary: s,
    metricValue: String(i + 1).padStart(2, "0"),
    metricUnit: "Key insight",
    barRatio: Math.max(.3, 1 - i * .11)
  }));
  return { ...demoProject, id: crypto.randomUUID(), title, subtitle: "An editorial synthesis of your source material.", kickerTag: "INFOCRAFT / FIELD NOTES", sourceText: text, heroStatValue: String(sections.length).padStart(2,"0"), heroStatLabel: "Key insights", heroStatDelta: "STRUCTURED", takeawayQuote: sentences.at(-1) || text.slice(0,160), sections, createdAt: Date.now(), updatedAt: Date.now() };
}

export default function Studio() {
  const [active, setActive] = useState<"create"|"canvas"|"poster"|"director"|"library">("create");
  const [source, setSource] = useState("");
  const [project, setProject] = useState<InfographicProject>(demoProject);
  const [library, setLibrary] = useState<InfographicProject[]>([]);
  const [past, setPast] = useState<InfographicProject[]>([]);
  const [future, setFuture] = useState<InfographicProject[]>([]);
  const [notice, setNotice] = useState("Welcome to your creative studio");
  const [generating, setGenerating] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [exportFormat, setExportFormat] = useState<"standard" | "pinterest">("standard");
  const [dark, setDark] = useState(true);
  const [resolution, setResolution] = useState("2K");
  const [ratio, setRatio] = useState("4:5");
  const [chat, setChat] = useState<{role:"user"|"assistant";text:string}[]>([{role:"assistant",text:"I’m your InfoCraft Art Director. Share a goal and I’ll help sharpen the story, hierarchy, and layout."}]);
  const [chatInput, setChatInput] = useState("");
  const [searchText, setSearchText] = useState("");
  const [sourceName, setSourceName] = useState("");
  const [user, setUser] = useState<User | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [urlInput, setUrlInput] = useState("");
  const [searchGrounded, setSearchGrounded] = useState(false);
  const [language, setLanguage] = useState("same as source");
  const [posterImage, setPosterImage] = useState("");
  const [posterBusy, setPosterBusy] = useState(false);
  const [socialCopy, setSocialCopy] = useState("");
  const current = useMemo(() => library.find(p=>p.id===project.id) || project,[library,project]);
  useEffect(() => { if (!auth) return; return onAuthStateChanged(auth, setUser); }, []);
  useEffect(() => { if (!user || !db) return; const q = query(collection(db, "users", user.uid, "projects"), orderBy("updatedAt", "desc")); return onSnapshot(q, snap => setLibrary(snap.docs.map(item => item.data() as InfographicProject)), error => setNotice(error.message)); }, [user]);

  function commitProject(next: InfographicProject) {
    setPast(items => [...items.slice(-49), project]);
    setFuture([]);
    setProject({ ...next, updatedAt: Date.now() });
  }
  function updateProject(patch: Partial<InfographicProject>) { commitProject({ ...project, ...patch }); }
  function updateSection(index: number, patch: Partial<InfographicSection>) {
    commitProject({ ...project, sections: project.sections.map((section, i) => i === index ? { ...section, ...patch } : section) });
  }
  function addSection() {
    if (project.sections.length >= 12) { setNotice("A design can contain up to 12 sections."); return; }
    const index = project.sections.length + 1;
    commitProject({ ...project, sections: [...project.sections, { indexLabel: String(index).padStart(2, "0"), heading: "New insight", summary: "Add a concise explanation for this section.", metricValue: String(index).padStart(2, "0"), metricUnit: "Key insight", barRatio: .55 }] });
    setNotice("New section added.");
  }
  function removeSection(index: number) { commitProject({ ...project, sections: project.sections.filter((_, i) => i !== index).map((section, i) => ({ ...section, indexLabel: String(i + 1).padStart(2, "0") })) }); }
  function moveSection(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= project.sections.length) return;
    const sections = [...project.sections]; [sections[index], sections[target]] = [sections[target], sections[index]];
    commitProject({ ...project, sections: sections.map((section, i) => ({ ...section, indexLabel: String(i + 1).padStart(2, "0") })) });
  }
  function undo() { const previous = past[past.length - 1]; if (!previous) return; setFuture(items => [project, ...items]); setPast(items => items.slice(0, -1)); setProject(previous); setNotice("Last edit undone."); }
  function redo() { const next = future[0]; if (!next) return; setPast(items => [...items, project]); setFuture(items => items.slice(1)); setProject(next); setNotice("Edit restored."); }
  async function generate() {
    if (!source.trim() && !imageFile) { setNotice("Add source text or a photo first."); return; }
    setGenerating(true); setNotice("Structuring your information…");
    try {
      const response = await fetch("/api/ai/infographic", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sourceText: source.trim(), template: project.templateType, model: project.generationMode === "HIGH_THINKING" ? "gemini-2.5-pro" : "gemini-2.5-flash", searchGrounded, language, ...(imageFile ? { imageBase64: await fileToBase64(imageFile), imageMimeType: imageFile.type } : {}) })
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "AI generation failed.");
      const generated = payload.project;
      const now = Date.now();
      const next: InfographicProject = {
        ...demoProject,
        id: crypto.randomUUID(),
        title: generated.title,
        subtitle: generated.subtitle,
        kickerTag: generated.kickerTag,
        sourceText: source.trim(),
        templateType: generated.recommendedTemplate,
        heroStatValue: generated.heroStatValue,
        heroStatLabel: generated.heroStatLabel,
        heroStatDelta: generated.heroStatDelta,
        takeawayQuote: generated.takeawayQuote,
        sections: generated.sections,
        citations: payload.citations ?? [],
        createdAt: now,
        updatedAt: now
      };
      setProject(next); setActive("canvas"); setNotice("AI infographic generated. Review and refine every detail.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Could not create the infographic. Please try again.");
    } finally { setGenerating(false); }
  }
  async function save() {
    const owned = { ...project, userId: user?.uid };
    setLibrary(list => [owned, ...list.filter(p=>p.id!==project.id)]);
    if (user && db) { try { await setDoc(doc(db, "users", user.uid, "projects", project.id), owned); setNotice("Project synced to your cloud Library."); } catch (error) { setNotice(error instanceof Error ? error.message : "Cloud save failed."); } } else setNotice("Saved locally for this session. Sign in to sync across devices.");
  }
  async function signIn() { if (!auth) { setNotice("Add Firebase web configuration to enable Google sign-in."); return; } try { await signInWithPopup(auth, googleProvider); } catch (error) { setNotice(error instanceof Error ? error.message : "Sign-in failed."); } }
  async function removeProject(id: string) { if (user && db) await deleteDoc(doc(db, "users", user.uid, "projects", id)); setLibrary(items => items.filter(item => item.id !== id)); }
  async function exportPng() {
    if (downloading) return;
    setDownloading(true);
    setNotice("Preparing your high-resolution PNG…");
    try {
      const canvas = document.createElement("canvas");
      const pinterestExport = exportFormat === "pinterest";
      const scale = resolution === "4K" ? 4 : resolution === "2K" ? 2 : 1;
      const baseWidth = pinterestExport ? 1000 : 1080;
      const baseHeight = pinterestExport ? 1500 : 1350;
      canvas.width = baseWidth * scale;
      canvas.height = baseHeight * scale;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Your browser could not start the image exporter.");
      ctx.scale(scale * (pinterestExport ? 1000 / 1080 : 1), scale * (pinterestExport ? 1000 / 1080 : 1));

      const paletteColors: Record<PaletteId, { accent: string; paper: string; ink: string; muted: string }> = {
        SWISS_VERMILION: { accent: "#d94c36", paper: "#f1eee5", ink: "#22221e", muted: "#66635b" },
        COBALT_BLUEPRINT: { accent: "#315a9e", paper: "#edf0f3", ink: "#1d2632", muted: "#5e6875" },
        CHARCOAL_PRESS: { accent: "#343b40", paper: "#e8e7e1", ink: "#222522", muted: "#62645f" },
        FOREST_OCHRE: { accent: "#82764b", paper: "#ede9dc", ink: "#29291f", muted: "#696653" }
      };
      const colors = paletteColors[project.paletteId];
      const wrap = (value: string, maxWidth: number, font: string) => {
        ctx.font = font;
        const words = String(value || "").split(/\\s+/);
        const lines: string[] = [];
        let line = "";
        for (const word of words) {
          const next = line ? line + " " + word : word;
          if (line && ctx.measureText(next).width > maxWidth) {
            lines.push(line);
            line = word;
          } else line = next;
        }
        if (line) lines.push(line);
        return lines;
      };
      const drawLines = (value: string, x: number, y: number, maxWidth: number, font: string, color: string, lineHeight: number, maxLines: number) => {
        const lines = wrap(value, maxWidth, font).slice(0, maxLines);
        ctx.font = font;
        ctx.fillStyle = color;
        lines.forEach((line, index) => ctx.fillText(line, x, y + index * lineHeight));
        return y + lines.length * lineHeight;
      };

      ctx.fillStyle = colors.paper;
      ctx.fillRect(0, 0, 1080, 1350);
      ctx.strokeStyle = colors.ink;
      ctx.lineWidth = 3;
      ctx.strokeRect(52, 52, 976, pinterestExport ? 1516 : 1246);
      ctx.fillStyle = colors.accent;
      ctx.font = "700 22px Arial";
      ctx.fillText(String(project.kickerTag || "INFOCRAFT").toUpperCase().slice(0, 64), 88, 112);
      ctx.textAlign = "right";
      ctx.fillText("INFO / " + String(project.sections.length).padStart(2, "0"), 990, 112);
      ctx.textAlign = "left";
      ctx.strokeStyle = colors.ink;
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(88, 142); ctx.lineTo(992, 142); ctx.stroke();

      const titleLines = drawLines(project.title, 88, 235, 900, "700 68px Arial", colors.ink, 76, 2);
      const subtitleY = drawLines(project.subtitle, 90, titleLines + 8, 850, "26px Arial", colors.muted, 36, 3);
      const metricTop = Math.max(410, subtitleY + 38);
      ctx.strokeStyle = colors.ink; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(88, metricTop); ctx.lineTo(992, metricTop); ctx.stroke();
      ctx.fillStyle = colors.accent;
      ctx.font = "700 132px Arial";
      ctx.fillText(String(project.heroStatValue || "").slice(0, 12), 88, metricTop + 142);
      ctx.fillStyle = colors.ink;
      ctx.font = "700 28px Arial";
      ctx.fillText(String(project.heroStatLabel || "").slice(0, 55), 350, metricTop + 102);
      ctx.fillStyle = colors.muted;
      ctx.font = "16px Arial";
      ctx.fillText(String(project.heroStatDelta || "").slice(0, 70), 350, metricTop + 132);

      let y = metricTop + 195;
      const sections = project.sections.slice(0, 6);
      sections.forEach((section, index) => {
        if (y > 1080) return;
        ctx.strokeStyle = "#c8c4b8"; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(88, y - 24); ctx.lineTo(992, y - 24); ctx.stroke();
        ctx.fillStyle = colors.accent;
        ctx.font = "700 20px Arial";
        ctx.fillText(String(section.indexLabel || String(index + 1).padStart(2, "0")), 90, y + 8);
        const headingEnd = drawLines(section.heading, 160, y + 8, 760, "700 27px Arial", colors.ink, 32, 1);
        const summaryEnd = drawLines(section.summary, 160, headingEnd + 7, 760, "18px Arial", colors.muted, 24, 2);
        const barY = summaryEnd + 9;
        ctx.fillStyle = "#d5d1c7"; ctx.fillRect(160, barY, 760, 4);
        ctx.fillStyle = colors.accent; ctx.fillRect(160, barY, 760 * Math.max(0, Math.min(1, section.barRatio || 0)), 4);
        y = barY + 38;
      });

      if (project.takeawayQuote && y < 1190) {
        ctx.fillStyle = colors.accent;
        ctx.fillRect(88, y, 4, 58);
        drawLines(project.takeawayQuote, 110, y + 22, 850, "italic 20px Georgia", colors.ink, 27, 2);
      }
      const footerY = pinterestExport ? 1440 : 1230;
      ctx.strokeStyle = "#aaa79d"; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(88, footerY); ctx.lineTo(992, footerY); ctx.stroke();
      ctx.fillStyle = colors.muted;
      ctx.font = "700 14px Arial";
      ctx.fillText("INFOCRAFT / VISUAL RESEARCH", 88, footerY + 32);
      ctx.textAlign = "right";
      ctx.fillText(pinterestExport ? "PINTEREST EDITION · 2:3" : "CLARITY, COMPOSED.", 992, footerY + 32);
      ctx.textAlign = "left";

      if (exportType === "pdf") { const printWindow = window.open("", "_blank"); if (!printWindow) throw new Error("Allow pop-ups to export PDF."); const imageUrl = canvas.toDataURL("image/png"); printWindow.document.write("<html><head><title>InfoCraft export</title><style>@page{margin:0}body{margin:0}img{width:100%;height:auto;display:block}</style></head><body><img src=\"" + imageUrl + "\" onload=\"window.print()\"></body></html>"); printWindow.document.close(); setNotice("Print dialog opened. Choose Save as PDF."); return; }
      const mime = exportType === "jpeg" ? "image/jpeg" : exportType === "webp" ? "image/webp" : "image/png";
      const blob = await new Promise<Blob>((resolve, reject) => { canvas.toBlob(value => value ? resolve(value) : reject(new Error("Image encoding failed.")), mime, 0.94); });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      const safeName = (project.title || "infocraft-infographic").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 48) || "infocraft-infographic";
      link.href = url;
      link.download = safeName + (pinterestExport ? "-pinterest-2x3" : "-4x5") + "." + (exportType === "jpeg" ? "jpg" : exportType);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1500);
      setNotice("Export complete: " + canvas.width + " × " + canvas.height + " " + exportType.toUpperCase() + ".");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Could not export PNG. Please try again.");
    } finally {
      setDownloading(false);
    }
  }
  function escapeXml(s:string){return s.replace(/[<>&'"]/g,c=>({"<":"&lt;",">":"&gt;","&":"&amp;","'":"&apos;",'"':"&quot;"}[c]||c));}
  async function sendChat() {
    if (!chatInput.trim()) return;
    const message=chatInput.trim(); setChat(c=>[...c,{role:"user",text:message}]); setChatInput("");
    try { const response=await fetch("/api/ai/director",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({message,project,history:chat.slice(-8)})}); const data=await response.json(); if(!response.ok) throw new Error(data.error); setChat(c=>[...c,{role:"assistant",text:data.reply}]); } catch(error) { setChat(c=>[...c,{role:"assistant",text:error instanceof Error?error.message:"Art Director is unavailable."}]); }
  }
  async function importPdf(file: File) { const form=new FormData(); form.append("file",file); try { const response=await fetch("/api/import/pdf",{method:"POST",body:form}); const data=await response.json(); if(!response.ok) throw new Error(data.error); setSource(data.text); setSourceName(file.name+" · "+data.pages+" pages"); setNotice("PDF text extracted. Review before generating."); } catch(error) { setNotice(error instanceof Error?error.message:"PDF import failed."); } }
  async function importUrl() { if (!urlInput.trim()) return; try { const response=await fetch("/api/import/url",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({url:urlInput.trim()})}); const data=await response.json(); if(!response.ok) throw new Error(data.error); setSource(data.text); setSourceName(data.title||"Imported webpage"); setNotice("Webpage imported. Review source text before generating."); } catch(error) { setNotice(error instanceof Error?error.message:"URL import failed."); } }
  async function generatePoster() { setPosterBusy(true); try { const response=await fetch("/api/ai/poster",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({prompt:project.title+". "+project.subtitle+". "+project.takeawayQuote,ratio,resolution})}); const data=await response.json(); if(!response.ok) throw new Error(data.error); setPosterImage(data.image); setNotice("Poster image generated."); } catch(error) { setNotice(error instanceof Error?error.message:"Poster generation failed."); } finally { setPosterBusy(false); } }
  async function makeSocialCopy() { try { const response=await fetch("/api/ai/director",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({message:"Create Pinterest SEO copy: pin title, keyword-rich description, relevant hashtags and accessible alt text. Label each.",project})}); const data=await response.json(); if(!response.ok) throw new Error(data.error); setSocialCopy(data.reply); } catch(error) { setNotice(error instanceof Error?error.message:"Could not create social copy."); } }

  return <main className={dark?"studio":"studio light"}>
    <aside className="sidebar">
      <div className="brand"><div className="brand-mark">i.</div><div><b>infocraft</b><small>STUDIO / 01</small></div></div>
      <div className="side-label">WORKSPACE</div>
      <nav>
        <NavButton active={active==="create"} onClick={()=>setActive("create")} icon={<Plus/>} label="Create"/>
        <NavButton active={active==="canvas"} onClick={()=>setActive("canvas")} icon={<LayoutDashboard/>} label="Canvas"/>
        <NavButton active={active==="poster"} onClick={()=>setActive("poster")} icon={<ImagePlus/>} label="Poster Studio"/>
        <NavButton active={active==="director"} onClick={()=>setActive("director")} icon={<MessageCircle/>} label="AI Art Director"/>
        <NavButton active={active==="library"} onClick={()=>setActive("library")} icon={<FolderOpen/>} label="Library" count={library.length}/>
      </nav>
      <div className="sidebar-bottom"><div className="plan-card"><span className="online-dot"/> <span>LOCAL STUDIO</span><small>{user ? "Cloud sync enabled" : firebaseConfigured ? "Sign in to sync projects" : "Local workspace"}</small></div><button className="side-link" onClick={()=>setNotice("Settings and Firebase connection setup will be added in the next stage.")}><Settings2 size={16}/> Settings</button><button className="side-link" onClick={()=>setDark(v=>!v)}>{dark?<Sun size={16}/>:<Moon size={16}/>} {dark?"Light appearance":"Dark appearance"}</button></div>
    </aside>

    <section className="main-panel">
      <header className="topbar"><div className="breadcrumbs">INFOCRAFT <span>/</span> {active.toUpperCase()}</div><div className="top-actions"><span className="status"><i/> Draft workspace</span><button className="icon-btn" title="Toggle theme" onClick={()=>setDark(v=>!v)}>{dark?<Sun size={17}/>:<Moon size={17}/>}</button><button className="secondary-btn" onClick={user?()=>signOut(auth!):signIn}>{user ? "Sign out" : "Google sign-in"}</button><div className="avatar">{user?.displayName?.slice(0,2).toUpperCase() || "IC"}</div></div></header>
      <div className="content">
        {active==="create"&&<section className="page narrow">
          <div className="eyebrow">01 / THE CREATIVE STUDIO</div><img className="brand-hero-art" src="/infocraft/hero-banner.svg" alt="InfoCraft — visual stories, engineered with AI"/><h1>Make information<br/><em>impossible to ignore.</em></h1><p className="lede">Turn raw notes, research, and ideas into clear editorial-grade visual stories.</p><div className="workflow-art"><img src="/infocraft/how-it-works.svg" alt="InfoCraft workflow: input, AI structure, refine, export"/></div>
          <div className="input-card"><div className="card-head"><div><span className="eyebrow">START WITH YOUR SOURCE</span><h2>What are we making today?</h2></div><span className="step">01 — INPUT</span></div>
            <textarea value={source} onChange={e=>setSource(e.target.value)} placeholder="Paste an article, report, research notes, metrics, or a rough idea…" rows={7}/><label className="field-label">Webpage URL<input value={urlInput} onChange={e=>setUrlInput(e.target.value)} placeholder="https://example.com/article"/></label><button className="secondary-btn" onClick={importUrl}>Import webpage</button><label className="upload-btn">Import PDF<input type="file" accept="application/pdf" onChange={e=>{const file=e.target.files?.[0];if(file) importPdf(file);e.currentTarget.value="";}}/></label><label className="field-label">Output language<select value={language} onChange={e=>setLanguage(e.target.value)}><option>same as source</option><option>English</option><option>Hindi</option><option>Hinglish</option><option>Odia</option></select></label><label className="field-label"><input type="checkbox" checked={searchGrounded} onChange={e=>setSearchGrounded(e.target.checked)}/> Google Search grounding</label>
            <div className="input-foot"><span>{source.length.toLocaleString()} characters</span><label className="upload-btn"><ImagePlus size={15}/> Add photo<input type="file" accept="image/jpeg,image/png,image/webp" onChange={e=>{const f=e.target.files?.[0];if(f){setImageFile(f);setSourceName(f.name);setNotice("Photo ready for AI scan.");}}}/></label></div>
            {sourceName&&<div className="file-pill"><FileImage size={14}/>{sourceName}<button onClick={()=>{setSourceName("");setImageFile(null);}}><X size={13}/></button></div>}
            <div className="samples"><span className="muted">TRY A STARTER</span>{samples.map(s=><button key={s.label} onClick={()=>setSource(s.text)}>{s.label}<ArrowRight size={13}/></button>)}</div>
            <div className="generate-row"><span><Sparkles size={15}/> AI-assisted story structure</span><button className="primary-btn" disabled={generating} onClick={generate}>{generating?<LoaderCircle className="spin" size={17}/>:<WandSparkles size={17}/>} {generating?"Structuring…":"Create infographic"} <ArrowRight size={16}/></button></div>
          </div>
          <div className="input-card" style={{marginTop:22}}><div className="eyebrow">PINTEREST SEO STUDIO</div><p className="lede">Create searchable pin assets from your current infographic.</p><button className="secondary-btn" onClick={makeSocialCopy}>Generate Pinterest copy</button>{socialCopy&&<pre className="social-copy">{socialCopy}</pre>}</div><div className="below-note"><span>EDITORIAL BY DESIGN</span><span>SWISS GRID / SYSTEM 01</span><span>BUILT FOR CLARITY</span></div>
        </section>}

        {active==="canvas"&&<section className="page canvas-page"><div className="page-heading"><div><div className="eyebrow">02 / EDITORIAL CANVAS</div><h1>Shape the <em>story.</em></h1><p className="lede">Adjust the hierarchy, layout, and visual language of your infographic.</p></div><div className="heading-actions"><button className="secondary-btn history-btn" onClick={undo} disabled={past.length===0} title="Undo last edit"><Undo2 size={15}/> Undo</button><button className="secondary-btn history-btn" onClick={redo} disabled={future.length===0} title="Redo edit"><Redo2 size={15}/> Redo</button><button className="secondary-btn" onClick={save}><BookOpen size={16}/> Save project</button><button className="primary-btn" onClick={exportPng} disabled={downloading}><ArrowDownToLine size={16}/> {downloading ? "Preparing PNG…" : "Download PNG"}</button></div></div>
          <div className="export-options"><span className="export-label">FILE TYPE</span><div className="segmented">{(["png","jpeg","webp","pdf"] as const).map(v=><button className={exportType===v?"active":""} key={v} onClick={()=>setExportType(v)}>{v.toUpperCase()}</button>)}</div><span className="export-label">EXPORT FORMAT</span><div className="segmented"><button className={exportFormat==="standard"?"active":""} onClick={()=>setExportFormat("standard")}>Standard · 4:5</button><button className={exportFormat==="pinterest"?"active":""} onClick={()=>setExportFormat("pinterest")}>Pinterest · 2:3</button></div><small>{exportFormat==="pinterest"?"1000 × 1500 px · Pinterest portrait pin":"1080 × 1350 px · Standard portrait"}</small></div><div className="canvas-layout"><div className="canvas-controls">
            <ControlGroup title="GENERATION MODE"><div className="choice-grid"><button className={project.generationMode==="FAST"?"choice selected":"choice"} onClick={()=>updateProject({generationMode:"FAST"})}>Instant Draft</button><button className={project.generationMode==="HIGH_THINKING"?"choice selected":"choice"} onClick={()=>updateProject({generationMode:"HIGH_THINKING"})}>Deep Synthesis</button></div></ControlGroup><ControlGroup title="LAYOUT"><div className="choice-grid">{templates.map(t=><button className={project.templateType===t?"choice selected":"choice"} key={t} onClick={()=>updateProject({templateType:t})}>{TEMPLATE_LABELS[t]}{project.templateType===t&&<Check size={13}/>}</button>)}</div></ControlGroup>
            <ControlGroup title="COLOR SYSTEM"><div className="palette-list">{palettes.map((p,i)=><button key={p} className={project.paletteId===p?"palette selected":"palette"} onClick={()=>updateProject({paletteId:p})}><span className={"swatch swatch-"+i}/>{PALETTE_LABELS[p]}{project.paletteId===p&&<Check size={14}/>}</button>)}</div></ControlGroup>
            <ControlGroup title="CONTENT"><label className="field-label">Headline<input value={project.title} onChange={e=>updateProject({title:e.target.value})}/></label><label className="field-label">Subtitle<textarea rows={3} value={project.subtitle} onChange={e=>updateProject({subtitle:e.target.value})}/></label><label className="field-label">Hero metric<input value={project.heroStatValue} onChange={e=>updateProject({heroStatValue:e.target.value})}/></label><label className="field-label">Metric label<input value={project.heroStatLabel} onChange={e=>updateProject({heroStatLabel:e.target.value})}/></label><label className="field-label">Takeaway<textarea rows={3} value={project.takeawayQuote} onChange={e=>updateProject({takeawayQuote:e.target.value})}/></label></ControlGroup><ControlGroup title={"SECTIONS · " + project.sections.length + "/12"}><button className="secondary-btn add-section-btn" onClick={addSection}><Plus size={14}/> Add section</button><div className="section-editor-list">{project.sections.map((section,index)=><div className="section-editor" key={section.indexLabel+"-"+index}><div className="section-editor-head"><b>SECTION {String(index+1).padStart(2,"0")}</b><div><button title="Move up" disabled={index===0} onClick={()=>moveSection(index,-1)}><ChevronUp size={14}/></button><button title="Move down" disabled={index===project.sections.length-1} onClick={()=>moveSection(index,1)}><ChevronDown size={14}/></button><button title="Remove section" onClick={()=>removeSection(index)}><Trash2 size={14}/></button></div></div><label className="field-label">Heading<input value={section.heading} onChange={e=>updateSection(index,{heading:e.target.value})}/></label><label className="field-label">Summary<textarea rows={3} value={section.summary} onChange={e=>updateSection(index,{summary:e.target.value})}/></label><label className="field-label">Metric<input value={section.metricValue} onChange={e=>updateSection(index,{metricValue:e.target.value})}/></label><label className="field-label">Visual emphasis<input type="range" min="0" max="100" value={Math.round(section.barRatio*100)} onChange={e=>updateSection(index,{barRatio:Number(e.target.value)/100})}/></label></div>)}</div></ControlGroup>
          </div>
          <div className="preview-wrap"><div className="preview-top"><span>LIVE PREVIEW <i/></span><span>1080 × 1350 / PORTRAIT</span></div><div id="infographic-export" className={"infographic poster-"+project.paletteId}><div className="poster-top"><span>{project.kickerTag}</span><span>INFO / 0{project.sections.length}</span></div><div className="poster-title">{project.title}</div><div className="poster-subtitle">{project.subtitle}</div><div className="hero-stat"><strong>{project.heroStatValue}</strong><div><b>{project.heroStatLabel}</b><small>{project.heroStatDelta}</small></div></div><div className="poster-sections">{project.sections.slice(0,6).map((s,i)=><article key={s.indexLabel} className="poster-section"><span>{s.indexLabel}</span><div><b>{s.heading}</b><p>{s.summary}</p><div className="meter"><i style={{width:`${s.barRatio*100}%`}}/></div></div><strong>{s.metricValue}</strong></article>)}</div><blockquote>{project.takeawayQuote}</blockquote><div className="poster-footer"><span>INFOCRAFT / VISUAL RESEARCH</span><span>CLARITY, COMPOSED.</span></div></div>{project.citations.length>0&&<div className="citation-list"><b>Research sources</b>{project.citations.map((citation,i)=><a key={i} href={citation.uri} target="_blank" rel="noreferrer">{citation.title}</a>)}</div>}<div className="canvas-bottom"><span>{user?"Cloud sync available":"Draft changes are local until saved."}</span><button className="text-btn" onClick={()=>setActive("director")}>Ask Art Director <ArrowRight size={14}/></button></div></div></div>
        </section>}

        {active==="poster"&&<section className="page narrow"><div className="eyebrow">03 / IMAGE-LED COMPOSITION</div><h1>Poster <em>studio.</em></h1><p className="lede">Transform the active story into an image-led poster composition.</p><div className="input-card poster-card"><div className="eyebrow">OUTPUT RESOLUTION</div><div className="segmented">{["1K","2K","4K"].map(v=><button className={resolution===v?"active":""} onClick={()=>setResolution(v)} key={v}>{v}</button>)}</div><div className="eyebrow">ASPECT RATIO</div><div className="segmented">{["1:1","4:5","9:16","16:9"].map(v=><button className={ratio===v?"active":""} onClick={()=>setRatio(v)} key={v}>{v}</button>)}</div>{posterImage?<img className="generated-poster" src={posterImage} alt="Generated poster"/>:<div className="poster-placeholder"><ImagePlus size={30}/><b>Ready to compose</b><span>{project.title}</span><small>Generated image model availability depends on your Google AI project.</small></div>}<button className="primary-btn full" disabled={posterBusy} onClick={generatePoster}><Sparkles size={16}/>{posterBusy?"Generating…":"Generate "+resolution+" poster · "+ratio}</button>{posterImage&&<a className="secondary-btn" href={posterImage} download="infocraft-poster.png">Save poster</a>}</div></section>}

        {active==="director"&&<section className="page narrow"><div className="eyebrow">04 / CREATIVE COLLABORATION</div><h1>AI Art <em>Director.</em></h1><p className="lede">A focused editorial partner for stronger hierarchy, sharper copy, and clearer visual storytelling.</p><div className="chat-card"><div className="chat-head"><div className="director-avatar"><Sparkles/></div><div><b>InfoCraft Art Director</b><small>EDITORIAL INTELLIGENCE / SESSION</small></div><span className="online-dot"/></div><div className="chat-messages">{chat.map((m,i)=><div key={i} className={"message "+m.role}><span>{m.role==="assistant"?"ART DIRECTOR":"YOU"}</span><p>{m.text}</p></div>)}</div><div className="chat-compose"><input value={chatInput} onChange={e=>setChatInput(e.target.value)} onKeyDown={e=>e.key==="Enter"&&sendChat()} placeholder="Ask for a sharper headline, clearer structure…"/><button className="primary-btn" onClick={sendChat}><ArrowRight size={17}/></button></div></div></section>}

        {active==="library"&&<section className="page"><div className="page-heading"><div><div className="eyebrow">05 / YOUR WORK, IN ONE PLACE</div><h1>Project <em>library.</em></h1><p className="lede">Reopen a draft and keep shaping the story.</p></div><label className="search-box"><Search size={16}/><input value={searchText} onChange={e=>setSearchText(e.target.value)} placeholder="Search projects…"/></label></div><div className="library-grid">{library.filter(p=>p.title.toLowerCase().includes(searchText.toLowerCase())).map(p=><button className="library-item" key={p.id} onClick={()=>{setProject(p);setActive("canvas");}}><div className={"library-thumb poster-"+p.paletteId}><span>{p.kickerTag}</span><b>{p.title}</b><strong>{p.heroStatValue}</strong></div><b>{p.title}</b><small>Updated {new Date(p.updatedAt).toLocaleDateString()}</small><span onClick={e=>{e.stopPropagation();removeProject(p.id);}} role="button">Delete</span></button>)}{library.length===0&&<div className="empty-state"><FolderOpen size={28}/><b>Your library is ready for a first story.</b><span>Create an infographic and save it to keep it here.</span><button className="secondary-btn" onClick={()=>setActive("create")}>Start creating <ArrowRight size={14}/></button></div>}</div></section>}
      </div>
      <footer className="statusbar"><span><i/> {notice}</span><span>INFOCRAFT WEB / PREVIEW BUILD</span></footer>
    </section>
  </main>;
}

function NavButton({active,onClick,icon,label,count}:{active:boolean;onClick:()=>void;icon:React.ReactNode;label:string;count?:number}) {
  return <button onClick={onClick} className={active?"nav-item active":"nav-item"}>{icon}<span>{label}</span>{typeof count==="number"&&<small>{count}</small>}</button>;
}
function ControlGroup({title,children}:{title:string;children:React.ReactNode}) {
  return <section className="control-group"><div className="control-title">{title}</div>{children}</section>;
}

function fileToBase64(file: File): Promise<string> { return new Promise((resolve,reject)=>{ const reader=new FileReader(); reader.onload=()=>resolve(String(reader.result).split(",")[1]||""); reader.onerror=()=>reject(new Error("Could not read selected image.")); reader.readAsDataURL(file); }); }
