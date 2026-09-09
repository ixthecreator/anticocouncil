import { jsPDF } from "jspdf";
import { autoTable } from "jspdf-autotable";
import { meetingExportBlocks, type MeetingExport } from "./meetingExport";

type PdfFonts = { regular: string; bold: string; coverage: [number, number][] };
let fontsPromise: Promise<PdfFonts> | undefined;

function binaryString(bytes: Uint8Array): string {
  const parts: string[] = [];
  for (let i = 0; i < bytes.length; i += 8192) {
    parts.push(String.fromCharCode(...bytes.subarray(i, i + 8192)));
  }
  return parts.join("");
}

async function fontResource(name: string): Promise<Response> {
  const base = import.meta.env?.BASE_URL ?? "/";
  const response = await fetch(`${base}fonts/${name}`, { signal: AbortSignal.timeout(60_000) });
  if (!response.ok) throw new Error(`字体资源加载失败（${response.status}）。`);
  return response;
}

async function loadFonts(): Promise<PdfFonts> {
  if (!fontsPromise) {
    fontsPromise = Promise.all([
      fontResource("NotoSansSC-Regular.ttf").then(async (r) => binaryString(new Uint8Array(await r.arrayBuffer()))),
      fontResource("NotoSansSC-Bold.ttf").then(async (r) => binaryString(new Uint8Array(await r.arrayBuffer()))),
      fontResource("coverage.json").then((r) => r.json() as Promise<[number, number][]>),
    ]).then(([regular, bold, coverage]) => ({ regular, bold, coverage })).catch(() => {
      fontsPromise = undefined;
      throw new Error("PDF 中文字体加载失败，请检查网络后重试；也可先导出 Word。");
    });
  }
  return fontsPromise;
}

/** Validate against both embedded fonts; never silently replace names with tofu. */
export function unsupportedPdfCharacters(text: string, coverage: [number, number][]): string[] {
  return [...new Set(Array.from(text))].filter((character) => {
    if (character === "\n" || character === "\r" || character === "\t") return false;
    const point = character.codePointAt(0)!;
    return point > 0xffff || !coverage.some(([first, last]) => point >= first && point <= last);
  });
}

const cleanText = (text: string) => text.replace(/\r\n?/g, "\n").replace(/\t/g, "    ");

function wrappedLines(pdf: jsPDF, text: string, width: number): string[] {
  return cleanText(text).split("\n").flatMap((paragraph) => {
    const lines = pdf.splitTextToSize(paragraph, width) as string[];
    for (let i = 0; i < lines.length; i++) {
      if (i && lines[i - 1].length > 1 && (/^[，。；：！？、）》】」』”’]/u.test(lines[i]) || /[（《【「『“‘]$/u.test(lines[i - 1]))) {
        lines[i] = lines[i - 1].slice(-1) + lines[i];
        lines[i - 1] = lines[i - 1].slice(0, -1);
      }
      while (lines[i].length > 1 && pdf.getTextWidth(lines[i]) > width) {
        const last = lines[i].slice(-1);
        lines[i] = lines[i].slice(0, -1);
        lines[i + 1] = last + (lines[i + 1] ?? "");
      }
    }
    return lines;
  });
}

export async function renderMeetingPdf(snapshot: MeetingExport, onFontsLoaded?: () => void): Promise<Blob> {
  const pages = meetingExportBlocks(snapshot);
  if (!pages.length) throw new Error("请至少选择一场会议。");
  const fonts = await loadFonts();
  const allText = pages.flatMap((page) => page.blocks.flatMap((block) =>
    block.type === "table" ? [...block.headers, ...block.rows.flat()] : [block.text],
  )).join("\n");
  const unsupported = unsupportedPdfCharacters(allText, fonts.coverage);
  if (unsupported.length) {
    const list = unsupported.slice(0, 12).map((c) => `${c}（U+${c.codePointAt(0)!.toString(16).toUpperCase()}）`).join("、");
    throw new Error(`PDF 字体暂不支持以下字符：${list}${unsupported.length > 12 ? "等" : ""}。请调整这些字符或导出 Word。`);
  }
  onFontsLoaded?.();
  // Yield once so the loading message can paint before synchronous PDF layout.
  await new Promise<void>((resolve) => setTimeout(resolve, 0));
  const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4", compress: true, putOnlyUsedFonts: true });
  pdf.addFileToVFS("NotoSansSC-Regular.ttf", fonts.regular);
  pdf.addFont("NotoSansSC-Regular.ttf", "NotoSansSC", "normal");
  pdf.addFileToVFS("NotoSansSC-Bold.ttf", fonts.bold);
  pdf.addFont("NotoSansSC-Bold.ttf", "NotoSansSC", "bold");
  const margin = 20;
  const width = pdf.internal.pageSize.getWidth() - margin * 2;
  const bottom = pdf.internal.pageSize.getHeight() - margin;
  let y = margin;
  const nextPage = () => { pdf.addPage(); y = margin; };
  const ensureRoom = (height: number) => { if (y + height > bottom) nextPage(); };
  const textBlock = (text: string, size: number, bold = false, muted = false, heading = false) => {
    pdf.setFont("NotoSansSC", bold ? "bold" : "normal");
    pdf.setFontSize(size);
    pdf.setTextColor(muted ? 85 : 25);
    const lineHeight = size * 0.352778 * 1.55;
    const lines = wrappedLines(pdf, text, width);
    if (heading) ensureRoom(Math.min(lines.length * lineHeight + 14, bottom - margin));
    else if (lines.length <= 5) ensureRoom(lines.length * lineHeight);
    for (const line of lines) {
      ensureRoom(lineHeight);
      pdf.text(line, margin, y + lineHeight * 0.76);
      y += lineHeight;
    }
    y += heading ? 3 : 4;
  };
  pages.forEach((page, index) => {
    if (index) nextPage();
    for (const block of page.blocks) {
      if (block.type === "heading") {
        if (block.level === 3) ensureRoom(100); // Keep an issue heading with its metadata and opening text.
        textBlock(block.text, block.level === 1 ? 18 : block.level === 2 ? 14 : 12, true, false, true);
      } else if (block.type === "text") {
        textBlock(block.text, block.muted ? 10 : 11, false, block.muted);
      } else {
        ensureRoom(20);
        // A long report must not squeeze the name/time/status columns to zero.
        const proportions = block.headers.length === 2 ? [0.24, 0.76]
          : block.headers.length === 4 ? [0.14, 0.26, 0.18, 0.42]
          : block.headers.map(() => 1 / block.headers.length);
        autoTable(pdf, {
          startY: y,
          margin: { top: margin, right: margin, bottom: margin, left: margin },
          tableWidth: width,
          head: [block.headers.map(cleanText)],
          body: block.rows.map((row) => row.map(cleanText)),
          theme: "grid",
          showHead: "everyPage",
          rowPageBreak: "avoid",
          columnStyles: Object.fromEntries(proportions.map((share, column) => [column, { cellWidth: width * share }])),
          styles: { font: "NotoSansSC", fontStyle: "normal", fontSize: 10, cellPadding: 2.5, overflow: "linebreak", valign: "top", textColor: 25, lineColor: 190, lineWidth: 0.15 },
          headStyles: { font: "NotoSansSC", fontStyle: "bold", fillColor: [240, 240, 240], textColor: 25 },
        });
        y = (pdf as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 5;
      }
    }
  });
  const pageCount = pdf.getNumberOfPages();
  for (let page = 1; page <= pageCount; page++) {
    pdf.setPage(page);
    pdf.setFont("NotoSansSC", "normal");
    pdf.setFontSize(9);
    pdf.setTextColor(100);
    pdf.text(`${page} / ${pageCount}`, pdf.internal.pageSize.getWidth() / 2, bottom + 10, { align: "center" });
  }
  return pdf.output("blob");
}
