import { afterEach, expect, test } from "bun:test";
import { renderToReadableStream, renderToStaticMarkup } from "react-dom/server";
import SiteRouter from "./SiteRouter";
// Load browser-capable libraries in the test runner before installing the route-only window stub.
import "./WorkspaceEntry";
import { WorkspaceGateway } from "./components/WorkspaceGateway";
import { readLocal } from "./lib/useWorkspace";
import { archiveRecords, archiveTerms } from "./content/archive";

const originalGlobals = new Map(["window", "document", "localStorage"].map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));

afterEach(() => {
  for (const [key, descriptor] of originalGlobals) {
    if (descriptor) Object.defineProperty(globalThis, key, descriptor);
    else Reflect.deleteProperty(globalThis, key);
  }
});

function browserAt(path: string, preference: "local" | "firebase") {
  const url = new URL(path, "https://council.example");
  const stored = new Map<string, string>([["storage_mode", preference]]);
  const reads: string[] = [];
  const navigations: string[] = [];
  Object.defineProperty(globalThis, "window", { configurable: true, value: { location: { hostname: url.hostname, pathname: url.pathname, search: url.search, hash: url.hash, assign: (next: string) => navigations.push(next), replace: (next: string) => navigations.push(next) } } });
  Object.defineProperty(globalThis, "document", { configurable: true, value: { title: "" } });
  Object.defineProperty(globalThis, "localStorage", { configurable: true, value: {
    getItem: (key: string) => { reads.push(key); return stored.get(key) ?? null; },
    setItem: (key: string, value: string) => { stored.set(key, value); },
  } });
  return { stored, reads, navigations };
}

async function renderRoute() {
  const stream = await renderToReadableStream(<SiteRouter />);
  await stream.allReady;
  return new Response(stream).text();
}

test("workspace loading pages retain the public header, footer and route-specific title", () => {
  for (const [path, title] of [
    ["/portal", "正在打开协作工作台"],
    ["/workspace", "正在打开协作工作台"],
    ["/local", "正在打开本地试用"],
  ]) {
    const browser = browserAt(path, "local");
    // Render the pending UI directly so this remains independent of lazy module caching.
    const html = renderToStaticMarkup(SiteRouter().props.fallback);
    expect(html).toContain(title);
    expect(html).toContain('class="public-masthead"');
    expect(html).toContain('class="public-footer"');
    expect(html).toContain('href="/"');
    expect(html).toContain('href="/archive"');
    expect(html).not.toContain('class="council-app');
    if (path === "/local") {
      expect(html).toContain("试用数据仅保存在当前浏览器，不会同步到云端。");
      expect(html).not.toContain("注册账号");
    } else {
      expect(html).toContain("注册账号");
    }
    expect(browser.reads).toEqual([]);
  }
});

test("portal and legacy workspace routes never mount local data behind a saved local preference", async () => {
  for (const path of ["/portal#overview", "/portal#proposals", "/portal#assets", "/workspace#inventory", "/portal/", "/workspace/"]) {
    const browser = browserAt(path, "local");
    browser.stored.set("antico_workspace_v2", "private local data must remain untouched");
    const html = await renderRoute();
    expect(html).toContain('class="cloud-gateway"');
    expect(html).not.toContain('class="council-app');
    expect(browser.reads).toEqual([]);
    expect(browser.stored.get("antico_workspace_v2")).toBe("private local data must remain untouched");
  }
});

test("local route opens the actual local workspace even when the saved preference is cloud", async () => {
  browserAt("/local#editorial", "firebase");
  const html = await renderRoute();
  expect(html).toContain('class="council-app');
  expect(html).not.toContain('class="cloud-gateway"');
  expect(html).toContain("connection-local");
  expect(html).toContain('<option value="local" selected="">');
  expect(html).toContain('class="workspace-content page-editorial"');
  expect(document.title).toBe("本地试用 · 安提柯议会");
});

test("an unspecified gateway remains closed rather than trusting browser preferences", () => {
  browserAt("/portal", "local");
  let opened = false;
  const html = renderToStaticMarkup(<WorkspaceGateway>{() => { opened = true; return <p>private records</p>; }}</WorkspaceGateway>);
  expect(opened).toBe(false);
  expect(html).toContain('class="cloud-gateway"');
});

test("switching the local workspace navigates to cloud authentication and preserves each module", () => {
  for (const module of ["overview", "proposals", "session", "post", "archive", "supervision", "activity", "editorial", "assets", "inventory"]) {
    const browser = browserAt(`/local#${module}`, "local");
    let switchMode: (mode: "local" | "firebase") => void = () => { throw new Error("workspace not rendered"); };
    renderToStaticMarkup(<WorkspaceGateway mode="local">{props => { switchMode = props.onModeChange; return <p>{props.mode}</p>; }}</WorkspaceGateway>);
    switchMode("local");
    expect(browser.navigations).toEqual([]);
    switchMode("firebase");
    expect(browser.navigations).toEqual([`/portal#${module}`]);
    expect(browser.stored.get("storage_mode")).toBe("local");
  }
});

test("local trial keeps using the existing local store and its legacy fallback", () => {
  const browser = browserAt("/local", "firebase");
  const meeting = { id: "existing", title: "已有本地例会", date: "2026-09-01", week: "星期二", createdAt: "2026-09-01", summary: "", regularReport: "", issueIds: [] };
  const saved = JSON.stringify({ meetings: [meeting] });
  browser.stored.set("antico_workspace_v2", saved);
  expect(readLocal().meetings).toEqual([meeting]);
  expect(browser.stored.get("antico_workspace_v2")).toBe(saved);
  browser.stored.delete("antico_workspace_v2");
  browser.stored.set("local_meetings", JSON.stringify([meeting]));
  expect(readLocal().meetings).toEqual([meeting]);
});

test("only cloud routes on the owned alias move to canonical origin with the full deep link", async () => {
  for (const path of ["/portal?from=guide#assets", "/workspace/#inventory"]) {
    const browser = browserAt(`https://anticocouncil-sigma.vercel.app${path}`, "local");
    const html = await renderRoute();
    expect(html).toContain(`href="https://www.anticocouncil.com${path}"`);
    expect(html).toContain("正在前往正式协作工作台");
    expect(html).toContain('class="public-masthead"');
    expect(html).toContain('class="public-footer"');
    expect(html).not.toContain('class="cloud-gateway"');
    expect(html).not.toContain('class="council-app');
    expect(browser.reads).toEqual([]);
  }
  browserAt("https://anticocouncil-sigma.vercel.app/local#assets", "firebase");
  const html = await renderRoute();
  expect(html).toContain('class="council-app');
  expect(html).toContain("connection-local");
  expect(html).not.toContain("正在前往正式协作工作台");
});

test("canonical cloud entry does not redirect again and public pages remain outside the auth gate", async () => {
  browserAt("https://www.anticocouncil.com/portal#session", "local");
  expect(await renderRoute()).toContain('class="cloud-gateway"');
  for (const path of ["/", "/blog", "/not-a-workspace"]) {
    const browser = browserAt(`https://www.anticocouncil.com${path}`, "firebase");
    const html = await renderRoute();
    expect(html).not.toContain('class="cloud-gateway"');
    expect(html).not.toContain('class="council-app');
    expect(browser.reads).toEqual([]);
  }
});

test("public archive routes render complete example articles without touching workspace storage", async () => {
  for (const record of archiveRecords) {
    const browser = browserAt(`/archive/${record.slug}/`, "firebase");
    browser.stored.set("antico_workspace_v2", "private meeting record");
    const html = await renderRoute();
    expect(html).toContain(record.title);
    expect(html).toContain("示例文稿");
    expect(html).toContain('aria-label="本文目录"');
    expect(html).toContain(`href="/archive#${record.termId}"`);
    for (const section of record.sections) {
      expect(html).toContain(section.title);
      for (const paragraph of section.paragraphs)
        expect(html).toContain(paragraph);
    }
    expect(document.title).toBe(`${record.title}（示例） · 安提柯议会`);
    expect(html).not.toContain("private meeting record");
    expect(html).not.toContain('class="cloud-gateway"');
    expect(browser.reads).toEqual([]);
  }
});

test("archive and legacy blog provide the same term index with working article links", async () => {
  for (const path of ["/archive", "/archive/", "/blog", "/blog/"]) {
    const browser = browserAt(path, "local");
    const html = await renderRoute();
    for (const term of archiveTerms) expect(html).toContain(`id="${term.id}"`);
    for (const record of archiveRecords)
      expect(html).toContain(`href="/archive/${record.slug}"`);
    expect(html).toContain("真实档案尚未收录");
    expect(browser.reads).toEqual([]);
  }
});

test("unknown or nested archive slugs show not found rather than an article or workspace", async () => {
  for (const path of [
    "/archive/missing",
    `/archive/${archiveRecords[0].slug}/extra`,
    "/archive/%2Fportal",
  ]) {
    const browser = browserAt(path, "firebase");
    const html = await renderRoute();
    expect(html).toContain("没有找到这一页");
    expect(html).not.toContain('aria-label="本文目录"');
    expect(html).not.toContain('class="cloud-gateway"');
    expect(browser.reads).toEqual([]);
  }
});
