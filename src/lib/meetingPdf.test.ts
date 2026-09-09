import { afterAll, expect, test } from "bun:test";
import { readFile } from "node:fs/promises";
import { buildMeetingExport } from "./meetingExport";
import { renderMeetingPdf, unsupportedPdfCharacters } from "./meetingPdf";
import { emptyWorkspace } from "./workspace";

const originalFetch = globalThis.fetch;
afterAll(() => { globalThis.fetch = originalFetch; });

test("PDF glyph validation permits covered Chinese and whitespace but rejects missing glyphs", () => {
  expect(unsupportedPdfCharacters("中中\n文\t😀\u0000", [[0x4e2d, 0x4e2d], [0x6587, 0x6587]])).toEqual(["😀", "\u0000"]);
});

test("PDF font failure is retryable, and real bundled fonts produce Chinese text pages", async () => {
  const data = emptyWorkspace();
  data.meetings = ["m1", "m2"].map((id) => ({ id, title: `中文会议${id}`, date: "2026-09-09", week: "星期三", summary: "", regularReport: "中文可复制", createdAt: "2026-09-09T08:00:00Z", issueIds: [] }));
  const snapshot = buildMeetingExport(data, ["m1", "m2"], "agenda", "2026-09-09T08:00:00Z");
  globalThis.fetch = (async () => new Response("unavailable", { status: 503 })) as unknown as typeof fetch;
  await expect(renderMeetingPdf(snapshot)).rejects.toThrow("中文字体加载失败");
  globalThis.fetch = (async (url: string) => {
    const name = url.split("/").pop()!;
    const bytes = await readFile(new URL(`../../public/fonts/${name}`, import.meta.url));
    return new Response(bytes);
  }) as typeof fetch;
  const blob = await renderMeetingPdf(snapshot);
  const pdf = new TextDecoder("latin1").decode(await blob.arrayBuffer());
  expect(blob.type).toBe("application/pdf");
  expect(pdf.startsWith("%PDF-")).toBe(true);
  expect((pdf.match(/\/Type \/Page\b/g) || []).length).toBe(2);
  expect(pdf).toContain("/ToUnicode");
  snapshot.meetings[0].title = "不能静默丢失😀";
  await expect(renderMeetingPdf(snapshot)).rejects.toThrow("U+1F600");
});
