import { useEffect, useState } from "react";
import { RotateCcw, SlidersHorizontal } from "lucide-react";
import {
  getMemberCardTextStyle, MEMBER_CARD_STYLE_LIMITS, MEMBER_CARD_TEXT_FIELDS,
  type MemberCardData, type MemberCardLayout, type MemberCardTextField, type MemberCardTextStyle,
} from "../lib/memberCard";

const labels: Record<MemberCardTextField, string> = {
  role: "中文身份", roleEnglish: "英文身份", name: "姓名",
  biography: "个人介绍", organization: "底部社名", contact: "联系方式",
};
const controls = [
  { key: "fontSize", label: "字号", hint: "小 → 大" },
  { key: "tracking", label: "字距", hint: "紧凑 → 宽松" },
  { key: "offsetX", label: "水平位置", hint: "向左 ← 0 → 向右" },
  { key: "offsetY", label: "垂直位置", hint: "向上 ← 0 → 向下" },
  { key: "lineHeight", label: "行距", hint: "多行介绍的行间距离" },
] as const;

function LayoutControl({ property, label, hint, value, onChange }: {
  property: keyof MemberCardTextStyle;
  label: string;
  hint: string;
  value: number;
  onChange: (value: number) => void;
}) {
  const [entry, setEntry] = useState(String(value));
  useEffect(() => setEntry(String(value)), [value]);
  const limits = MEMBER_CARD_STYLE_LIMITS[property];
  function commit() {
    const parsed = entry.trim() === "" ? NaN : Number(entry);
    const next = Number.isFinite(parsed) ? Math.min(limits.max, Math.max(limits.min, parsed)) : value;
    setEntry(String(next));
    if (next !== value) onChange(next);
  }
  return <div className="card-layout-control">
    <div className="card-layout-control-heading">
      <label htmlFor={`card-layout-${property}`}>{label}</label>
      <div className="card-layout-number"><input
        id={`card-layout-${property}`} type="number" aria-label={`${label}数值`}
        {...limits} value={entry} onBlur={commit}
        onKeyDown={event => { if (event.key === "Enter") event.currentTarget.blur(); }}
        onChange={event => {
          const next = event.target.value;
          setEntry(next);
          if (next.trim() !== "" && Number.isFinite(Number(next)) && Number(next) >= limits.min && Number(next) <= limits.max) onChange(Number(next));
        }}
      /><span aria-hidden="true">px</span></div>
    </div>
    <input type="range" aria-label={`${label}滑块`} {...limits} value={value} onChange={event => onChange(Number(event.target.value))} />
    <small>{hint}</small>
  </div>;
}

export default function MemberCardLayoutEditor({ data, onChange }: {
  data: MemberCardData;
  onChange: (layout: MemberCardLayout) => void;
}) {
  const [field, setField] = useState<MemberCardTextField>("role");
  const style = getMemberCardTextStyle(data, field);
  const currentChanged = !!data.layout?.[field] && Object.keys(data.layout[field]!).length > 0;
  const anyChanged = !!data.layout && Object.values(data.layout).some(value => value && Object.keys(value).length > 0);
  function update(property: keyof MemberCardTextStyle, value: number) {
    onChange({ ...data.layout, [field]: { ...data.layout?.[field], [property]: value } });
  }
  return <section className="card-layout-editor" aria-labelledby="card-layout-title">
    <div className="card-layout-heading"><div><h3 id="card-layout-title"><SlidersHorizontal size={16} aria-hidden="true" />排版微调</h3><p>先选择文字，再拖动滑块或输入数值。</p></div>
      <button type="button" className="card-text-button" disabled={!anyChanged} onClick={() => onChange({})}><RotateCcw size={13} aria-hidden="true" />恢复全部排版</button>
    </div>
    <div className="card-layout-targets" role="group" aria-label="选择要调整的文字">
      {MEMBER_CARD_TEXT_FIELDS.map(key => <button type="button" key={key} aria-pressed={field === key} onClick={() => setField(key)}>{labels[key]}</button>)}
    </div>
    <div className="card-layout-selection"><span>正在调整：<strong>{labels[field]}</strong></span>
      <button type="button" className="card-text-button" disabled={!currentChanged} onClick={() => {
        const layout = { ...data.layout }; delete layout[field]; onChange(layout);
      }}>恢复此项</button>
    </div>
    {!data[field].trim() && <p className="card-layout-empty">先填写{labels[field]}，即可在预览中看到调整效果。</p>}
    <div className="card-layout-controls">
      {controls.filter(control => control.key !== "lineHeight" || field === "biography").map(control => <LayoutControl
        key={`${field}-${control.key}`} property={control.key} label={control.label} hint={control.hint}
        value={style[control.key]} onChange={value => update(control.key, value)}
      />)}
    </div>
    <p className="card-layout-help">位置以原版为 0；数值按高清图片的像素计算。长文字会自动缩小以完整显示，移动到图片边缘时会自动停住。排版随草稿保存。</p>
  </section>;
}
