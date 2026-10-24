import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { ArrowUpRight, Download, ImagePlus, RotateCcw, Save, Upload } from "lucide-react";
import type { LibraryAsset } from "../types";
import { downloadBlob } from "../lib/downloadBlob";
import {
  defaultMemberCardData, MEMBER_CARD_HEIGHT, MEMBER_CARD_WIDTH,
  memberCardFilename, renderMemberCard, validateMemberCardData, type MemberCardData,
} from "../lib/memberCard";
import { loadMemberCardDraft, parseMemberCardDraft, saveMemberCardDraft, serializeMemberCardDraft } from "../lib/memberCardDraft";
import MemberCardLayoutEditor from "./MemberCardLayoutEditor";
import "./member-card.css";

interface Props {
  draftScope: string;
  libraryReady: boolean;
  sharedLibrary: boolean;
  onSave: (asset: LibraryAsset) => Promise<void>;
  onOpenLibrary: () => void;
}

const presets = [
  { role: "作者", roleEnglish: "writer" },
  { role: "编辑", roleEnglish: "editor" },
  { role: "嘉宾", roleEnglish: "guest" },
  { role: "成员", roleEnglish: "member" },
];

function initialDraft(scope: string): MemberCardData {
  try { return loadMemberCardDraft(localStorage, scope) ?? { ...defaultMemberCardData }; }
  catch { return { ...defaultMemberCardData }; }
}

async function avatarFromFile(file: File): Promise<string> {
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) throw new Error("请选择 JPG、PNG 或 WebP 图片。");
  if (file.size > 8 * 1024 * 1024) throw new Error("头像不能超过 8 MB，请选择较小的图片。");
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    if (!img.naturalWidth || !img.naturalHeight) throw new Error("无法读取图片尺寸。");
    const scale = Math.min(1, 800 / Math.max(img.naturalWidth, img.naturalHeight));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(img.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
    const context = canvas.getContext("2d");
    if (!context) throw new Error("浏览器暂时无法处理图片。");
    context.fillStyle = "#fff";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(img, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/jpeg", 0.88);
  } finally { URL.revokeObjectURL(url); }
}

function pngBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error("图片生成失败，请重试。")), "image/png"));
}

// The shared library uses the existing inline-file size limit; PNG downloads keep full resolution.
function libraryImage(canvas: HTMLCanvasElement): string {
  const copy = document.createElement("canvas");
  for (const width of [1800, 1440, 1200]) {
    copy.width = width;
    copy.height = Math.round(width * MEMBER_CARD_HEIGHT / MEMBER_CARD_WIDTH);
    const context = copy.getContext("2d");
    if (!context) throw new Error("浏览器暂时无法生成图片。");
    context.drawImage(canvas, 0, 0, copy.width, copy.height);
    for (const quality of [0.9, 0.8, 0.65]) {
      const image = copy.toDataURL("image/jpeg", quality);
      if (image.length <= 500_000) return image;
    }
  }
  throw new Error("名片图片过大，请下载 PNG 保存。");
}

export default function MemberCardStudio({ draftScope, libraryReady, sharedLibrary, onSave, onOpenLibrary }: Props) {
  const [data, setData] = useState(() => initialDraft(draftScope));
  const [editorMode, setEditorMode] = useState<"content" | "layout">("content");
  const [rendered, setRendered] = useState<MemberCardData | null>(null);
  const [renderError, setRenderError] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [draftStatus, setDraftStatus] = useState("草稿仅保存在此浏览器");
  const [busy, setBusy] = useState<"" | "download" | "library">("");
  const [uploading, setUploading] = useState(false);
  const [resetConfirm, setResetConfirm] = useState(false);
  const [retry, setRetry] = useState(0);
  const [savedData, setSavedData] = useState<MemberCardData | null>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const importInput = useRef<HTMLInputElement>(null);
  const resetButton = useRef<HTMLButtonElement>(null);
  const uploadSequence = useRef(0);
  const importSequence = useRef(0);
  const latestData = useRef(data);
  latestData.current = data;
  const mounted = useRef(true);
  const validation = validateMemberCardData(data);
  const ready = rendered === data && !renderError && !validation.length && !uploading;

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; uploadSequence.current++; importSequence.current++; };
  }, []);

  useEffect(() => {
    if (validateMemberCardData(data).length) {
      setDraftStatus("补全有效信息后自动保存草稿");
      return;
    }
    try {
      saveMemberCardDraft(localStorage, draftScope, data);
      setDraftStatus("草稿已保存在此浏览器");
    } catch { setDraftStatus("草稿未能保存，请下载草稿备份后再离开"); }
  }, [data, draftScope]);

  useEffect(() => {
    let cancelled = false;
    setRenderError("");
    if (validation.length) return;
    const timer = setTimeout(() => {
      if (!canvas.current) return;
      void renderMemberCard(canvas.current, data).then(() => {
        if (!cancelled) setRendered(data);
      }).catch(err => {
        if (!cancelled) setRenderError(err instanceof Error ? err.message : "预览生成失败，请重试。");
      });
    }, 150);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [data, retry]);

  function update<K extends keyof MemberCardData>(key: K, value: MemberCardData[K]) {
    setData(previous => ({ ...previous, [key]: value }));
    setNotice(""); setError(""); setResetConfirm(false);
    setDraftStatus("正在保存草稿…");
  }

  async function uploadAvatar(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    const sequence = ++uploadSequence.current;
    importSequence.current++;
    setUploading(true); setError("");
    try {
      const avatar = await avatarFromFile(file);
      if (mounted.current && sequence === uploadSequence.current) {
        setData(previous => ({ ...previous, avatar, avatarZoom: 1 })); setNotice("");
      }
    } catch (err) {
      if (mounted.current && sequence === uploadSequence.current) setError(err instanceof Error ? err.message : "图片无法读取，请换一张图片。");
    } finally { if (mounted.current && sequence === uploadSequence.current) setUploading(false); }
  }

  async function importDraft(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    const sequence = ++importSequence.current;
    const before = latestData.current;
    setError("");
    try {
      if (file.size > 2 * 1024 * 1024) throw new Error("草稿文件不能超过 2 MB。");
      const next = parseMemberCardDraft(await file.text());
      if (mounted.current && sequence === importSequence.current && latestData.current === before) { uploadSequence.current++; setUploading(false); setData(next); setResetConfirm(false); setNotice("草稿已导入，可以继续编辑。"); }
    } catch (err) { if (mounted.current && sequence === importSequence.current && latestData.current === before) setError(err instanceof Error ? err.message : "无法导入此草稿。"); }
  }

  async function exportCard(toLibrary: boolean) {
    if (!ready || !canvas.current || busy || toLibrary && !libraryReady) return;
    const snapshot = data;
    setError(""); setNotice(""); setBusy(toLibrary ? "library" : "download");
    try {
      if (toLibrary) {
        const asset: LibraryAsset = {
          id: crypto.randomUUID(), title: `${snapshot.name.trim()} · ${snapshot.role.trim() || "成员"}名片`,
          kind: "作者名片", author: snapshot.name.trim(), tags: "名片", url: "",
          fileName: memberCardFilename(snapshot.name).replace(/\.png$/, ".jpg"), fileData: libraryImage(canvas.current),
          notes: [snapshot.biography.trim(), snapshot.contact.trim()].filter(Boolean).join("\n"), updatedAt: new Date().toISOString(),
        };
        await onSave(asset);
        if (mounted.current) { setSavedData(snapshot); setNotice(sharedLibrary ? "名片已保存到团队资料库，成员可以查看和下载。" : "名片已保存到本地资料库。"); }
      } else {
        const blob = await pngBlob(canvas.current);
        downloadBlob(blob, memberCardFilename(snapshot.name));
        if (mounted.current) setNotice("PNG 已生成，请查看浏览器下载记录。");
      }
    } catch (err) { if (mounted.current) setError(err instanceof Error ? err.message : "保存失败，请重试。"); }
    finally { if (mounted.current) setBusy(""); }
  }

  return <div className="card-studio">
    <section className="card-editor" aria-labelledby="card-editor-title">
      <header className="card-section-heading"><p className="card-step">第 1 步</p><h2 id="card-editor-title">编辑名片</h2><p>一张属于你的议会名片</p></header>
      <div className="card-editor-modes" role="group" aria-label="名片编辑方式">
        <button type="button" aria-pressed={editorMode === "content"} onClick={() => setEditorMode("content")}>填写信息</button>
        <button type="button" aria-pressed={editorMode === "layout"} onClick={() => setEditorMode("layout")}>排版微调</button>
      </div>
      {editorMode === "layout" ? <MemberCardLayoutEditor data={data} onChange={layout => update("layout", layout)} /> : <>
      <div className="card-fields">
        <label>身份模板<select value={presets.find(p => p.role === data.role && p.roleEnglish === data.roleEnglish)?.role || "custom"} onChange={event => {
          const preset = presets.find(p => p.role === event.target.value);
          setData(previous => ({ ...previous, ...(preset || { role: "", roleEnglish: "" }) })); setNotice("");
        }}><option value="custom">自定义身份（在下方填写）</option>{presets.map(p => <option key={p.role} value={p.role}>{p.role} / {p.roleEnglish}</option>)}</select></label>
        <label>姓名<input value={data.name} onChange={event => update("name", event.target.value)} maxLength={48} autoComplete="off" placeholder="填写姓名" /></label>
        <div className="card-field-pair"><label>中文身份<input value={data.role} onChange={event => update("role", event.target.value)} maxLength={24} placeholder="作者" /></label><label>英文身份<input value={data.roleEnglish} onChange={event => update("roleEnglish", event.target.value)} maxLength={64} placeholder="writer" /></label></div>
        <label>个人介绍<small id="card-biography-help">最多 3 行，每行最多 80 字；文字较短时版面更舒展。</small><textarea rows={3} value={data.biography} onChange={event => update("biography", event.target.value)} maxLength={486} placeholder="研究方向、任职或个人简介" aria-describedby="card-biography-help" /></label>
        <label>组织名称<input value={data.organization} onChange={event => update("organization", event.target.value)} maxLength={64} placeholder="安提柯史学社" /></label>
        <label>联系方式<span className="card-optional">（选填）</span><input value={data.contact} onChange={event => update("contact", event.target.value)} maxLength={160} placeholder="邮箱、个人主页或其他联系方式" /></label>
      </div>
      <div className="card-avatar-editor">
        <div className="card-avatar-heading"><h3>个人头像</h3><p>JPG、PNG 或 WebP，不超过 8 MB</p></div>
        <div className="card-avatar-controls">
          <div className="card-avatar-thumb">{data.avatar ? <img src={data.avatar} alt="当前头像" /> : <ImagePlus size={20} aria-hidden="true" />}</div>
          <label className={`workspace-button card-file-button ${uploading ? "is-busy" : ""}`}><Upload size={18} aria-hidden="true" />{uploading ? "正在处理…" : data.avatar ? "更换头像" : "上传头像"}<input type="file" aria-label="上传个人头像" accept="image/jpeg,image/png,image/webp" onChange={event => void uploadAvatar(event)} disabled={uploading} /></label>
          {data.avatar && <button type="button" className="card-text-button" disabled={uploading} onClick={() => update("avatar", "")}>移除</button>}
        </div>
        {data.avatar && <label className="card-zoom">头像缩放 <input type="range" min="1" max="3" step="0.05" value={data.avatarZoom} onChange={event => update("avatarZoom", Number(event.target.value))} /><output>{data.avatarZoom.toFixed(1)}×</output></label>}
        <p className="card-small">头像自动居中裁切；未上传时使用姓名首字。</p>
      </div>
      </>}
    </section>
    <section className="card-preview-section" aria-labelledby="card-preview-title">
      <header className="card-preview-heading"><div className="card-section-heading"><p className="card-step">第 2 步</p><h2 id="card-preview-title">名片预览</h2><p>经典黑白 · 议会徽标 · 圆形头像</p></div><p className="card-size">2400 × 1240 像素</p></header>
      <div className={`card-preview-stage ${!ready ? "is-updating" : ""}`} aria-busy={!ready && !renderError && !validation.length}>
        <canvas ref={canvas} width={MEMBER_CARD_WIDTH} height={MEMBER_CARD_HEIGHT} role="img" aria-label={`${data.name || "成员"}的名片预览`} />
        {!rendered && <div className="card-preview-placeholder">{renderError || validation.length ? "完善信息后显示名片" : "正在准备名片与中文字体…"}</div>}
      </div>
      <div className="card-preview-status" role="status">{uploading ? "正在处理头像…" : validation.length ? "请调整下方提示的内容。预览暂未更新。" : renderError ? "预览暂未更新。" : ready ? "预览与下载图片一致" : "正在更新预览，首次加载字体可能需要一点时间…"}</div>
      {!!validation.length && <div className="card-message error" role="alert">{validation.map(message => <p key={message}>{message}</p>)}</div>}
      {renderError && <div className="card-message error" role="alert"><p>{renderError}</p><button type="button" className="card-text-button" onClick={() => setRetry(value => value + 1)}>重新生成预览</button></div>}
      {error && <p className="card-message error" role="alert">{error}</p>}
      {notice && <p className="card-message success" role="status">{notice}</p>}
      <div className="card-export-actions">
        <button type="button" className="workspace-button primary" disabled={!ready || !!busy} onClick={() => void exportCard(false)}><Download size={18} aria-hidden="true" />{busy === "download" ? "正在生成…" : "下载高清 PNG"}</button>
        <button type="button" className="workspace-button" disabled={!ready || !libraryReady || !!busy || savedData === data} onClick={() => void exportCard(true)}><Save size={18} aria-hidden="true" />{busy === "library" ? "正在保存，请稍候…" : savedData === data ? "已保存到资料库" : "保存到资料库"}</button>
        <button type="button" className="card-text-button" onClick={onOpenLibrary}>查看资料库<ArrowUpRight size={16} aria-hidden="true" /></button>
      </div>
      {!libraryReady && <p className="card-small">资料库连接完成后可保存成品；现在可以编辑和下载名片。</p>}
      <div className="card-draft-panel">
        <div><h3>继续编辑，也留一份备份</h3><p>{draftStatus}。下载草稿后，可在其他设备导入接着修改。</p></div>
        <div className="card-draft-actions">
          <button type="button" className="card-text-button" disabled={!!validation.length || uploading} onClick={() => {
            try { downloadBlob(new Blob([serializeMemberCardDraft(data)], { type: "application/json" }), memberCardFilename(data.name).replace(/\.png$/, "-草稿.json")); }
            catch (err) { setError(err instanceof Error ? err.message : "草稿下载失败。"); }
          }}><Download size={16} aria-hidden="true" />下载草稿</button>
          <button type="button" className="card-text-button" disabled={uploading || !!busy} onClick={() => importInput.current?.click()}><Upload size={16} aria-hidden="true" />导入草稿</button>
          <input ref={importInput} type="file" accept="application/json,.json" aria-label="导入名片草稿" hidden onChange={event => void importDraft(event)} />
          <button ref={resetButton} type="button" className="workspace-button danger card-reset-button" disabled={uploading || !!busy} aria-expanded={resetConfirm} aria-controls={resetConfirm ? "card-reset-confirm" : undefined} onClick={() => setResetConfirm(value => !value)}><RotateCcw size={16} aria-hidden="true" />重新制作</button>
        </div>
        {/* Both buttons close the confirm, so focus goes back to 重新制作. */}
        {resetConfirm && <div id="card-reset-confirm" className="card-reset-confirm" onKeyDown={event => { if (event.key === "Escape") { setResetConfirm(false); resetButton.current?.focus(); } }}><p>将清空头像并恢复示例文字，已保存到资料库的名片会保留。</p><button type="button" className="workspace-button danger" onClick={() => { setData({ ...defaultMemberCardData }); setResetConfirm(false); setNotice("已恢复示例名片，可以重新填写。"); setError(""); resetButton.current?.focus(); }}>确认重新制作</button><button type="button" className="workspace-button" onClick={() => { setResetConfirm(false); resetButton.current?.focus(); }}>取消</button></div>}
      </div>
      <p className="card-privacy">编辑与导出在此浏览器完成。{sharedLibrary ? "点击“保存到资料库”后，名片上的信息和头像将向工作区成员共享。" : "本地试用中保存的名片仅在此浏览器的资料库可见。"}</p>
    </section>
  </div>;
}
