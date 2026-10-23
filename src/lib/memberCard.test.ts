import { expect, test } from "bun:test";
import {
  defaultMemberCardData,
  fitMemberCardText,
  memberCardAvatarCrop,
  memberCardBiographyLines,
  memberCardFilename,
  sanitizeMemberCardData,
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
