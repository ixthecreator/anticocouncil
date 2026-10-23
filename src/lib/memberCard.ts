export interface MemberCardData {
  name: string;
  role: string;
  roleEnglish: string;
  biography: string;
  organization: string;
  contact: string;
  avatar: string;
  avatarZoom: number;
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
  if (!(maxWidth > 0) || !(minimumSize > 0) || preferredSize < minimumSize) throw new Error("名片文字布局参数无效。");
  const gaps = Math.max(0, Array.from(text).length - 1);
  const widthAt = (size: number, spacing: number) => measure(text, size) + gaps * spacing;
  let spacing = Math.max(0, tracking);
  // Tracking is decorative; remove it before making a long name unreadably small.
  if (widthAt(minimumSize, spacing) > maxWidth) spacing = 0;
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
        const response = await fetch(resourcePath(`fonts/${file}`), { signal: AbortSignal.timeout(60_000) });
        if (!response.ok) throw new Error(`字体加载失败：${response.status}`);
        return response;
      };
      const [regular, bold, coverage] = await Promise.all([
        load("NotoSansSC-Regular.ttf").then((response) => response.arrayBuffer()),
        load("NotoSansSC-Bold.ttf").then((response) => response.arrayBuffer()),
        load("coverage.json").then((response) => response.json() as Promise<FontCoverage>),
      ]);
      const fonts = await Promise.all([
        new FontFace(FONT_FAMILY, regular, { weight: "400" }).load(),
        new FontFace(FONT_FAMILY, bold, { weight: "700" }).load(),
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

function drawCardText(
  context: CanvasRenderingContext2D,
  text: string,
  x: number,
  baseline: number,
  width: number,
  preferred: number,
  minimum: number,
  options: { bold?: boolean; tracking?: number; color?: string; align?: "left" | "center" | "right" } = {},
) {
  if (!text) return;
  const weight = options.bold ? 700 : 400;
  const measure: CardTextMeasure = (value, size) => {
    context.font = `${weight} ${size}px "${FONT_FAMILY}"`;
    return options.tracking
      ? Array.from(value).reduce((width, character) => width + context.measureText(character).width, 0)
      : context.measureText(value).width;
  };
  const fit = fitMemberCardText(text, width, preferred, minimum, measure, options.tracking);
  context.font = `${weight} ${fit.fontSize}px "${FONT_FAMILY}"`;
  context.fillStyle = options.color ?? "#111111";
  context.textAlign = "left";
  context.textBaseline = "alphabetic";
  const align = options.align ?? "right";
  let cursor = x - (align === "right" ? fit.width : align === "center" ? fit.width / 2 : 0);
  if (!fit.tracking) context.fillText(text, cursor, baseline);
  else {
    for (const character of Array.from(text)) {
      context.fillText(character, cursor, baseline);
      cursor += context.measureText(character).width + fit.tracking;
    }
  }
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

  const textRight = 2272;
  drawCardText(context, data.role, textRight, 285, 700, 160, 48, { tracking: 9 });
  if (data.role && data.roleEnglish) {
    context.strokeStyle = "#111111";
    context.lineWidth = 2;
    context.beginPath();
    context.moveTo(textRight - 440, 320);
    context.lineTo(textRight, 320);
    context.stroke();
  }
  drawCardText(context, data.roleEnglish, textRight, 397, 700, 74, 18, { tracking: 15 });
  drawCardText(context, data.name, textRight, 558, 1610, 132, 48, { bold: true, tracking: Array.from(data.name).length <= 6 ? 18 : 4 });
  memberCardBiographyLines(data.biography).forEach((line, index) => {
    drawCardText(context, /^[·•]/u.test(line) ? line : `· ${line}`, textRight, 715 + index * 116, 1640, 74, 18);
  });
  drawCardText(context, data.contact, textRight, 1065, 1640, 33, 18, { color: "#666666" });
  if (data.organization) {
    drawCardText(context, data.organization, MEMBER_CARD_WIDTH / 2, 1190, 1850, 44, 32, { align: "center", bold: true, tracking: 15, color: "#7c7c79" });
  }

  // Commit only after every text and image has rendered successfully.
  if (renderVersions.get(canvas) !== version) return;
  canvas.width = MEMBER_CARD_WIDTH;
  canvas.height = MEMBER_CARD_HEIGHT;
  const target = canvas.getContext("2d");
  if (!target) throw new Error("浏览器无法显示名片，请刷新后重试。");
  target.drawImage(surface, 0, 0);
}
