import { expect, test } from "bun:test";
import {
  defaultMemberCardData,
  fitMemberCardText,
  getMemberCardTextStyle,
  isMemberCardLayout,
  MEMBER_CARD_HEIGHT,
  MEMBER_CARD_TEXT_FIELDS,
  MEMBER_CARD_WIDTH,
  memberCardAvatarCrop,
  memberCardBiographyLines,
  memberCardFilename,
  sanitizeMemberCardData,
  sanitizeMemberCardLayout,
  renderMemberCard,
  validateMemberCardData,
} from "./memberCard";

test("draft normalization strips control marks, keeps intentional biography breaks and bounds image zoom", () => {
  const result = sanitizeMemberCardData({
    name: "  张\u202e 三\n ", role: " 作\t者 ", biography: " 第一行\r\n\r\n 第二行 \n  ",
    contact: "\u0000a@example.com", avatarZoom: Infinity,
  });
  expect(result.name).toBe("张 三");
  expect(result.role).toBe("作 者");
  expect(result.biography).toBe("第一行\n第二行");
  expect(result.contact).toBe("a@example.com");
  expect(result.avatarZoom).toBe(1);
  expect(sanitizeMemberCardData({ avatarZoom: 50 }).avatarZoom).toBe(3);
  expect(sanitizeMemberCardData({ avatarZoom: -50 }).avatarZoom).toBe(1);
});

test("maximum length cards are accepted but overflowing text is reported rather than silently truncated", () => {
  const data = {
    ...defaultMemberCardData,
    name: "名".repeat(24), role: "作".repeat(12), roleEnglish: "W".repeat(32),
    organization: "社".repeat(32), contact: "联".repeat(80),
    biography: ["甲".repeat(80), "乙".repeat(80), "丙".repeat(80)].join("\n"),
  };
  expect(validateMemberCardData(data)).toEqual([]);
  expect(validateMemberCardData({ ...data, name: data.name + "人" })).toContain("姓名最多填写 24 个字。");
  expect(sanitizeMemberCardData({ name: "人".repeat(25) }).name).toHaveLength(25);
  expect(validateMemberCardData({ ...data, biography: data.biography + "\n第四行" })).toContain("个人介绍最多填写 3 行。");
  expect(validateMemberCardData({ ...data, biography: "字".repeat(81) })).toContain("个人介绍每行最多填写 80 个字，请手动换行。");
  expect(validateMemberCardData({ ...data, name: " \n " })).toContain("请填写姓名。");
});

test("only local raster avatar sources are accepted, without external image tracking or canvas taint", () => {
  for (const avatar of ["", "data:image/png;base64,YQ==", "data:image/jpeg;base64,YQ==", "data:image/webp;base64,YQ==", "blob:https://example.com/image-id"]) {
    expect(validateMemberCardData({ ...defaultMemberCardData, avatar })).toEqual([]);
  }
  for (const avatar of ["https://example.com/avatar.png", "data:image/svg+xml;base64,YQ==", "javascript:alert(1)"]) {
    expect(validateMemberCardData({ ...defaultMemberCardData, avatar }).length).toBeGreaterThan(0);
  }
});

test("download names cannot introduce folders, control characters or platform-invalid filename characters", () => {
  expect(memberCardFilename(" ../张三:作者?\u0000 ")).toBe("..-张三-作者--名片.png");
  expect(memberCardFilename(" ")).toBe("议会成员-名片.png");
  expect(memberCardFilename("王小明")).toBe("王小明-名片.png");
  expect(memberCardFilename("𠮷".repeat(45))).toBe(`${"𠮷".repeat(40)}-名片.png`);
});

test("text fitting keeps maximum Chinese names and biographies inside their actual drawing bounds", () => {
  const measure = (text: string, size: number) => Array.from(text).reduce((width, character) => width + (character === " " ? 0.25 : 1) * size, 0);
  const name = fitMemberCardText("名".repeat(24), 1610, 132, 48, measure, 4);
  expect(name.width).toBeLessThanOrEqual(1610);
  expect(name.fontSize).toBeGreaterThanOrEqual(48);
  const biography = fitMemberCardText(`· ${"字".repeat(80)}`, 1640, 74, 18, measure);
  expect(biography.width).toBeLessThanOrEqual(1640);
  expect(biography.fontSize).toBeGreaterThanOrEqual(18);
  const footer = fitMemberCardText("社".repeat(32), 1850, 44, 32, measure, 15);
  expect(footer.width).toBeLessThanOrEqual(1850);
  expect(fitMemberCardText("姓名", 1610, 132, 48, measure, 18).fontSize).toBe(132);
});

test("layout removes decoration before shrinking and refuses impossible text rather than clipping it", () => {
  const measure = (text: string, size: number) => text.length * size;
  const fit = fitMemberCardText("abcdefghij", 200, 36, 20, measure, 10);
  expect(fit.tracking).toBe(0);
  expect(fit.width).toBeLessThanOrEqual(200);
  expect(() => fitMemberCardText("abcdefghij", 100, 36, 20, measure)).toThrow("文字过长");
  expect(() => fitMemberCardText("text", -1, 36, 20, measure)).toThrow("布局参数");
});

test("avatar crop handles wide and tall images with a center-preserving zoom", () => {
  expect(memberCardAvatarCrop(2000, 1000, 1)).toEqual({ x: 500, y: 0, size: 1000 });
  expect(memberCardAvatarCrop(1000, 2000, 2)).toEqual({ x: 250, y: 750, size: 500 });
  expect(memberCardAvatarCrop(1200, 1200, 99)).toEqual({ x: 400, y: 400, size: 400 });
  expect(() => memberCardAvatarCrop(0, 1000, 1)).toThrow("尺寸无效");
  expect(() => memberCardAvatarCrop(NaN, 1000, 1)).toThrow("尺寸无效");
});

test("biography normalization preserves three separate entries without empty bullets", () => {
  expect(memberCardBiographyLines(" 第一行\r\n \n第二行\n第三行 ")).toEqual(["第一行", "第二行", "第三行"]);
});

test("older drafts retain their reference typography and only explicit style changes are applied", () => {
  expect(sanitizeMemberCardData(defaultMemberCardData)).toEqual(defaultMemberCardData);
  expect(sanitizeMemberCardData({ ...defaultMemberCardData, layout: { name: {} } })).toEqual(defaultMemberCardData);
  expect(getMemberCardTextStyle(defaultMemberCardData, "role")).toEqual({ fontSize: 174, tracking: 2, offsetX: 0, offsetY: 0, lineHeight: 116 });
  expect(getMemberCardTextStyle(defaultMemberCardData, "name").tracking).toBe(32);
  expect(getMemberCardTextStyle({ ...defaultMemberCardData, name: "一二三四五六七" }, "name").tracking).toBe(4);
  const data = { ...defaultMemberCardData, layout: { name: { fontSize: 16, tracking: -8, offsetX: 125 } } };
  expect(getMemberCardTextStyle(data, "name")).toEqual({ fontSize: 16, tracking: -8, offsetX: 125, offsetY: 0, lineHeight: 116 });
  expect(getMemberCardTextStyle(data, "biography")).toEqual({ fontSize: 90, tracking: 4, offsetX: 0, offsetY: 0, lineHeight: 116 });
});

test("layout imports reject malformed shapes while normalization bounds only known finite values", () => {
  for (const value of [null, [], "layout", { unknown: {} }, { name: null }, { name: [] }, { name: { fontSize: "20" } }, { name: { weight: 100 } }, { name: { tracking: NaN } }, { biography: { lineHeight: Infinity } }]) {
    expect(isMemberCardLayout(value)).toBe(false);
  }
  expect(isMemberCardLayout({})).toBe(true);
  expect(isMemberCardLayout({ name: { offsetX: -9000 }, biography: { lineHeight: 40.5 } })).toBe(true);
  expect(sanitizeMemberCardLayout({
    name: { fontSize: 999, tracking: -100, offsetX: -9000, offsetY: 9000, unsupported: 1 },
    biography: { lineHeight: 1, tracking: "10" }, contact: { fontSize: NaN }, unknown: { fontSize: 40 },
  })).toEqual({ name: { fontSize: 240, tracking: -8, offsetX: -1200, offsetY: 1000 }, biography: { lineHeight: 30 } });
  expect(sanitizeMemberCardData({ ...defaultMemberCardData, layout: { role: { tracking: -2 } } }).layout).toEqual({ role: { tracking: -2 } });
});

test("negative tracking is retained and user-selected small text can fit without being enlarged", () => {
  const measure = (text: string, size: number) => text.length * size;
  expect(fitMemberCardText("ABCD", 70, 20, 16, measure, -4)).toEqual({ fontSize: 20, width: 68, tracking: -4 });
  expect(fitMemberCardText("ABCD", 70, 16, 16, measure, -4)).toEqual({ fontSize: 16, width: 52, tracking: -4 });
  expect(() => fitMemberCardText("ABCD", 70, Infinity, 16, measure)).toThrow("布局参数");
});

test("renderer preserves default baselines and bounds all glyphs and biography markers at extreme settings", async () => {
  type PaintedText = { text: string; font: string; x: number; y: number; size: number; left: number; right: number; top: number; bottom: number };
  const surfaces: { texts: PaintedText[]; rectangles: number[][] }[] = [];
  const makeCanvas = () => {
    const painted = { texts: [] as PaintedText[], rectangles: [] as number[][] };
    surfaces.push(painted);
    const context = {
      font: "400 16px sans-serif", textAlign: "left", textBaseline: "alphabetic",
      measureText(text: string) {
        const size = Number(this.font.match(/([\d.]+)px/)![1]);
        // Deliberate overhang and descent catch advance-width-only clipping checks.
        const width = Array.from(text).reduce((total, character) => total + (character === "." ? 0.15 : 1) * size, 0);
        return { width, actualBoundingBoxLeft: size * 0.06, actualBoundingBoxRight: width + size * 0.04, actualBoundingBoxAscent: size * 0.9, actualBoundingBoxDescent: size * 0.24 };
      },
      fillText(text: string, x: number, y: number) {
        const metrics = this.measureText(text);
        const size = Number(this.font.match(/([\d.]+)px/)![1]);
        painted.texts.push({ text, font: this.font, x, y, size, left: x - metrics.actualBoundingBoxLeft, right: x + metrics.actualBoundingBoxRight, top: y - metrics.actualBoundingBoxAscent, bottom: y + metrics.actualBoundingBoxDescent });
      },
      fillRect(...rectangle: number[]) { painted.rectangles.push(rectangle); },
      save() {}, restore() {}, beginPath() {}, rect() {}, clip() {}, drawImage() {},
      setLineDash() {}, moveTo() {}, lineTo() {}, stroke() {}, strokeRect() {}, arc() {}, fill() {},
    };
    return { width: 0, height: 0, getContext: () => context };
  };
  const replacements: Record<string, unknown> = {
    document: { fonts: { add() {} }, createElement: () => makeCanvas() },
    window: { setTimeout, clearTimeout },
    FontFace: class { async load() { return this; } },
    Image: class {
      naturalWidth = 1000;
      naturalHeight = 1000;
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      set src(_value: string) { queueMicrotask(() => this.onload?.()); }
    },
    fetch: async () => ({ ok: true, arrayBuffer: async () => new ArrayBuffer(0), json: async () => [[0, 0x10ffff]] }),
  };
  const originals = new Map(Object.keys(replacements).map((key) => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  for (const [key, value] of Object.entries(replacements)) Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
  try {
    const data = { ...defaultMemberCardData, name: "N", role: "R", roleEnglish: "E", biography: "B\nC\nD", organization: "O", contact: "T" };
    const canvas = makeCanvas() as unknown as HTMLCanvasElement;
    await renderMemberCard(canvas, data);
    const defaultText = surfaces.at(-1)!.texts;
    for (const [text, baseline, size] of [["R", 284, 174], ["E", 382, 82], ["N", 550, 132], ["B", 695, 90], ["C", 811, 90], ["D", 927, 90], ["O", 1185, 44], ["T", 1065, 33]] as const) {
      expect(defaultText.filter((entry) => entry.text === text).at(-1)).toMatchObject({ y: baseline, size });
    }
    for (const direction of [-1, 1]) {
      const layout = Object.fromEntries(MEMBER_CARD_TEXT_FIELDS.map((field) => [field, { fontSize: 240, tracking: 80, offsetX: direction * 1200, offsetY: direction * 1000, lineHeight: 280 }]));
      await renderMemberCard(canvas, { ...data, name: "名".repeat(24), biography: ["甲".repeat(80), "乙", "丙"].join("\n"), layout });
      const drawing = surfaces.at(-1)!;
      expect(drawing.texts.reduce((count, entry) => count + Array.from(entry.text).length, 0)).toBeGreaterThan(100);
      for (const glyph of drawing.texts) {
        expect(glyph.left).toBeGreaterThanOrEqual(0);
        expect(glyph.top).toBeGreaterThanOrEqual(0);
        expect(glyph.right).toBeLessThanOrEqual(MEMBER_CARD_WIDTH);
        expect(glyph.bottom).toBeLessThanOrEqual(MEMBER_CARD_HEIGHT);
      }
      const biographyStarts = ["甲", "乙", "丙"].map((text) => drawing.texts.find((entry) => entry.text.startsWith(text))!.y);
      expect(biographyStarts[1] - biographyStarts[0]).toBeCloseTo(280);
      expect(biographyStarts[2] - biographyStarts[1]).toBeCloseTo(280);
      for (const [x, y, width, height] of drawing.rectangles.slice(-3)) {
        expect(x).toBeGreaterThanOrEqual(0);
        expect(y).toBeGreaterThanOrEqual(0);
        expect(x + width).toBeLessThanOrEqual(MEMBER_CARD_WIDTH);
        expect(y + height).toBeLessThanOrEqual(MEMBER_CARD_HEIGHT);
      }
    }
    await renderMemberCard(canvas, { ...data, name: "........", layout: { name: { fontSize: 16, tracking: -8, offsetX: 1200, offsetY: -1000 }, organization: { fontSize: 16 } } });
    const small = surfaces.at(-1)!.texts;
    expect(small.filter((entry) => entry.text === "." && entry.size === 16)).toHaveLength(8);
    for (const glyph of small.filter((entry) => (entry.text === "." && entry.size !== 126) || entry.text === "O")) {
      expect(glyph.size).toBe(16);
      expect(glyph.left).toBeGreaterThanOrEqual(0);
      expect(glyph.top).toBeGreaterThanOrEqual(0);
      expect(glyph.right).toBeLessThanOrEqual(MEMBER_CARD_WIDTH);
      expect(glyph.bottom).toBeLessThanOrEqual(MEMBER_CARD_HEIGHT);
    }
    await renderMemberCard(canvas, { ...data, biography: "........\nZ", layout: { biography: { fontSize: 16, tracking: -8, offsetX: 1200, offsetY: 1000 } } });
    const tightBiography = surfaces.at(-1)!;
    const leftmostGlyph = Math.min(...tightBiography.texts.filter((entry) => entry.text === ".").map((entry) => entry.left));
    const [markerX, , markerWidth] = tightBiography.rectangles.at(-2)!;
    expect(markerX + markerWidth).toBeLessThan(leftmostGlyph);
  } finally {
    for (const [key, original] of originals) {
      if (original) Object.defineProperty(globalThis, key, original);
      else Reflect.deleteProperty(globalThis, key);
    }
  }
});
