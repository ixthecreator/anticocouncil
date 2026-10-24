import {
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import type { EditorialItem, InventoryItem, LibraryAsset } from "../types";
import type { Workspace } from "../lib/useWorkspace";
import { safeUrl } from "../lib/workspace";
import { Action, Empty, Field, SaveForm } from "./WorkspaceForms";
import { Download, ExternalLink, FileImage, Plus, X } from "lucide-react";

type Kind = "editorial" | "assets" | "inventory";
// Status and kind tags: the text carries the meaning, colour only supports it.
const editorialTone: Record<EditorialItem["status"], string> = {
  选题: "grey",
  撰稿: "purple",
  编辑: "blue",
  排版: "amber",
  已发布: "green",
};
const assetTone: Record<LibraryAsset["kind"], string> = {
  作者名片: "purple",
  美工素材: "blue",
  往期成果: "grey",
};
/** "2026-10-28" or an ISO timestamp → "2026年10月28日". */
function longDate(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value || "");
  return match
    ? `${Number(match[1])}年${Number(match[2])}月${Number(match[3])}日`
    : value;
}
/** Words a screen reader hears after a repeated button label. */
function Context({ children }: { children: ReactNode }) {
  return <span className="ac-visually-hidden">：{children}</span>;
}
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
/**
 * 删除 with an inline confirm step. The first step is the destructive
 * secondary button; 确认删除 takes focus when it appears, and 取消 (or Esc)
 * returns focus to 删除. Both buttons name the record for screen readers.
 * onDeleted runs after a successful delete, when this button is gone.
 */
export function DeleteButton({
  name,
  onDelete,
  onDeleted,
}: {
  name: string;
  onDelete: () => Promise<void>;
  onDeleted?: () => void;
}) {
  const [confirm, setConfirm] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const confirmGroup = useRef<HTMLSpanElement>(null);
  const moveFocus = useRef(false);
  useEffect(() => {
    if (!moveFocus.current) return;
    moveFocus.current = false;
    if (confirm) confirmGroup.current?.querySelector("button")?.focus();
    else trigger.current?.focus();
  }, [confirm]);
  const show = (next: boolean) => {
    moveFocus.current = true;
    setConfirm(next);
  };
  return confirm ? (
    <span
      ref={confirmGroup}
      className="workspace-actions daily-confirm"
      onKeyDown={(event: KeyboardEvent) => {
        if (event.key === "Escape") show(false);
      }}
    >
      <Action
        className="danger"
        onClick={async () => {
          await onDelete();
          onDeleted?.();
        }}
      >
        确认删除
        <Context>{name}</Context>
      </Action>
      <button
        type="button"
        className="workspace-button"
        onClick={() => show(false)}
      >
        取消
      </button>
    </span>
  ) : (
    <button
      ref={trigger}
      type="button"
      className="workspace-button danger"
      onClick={() => show(true)}
    >
      删除
      <Context>{name}</Context>
    </button>
  );
}

/**
 * Focus for an inline add or edit form: its heading takes focus when the
 * form opens (or switches to another record), and focus goes back to the
 * button that opened it when the form closes.
 */
export function useInlineFormFocus(openId: string | undefined) {
  const heading = useRef<HTMLHeadingElement>(null);
  const opener = useRef<HTMLElement | null>(null);
  useEffect(() => {
    if (openId) heading.current?.focus();
  }, [openId]);
  return {
    heading,
    remember(element: HTMLElement) {
      opener.current = element;
    },
    restore() {
      const element = opener.current;
      opener.current = null;
      if (element?.isConnected) element.focus();
    },
  };
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
  const { data, save, remove, setError } = workspace;
  const matched = (row: object) =>
    Object.entries(row).some(
      ([key, value]) =>
        !["id", "fileData"].includes(key) &&
        String(value).toLowerCase().includes(search.toLowerCase()),
    );
  const authorCards = data.assets.filter((a) => a.kind === "作者名片");
  const open = editorial ?? asset ?? inventory;
  const form = useInlineFormFocus(open?.id);
  const formId = useId();
  const results = useRef<HTMLParagraphElement>(null);
  // The add button opens a blank form and, while that form is open, closes it.
  const adding =
    !!open &&
    !(
      kind === "editorial"
        ? data.editorial
        : kind === "assets"
          ? data.assets
          : data.inventory
    ).some((row) => row.id === open.id);
  const close = () => {
    setEditorial(null);
    setAsset(null);
    setInventory(null);
    form.restore();
  };
  const toggleAdd = (opener: HTMLElement) => {
    if (adding) return close();
    form.remember(opener);
    if (kind === "editorial") setEditorial(freshEditorial());
    else if (kind === "assets") setAsset(freshAsset());
    else setInventory(freshInventory());
  };
  /** Opens the form for a record; focus returns to `opener` when it closes. */
  const editRow = <T,>(set: (row: T) => void, row: T, opener: HTMLElement) => {
    form.remember(opener);
    set(row);
  };
  // After a delete the row's buttons are gone: focus the updated count.
  const focusResults = () => results.current?.focus();
  const filterId = useId();
  const editorialRows = data.editorial.filter(
    (row) => matched(row) && (filter === "全部" || row.department === filter),
  );
  const assetRows = data.assets.filter(
    (row) => matched(row) && (filter === "全部" || row.kind === filter),
  );
  const inventoryRows = data.inventory.filter(matched);
  const count =
    kind === "editorial"
      ? editorialRows.length
      : kind === "assets"
        ? assetRows.length
        : inventoryRows.length;
  const countLabel = `${count} 项${
    kind === "editorial" ? "选题" : kind === "assets" ? "资料" : "物品"
  }`;
  const externalLink =
    kind === "editorial"
      ? {
          href: "https://docs.qq.com/form/page/DUVpiSktzanZmZWFr",
          label: "编辑部招新表",
        }
      : kind === "inventory"
        ? {
            href: "https://docs.qq.com/sheet/DSmJCU0dJQ0xHbW9N?tab=BB08J2",
            label: "原文创存放表",
          }
        : null;
  return (
    <div className={`daily-view operations-view ${kind}-view`}>
      <div className="daily-actions">
        <button
          type="button"
          className={`workspace-button${open ? "" : " primary"}`}
          aria-expanded={adding}
          aria-controls={adding ? formId : undefined}
          onClick={(event) => toggleAdd(event.currentTarget)}
        >
          {adding ? <X aria-hidden="true" /> : <Plus aria-hidden="true" />}
          {adding
            ? "收起"
            : kind === "editorial"
              ? "新增选题"
              : kind === "assets"
                ? "添加资料"
                : "登记库存"}
        </button>
        {externalLink && (
          <a
            className="council-link daily-related"
            target="_blank"
            rel="noreferrer"
            href={externalLink.href}
          >
            {externalLink.label}
            <ExternalLink aria-hidden="true" />
            <span className="ac-visually-hidden">（在新窗口打开）</span>
          </a>
        )}
      </div>
      {open && (
        <div id={formId} className="daily-form">
          {editorial && (
            <SaveForm
              key={editorial.id}
              onCancel={close}
              onSave={async () => {
                if (!editorial.title.trim()) throw new Error("请输入选题。");
                await save("editorial", {
                  ...editorial,
                  title: editorial.title.trim(),
                });
                close();
              }}
            >
              <h2 ref={form.heading} tabIndex={-1} className="daily-form-title">
                {adding ? "新增选题" : "编辑选题安排"}
              </h2>
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
              onCancel={close}
              onSave={async () => {
                if (fileBusy) throw new Error("文件正在读取，请稍候。");
                if (!asset.title.trim()) throw new Error("请输入资料名称。");
                if (!asset.fileData && !asset.url.trim())
                  throw new Error("请上传文件或填写资料链接。");
                if (asset.url && !safeUrl(asset.url))
                  throw new Error("请输入完整的 https:// 或 http:// 链接。");
                if (asset.kind === "作者名片" && !asset.author.trim())
                  throw new Error("作者名片需要填写作者姓名。");
                await save("assets", {
                  ...asset,
                  title: asset.title.trim(),
                  url: asset.url ? safeUrl(asset.url) : "",
                  updatedAt: new Date().toISOString(),
                });
                close();
              }}
            >
              <h2 ref={form.heading} tabIndex={-1} className="daily-form-title">
                {adding ? "添加资料" : "编辑资料"}
              </h2>
              <Field label="资料名称">
                <input
                  required
                  value={asset.title}
                  onChange={(e) =>
                    setAsset({ ...asset, title: e.target.value })
                  }
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
                  onChange={(e) =>
                    setAsset({ ...asset, author: e.target.value })
                  }
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
              <Field
                label="上传名片或资料"
                hint="PNG、JPG、WEBP 或 PDF，最多 400 KB；更大的文件请填写资料链接。"
              >
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
                          reader.onerror = () =>
                            reject(new Error("文件读取失败"));
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
                  <span className="workspace-help">
                    {fileBusy ? "正在读取…" : `已选择：${asset.fileName}`}
                  </span>
                )}
              </Field>
              {asset.fileData && (
                <button
                  type="button"
                  className="workspace-button"
                  onClick={() =>
                    setAsset({ ...asset, fileData: "", fileName: "" })
                  }
                >
                  移除附件
                </button>
              )}
              <Field label="资料说明">
                <textarea
                  value={asset.notes}
                  onChange={(e) =>
                    setAsset({ ...asset, notes: e.target.value })
                  }
                  rows={3}
                />
              </Field>
            </SaveForm>
          )}
          {inventory && (
            <SaveForm
              key={inventory.id}
              onCancel={close}
              onSave={async () => {
                if (!inventory.title.trim() || !inventory.location.trim())
                  throw new Error("请填写文创名称和存放地点。");
                if (
                  !Number.isSafeInteger(inventory.quantity) ||
                  inventory.quantity < 0
                )
                  throw new Error("数量必须是非负整数。");
                await save("inventory", {
                  ...inventory,
                  title: inventory.title.trim(),
                  location: inventory.location.trim(),
                });
                close();
              }}
            >
              <h2 ref={form.heading} tabIndex={-1} className="daily-form-title">
                {adding ? "登记库存" : "更新库存"}
              </h2>
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
                  step={1}
                  type="number"
                  value={inventory.quantity}
                  onChange={(e) =>
                    setInventory({
                      ...inventory,
                      quantity: Number(e.target.value),
                    })
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
        </div>
      )}
      {kind !== "inventory" ? (
        <div className="council-filter-toolbar daily-toolbar">
          <label htmlFor={filterId}>
            {kind === "editorial" ? "筛选编辑部" : "筛选资料类型"}
          </label>
          <select
            id={filterId}
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          >
            {(kind === "editorial"
              ? ["全部", "微信编辑部", "QQ编辑部"]
              : ["全部", "作者名片", "美工素材", "往期成果"]
            ).map((value) => (
              <option key={value}>{value}</option>
            ))}
          </select>
          <p ref={results} tabIndex={-1} className="council-meta" role="status">
            {countLabel}
          </p>
        </div>
      ) : (
        <p
          ref={results}
          tabIndex={-1}
          className="council-meta daily-count"
          role="status"
        >
          {countLabel}
        </p>
      )}
      {kind === "editorial" && editorialRows.length > 0 && (
        <div className="council-table-wrap">
          <table className="council-table council-table--stack-md daily-table editorial-table">
            <caption className="ac-visually-hidden">
              编辑部选题，共 {editorialRows.length} 项
            </caption>
            <thead>
              <tr>
                <th scope="col">选题</th>
                <th scope="col">编辑部</th>
                <th scope="col">分工</th>
                <th scope="col">计划发布</th>
                <th scope="col">进度</th>
                <th scope="col">
                  <span className="ac-visually-hidden">操作</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {editorialRows.map((row) => {
                const cards = authorCards.filter(
                  (a) =>
                    a.author.trim() === row.author.trim() && row.author.trim(),
                );
                return (
                  <tr key={row.id}>
                    <th scope="row">
                      {row.title}
                      {row.notes && (
                        <span className="council-meta daily-notes">
                          {row.notes}
                        </span>
                      )}
                    </th>
                    <td data-label="编辑部" className="council-nowrap">
                      {row.department}
                    </td>
                    <td>
                      <dl className="daily-roles">
                        <div>
                          <dt>作者</dt>
                          <dd>
                            {row.author || "待安排"}
                            {cards.map((a) =>
                              a.fileData ? (
                                <a
                                  key={a.id}
                                  className="council-link"
                                  href={a.fileData}
                                  download={a.fileName}
                                >
                                  下载名片
                                  <Context>{a.author}</Context>
                                </a>
                              ) : (
                                <a
                                  key={a.id}
                                  className="council-link"
                                  href={safeUrl(a.url)}
                                  target="_blank"
                                  rel="noreferrer"
                                >
                                  打开名片
                                  <span className="ac-visually-hidden">
                                    ：{a.author}（在新窗口打开）
                                  </span>
                                </a>
                              ),
                            )}
                          </dd>
                        </div>
                        <div>
                          <dt>编辑</dt>
                          <dd>{row.editor || "待安排"}</dd>
                        </div>
                        <div>
                          <dt>排版</dt>
                          <dd>{row.designer || "待安排"}</dd>
                        </div>
                      </dl>
                    </td>
                    <td data-label="计划发布" className="council-nowrap">
                      {row.dueDate ? (
                        <time dateTime={row.dueDate}>
                          {longDate(row.dueDate)}
                        </time>
                      ) : (
                        "待安排"
                      )}
                    </td>
                    <td data-label="进度">
                      <span
                        className={`council-tag ${editorialTone[row.status]}`}
                      >
                        {row.status}
                      </span>
                    </td>
                    <td className="daily-table-actions">
                      <div className="workspace-actions">
                        <button
                          type="button"
                          className="workspace-button"
                          onClick={(event) =>
                            editRow(setEditorial, row, event.currentTarget)
                          }
                        >
                          编辑安排
                          <Context>{row.title}</Context>
                        </button>
                        <DeleteButton
                          name={row.title}
                          onDelete={() => remove("editorial", row.id)}
                          onDeleted={focusResults}
                        />
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {kind === "assets" && assetRows.length > 0 && (
        <ul className="asset-grid">
          {assetRows.map((row) => {
            const url = safeUrl(row.url);
            return (
              <li className="asset-card" key={row.id}>
                <div className="asset-preview">
                  {row.fileData.startsWith("data:image/") ? (
                    <img src={row.fileData} alt="" loading="lazy" />
                  ) : (
                    <FileImage aria-hidden="true" />
                  )}
                </div>
                <div className="asset-body">
                  <span className={`council-tag ${assetTone[row.kind]}`}>
                    {row.kind}
                  </span>
                  <h2>
                    {url ? (
                      <a
                        className="council-link"
                        href={url}
                        target="_blank"
                        rel="noreferrer"
                      >
                        {row.title}
                        <span className="ac-visually-hidden">
                          （在新窗口打开）
                        </span>
                      </a>
                    ) : row.fileData ? (
                      <a
                        className="council-link"
                        href={row.fileData}
                        download={row.fileName || row.title}
                      >
                        {row.title}
                        <span className="ac-visually-hidden">（下载文件）</span>
                      </a>
                    ) : (
                      row.title
                    )}
                  </h2>
                  <dl className="daily-meta">
                    {row.author && (
                      <div>
                        <dt>作者</dt>
                        <dd>{row.author}</dd>
                      </div>
                    )}
                    {row.tags && (
                      <div>
                        <dt>标签</dt>
                        <dd>{row.tags}</dd>
                      </div>
                    )}
                  </dl>
                  {row.notes && (
                    <p className="notes-text daily-notes">{row.notes}</p>
                  )}
                  {(url && row.fileData) || row.updatedAt ? (
                    <p className="council-meta asset-footer">
                      {url && row.fileData && (
                        <a
                          className="council-link"
                          href={row.fileData}
                          download={row.fileName || row.title}
                        >
                          <Download aria-hidden="true" />
                          下载文件
                          <Context>{row.title}</Context>
                        </a>
                      )}
                      {row.updatedAt && (
                        <span>
                          更新于{" "}
                          <time dateTime={row.updatedAt}>
                            {longDate(row.updatedAt)}
                          </time>
                        </span>
                      )}
                    </p>
                  ) : null}
                  <div className="workspace-actions">
                    <button
                      type="button"
                      className="workspace-button"
                      onClick={(event) =>
                        editRow(setAsset, row, event.currentTarget)
                      }
                    >
                      编辑资料
                      <Context>{row.title}</Context>
                    </button>
                    <DeleteButton
                      name={row.title}
                      onDelete={() => remove("assets", row.id)}
                      onDeleted={focusResults}
                    />
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
      {kind === "inventory" && inventoryRows.length > 0 && (
        <div className="council-table-wrap">
          <table className="council-table daily-table inventory-table">
            <caption className="ac-visually-hidden">
              文创库存，共 {inventoryRows.length} 项
            </caption>
            <thead>
              <tr>
                <th scope="col">物品</th>
                <th scope="col">存放地点</th>
                <th scope="col">保管人</th>
                <th scope="col" className="is-numeric">
                  现存数量
                </th>
                <th scope="col">
                  <span className="ac-visually-hidden">操作</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {inventoryRows.map((row) => (
                <tr key={row.id}>
                  <th scope="row">
                    {row.title}
                    {row.notes && (
                      <span className="council-meta daily-notes">
                        {row.notes}
                      </span>
                    )}
                  </th>
                  <td data-label="存放地点">{row.location}</td>
                  <td data-label="保管人">{row.keeper || "未填写"}</td>
                  <td data-label="现存数量" className="is-numeric">
                    <span className="inventory-count">
                      <strong>{row.quantity}</strong> 件
                    </span>
                  </td>
                  <td className="daily-table-actions">
                    <div className="workspace-actions">
                      <button
                        type="button"
                        className="workspace-button"
                        onClick={(event) =>
                          editRow(setInventory, row, event.currentTarget)
                        }
                      >
                        更新库存
                        <Context>{row.title}</Context>
                      </button>
                      <DeleteButton
                        name={row.title}
                        onDelete={() => remove("inventory", row.id)}
                        onDeleted={focusResults}
                      />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {count === 0 && (
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
    </div>
  );
}
