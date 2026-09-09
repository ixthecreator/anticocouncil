import {
  AlignmentType, BorderStyle, Document, Footer, HeadingLevel, Packer, PageNumber,
  Paragraph, Table, TableCell, TableLayoutType, TableRow, TextRun, WidthType,
} from "docx";
import { meetingExportBlocks, type MeetingExport, type MeetingExportBlock } from "./meetingExport";

const BODY_FONT = { ascii: "Times New Roman", hAnsi: "Times New Roman", eastAsia: "宋体", cs: "Times New Roman" };
const HEADING_FONT = { ascii: "Arial", hAnsi: "Arial", eastAsia: "黑体", cs: "Arial" };
const margin = 1134; // 20 mm, rounded to twentieths of a point.
const pageWidth = 11906;
const contentWidth = pageWidth - margin * 2;
const border = { style: BorderStyle.SINGLE, size: 4, color: "A7ADB4" };
const cleanText = (text: string) => text.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, "");

function textParagraphs(text: string, muted = false, inTable = false, bold = false): Paragraph[] {
  const lines = cleanText(text).split(/\r\n?|\n/);
  return lines.map((line, index) => new Paragraph({
    children: [new TextRun({ text: line, font: BODY_FONT, size: inTable ? 21 : muted ? 20 : 24, bold, color: muted ? "5E6670" : "202124" })],
    spacing: { after: inTable ? 60 : 120, line: 340 },
    ...(!inTable && lines.length > 1 && index === 0 ? { keepNext: true } : {}),
    widowControl: true,
  }));
}

/** Keep one physical table row short enough for readers to repeat its header. */
function continuationCells(text: string, width: number): string[] {
  // A CJK glyph at 10.5 pt takes 210 twips. Account for cell padding and leave
  // a small safety margin; counting Latin glyphs the same way is conservative.
  const charactersPerLine = Math.max(1, Math.floor((width - 220) / 210 * 0.9));
  const maxLines = 20;
  const chunks: string[] = [];
  let chunk = "";
  let lines = 1;
  let occupied = 0;
  // Preserve original line breaks (including CRLF) and complete code points.
  const tokens = cleanText(text).match(/\r\n|\r|\n|[^\r\n]/gu) || [];
  for (const token of tokens) {
    const isNewline = /^(?:\r\n|\r|\n)$/.test(token);
    const widthUnits = token === "\t" ? 4 : 1;
    const nextLine = isNewline || occupied + widthUnits > charactersPerLine;
    if (nextLine && lines === maxLines) {
      chunks.push(chunk);
      chunk = "";
      lines = 1;
      occupied = 0;
    }
    if (isNewline) {
      lines++;
      occupied = 0;
    } else {
      if (occupied + widthUnits > charactersPerLine) {
        lines++;
        occupied = 0;
      }
      occupied += widthUnits;
    }
    chunk += token;
  }
  if (chunk || !chunks.length) chunks.push(chunk);
  return chunks;
}

function continuationRows(cells: string[], widths: number[]): string[][] {
  const columns = cells.map((text, index) => continuationCells(text, widths[index]));
  const count = Math.max(...columns.map((parts) => parts.length));
  return Array.from({ length: count }, (_, index) => columns.map((parts) => parts[index] || ""));
}

function blockChildren(block: MeetingExportBlock): (Paragraph | Table)[] {
  if (block.type === "heading") return [new Paragraph({
    heading: { 1: HeadingLevel.TITLE, 2: HeadingLevel.HEADING_1, 3: HeadingLevel.HEADING_2 }[block.level],
    children: [new TextRun({ text: cleanText(block.text), font: HEADING_FONT, size: { 1: 36, 2: 28, 3: 25 }[block.level], bold: true, color: "000000" })],
    spacing: { before: block.level === 1 ? 60 : 220, after: 140, line: 360 },
    keepNext: true,
    widowControl: true,
  })];
  if (block.type === "text") return textParagraphs(block.text, block.muted);
  const widths = block.headers.length === 2
    ? [Math.round(contentWidth * 0.24), Math.round(contentWidth * 0.76)]
    : block.headers.length === 4
    ? [0.14, 0.26, 0.18, 0.42].map((share) => Math.round(contentWidth * share))
    : block.headers.map(() => Math.floor(contentWidth / block.headers.length));
  const row = (cells: string[], header = false) => new TableRow({
    tableHeader: header,
    // Body content is already bounded by continuationRows. Keep each physical
    // row together: some Word readers omit headers while splitting a long row.
    cantSplit: true,
    children: cells.map((text, index) => new TableCell({
      width: { size: widths[index], type: WidthType.DXA },
      margins: { top: 90, bottom: 90, left: 110, right: 110 },
      ...(header ? { shading: { fill: "F0F2F4" } } : {}),
      children: textParagraphs(text, false, true, header),
    })),
  });
  return [new Table({
    width: { size: contentWidth, type: WidthType.DXA },
    columnWidths: widths,
    layout: TableLayoutType.FIXED,
    borders: { top: border, bottom: border, left: border, right: border, insideHorizontal: border, insideVertical: border },
    rows: [row(block.headers, true), ...block.rows.flatMap((cells) => continuationRows(cells, widths).map((parts) => row(parts)))],
  }), new Paragraph({ spacing: { after: 80 }, children: [] })];
}

export async function renderMeetingDocx(snapshot: MeetingExport): Promise<Blob> {
  const pages = meetingExportBlocks(snapshot);
  const children: (Paragraph | Table)[] = [];
  pages.forEach((page, index) => {
    page.blocks.forEach((block, blockIndex) => {
      const rendered = blockChildren(block);
      if (index > 0 && blockIndex === 0) {
        // The first block is the document label. Start each meeting on a fresh page.
        children.push(new Paragraph({ pageBreakBefore: true, spacing: { after: 80 }, children: [new TextRun({ text: block.type === "text" ? cleanText(block.text) : page.title, font: BODY_FONT, size: 20, color: "5E6670" })] }));
      } else children.push(...rendered);
    });
  });
  const document = new Document({
    creator: "安提柯议会",
    title: snapshot.title,
    description: `${snapshot.meetings.length} 场会议；导出时间 ${snapshot.generatedAt}`,
    styles: { default: { document: { run: { font: BODY_FONT, size: 24 }, paragraph: { spacing: { line: 340, after: 120 } } } } },
    sections: [{
      properties: { page: { size: { width: pageWidth, height: 16838 }, margin: { top: margin, right: margin, bottom: margin, left: margin, header: 567, footer: 567 } } },
      footers: { default: new Footer({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [
        new TextRun({ text: "第 ", font: BODY_FONT, size: 18, color: "5E6670" }),
        new TextRun({ children: [PageNumber.CURRENT], font: BODY_FONT, size: 18, color: "5E6670" }),
        new TextRun({ text: " 页 / 共 ", font: BODY_FONT, size: 18, color: "5E6670" }),
        new TextRun({ children: [PageNumber.TOTAL_PAGES], font: BODY_FONT, size: 18, color: "5E6670" }),
        new TextRun({ text: " 页", font: BODY_FONT, size: 18, color: "5E6670" }),
      ] })] }) },
      children,
    }],
  });
  return Packer.toBlob(document);
}
