"use client";

import { useMemo, useState } from "react";
import {
  ArrowDownToLine, ArrowRight, BookOpen, Check, Plus,
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
  const [notice, setNotice] = useState("Welcome to your creative studio");
  const [generating, setGenerating] = useState(false);
  const [dark, setDark] = useState(true);
  const [resolution, setResolution] = useState("2K");
  const [ratio, setRatio] = useState("4:5");
  const [chat, setChat] = useState<{role:"user"|"assistant";text:string}[]>([{role:"assistant",text:"I’m your InfoCraft Art Director. Share a goal and I’ll help sharpen the story, hierarchy, and layout."}]);
  const [chatInput, setChatInput] = useState("");
  const [searchText, setSearchText] = useState("");
  const [sourceName, setSourceName] = useState("");
  const current = useMemo(() => library.find(p=>p.id===project.id) || project,[library,project]);

  function updateProject(patch: Partial<InfographicProject>) { setProject(p=>({...p,...patch,updatedAt:Date.now()})); }
  async function generate() {
    if (!source.trim()) { setNotice("Add some source text first."); return; }
    setGenerating(true); setNotice("Structuring your information…");
    try {
      const response = await fetch("/api/ai/infographic", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sourceText: source.trim(), template: project.templateType, model: "gemini-2.5-flash" })
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
        citations: [],
        createdAt: now,
        updatedAt: now
      };
      setProject(next); setActive("canvas"); setNotice("AI infographic generated. Review and refine every detail.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Could not create the infographic. Please try again.");
    } finally { setGenerating(false); }
  }
  function save() {
    setLibrary(list => [project, ...list.filter(p=>p.id!==project.id)]);
    setNotice("Project saved in this browser session.");
  }
  function exportPng() {
    const el=document.getElementById("infographic-export");
    if (!el) return;
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1350" viewBox="0 0 1080 1350"><rect width="1080" height="1350" fill="#f2efe6"/><rect x="64" y="64" width="952" height="1222" fill="none" stroke="#252522" stroke-width="3"/><text x="96" y="130" font-family="Arial" font-size="26" letter-spacing="5" fill="#d94c36">${escapeXml(project.kickerTag)}</text><text x="96" y="260" font-family="Arial" font-weight="700" font-size="78" fill="#20201d">${escapeXml(project.title.slice(0,32))}</text><foreignObject x="96" y="295" width="850" height="120"><div xmlns="http://www.w3.org/1999/xhtml" style="font:26px Arial;color:#555">${escapeXml(project.subtitle)}</div></foreignObject><text x="96" y="520" font-family="Arial" font-size="150" font-weight="700" fill="#d94c36">${escapeXml(project.heroStatValue)}</text><text x="100" y="575" font-family="Arial" font-size="28" fill="#34342f">${escapeXml(project.heroStatLabel)}</text>${project.sections.slice(0,4).map((s,i)=>`<text x="96" y="${700+i*125}" font-family="Arial" font-size="24" fill="#d94c36">${s.indexLabel}</text><text x="175" y="${700+i*125}" font-family="Arial" font-size="34" font-weight="700" fill="#20201d">${escapeXml(s.heading.slice(0,38))}</text><text x="175" y="${744+i*125}" font-family="Arial" font-size="21" fill="#555">${escapeXml(s.summary.slice(0,90))}</text>`).join("")}<text x="96" y="1230" font-family="Arial" font-size="25" fill="#d94c36">INFOCRAFT  /  VISUAL STORIES, ENGINEERED WITH AI</text></svg>`;
    const blob=new Blob([svg],{type:"image/svg+xml"}); const url=URL.createObjectURL(blob); const img=new Image();
    img.onload=()=>{ const canvas=document.createElement("canvas");canvas.width=1080;canvas.height=1350;const ctx=canvas.getContext("2d");ctx?.drawImage(img,0,0);canvas.toBlob(b=>{if(!b)return;const link=document.createElement("a");link.href=URL.createObjectURL(b);link.download="infocraft-infographic.png";link.click();URL.revokeObjectURL(link.href);URL.revokeObjectURL(url);},"image/png"); };
    img.src=url;
  }
  function escapeXml(s:string){return s.replace(/[<>&'"]/g,c=>({"<":"&lt;",">":"&gt;","&":"&amp;","'":"&apos;",'"':"&quot;"}[c]||c));}
  function sendChat() {
    if (!chatInput.trim()) return;
    const message=chatInput.trim(); setChat(c=>[...c,{role:"user",text:message}]); setChatInput("");
    setChat(c=>[...c,{role:"assistant",text:"Try making the headline more specific, keeping one dominant metric, and limiting each block to a single idea. Select a section on the Canvas to edit its copy. AI-powered live suggestions will activate after provider configuration."}]);
  }

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
      <div className="sidebar-bottom"><div className="plan-card"><span className="online-dot"/> <span>LOCAL STUDIO</span><small>Firebase not connected</small></div><button className="side-link" onClick={()=>setNotice("Settings and Firebase connection setup will be added in the next stage.")}><Settings2 size={16}/> Settings</button><button className="side-link" onClick={()=>setDark(v=>!v)}>{dark?<Sun size={16}/>:<Moon size={16}/>} {dark?"Light appearance":"Dark appearance"}</button></div>
    </aside>

    <section className="main-panel">
      <header className="topbar"><div className="breadcrumbs">INFOCRAFT <span>/</span> {active.toUpperCase()}</div><div className="top-actions"><span className="status"><i/> Draft workspace</span><button className="icon-btn" title="Toggle theme" onClick={()=>setDark(v=>!v)}>{dark?<Sun size={17}/>:<Moon size={17}/>}</button><div className="avatar">IC</div></div></header>
      <div className="content">
        {active==="create"&&<section className="page narrow">
          <div className="eyebrow">01 / THE CREATIVE STUDIO</div><img className="brand-hero-art" src="/infocraft/hero-banner.svg" alt="InfoCraft — visual stories, engineered with AI"/><h1>Make information<br/><em>impossible to ignore.</em></h1><p className="lede">Turn raw notes, research, and ideas into clear editorial-grade visual stories.</p><div className="workflow-art"><img src="/infocraft/how-it-works.svg" alt="InfoCraft workflow: input, AI structure, refine, export"/></div>
          <div className="input-card"><div className="card-head"><div><span className="eyebrow">START WITH YOUR SOURCE</span><h2>What are we making today?</h2></div><span className="step">01 — INPUT</span></div>
            <textarea value={source} onChange={e=>setSource(e.target.value)} placeholder="Paste an article, report, research notes, metrics, or a rough idea…" rows={7}/>
            <div className="input-foot"><span>{source.length.toLocaleString()} characters</span><label className="upload-btn"><ImagePlus size={15}/> Add photo<input type="file" accept="image/*" onChange={e=>{const f=e.target.files?.[0];if(f){setSourceName(f.name);setNotice("Image selected. Image understanding requires AI provider configuration.");}}}/></label></div>
            {sourceName&&<div className="file-pill"><FileImage size={14}/>{sourceName}<button onClick={()=>setSourceName("")}><X size={13}/></button></div>}
            <div className="samples"><span className="muted">TRY A STARTER</span>{samples.map(s=><button key={s.label} onClick={()=>setSource(s.text)}>{s.label}<ArrowRight size={13}/></button>)}</div>
            <div className="generate-row"><span><Sparkles size={15}/> AI-assisted story structure</span><button className="primary-btn" disabled={generating} onClick={generate}>{generating?<LoaderCircle className="spin" size={17}/>:<WandSparkles size={17}/>} {generating?"Structuring…":"Create infographic"} <ArrowRight size={16}/></button></div>
          </div>
          <div className="below-note"><span>EDITORIAL BY DESIGN</span><span>SWISS GRID / SYSTEM 01</span><span>BUILT FOR CLARITY</span></div>
        </section>}

        {active==="canvas"&&<section className="page canvas-page"><div className="page-heading"><div><div className="eyebrow">02 / EDITORIAL CANVAS</div><h1>Shape the <em>story.</em></h1><p className="lede">Adjust the hierarchy, layout, and visual language of your infographic.</p></div><div className="heading-actions"><button className="secondary-btn" onClick={save}><BookOpen size={16}/> Save project</button><button className="primary-btn" onClick={exportPng}><ArrowDownToLine size={16}/> Export PNG</button></div></div>
          <div className="canvas-layout"><div className="canvas-controls">
            <ControlGroup title="LAYOUT"><div className="choice-grid">{templates.map(t=><button className={project.templateType===t?"choice selected":"choice"} key={t} onClick={()=>updateProject({templateType:t})}>{TEMPLATE_LABELS[t]}{project.templateType===t&&<Check size={13}/>}</button>)}</div></ControlGroup>
            <ControlGroup title="COLOR SYSTEM"><div className="palette-list">{palettes.map((p,i)=><button key={p} className={project.paletteId===p?"palette selected":"palette"} onClick={()=>updateProject({paletteId:p})}><span className={"swatch swatch-"+i}/>{PALETTE_LABELS[p]}{project.paletteId===p&&<Check size={14}/>}</button>)}</div></ControlGroup>
            <ControlGroup title="CONTENT"><label className="field-label">Headline<input value={project.title} onChange={e=>updateProject({title:e.target.value})}/></label><label className="field-label">Subtitle<textarea rows={3} value={project.subtitle} onChange={e=>updateProject({subtitle:e.target.value})}/></label><label className="field-label">Hero metric<input value={project.heroStatValue} onChange={e=>updateProject({heroStatValue:e.target.value})}/></label></ControlGroup>
          </div>
          <div className="preview-wrap"><div className="preview-top"><span>LIVE PREVIEW <i/></span><span>1080 × 1350 / PORTRAIT</span></div><div id="infographic-export" className={"infographic poster-"+project.paletteId}><div className="poster-top"><span>{project.kickerTag}</span><span>INFO / 0{project.sections.length}</span></div><div className="poster-title">{project.title}</div><div className="poster-subtitle">{project.subtitle}</div><div className="hero-stat"><strong>{project.heroStatValue}</strong><div><b>{project.heroStatLabel}</b><small>{project.heroStatDelta}</small></div></div><div className="poster-sections">{project.sections.slice(0,6).map((s,i)=><article key={s.indexLabel} className="poster-section"><span>{s.indexLabel}</span><div><b>{s.heading}</b><p>{s.summary}</p><div className="meter"><i style={{width:`${s.barRatio*100}%`}}/></div></div><strong>{s.metricValue}</strong></article>)}</div><blockquote>{project.takeawayQuote}</blockquote><div className="poster-footer"><span>INFOCRAFT / VISUAL RESEARCH</span><span>CLARITY, COMPOSED.</span></div></div><div className="canvas-bottom"><span>Draft changes are local until saved.</span><button className="text-btn" onClick={()=>setActive("director")}>Ask Art Director <ArrowRight size={14}/></button></div></div></div>
        </section>}

        {active==="poster"&&<section className="page narrow"><div className="eyebrow">03 / IMAGE-LED COMPOSITION</div><h1>Poster <em>studio.</em></h1><p className="lede">Transform the active story into an image-led poster composition.</p><div className="input-card poster-card"><div className="eyebrow">OUTPUT RESOLUTION</div><div className="segmented">{["1K","2K","4K"].map(v=><button className={resolution===v?"active":""} onClick={()=>setResolution(v)} key={v}>{v}</button>)}</div><div className="eyebrow">ASPECT RATIO</div><div className="segmented">{["1:1","4:5","9:16","16:9"].map(v=><button className={ratio===v?"active":""} onClick={()=>setRatio(v)} key={v}>{v}</button>)}</div><div className="poster-placeholder"><ImagePlus size={30}/><b>Ready to compose</b><span>{project.title}</span><small>Poster generation requires an enabled image-generation model and configured Firebase project.</small></div><button className="primary-btn full" onClick={()=>setNotice("Poster generation is not enabled until the AI image provider is configured.")}><Sparkles size={16}/> Generate {resolution} poster · {ratio}</button></div></section>}

        {active==="director"&&<section className="page narrow"><div className="eyebrow">04 / CREATIVE COLLABORATION</div><h1>AI Art <em>Director.</em></h1><p className="lede">A focused editorial partner for stronger hierarchy, sharper copy, and clearer visual storytelling.</p><div className="chat-card"><div className="chat-head"><div className="director-avatar"><Sparkles/></div><div><b>InfoCraft Art Director</b><small>EDITORIAL INTELLIGENCE / SESSION</small></div><span className="online-dot"/></div><div className="chat-messages">{chat.map((m,i)=><div key={i} className={"message "+m.role}><span>{m.role==="assistant"?"ART DIRECTOR":"YOU"}</span><p>{m.text}</p></div>)}</div><div className="chat-compose"><input value={chatInput} onChange={e=>setChatInput(e.target.value)} onKeyDown={e=>e.key==="Enter"&&sendChat()} placeholder="Ask for a sharper headline, clearer structure…"/><button className="primary-btn" onClick={sendChat}><ArrowRight size={17}/></button></div></div></section>}

        {active==="library"&&<section className="page"><div className="page-heading"><div><div className="eyebrow">05 / YOUR WORK, IN ONE PLACE</div><h1>Project <em>library.</em></h1><p className="lede">Reopen a draft and keep shaping the story.</p></div><label className="search-box"><Search size={16}/><input value={searchText} onChange={e=>setSearchText(e.target.value)} placeholder="Search projects…"/></label></div><div className="library-grid">{library.filter(p=>p.title.toLowerCase().includes(searchText.toLowerCase())).map(p=><button className="library-item" key={p.id} onClick={()=>{setProject(p);setActive("canvas");}}><div className={"library-thumb poster-"+p.paletteId}><span>{p.kickerTag}</span><b>{p.title}</b><strong>{p.heroStatValue}</strong></div><b>{p.title}</b><small>Updated {new Date(p.updatedAt).toLocaleDateString()}</small></button>)}{library.length===0&&<div className="empty-state"><FolderOpen size={28}/><b>Your library is ready for a first story.</b><span>Create an infographic and save it to keep it here.</span><button className="secondary-btn" onClick={()=>setActive("create")}>Start creating <ArrowRight size={14}/></button></div>}</div></section>}
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
