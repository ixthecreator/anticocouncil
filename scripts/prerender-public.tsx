import { readFile, writeFile, mkdir } from "node:fs/promises";
import { resolve, dirname, sep } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { getPublicRoute, publicPaths } from "../src/publicRoutes";

const output = resolve("dist");
const template = await readFile(resolve(output, "index.html"), "utf8");
const rootMarker = '<div id="root"></div>';
if (!template.includes(rootMarker))
  throw new Error("Missing Vite root marker; cannot prerender public pages.");

// Keep the original application shell for authenticated and local workspace routes.
await writeFile(resolve(output, "workspace.html"), template);
const publicTemplate = template
  .replace(/<script\b[^>]*>[\s\S]*?<\/script>/g, "")
  .replace(/<link\b[^>]*rel="modulepreload"[^>]*>/g, "");
const escapeAttribute = (value: string) =>
  value.replace(
    /[&<>"']/g,
    (char) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#x27;" })[
        char
      ]!,
  );

for (const path of [...publicPaths, "/404"]) {
  const route = getPublicRoute(path);
  let html = publicTemplate
    .replace(
      /<title>[^<]*<\/title>/,
      () => `<title>${escapeAttribute(route.title)}</title>`,
    )
    .replace(
      /(<meta name="description" content=")[^"]*/,
      (_, prefix) => prefix + escapeAttribute(route.description),
    )
    .replace(
      /(<meta property="og:title" content=")[^"]*/,
      (_, prefix) => prefix + escapeAttribute(route.title),
    )
    .replace(
      /(<meta property="og:description" content=")[^"]*/,
      (_, prefix) => prefix + escapeAttribute(route.description),
    )
    .replace(
      rootMarker,
      () => `<div id="root">${renderToStaticMarkup(route.page)}</div>`,
    );
  if (route.noindex)
    html = html.replace(
      "</head>",
      '<meta name="robots" content="noindex, nofollow" />\n</head>',
    );
  const file = resolve(
    output,
    path === "/404" ? "404.html" : `.${path}/index.html`,
  );
  if (!file.startsWith(output + sep)) throw new Error(`Invalid public path: ${path}`);
  await mkdir(dirname(file), { recursive: true });
  await writeFile(file, html);
}
console.log(
  `Prerendered ${publicPaths.length} public pages and a 404 page; workspace shell preserved.`,
);
