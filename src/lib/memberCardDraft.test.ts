import { expect, test } from "bun:test";
import { defaultMemberCardData, getMemberCardTextStyle, type MemberCardData } from "./memberCard";
import {
  loadMemberCardDraft,
  memberCardDraftKey,
  parseMemberCardDraft,
  saveMemberCardDraft,
  serializeMemberCardDraft,
} from "./memberCardDraft";

const wrap = (data: unknown, version: unknown = 1) => JSON.stringify({ version, data });
const card = { ...defaultMemberCardData, name: "王小明", avatar: "data:image/png;base64,YQ==" };

test("account-scoped keys and saved drafts remain separate from other accounts and local mode", () => {
  const rows = new Map<string, string>();
  const storage = { getItem: (key: string) => rows.get(key) ?? null, setItem: (key: string, value: string) => { rows.set(key, value); } };
  expect(memberCardDraftKey("cloud:uid/a")).toBe("antico.member-card.v1.cloud%3Auid%2Fa");
  expect(memberCardDraftKey("cloud:uid/a")).not.toBe(memberCardDraftKey("cloud:uid%2Fa"));
  saveMemberCardDraft(storage, "cloud:alice", card);
  saveMemberCardDraft(storage, "cloud:bob", { ...card, name: "李小红" });
  saveMemberCardDraft(storage, "local", { ...card, name: "本地草稿" });
  expect(loadMemberCardDraft(storage, "cloud:alice")?.name).toBe("王小明");
  expect(loadMemberCardDraft(storage, "cloud:bob")?.name).toBe("李小红");
  expect(loadMemberCardDraft(storage, "local")?.name).toBe("本地草稿");
  expect(loadMemberCardDraft(storage, "cloud:other")).toBeNull();
});

test("portable drafts round-trip normalized content without losing avatar bytes or biography lines", () => {
  const text = serializeMemberCardDraft({ ...card, name: " 王\u202e小明 ", biography: "第一行\r\n 第二行", avatarZoom: 2 });
  expect(JSON.parse(text).version).toBe(1);
  expect(parseMemberCardDraft(text)).toEqual({ ...card, name: "王小明", biography: "第一行\n第二行", avatarZoom: 2 });
  expect(parseMemberCardDraft(wrap({ name: "李明" }))).toEqual({ ...defaultMemberCardData, name: "李明" });
});

test("corrupt or unavailable local storage is ignored while write failures propagate", () => {
  expect(loadMemberCardDraft({ getItem: () => "{broken" }, "local")).toBeNull();
  expect(loadMemberCardDraft({ getItem: () => { throw new Error("storage denied"); } }, "local")).toBeNull();
  const quota = new Error("quota exceeded");
  expect(() => saveMemberCardDraft({ setItem: () => { throw quota; } }, "local", card)).toThrow(quota);
});

test("layout refinements survive portable and stored drafts while old v1 drafts keep defaults", () => {
  const custom: MemberCardData = { ...card, layout: {
    role: { fontSize: 155, tracking: -2, offsetX: -120, offsetY: 28 },
    biography: { fontSize: 74, lineHeight: 130 }, organization: { offsetY: -16 },
  } };
  expect(parseMemberCardDraft(serializeMemberCardDraft(custom))).toEqual(custom);
  let saved = "";
  saveMemberCardDraft({ setItem: (_key, value) => { saved = value; } }, "local", custom);
  expect(loadMemberCardDraft({ getItem: () => saved }, "local")).toEqual(custom);
  const legacy = parseMemberCardDraft(wrap(card));
  expect(legacy.layout).toBeUndefined();
  expect(getMemberCardTextStyle(legacy, "role")).toEqual(getMemberCardTextStyle(card, "role"));
  expect(parseMemberCardDraft(serializeMemberCardDraft({ ...custom, layout: {} })).name).toBe(card.name);
});

test("draft imports reject malformed layout parameters before they can replace the current card", () => {
  for (const layout of [null, [], "layout", { role: null }, { role: [] }, { role: { fontSize: "100" } }, { role: { tracking: null } }, { role: { other: 5 } }, { org: { offsetX: 10 } }]) {
    expect(() => parseMemberCardDraft(wrap({ ...card, layout }))).toThrow("排版设置格式不正确");
  }
  expect(() => serializeMemberCardDraft({ ...card, layout: { name: { fontSize: Infinity } } })).toThrow("排版设置格式不正确");
  const imported = parseMemberCardDraft(wrap({ ...card, layout: { name: { fontSize: 900, offsetX: -9000 } } }));
  expect(getMemberCardTextStyle(imported, "name").fontSize).toBe(240);
  expect(getMemberCardTextStyle(imported, "name").offsetX).toBe(-1200);
});

test("imports reject bad envelopes, invalid field types and invalid renderer content", () => {
  for (const text of ["not JSON", "null", "[]", wrap(card, 2), wrap(card, "1"), wrap(null), wrap([]), wrap({ role: "作者" }), wrap({ ...card, name: 42 }), wrap({ ...card, biography: [] }), wrap({ ...card, avatarZoom: "2" })]) {
    expect(() => parseMemberCardDraft(text)).toThrow();
  }
  expect(() => parseMemberCardDraft(wrap({ ...card, name: " " }))).toThrow("请填写姓名");
  expect(() => parseMemberCardDraft(wrap({ ...card, biography: "一\n二\n三\n四" }))).toThrow("最多填写 3 行");
  expect(() => serializeMemberCardDraft({ ...card, avatarZoom: Infinity })).toThrow("格式不正确");
});

test("portable imports cannot reference remote, executable or session-only avatar URLs", () => {
  for (const avatar of ["https://example.com/avatar.png", "blob:https://example.com/image", "javascript:alert(1)", "data:image/svg+xml;base64,YQ==", "data:text/html;base64,YQ==", "data:image/png;base64,", "data:image/png;base64,YQ", "data:image/png;base64,Y Q==", "data:image/png;base64,Y==="]) {
    expect(() => parseMemberCardDraft(wrap({ ...card, avatar }))).toThrow("头像须为内嵌");
  }
  for (const avatar of ["", "data:image/png;base64,YQ==", "data:image/jpeg;base64,YWI=", "data:image/webp;base64,YWJj"]) {
    expect(parseMemberCardDraft(wrap({ ...card, avatar })).avatar).toBe(avatar);
  }
});

test("oversized avatars and files are rejected before saving or interpreting content", () => {
  expect(() => parseMemberCardDraft(wrap({ ...card, avatar: "data:image/png;base64," + "A".repeat(1_500_000) }))).toThrow("头像过大");
  expect(() => parseMemberCardDraft(" ".repeat(2 * 1024 * 1024 + 1))).toThrow("文件过大");
  // Count UTF-8 bytes as well as JavaScript characters so Chinese content cannot bypass the file limit.
  expect(() => parseMemberCardDraft(wrap({ ...card, extra: "中".repeat(720_000) }))).toThrow("文件过大");
  let written = false;
  expect(() => saveMemberCardDraft({ setItem: () => { written = true; } }, "local", { ...card, avatar: "blob:https://example.com/id" })).toThrow();
  expect(written).toBe(false);
});
