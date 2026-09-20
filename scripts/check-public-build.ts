import assert from "node:assert/strict";
import { readFile, access } from "node:fs/promises";
import { resolve } from "node:path";
import { getPublicRoute, publicPaths } from "../src/publicRoutes";
import { archiveRecords, archiveTerms } from "../src/content/archive";

const output = resolve("dist");
const escapeText = (text: string) =>
  text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#x27;");
const pages = new Map<string, string>();
for (const path of publicPaths) {
  const html = await readFile(resolve(output, `.${path}/index.html`), "utf8");
  const route = getPublicRoute(path);
  assert(
    html.includes(`<title>${escapeText(route.title)}</title>`),
    `Wrong title: ${path}`,
  );
  assert(
    html.includes('id="public-main"'),
    `Missing rendered content: ${path}`,
  );
  assert(
    !/<script\b|modulepreload|class="cloud-gateway"/.test(
      html.replace(/<script data-brand-intro>[\s\S]*?<\/script>/g, ""),
    ),
    `Public page loads application code: ${path}`,
  );
  if (route.noindex)
    assert(
      html.includes('name="robots" content="noindex, nofollow"'),
      `Missing sample noindex: ${path}`,
    );
  for (const [tag] of html.matchAll(/<link\b[^>]*>/g)) {
    if (!tag.includes('rel="stylesheet"')) continue;
    const href = tag.match(/href="([^"]+)"/)?.[1];
    assert(href?.startsWith("/assets/"), `External public stylesheet: ${path}`);
    const css = await readFile(resolve(output, `.${href}`), "utf8");
    assert(
      !/fonts\.googleapis\.com|fonts\.gstatic\.com/.test(css),
      `Public CSS loads Google fonts: ${path}`,
    );
  }
  pages.set(path, html);
}

assert.equal(
  new Set(archiveRecords.map((record) => record.slug)).size,
  archiveRecords.length,
  "Duplicate article slug",
);
assert.equal(
  new Set(archiveTerms.map((term) => term.id)).size,
  archiveTerms.length,
  "Duplicate term ID",
);
for (const record of archiveRecords) {
  assert(
    /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(record.slug),
    `Unsafe article slug: ${record.slug}`,
  );
  assert(
    archiveTerms.some((term) => term.id === record.termId),
    `Missing term: ${record.slug}`,
  );
  assert(record.sections.length > 0, `Empty article: ${record.slug}`);
  const html = pages.get(`/archive/${record.slug}`)!;
  for (const section of record.sections) {
    assert(section.paragraphs.length > 0, `Empty section: ${record.slug}`);
    for (const paragraph of section.paragraphs)
      assert(
        html.includes(escapeText(paragraph)),
        `Missing article paragraph: ${record.slug}`,
      );
  }
}

for (const [path, html] of pages) {
  for (const [, href] of html.matchAll(/<a\b[^>]*href="([^"]+)"/g)) {
    const url = new URL(
      href.replaceAll("&amp;", "&"),
      `https://archive.invalid${path}`,
    );
    assert.equal(
      url.origin,
      "https://archive.invalid",
      `Unexpected external link: ${href}`,
    );
    const target = pages.get(url.pathname);
    if (target !== undefined) {
      if (url.hash)
        assert(
          target.includes(`id="${decodeURIComponent(url.hash.slice(1))}"`),
          `Broken anchor: ${path} -> ${href}`,
        );
    } else if (!["/portal", "/workspace", "/local"].includes(url.pathname)) {
      const file = url.pathname.endsWith("/")
        ? `${url.pathname}index.html`
        : url.pathname;
      await access(resolve(output, `.${file}`));
    }
  }
}
const workspace = await readFile(resolve(output, "workspace.html"), "utf8");
assert(
  workspace.includes('<div id="root"></div>') &&
    /<script\b[^>]*type="module"/.test(workspace),
  "Missing workspace application shell",
);
const notFound = await readFile(resolve(output, "404.html"), "utf8");
assert(
  notFound.includes("没有找到这一页") && !/<script\b/.test(notFound),
  "Missing static 404",
);
console.log(
  `Verified ${pages.size} script-free public pages, article text, local styles, navigation, workspace shell and 404.`,
);
