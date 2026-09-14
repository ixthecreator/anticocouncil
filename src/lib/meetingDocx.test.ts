import { expect, test } from "bun:test";
import JSZip from "jszip";
import { buildMeetingExport } from "./meetingExport";
import { renderMeetingDocx } from "./meetingDocx";
import { emptyWorkspace } from "./workspace";

test("Word exports editable Chinese paragraphs/tables, A4 margins, repeating headers and page fields", async () => {
  const data = emptyWorkspace();
  data.meetings = [
    { id: "m1", title: "中文会议 A&B", date: "2026-09-01", week: "第1周", summary: "完整摘要", regularReport: "第一行\n第二行", createdAt: "2026-09-01", issueIds: [] },
    { id: "m2", title: "第二场会议", date: "2026-09-02", week: "第2周", summary: "", createdAt: "2026-09-02", issueIds: [] },
  ];
  data.issues = [{ id: "i1", title: "可编辑议题", category: "编辑", priority: "high", status: "passed", description: "正文内容", discussion: "完整结论", signature: "自由姓名", createdAt: "2026-09-01", updatedAt: "2026-09-01", archived: false, meetingId: "m1", voteMode: "members", ballots: { secretVoterIdentity: "approve" } }];
  const blob = await renderMeetingDocx(buildMeetingExport(data, ["m2", "m1"], "minutes", "2026-09-09T00:00:00.000Z"));
  expect(blob.type).toBe("application/vnd.openxmlformats-officedocument.wordprocessingml.document");
  const zip = await JSZip.loadAsync(await blob.arrayBuffer());
  const xml = await zip.file("word/document.xml")!.async("string");
  const styles = await zip.file("word/styles.xml")!.async("string");
  const footer = await zip.file("word/footer1.xml")!.async("string");
  for (const value of ["中文会议 A&amp;B", "第二场会议", "可编辑议题", "完整摘要", "完整结论", "第一行", "第二行", "自由姓名", "表决汇总：赞成 1"]) expect(xml).toContain(value);
  expect(xml).not.toContain("secretVoterIdentity");
  expect(xml).not.toContain("w:drawing");
  expect(xml).toContain("<w:tbl>");
  expect(xml).toContain("<w:tblHeader");
  expect(xml).toContain("<w:pageBreakBefore");
  expect(xml).toContain('w:w="11906"');
  expect(xml).toContain('w:h="16838"');
  expect(xml).toContain('w:top="1134"');
  expect(xml + styles).toContain('w:eastAsia="宋体"');
  expect(xml).toContain('w:eastAsia="黑体"');
  expect(footer).toContain("PAGE");
  expect(footer).toContain("NUMPAGES");
});

function cellText(xml: string): string {
  const decode = (value: string) => value.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, "&");
  return Array.from(xml.matchAll(/<w:p(?:\s[^>]*)?>[\s\S]*?<\/w:p>/g), (paragraph) =>
    Array.from(paragraph[0].matchAll(/<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>/g), (run) => decode(run[1])).join(""),
  ).join("\n");
}

test("Word continuation rows preserve every cell's text and original line breaks without duplicating neighbours", async () => {
  const data = emptyWorkspace();
  data.meetings = [{ id: "m", title: "长表格测试", date: "2026-09-01", week: "本周", summary: "", createdAt: "2026-09-01", issueIds: [] }];
  data.attendance = [{ id: "a", meetingId: "m", memberId: "p", memberName: "占位", checkedInAt: "占位", reportStatus: "reported", reportNote: "占位" }];
  const snapshot = buildMeetingExport(data, ["m"], "minutes", "2026-09-09T00:00:00.000Z");
  const source = [
    "甲乙🙂".repeat(190) + "\n姓名末尾",
    "已汇报",
    Array.from({ length: 90 }, (_, index) => `第${index}段：保留所有中文、ABC & < > 和🙂字符。`).join("\n\n") + "\n最终记录",
  ];
  Object.assign(snapshot.meetings[0].attendance![0], { name: source[0], reportStatus: source[1], reportNote: source[2] });
  const zip = await JSZip.loadAsync(await (await renderMeetingDocx(snapshot)).arrayBuffer());
  const xml = await zip.file("word/document.xml")!.async("string");
  const table = xml.match(/<w:tbl>[\s\S]*?<\/w:tbl>/)![0];
  const rows = Array.from(table.matchAll(/<w:tr(?:\s[^>]*)?>[\s\S]*?<\/w:tr>/g), (row) =>
    Array.from(row[0].matchAll(/<w:tc(?:\s[^>]*)?>[\s\S]*?<\/w:tc>/g), (cell) => cellText(cell[0])),
  );
  expect(rows[0]).toEqual(["姓名", "汇报状态", "汇报记录"]);
  expect(rows.length).toBeGreaterThan(4);
  for (let column = 0; column < source.length; column++) {
    expect(rows.slice(1).map((row) => row[column]).join("")).toBe(source[column].replace(/\r\n?|\n/g, "\n"));
  }
  expect(rows[1][1]).toBe("已汇报");
  expect(rows.slice(2).every((row) => row[1] === "")).toBe(true);
  expect(table).not.toContain('<w:cantSplit w:val="false"');
});

test("only the first paragraph of a multiline text block stays with the next paragraph", async () => {
  const data = emptyWorkspace();
  data.meetings = [{ id: "m", title: "段落分页", date: "2026-09-01", week: "本周", summary: "", createdAt: "2026-09-01", issueIds: [] }];
  data.issues = [{ id: "i", meetingId: "m", title: "事项", category: "编辑", priority: "medium", status: "agenda", description: "正文第一段\n正文第二段", discussion: "", signature: "", archived: false, createdAt: "2026-09-01", updatedAt: "2026-09-01" }];
  const snapshot = buildMeetingExport(data, ["m"], "agenda", "2026-09-09T00:00:00.000Z");
  const zip = await JSZip.loadAsync(await (await renderMeetingDocx(snapshot)).arrayBuffer());
  const xml = await zip.file("word/document.xml")!.async("string");
  const paragraphs = Array.from(xml.matchAll(/<w:p(?:\s[^>]*)?>[\s\S]*?<\/w:p>/g), (match) => match[0]);
  expect(paragraphs.find((paragraph) => cellText(paragraph) === "议题说明")).toContain("<w:keepNext");
  expect(paragraphs.find((paragraph) => cellText(paragraph) === "正文第一段")).not.toContain("<w:keepNext");
  expect(paragraphs.find((paragraph) => cellText(paragraph) === "正文第二段")).not.toContain("<w:keepNext");
  expect(paragraphs.find((paragraph) => cellText(paragraph) === "类别 / 优先级")).not.toContain("<w:keepNext");
});
