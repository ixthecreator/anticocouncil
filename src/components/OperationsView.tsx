import { useRef, useState } from "react";
import type { EditorialItem, InventoryItem, LibraryAsset } from "../types";
import type { Workspace } from "../lib/useWorkspace";
import { safeUrl } from "../lib/workspace";
import { mergeEditedRecord } from "../lib/editRecord";
import { Action, Empty, Field, SaveForm } from "./WorkspaceForms";
import { FileImage, ExternalLink } from "lucide-react";

type Kind = "editorial" | "assets" | "inventory";
const labels = {
  editorial: "编辑部选题与排版",
  assets: "作者名片与素材库",
  inventory: "文创库存与存放地点",
};
const editorialFields = [
  "title",
  "department",
  "author",
  "editor",
  "designer",
  "dueDate",
  "status",
  "notes",
] as const satisfies readonly (keyof EditorialItem)[];
const assetFields = [
  "title",
  "kind",
  "author",
  "tags",
  "url",
  "fileName",
  "fileData",
  "notes",
] as const satisfies readonly (keyof LibraryAsset)[];
const inventoryFields = [
  "title",
  "location",
  "quantity",
  "keeper",
  "notes",
] as const satisfies readonly (keyof InventoryItem)[];
const freshEditorial = (): EditorialItem => ({
  id: crypto.randomUUID(),
  title: "",
  department: "微信编辑部",
  author: "",
  editor: "",
  designer: "",
  dueDate: "",
  status: "选题",
  notes: "",
});
const freshAsset = (): LibraryAsset => ({
  id: crypto.randomUUID(),
  title: "",
  kind: "作者名片",
  author: "",
  tags: "",
  url: "",
  fileName: "",
  fileData: "",
  notes: "",
  updatedAt: new Date().toISOString(),
});
const freshInventory = (): InventoryItem => ({
  id: crypto.randomUUID(),
  title: "明信片",
  location: "",
  quantity: 0,
  keeper: "",
  notes: "",
});
function DeleteButton({
  onDelete,
  disabled = false,
}: {
  onDelete: () => Promise<void>;
  disabled?: boolean;
}) {
  const [confirm, setConfirm] = useState(false);
  return confirm ? (
    <span className="workspace-actions">
      <Action className="danger" onClick={onDelete} disabled={disabled}>
        确认删除
      </Action>
      <button
        type="button"
        className="workspace-button"
        disabled={disabled}
        onClick={() => setConfirm(false)}
      >
        取消
      </button>
    </span>
  ) : (
    <button
      type="button"
      className="workspace-button subtle"
      disabled={disabled}
      onClick={() => setConfirm(true)}
    >
      删除
    </button>
  );
}
export function OperationsView({
  kind,
  workspace,
  search,
}: {
  kind: Kind;
  workspace: Workspace;
  search: string;
}) {
  const [editorial, setEditorial] = useState<EditorialItem | null>(null);
  const [asset, setAsset] = useState<LibraryAsset | null>(null);
  const [inventory, setInventory] = useState<InventoryItem | null>(null);
  const [filter, setFilter] = useState("全部");
  const [fileBusy, setFileBusy] = useState(false);
  const [formBusy, setFormBusy] = useState(false);
  const draftPending = useRef(false);
  const editorialOriginal = useRef<EditorialItem | null>(null);
  const assetOriginal = useRef<LibraryAsset | null>(null);
  const inventoryOriginal = useRef<InventoryItem | null>(null);
  const { data, change, remove, setError } = workspace;
  const onFormBusyChange = (busy: boolean) => {
    draftPending.current = busy;
    setFormBusy(busy);
  };
  const beginEditorial = (row: EditorialItem | null) => {
    if (draftPending.current) return;
    editorialOriginal.current = row ? structuredClone(row) : null;
    setEditorial(row ? structuredClone(row) : freshEditorial());
  };
  const beginAsset = (row: LibraryAsset | null) => {
    if (draftPending.current) return;
    assetOriginal.current = row ? structuredClone(row) : null;
    setAsset(row ? structuredClone(row) : freshAsset());
  };
  const beginInventory = (row: InventoryItem | null) => {
    if (draftPending.current) return;
    inventoryOriginal.current = row ? structuredClone(row) : null;
    setInventory(row ? structuredClone(row) : freshInventory());
  };
  const matched = (row: object) =>
    Object.entries(row).some(
      ([key, value]) =>
        !["id", "fileData"].includes(key) &&
        String(value).toLowerCase().includes(search.toLowerCase()),
    );
  const authorCards = data.assets.filter((a) => a.kind === "作者名片");
  const edit = () =>
    kind === "editorial"
      ? beginEditorial(null)
      : kind === "assets"
        ? beginAsset(null)
        : beginInventory(null);
  return (
    <section className="workspace-panel operations-view">
      <div className="workspace-heading">
        <div>
          <span className="eyebrow">
            {kind === "editorial"
              ? "EDITORIAL"
              : kind === "assets"
                ? "LIBRARY"
                : "LOGISTICS"}
          </span>
          <h2>{labels[kind]}</h2>
        </div>
        <button
          type="button"
          className="workspace-button primary"
          disabled={formBusy}
          onClick={edit}
        >
          ＋{" "}
          {kind === "editorial"
            ? "新增选题"
            : kind === "assets"
              ? "添加资料"
              : "登记库存"}
        </button>
      </div>
      {kind === "editorial" && (
        <div className="resource-links">
          <a
            target="_blank"
            rel="noreferrer"
            href="https://docs.qq.com/form/page/DUVpiSktzanZmZWFr"
          >
            编辑部招新表 <ExternalLink size={14} />
          </a>
        </div>
      )}
      {kind === "inventory" && (
        <div className="resource-links">
          <a
            target="_blank"
            rel="noreferrer"
            href="https://docs.qq.com/sheet/DSmJCU0dJQ0xHbW9N?tab=BB08J2"
          >
            原文创存放表 <ExternalLink size={14} />
          </a>
        </div>
      )}
      {kind !== "inventory" && (
        <Field label={kind === "editorial" ? "筛选编辑部" : "筛选资料类型"}>
          <select value={filter} onChange={(e) => setFilter(e.target.value)}>
            {(kind === "editorial"
              ? ["全部", "微信编辑部", "QQ编辑部"]
              : ["全部", "作者名片", "美工素材", "往期成果"]
            ).map((value) => (
              <option key={value}>{value}</option>
            ))}
          </select>
        </Field>
      )}
      {editorial && (
        <SaveForm
          key={editorial.id}
          onBusyChange={onFormBusyChange}
          onCancel={() => setEditorial(null)}
          onSave={async () => {
            if (!editorial.title.trim()) throw new Error("请输入选题。");
            const original = editorialOriginal.current;
            const edited = {
              ...editorial,
              title: editorial.title.trim(),
            };
            await change("editorial", editorial.id, (latest) =>
              mergeEditedRecord(latest, original, edited, editorialFields),
            );
            setEditorial(null);
          }}
        >
          <Field label="选题名称">
            <input
              required
              value={editorial.title}
              onChange={(e) =>
                setEditorial({ ...editorial, title: e.target.value })
              }
            />
          </Field>
          <Field label="编辑部">
            <select
              value={editorial.department}
              onChange={(e) =>
                setEditorial({
                  ...editorial,
                  department: e.target.value as EditorialItem["department"],
                })
              }
            >
              <option>微信编辑部</option>
              <option>QQ编辑部</option>
            </select>
          </Field>
          <Field label="作者">
            <input
              value={editorial.author}
              onChange={(e) =>
                setEditorial({ ...editorial, author: e.target.value })
              }
              list="authors"
            />
            <datalist id="authors">
              {authorCards.map((a) => (
                <option key={a.id} value={a.author} />
              ))}
            </datalist>
          </Field>
          <Field label="负责编辑">
            <input
              value={editorial.editor}
              onChange={(e) =>
                setEditorial({ ...editorial, editor: e.target.value })
              }
            />
          </Field>
          <Field label="排版负责人">
            <input
              value={editorial.designer}
              onChange={(e) =>
                setEditorial({ ...editorial, designer: e.target.value })
              }
            />
          </Field>
          <Field label="计划发布日期">
            <input
              type="date"
              value={editorial.dueDate}
              onChange={(e) =>
                setEditorial({ ...editorial, dueDate: e.target.value })
              }
            />
          </Field>
          <Field label="工作进度">
            <select
              value={editorial.status}
              onChange={(e) =>
                setEditorial({
                  ...editorial,
                  status: e.target.value as EditorialItem["status"],
                })
              }
            >
              {["选题", "撰稿", "编辑", "排版", "已发布"].map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </Field>
          <Field label="稿件链接或备注">
            <textarea
              rows={3}
              value={editorial.notes}
              onChange={(e) =>
                setEditorial({ ...editorial, notes: e.target.value })
              }
            />
          </Field>
        </SaveForm>
      )}
      {asset && (
        <SaveForm
          key={asset.id}
          onBusyChange={onFormBusyChange}
          onCancel={() => setAsset(null)}
          onSave={async () => {
            if (fileBusy) throw new Error("文件正在读取，请稍候。");
            if (!asset.title.trim()) throw new Error("请输入资料名称。");
            if (!asset.fileData && !asset.url.trim())
              throw new Error("请上传文件或填写资料链接。");
            if (asset.url && !safeUrl(asset.url))
              throw new Error("请输入完整的 https:// 或 http:// 链接。");
            if (asset.kind === "作者名片" && !asset.author.trim())
              throw new Error("作者名片需要填写作者姓名。");
            const original = assetOriginal.current;
            const edited = {
              ...asset,
              title: asset.title.trim(),
              url: asset.url ? safeUrl(asset.url) : "",
            };
            await change("assets", asset.id, (latest) => ({
              ...mergeEditedRecord(latest, original, edited, assetFields),
              updatedAt: new Date().toISOString(),
            }));
            setAsset(null);
          }}
        >
          <Field label="资料名称">
            <input
              required
              value={asset.title}
              onChange={(e) => setAsset({ ...asset, title: e.target.value })}
            />
          </Field>
          <Field label="资料类型">
            <select
              value={asset.kind}
              onChange={(e) =>
                setAsset({
                  ...asset,
                  kind: e.target.value as LibraryAsset["kind"],
                })
              }
            >
              {["作者名片", "美工素材", "往期成果"].map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </Field>
          <Field label="作者姓名">
            <input
              value={asset.author}
              onChange={(e) => setAsset({ ...asset, author: e.target.value })}
            />
          </Field>
          <Field label="标签">
            <input
              value={asset.tags}
              onChange={(e) => setAsset({ ...asset, tags: e.target.value })}
              placeholder="例如：人物、封面、明信片"
            />
          </Field>
          <Field label="资料链接">
            <input
              type="url"
              value={asset.url}
              onChange={(e) => setAsset({ ...asset, url: e.target.value })}
              placeholder="https://"
            />
          </Field>
          <Field label="上传名片或资料（PNG / JPG / WEBP / PDF，最多 400 KB）">
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp,application/pdf"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                if (
                  file.size > 400 * 1024 ||
                  ![
                    "image/png",
                    "image/jpeg",
                    "image/webp",
                    "application/pdf",
                  ].includes(file.type)
                ) {
                  setError(
                    "请上传 400 KB 以内的 PNG、JPG、WEBP 或 PDF。大文件请使用资料链接。",
                  );
                  e.target.value = "";
                  return;
                }
                setFileBusy(true);
                const id = asset.id;
                try {
                  const content = await new Promise<string>(
                    (resolve, reject) => {
                      const reader = new FileReader();
                      reader.onload = () => resolve(String(reader.result));
                      reader.onerror = () => reject(new Error("文件读取失败"));
                      reader.readAsDataURL(file);
                    },
                  );
                  setAsset((old) =>
                    old?.id === id
                      ? { ...old, fileData: content, fileName: file.name }
                      : old,
                  );
                } catch {
                  setError("文件读取失败，请重新选择。");
                } finally {
                  setFileBusy(false);
                }
              }}
            />
            {asset.fileName && (
              <span>{fileBusy ? "正在读取…" : asset.fileName}</span>
            )}
          </Field>
          {asset.fileData && (
            <button
              type="button"
              className="workspace-button"
              onClick={() => setAsset({ ...asset, fileData: "", fileName: "" })}
            >
              移除附件
            </button>
          )}
          <Field label="资料说明">
            <textarea
              value={asset.notes}
              onChange={(e) => setAsset({ ...asset, notes: e.target.value })}
              rows={3}
            />
          </Field>
        </SaveForm>
      )}
      {inventory && (
        <SaveForm
          key={inventory.id}
          onBusyChange={onFormBusyChange}
          onCancel={() => setInventory(null)}
          onSave={async () => {
            if (!inventory.title.trim() || !inventory.location.trim())
              throw new Error("请填写文创名称和存放地点。");
            if (
              !Number.isSafeInteger(inventory.quantity) ||
              inventory.quantity < 0
            )
              throw new Error("数量必须是 0 至 9007199254740991 之间的整数。");
            const original = inventoryOriginal.current;
            const edited = {
              ...inventory,
              title: inventory.title.trim(),
              location: inventory.location.trim(),
            };
            await change("inventory", inventory.id, (latest) =>
              mergeEditedRecord(latest, original, edited, inventoryFields),
            );
            setInventory(null);
          }}
        >
          <Field label="文创名称">
            <input
              required
              value={inventory.title}
              onChange={(e) =>
                setInventory({ ...inventory, title: e.target.value })
              }
            />
          </Field>
          <Field label="存放地点或分区">
            <input
              required
              value={inventory.location}
              onChange={(e) =>
                setInventory({ ...inventory, location: e.target.value })
              }
            />
          </Field>
          <Field label="现存数量">
            <input
              required
              min={0}
              max={Number.MAX_SAFE_INTEGER}
              step={1}
              type="number"
              value={inventory.quantity}
              onChange={(e) =>
                setInventory({ ...inventory, quantity: Number(e.target.value) })
              }
            />
          </Field>
          <Field label="保管人">
            <input
              value={inventory.keeper}
              onChange={(e) =>
                setInventory({ ...inventory, keeper: e.target.value })
              }
            />
          </Field>
          <Field label="备注">
            <textarea
              value={inventory.notes}
              onChange={(e) =>
                setInventory({ ...inventory, notes: e.target.value })
              }
              rows={3}
            />
          </Field>
        </SaveForm>
      )}
      <div className={kind === "assets" ? "asset-grid" : "record-list"}>
        {kind === "editorial" &&
          data.editorial
            .filter(
              (row) =>
                matched(row) &&
                (filter === "全部" || row.department === filter),
            )
            .map((row) => (
              <article className="record-card" key={row.id}>
                <div className="workspace-heading">
                  <h3>{row.title}</h3>
                  <span className="workspace-badge">{row.status}</span>
                </div>
                <p className="workspace-help">
                  {row.department} · {row.dueDate || "日期待安排"}
                </p>
                <p>
                  作者：{row.author || "待安排"}　编辑：{row.editor || "待安排"}
                  　排版：{row.designer || "待安排"}
                </p>
                {row.notes && <p className="notes-text">{row.notes}</p>}
                <div className="resource-links">
                  {authorCards
                    .filter(
                      (a) =>
                        a.author.trim() === row.author.trim() &&
                        row.author.trim(),
                    )
                    .map((a) =>
                      a.fileData ? (
                        <a key={a.id} href={a.fileData} download={a.fileName}>
                          下载 {a.author} 的名片
                        </a>
                      ) : (
                        <a
                          key={a.id}
                          href={safeUrl(a.url)}
                          target="_blank"
                          rel="noreferrer"
                        >
                          打开 {a.author} 的名片
                        </a>
                      ),
                    )}
                </div>
                <div className="workspace-actions">
                  <button
                    className="workspace-button"
                    disabled={formBusy}
                    onClick={() => beginEditorial(row)}
                  >
                    编辑安排
                  </button>
                  <DeleteButton
                    disabled={formBusy}
                    onDelete={() => remove("editorial", row.id)}
                  />
                </div>
              </article>
            ))}
        {kind === "assets" &&
          data.assets
            .filter(
              (row) =>
                matched(row) && (filter === "全部" || row.kind === filter),
            )
            .map((row) => (
              <article className="record-card asset-card" key={row.id}>
                <div className="asset-preview">
                  {row.fileData.startsWith("data:image/") ? (
                    <img src={row.fileData} alt={row.title} loading="lazy" />
                  ) : (
                    <FileImage size={42} />
                  )}
                </div>
                <span className="workspace-badge">{row.kind}</span>
                <h3>{row.title}</h3>
                <p>
                  {row.author}
                  {row.tags ? ` · ${row.tags}` : ""}
                </p>
                {row.notes && <p className="workspace-help">{row.notes}</p>}
                <div className="resource-links">
                  {row.fileData && (
                    <a href={row.fileData} download={row.fileName || row.title}>
                      下载文件
                    </a>
                  )}
                  {safeUrl(row.url) && (
                    <a href={safeUrl(row.url)} target="_blank" rel="noreferrer">
                      打开资料 <ExternalLink size={14} />
                    </a>
                  )}
                </div>
                <div className="workspace-actions">
                  <button
                    className="workspace-button"
                    disabled={formBusy}
                    onClick={() => beginAsset(row)}
                  >
                    编辑
                  </button>
                  <DeleteButton
                    disabled={formBusy}
                    onDelete={() => remove("assets", row.id)}
                  />
                </div>
              </article>
            ))}
        {kind === "inventory" &&
          data.inventory.filter(matched).map((row) => (
            <article className="record-card" key={row.id}>
              <div className="workspace-heading">
                <h3>{row.title}</h3>
                <strong className="inventory-count">
                  {row.quantity}
                  <small> 件</small>
                </strong>
              </div>
              <p>
                存放：{row.location}　保管：{row.keeper || "未填写"}
              </p>
              {row.notes && <p className="workspace-help">{row.notes}</p>}
              <div className="workspace-actions">
                <button
                  className="workspace-button"
                  disabled={formBusy}
                  onClick={() => beginInventory(row)}
                >
                  更新数量与地点
                </button>
                <DeleteButton
                  disabled={formBusy}
                  onDelete={() => remove("inventory", row.id)}
                />
              </div>
            </article>
          ))}
      </div>
      {!(data[kind] as any[]).some(
        (row) =>
          matched(row) &&
          (filter === "全部" ||
            kind === "inventory" ||
            row.department === filter ||
            row.kind === filter),
      ) && (
        <Empty>
          {search || filter !== "全部"
            ? "没有匹配的记录，请调整搜索或筛选。"
            : kind === "editorial"
              ? "尚无选题。添加第一条，安排作者、编辑与排版。"
              : kind === "assets"
                ? "还没有资料。上传完成的作者名片，或登记素材与成果链接。"
                : "尚未登记文创。按实际存放地点录入现存数量。"}
        </Empty>
      )}
    </section>
  );
}
