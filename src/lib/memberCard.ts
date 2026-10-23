export interface MemberCardData {
  name: string;
  role: string;
  roleEnglish: string;
  biography: string;
  organization: string;
  contact: string;
  avatar: string;
  avatarZoom: number;
  layout?: MemberCardLayout;
}

export const MEMBER_CARD_TEXT_FIELDS = ["role", "roleEnglish", "name", "biography", "organization", "contact"] as const;
export type MemberCardTextField = typeof MEMBER_CARD_TEXT_FIELDS[number];
export interface MemberCardTextStyle {
  fontSize: number;
  tracking: number;
  offsetX: number;
  offsetY: number;
  lineHeight: number;
}
export type MemberCardLayout = Partial<Record<MemberCardTextField, Partial<MemberCardTextStyle>>>;
export const MEMBER_CARD_STYLE_LIMITS = {
  fontSize: { min: 16, max: 240, step: 1 },
  tracking: { min: -8, max: 80, step: 1 },
  offsetX: { min: -1200, max: 1200, step: 1 },
  offsetY: { min: -1000, max: 1000, step: 1 },
  lineHeight: { min: 30, max: 280, step: 1 },
} as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    && (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null);
}

/** Imported layouts may omit fields, but cannot contain unknown or non-numeric settings. */
export function isMemberCardLayout(value: unknown): value is MemberCardLayout {
  return isRecord(value) && Reflect.ownKeys(value).every((field) =>
    typeof field === "string" && MEMBER_CARD_TEXT_FIELDS.includes(field as MemberCardTextField)
    && isRecord(value[field]) && Reflect.ownKeys(value[field]).every((key) =>
      typeof key === "string" && Object.hasOwn(MEMBER_CARD_STYLE_LIMITS, key)
      && typeof value[field][key] === "number" && Number.isFinite(value[field][key])));
}

/** Keep only supported finite settings; drafts never gain arbitrary renderer options. */
export function sanitizeMemberCardLayout(value: unknown): MemberCardLayout {
  const result: MemberCardLayout = {};
  if (!isRecord(value)) return result;
  for (const field of MEMBER_CARD_TEXT_FIELDS) {
    const source = value[field];
    if (!isRecord(source)) continue;
    const style: Partial<MemberCardTextStyle> = {};
    for (const key of Object.keys(MEMBER_CARD_STYLE_LIMITS) as (keyof MemberCardTextStyle)[]) {
      const setting = source[key];
      if (typeof setting !== "number" || !Number.isFinite(setting)) continue;
      const { min, max } = MEMBER_CARD_STYLE_LIMITS[key];
      style[key] = Math.min(max, Math.max(min, setting));
    }
    if (Object.keys(style).length) result[field] = style;
  }
  return result;
}

export function getMemberCardTextStyle(data: MemberCardData, field: MemberCardTextField): MemberCardTextStyle {
  const defaults: Record<MemberCardTextField, Pick<MemberCardTextStyle, "fontSize" | "tracking">> = {
    role: { fontSize: 174, tracking: 2 },
    roleEnglish: { fontSize: 82, tracking: 35 },
    name: { fontSize: 132, tracking: Array.from(data.name).length <= 6 ? 32 : 4 },
    biography: { fontSize: 90, tracking: 4 },
    organization: { fontSize: 44, tracking: 15 },
    contact: { fontSize: 33, tracking: 0 },
  };
  return { ...defaults[field], offsetX: 0, offsetY: 0, lineHeight: 116, ...sanitizeMemberCardLayout(data.layout)[field] };
}

export const MEMBER_CARD_WIDTH = 2400;
export const MEMBER_CARD_HEIGHT = 1240;
export const MEMBER_CARD_LIMITS = {
  name: 24,
  role: 12,
  roleEnglish: 32,
  organization: 32,
  contact: 80,
  biographyLines: 3,
  biographyLine: 80,
  avatarZoomMin: 1,
  avatarZoomMax: 3,
} as const;

export const defaultMemberCardData: MemberCardData = {
  name: "你的姓名",
  role: "作者",
  roleEnglish: "writer",
  biography: "在这里介绍你的研究方向或工作",
  organization: "安提柯史学社",
  contact: "",
  avatar: "",
  avatarZoom: 1,
};

const controls = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f\u200b\u200e\u200f\u202a-\u202e\u2066-\u2069\ufeff]/g;
function singleLine(value: unknown): string {
  return typeof value === "string" ? value.replace(controls, "").replace(/\s+/g, " ").trim() : "";
}

export function memberCardBiographyLines(value: string): string[] {
  return value.replace(/\r\n?/g, "\n").split("\n").map(singleLine).filter(Boolean);
}

/** Normalize imported/local drafts without silently removing over-length text. */
export function sanitizeMemberCardData(input: Partial<MemberCardData> | null | undefined): MemberCardData {
  const source = input ?? {};
  const layout = sanitizeMemberCardLayout(source.layout);
  return {
    name: singleLine(source.name),
    role: singleLine(source.role),
    roleEnglish: singleLine(source.roleEnglish),
    biography: memberCardBiographyLines(typeof source.biography === "string" ? source.biography : "").join("\n"),
    organization: singleLine(source.organization),
    contact: singleLine(source.contact),
    avatar: typeof source.avatar === "string" ? source.avatar.trim() : "",
    avatarZoom: Number.isFinite(source.avatarZoom)
      ? Math.min(MEMBER_CARD_LIMITS.avatarZoomMax, Math.max(MEMBER_CARD_LIMITS.avatarZoomMin, source.avatarZoom!))
      : 1,
    ...(Object.keys(layout).length ? { layout } : {}),
  };
}

export function validateMemberCardData(input: MemberCardData): string[] {
  const data = sanitizeMemberCardData(input);
  const errors: string[] = [];
  if (!data.name) errors.push("请填写姓名。");
  const fields = [
    ["name", "姓名"], ["role", "身份"], ["roleEnglish", "英文身份"],
    ["organization", "组织名称"], ["contact", "联系方式"],
  ] as const;
  for (const [key, label] of fields) {
    if (Array.from(data[key]).length > MEMBER_CARD_LIMITS[key]) {
      errors.push(`${label}最多填写 ${MEMBER_CARD_LIMITS[key]} 个字。`);
    }
  }
  const lines = memberCardBiographyLines(data.biography);
  if (lines.length > MEMBER_CARD_LIMITS.biographyLines) errors.push("个人介绍最多填写 3 行。");
  if (lines.some((line) => Array.from(line).length > MEMBER_CARD_LIMITS.biographyLine)) errors.push("个人介绍每行最多填写 80 个字，请手动换行。");
  if (data.avatar && !/^data:image\/(?:png|jpeg|webp);base64,[a-z\d+/=\s]+$/i.test(data.avatar) && !/^blob:https?:\/\//i.test(data.avatar)) {
    errors.push("请重新上传 JPG、PNG 或 WebP 格式的头像。");
  }
  if (data.avatar.length > 12_000_000) errors.push("头像文件过大，请压缩后重新上传。");
  return errors;
}

export function memberCardFilename(name: string): string {
  const safe = Array.from(singleLine(name).replace(/[<>:"/\\|?*]/g, "-").replace(/[. ]+$/g, "")).slice(0, 40).join("");
  return `${safe || "议会成员"}-名片.png`;
}

export type CardTextMeasure = (text: string, fontSize: number) => number;

/** The same measured layout is used by the preview and the downloaded bitmap. */
export function fitMemberCardText(
  text: string,
  maxWidth: number,
  preferredSize: number,
  minimumSize: number,
  measure: CardTextMeasure,
  tracking = 0,
): { fontSize: number; width: number; tracking: number } {
  if (![maxWidth, preferredSize, minimumSize, tracking].every(Number.isFinite) || !(maxWidth > 0) || !(minimumSize > 0) || preferredSize < minimumSize) throw new Error("名片文字布局参数无效。");
  const gaps = Math.max(0, Array.from(text).length - 1);
  const widthAt = (size: number, spacing: number) => measure(text, size) + gaps * spacing;
  let spacing = tracking;
  // Tracking is decorative; remove it before making a long name unreadably small.
  if (spacing > 0 && widthAt(minimumSize, spacing) > maxWidth) spacing = 0;
  if (widthAt(minimumSize, spacing) > maxWidth + 0.01) throw new Error("文字过长，无法完整放入名片，请缩短内容。");
  if (widthAt(preferredSize, spacing) <= maxWidth) return { fontSize: preferredSize, width: widthAt(preferredSize, spacing), tracking: spacing };
  let low = minimumSize;
  let high = preferredSize;
  for (let i = 0; i < 20; i++) {
    const middle = (low + high) / 2;
    if (widthAt(middle, spacing) <= maxWidth) low = middle;
    else high = middle;
  }
  return { fontSize: low, width: widthAt(low, spacing), tracking: spacing };
}

/** A center crop always covers the circular frame, even for extreme aspect ratios. */
export function memberCardAvatarCrop(width: number, height: number, zoom: number) {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) throw new Error("头像图片尺寸无效，请重新上传。");
  const boundedZoom = Number.isFinite(zoom) ? Math.max(1, Math.min(3, zoom)) : 1;
  const size = Math.min(width, height) / boundedZoom;
  return { x: (width - size) / 2, y: (height - size) / 2, size };
}

const FONT_FAMILY = "AnticoMemberCard";
const SERIF_FONT_FAMILY = "AnticoMemberCardSerif";
type FontCoverage = [number, number][];
let fontPromise: Promise<FontCoverage> | undefined;
let logoPromise: Promise<HTMLImageElement> | undefined;
const renderVersions = new WeakMap<HTMLCanvasElement, number>();

function resourcePath(path: string) {
  return `${import.meta.env?.BASE_URL ?? "/"}${path}`;
}

async function loadCardFonts(): Promise<FontCoverage> {
  if (!fontPromise) {
    fontPromise = (async () => {
      const load = async (file: string) => {
        const response = await fetch(resourcePath(`fonts/card/${file}`), { signal: AbortSignal.timeout(60_000) });
        if (!response.ok) throw new Error(`字体加载失败：${response.status}`);
        return response;
      };
      const [sans, serif, coverage] = await Promise.all([
        load("NotoSansSC-Variable.woff2").then((response) => response.arrayBuffer()),
        load("NotoSerifSC-Bold.woff2").then((response) => response.arrayBuffer()),
        load("coverage.json").then((response) => response.json() as Promise<FontCoverage>),
      ]);
      const fonts = await Promise.all([
        new FontFace(FONT_FAMILY, sans, { weight: "100 500" }).load(),
        new FontFace(SERIF_FONT_FAMILY, serif, { weight: "700" }).load(),
      ]);
      for (const font of fonts) document.fonts.add(font);
      return coverage;
    })().catch(() => {
      fontPromise = undefined;
      throw new Error("名片中文字体加载失败，请检查网络后重试。");
    });
  }
  return fontPromise;
}

function loadCardImage(source: string, label: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    const timeout = window.setTimeout(() => fail(), 60_000);
    const clean = () => {
      window.clearTimeout(timeout);
      image.onload = null;
      image.onerror = null;
    };
    const fail = () => {
      clean();
      reject(new Error(`${label}加载失败，请检查图片后重试。`));
    };
    image.onload = () => {
      clean();
      if (!image.naturalWidth || !image.naturalHeight) reject(new Error(`${label}尺寸无效，请重新上传。`));
      else resolve(image);
    };
    image.onerror = fail;
    image.src = source;
  });
}

function loadLogo(): Promise<HTMLImageElement> {
  if (!logoPromise) logoPromise = loadCardImage(resourcePath("logo.png"), "社徽").catch((error) => {
    logoPromise = undefined;
    throw error;
  });
  return logoPromise;
}

function assertSupportedCharacters(data: MemberCardData, coverage: FontCoverage) {
  const text = [data.name, data.role, data.roleEnglish, data.biography, data.organization, data.contact].join("");
  const unsupported = [...new Set(Array.from(text))].filter((character) => {
    if (/\s/u.test(character)) return false;
    const point = character.codePointAt(0)!;
    return !coverage.some(([first, last]) => point >= first && point <= last);
  });
  if (unsupported.length) throw new Error(`名片字体暂不支持这些字符：${unsupported.slice(0, 8).join("、")}。请替换后重试。`);
}

interface CardBounds { left: number; top: number; right: number; bottom: number }
interface PreparedCardText {
  text: string;
  font: string;
  fontSize: number;
  tracking: number;
  left: number;
  baseline: number;
  color: string;
  bounds: CardBounds;
}
type CardTextOptions = { weight?: 100 | 300 | 400 | 500 | 700; serif?: boolean; tracking?: number; color?: string; align?: "left" | "center" | "right" };

function measuredTextBounds(context: CanvasRenderingContext2D, text: string, fontSize: number, tracking: number): CardBounds {
  let cursor = 0;
  let left = Infinity;
  let right = -Infinity;
  let top = Infinity;
  let bottom = -Infinity;
  const pieces = tracking ? Array.from(text) : [text];
  for (const piece of pieces) {
    const metrics = context.measureText(piece);
    left = Math.min(left, cursor - (Number.isFinite(metrics.actualBoundingBoxLeft) ? metrics.actualBoundingBoxLeft : 0));
    right = Math.max(right, cursor + (Number.isFinite(metrics.actualBoundingBoxRight) ? metrics.actualBoundingBoxRight : metrics.width));
    top = Math.min(top, -(Number.isFinite(metrics.actualBoundingBoxAscent) ? metrics.actualBoundingBoxAscent : fontSize * 0.85));
    bottom = Math.max(bottom, Number.isFinite(metrics.actualBoundingBoxDescent) ? metrics.actualBoundingBoxDescent : fontSize * 0.2);
    cursor += metrics.width + tracking;
  }
  return { left, right, top, bottom };
}

/** Translate a group together, keeping every glyph and biography marker inside the bitmap. */
function cardBoundsTranslation(bounds: CardBounds[]) {
  const padding = 4;
  if (!bounds.length) return { x: 0, y: 0 };
  const left = Math.min(...bounds.map((box) => box.left));
  const right = Math.max(...bounds.map((box) => box.right));
  const top = Math.min(...bounds.map((box) => box.top));
  const bottom = Math.max(...bounds.map((box) => box.bottom));
  if (right - left > MEMBER_CARD_WIDTH - padding * 2 || bottom - top > MEMBER_CARD_HEIGHT - padding * 2) {
    throw new Error("文字排版超出名片范围，请缩小字号或行距。");
  }
  return {
    x: Math.max(padding - left, Math.min(0, MEMBER_CARD_WIDTH - padding - right)),
    y: Math.max(padding - top, Math.min(0, MEMBER_CARD_HEIGHT - padding - bottom)),
  };
}

function prepareCardText(
  context: CanvasRenderingContext2D,
  text: string,
  x: number,
  baseline: number,
  width: number,
  preferred: number,
  minimum: number,
  options: CardTextOptions = {},
): PreparedCardText | undefined {
  if (!text) return;
  const weight = options.weight ?? 400;
  const family = options.serif ? SERIF_FONT_FAMILY : FONT_FAMILY;
  const measure: CardTextMeasure = (value, size) => {
    context.font = `${weight} ${size}px "${family}"`;
    if (!options.tracking) return context.measureText(value).width;
    const characters = Array.from(value);
    const advance = characters.reduce((width, character) => width + context.measureText(character).width, 0);
    // With tight negative spacing, narrow glyphs can move backwards. Fit their real span.
    if (options.tracking < 0) {
      const bounds = measuredTextBounds(context, value, size, options.tracking);
      return Math.max(advance, bounds.right - bounds.left - (characters.length - 1) * options.tracking);
    }
    return advance;
  };
  const fit = fitMemberCardText(text, width, preferred, Math.min(minimum, preferred), measure, options.tracking);
  context.font = `${weight} ${fit.fontSize}px "${family}"`;
  context.textAlign = "left";
  context.textBaseline = "alphabetic";
  const align = options.align ?? "right";
  const measured = measuredTextBounds(context, text, fit.fontSize, fit.tracking);
  const left = fit.tracking < 0
    ? x - (align === "right" ? measured.right : align === "center" ? (measured.left + measured.right) / 2 : measured.left)
    : x - (align === "right" ? fit.width : align === "center" ? fit.width / 2 : 0);
  return {
    text, font: context.font, fontSize: fit.fontSize, tracking: fit.tracking, left, baseline,
    color: options.color ?? "#111111",
    bounds: { left: left + measured.left, right: left + measured.right, top: baseline + measured.top, bottom: baseline + measured.bottom },
  };
}

function paintCardText(context: CanvasRenderingContext2D, text: PreparedCardText, translation: { x: number; y: number }) {
  context.font = text.font;
  context.fillStyle = text.color;
  context.textAlign = "left";
  context.textBaseline = "alphabetic";
  let cursor = text.left + translation.x;
  const baseline = text.baseline + translation.y;
  if (!text.tracking) context.fillText(text.text, cursor, baseline);
  else {
    for (const character of Array.from(text.text)) {
      context.fillText(character, cursor, baseline);
      cursor += context.measureText(character).width + text.tracking;
    }
  }
}

function drawCardText(
  context: CanvasRenderingContext2D, text: string, x: number, baseline: number,
  width: number, preferred: number, minimum: number, options: CardTextOptions = {},
) {
  const prepared = prepareCardText(context, text, x, baseline, width, preferred, minimum, options);
  if (prepared) paintCardText(context, prepared, cardBoundsTranslation([prepared.bounds]));
}

/** Render a complete 2400×1240 bitmap. Asset failures reject, never export a partial card. */
export async function renderMemberCard(canvas: HTMLCanvasElement, input: MemberCardData): Promise<void> {
  const version = (renderVersions.get(canvas) ?? 0) + 1;
  renderVersions.set(canvas, version);
  const errors = validateMemberCardData(input);
  if (errors.length) throw new Error(errors.join(" "));
  const data = sanitizeMemberCardData(input);
  const [coverage, logo, avatar] = await Promise.all([
    loadCardFonts(), loadLogo(), data.avatar ? loadCardImage(data.avatar, "头像") : Promise.resolve(null),
  ]);
  assertSupportedCharacters(data, coverage);
  if (renderVersions.get(canvas) !== version) return;
  const surface = document.createElement("canvas");
  surface.width = MEMBER_CARD_WIDTH;
  surface.height = MEMBER_CARD_HEIGHT;
  const context = surface.getContext("2d");
  if (!context) throw new Error("浏览器无法绘制名片，请换用支持 Canvas 的浏览器。");
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, MEMBER_CARD_WIDTH, MEMBER_CARD_HEIGHT);

  const left = 72;
  const right = 2328;
  const top = 100;
  const bottom = 1135;
  context.save();
  context.beginPath();
  context.rect(left, top, 570, 510);
  context.clip();
  context.drawImage(logo, -400, -430, 1000, 1000);
  context.restore();

  context.strokeStyle = "#929292";
  context.lineWidth = 3;
  context.setLineDash([50, 50]);
  context.beginPath();
  context.moveTo(left + 80, top);
  context.lineTo(right - 80, top);
  context.moveTo(left + 80, bottom);
  context.lineTo(right - 80, bottom);
  context.stroke();
  context.setLineDash([]);
  context.strokeStyle = "#111111";
  context.lineWidth = 4;
  context.beginPath();
  context.moveTo(left + 75, top);
  context.lineTo(left, top);
  context.lineTo(left, bottom);
  context.lineTo(left + 75, bottom);
  context.moveTo(right - 75, top);
  context.lineTo(right, top);
  context.lineTo(right, bottom);
  context.lineTo(right - 75, bottom);
  context.stroke();

  // The avatar frame is deliberately separate from the text column.
  context.strokeStyle = "#a1a1a1";
  context.lineWidth = 3;
  context.setLineDash([52, 48]);
  context.strokeRect(122, 665, 430, 430);
  context.setLineDash([]);
  const avatarX = 337;
  const avatarY = 880;
  const radius = 162;
  context.save();
  context.shadowColor = "rgba(0,0,0,0.20)";
  context.shadowBlur = 28;
  context.shadowOffsetY = 9;
  context.fillStyle = "#f0f0ef";
  context.beginPath();
  context.arc(avatarX, avatarY, radius, 0, Math.PI * 2);
  context.fill();
  context.restore();
  context.save();
  context.beginPath();
  context.arc(avatarX, avatarY, radius, 0, Math.PI * 2);
  context.clip();
  if (avatar) {
    const crop = memberCardAvatarCrop(avatar.naturalWidth, avatar.naturalHeight, data.avatarZoom);
    context.drawImage(avatar, crop.x, crop.y, crop.size, crop.size, avatarX - radius, avatarY - radius, radius * 2, radius * 2);
  } else {
    context.fillStyle = "#f0f0ef";
    context.fillRect(avatarX - radius, avatarY - radius, radius * 2, radius * 2);
    drawCardText(context, Array.from(data.name)[0], avatarX, avatarY + 43, radius * 1.5, 126, 80, { align: "center", color: "#999995" });
  }
  context.restore();

  // Match the reference's light title, widely spaced Latin line and quieter name weight.
  const textRight = 2280;
  const roleStyle = getMemberCardTextStyle(data, "role");
  const role = prepareCardText(context, data.role, textRight + roleStyle.offsetX, 284 + roleStyle.offsetY, 700, roleStyle.fontSize, 48, { weight: 100, tracking: roleStyle.tracking });
  if (role) {
    // Scale from the chosen size, so old drafts keep their original divider even when a long title fits smaller.
    const scale = roleStyle.fontSize / 174;
    const divider = data.roleEnglish ? {
      left: textRight + roleStyle.offsetX - 390 * scale,
      right: textRight + roleStyle.offsetX,
      top: role.baseline + 23 * scale - 1,
      bottom: role.baseline + 23 * scale + 1,
    } : undefined;
    const translation = cardBoundsTranslation([role.bounds, ...(divider ? [divider] : [])]);
    paintCardText(context, role, translation);
    if (divider) {
      context.strokeStyle = "#111111";
      context.lineWidth = 2;
      context.beginPath();
      context.moveTo(divider.left + translation.x, divider.top + 1 + translation.y);
      context.lineTo(divider.right + translation.x, divider.top + 1 + translation.y);
      context.stroke();
    }
  }
  const englishStyle = getMemberCardTextStyle(data, "roleEnglish");
  drawCardText(context, data.roleEnglish, textRight + englishStyle.offsetX, 382 + englishStyle.offsetY, 700, englishStyle.fontSize, 18, { weight: 100, tracking: englishStyle.tracking });
  const nameStyle = getMemberCardTextStyle(data, "name");
  drawCardText(context, data.name, textRight + nameStyle.offsetX, 550 + nameStyle.offsetY, 1610, nameStyle.fontSize, 48, { weight: 400, tracking: nameStyle.tracking });
  const biographyStyle = getMemberCardTextStyle(data, "biography");
  const biography = memberCardBiographyLines(data.biography).flatMap((line, index) => {
    const baseline = 695 + biographyStyle.offsetY + index * biographyStyle.lineHeight;
    const text = prepareCardText(context, line.replace(/^[·•]\s*/u, ""), textRight + biographyStyle.offsetX, baseline, 1590, biographyStyle.fontSize, 18, { weight: 300, tracking: biographyStyle.tracking });
    if (text) {
      const scale = text.fontSize / 90;
      const size = Math.max(2, 7 * scale);
      const textLeft = text.tracking < 0 ? Math.min(text.left, text.bounds.left) : text.left;
      const markerX = textLeft - 45 * scale - size / 2;
      const markerY = baseline - text.fontSize * 0.38 - size / 2;
      return [{ text, marker: { left: markerX, top: markerY, right: markerX + size, bottom: markerY + size } }];
    }
    return [];
  });
  const biographyTranslation = cardBoundsTranslation(biography.flatMap(({ text, marker }) => [text.bounds, marker]));
  for (const { text, marker } of biography) {
    paintCardText(context, text, biographyTranslation);
    // Keep the small square and every line in the same translated group.
    context.fillRect(marker.left + biographyTranslation.x, marker.top + biographyTranslation.y, marker.right - marker.left, marker.bottom - marker.top);
  }
  const contactStyle = getMemberCardTextStyle(data, "contact");
  drawCardText(context, data.contact, textRight + contactStyle.offsetX, 1065 + contactStyle.offsetY, 1640, contactStyle.fontSize, 18, { tracking: contactStyle.tracking, color: "#666666" });
  if (data.organization) {
    const organizationStyle = getMemberCardTextStyle(data, "organization");
    drawCardText(context, data.organization, MEMBER_CARD_WIDTH / 2 + organizationStyle.offsetX, 1185 + organizationStyle.offsetY, 1850, organizationStyle.fontSize, 32, { align: "center", serif: true, weight: 700, tracking: organizationStyle.tracking, color: "#7c7c79" });
  }

  // Commit only after every text and image has rendered successfully.
  if (renderVersions.get(canvas) !== version) return;
  canvas.width = MEMBER_CARD_WIDTH;
  canvas.height = MEMBER_CARD_HEIGHT;
  const target = canvas.getContext("2d");
  if (!target) throw new Error("浏览器无法显示名片，请刷新后重试。");
  target.drawImage(surface, 0, 0);
}
