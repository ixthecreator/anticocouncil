import { afterEach, expect, test } from "bun:test";
import { renderToReadableStream, renderToStaticMarkup } from "react-dom/server";
import SiteRouter from "./SiteRouter";
// Load browser-capable libraries in the test runner before installing the route-only window stub.
import "./WorkspaceEntry";
import { WorkspaceGateway } from "./components/WorkspaceGateway";
import { readLocal } from "./lib/useWorkspace";

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
  Object.defineProperty(globalThis, "window", { configurable: true, value: { location: { pathname: url.pathname, hash: url.hash, assign: (next: string) => navigations.push(next) } } });
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

test("portal and legacy workspace routes never mount local data behind a saved local preference", async () => {
  for (const path of ["/portal#assets", "/workspace#inventory", "/portal/", "/workspace/"]) {
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
  for (const module of ["session", "post", "archive", "supervision", "activity", "editorial", "assets", "inventory"]) {
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
