import {
  defaultMemberCardData,
  sanitizeMemberCardData,
  validateMemberCardData,
  type MemberCardData,
} from "./memberCard";

const MAX_DRAFT_BYTES = 2 * 1024 * 1024;
const MAX_AVATAR_CHARACTERS = 1_500_000;
const stringFields = ["name", "role", "roleEnglish", "biography", "organization", "contact", "avatar"] as const;

export function memberCardDraftKey(scope: string): string {
  return `antico.member-card.v1.${encodeURIComponent(scope)}`;
}

function record(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function checkTextSize(text: string): void {
  if (text.length > MAX_DRAFT_BYTES || new TextEncoder().encode(text).byteLength > MAX_DRAFT_BYTES) {
    throw new Error("名片草稿文件过大，请选择 2 MB 以内的草稿。");
  }
}

function portableAvatar(avatar: string): boolean {
  if (!avatar) return true;
  const prefix = /^data:image\/(?:png|jpeg|webp);base64,/i.exec(avatar);
  if (!prefix) return false;
  const encoded = avatar.slice(prefix[0].length);
  return encoded.length > 0 && encoded.length % 4 === 0 && /^[a-z\d+/]+={0,2}$/i.test(encoded);
}

function checkedData(value: unknown): MemberCardData {
  if (!record(value) || typeof value.name !== "string" ||
    stringFields.some((field) => value[field] !== undefined && typeof value[field] !== "string") ||
    (value.avatarZoom !== undefined && (typeof value.avatarZoom !== "number" || !Number.isFinite(value.avatarZoom)))) {
    throw new Error("名片草稿内容格式不正确，请导入从名片制作页面下载的草稿。");
  }
  if (typeof value.avatar === "string" && value.avatar.length > MAX_AVATAR_CHARACTERS) {
    throw new Error("草稿中的头像过大，请压缩头像后重新保存。");
  }
  const data = sanitizeMemberCardData({ ...defaultMemberCardData, ...value } as MemberCardData);
  if (!portableAvatar(data.avatar)) {
    throw new Error("草稿头像须为内嵌的 PNG、JPG 或 WebP 图片，请重新上传头像。");
  }
  const errors = validateMemberCardData(data);
  if (errors.length) throw new Error(errors.join(" "));
  return data;
}

/** A draft contains its image bytes and never depends on another user's browser URLs. */
export function parseMemberCardDraft(text: string): MemberCardData {
  checkTextSize(text);
  let value: unknown;
  try { value = JSON.parse(text); }
  catch { throw new Error("无法读取名片草稿，请选择有效的 JSON 草稿文件。"); }
  if (!record(value) || value.version !== 1) {
    throw new Error("不支持此名片草稿格式，请导入版本 1 的名片草稿。");
  }
  return checkedData(value.data);
}

export function serializeMemberCardDraft(data: MemberCardData): string {
  const text = JSON.stringify({ version: 1, data: checkedData(data) });
  checkTextSize(text);
  return text;
}

export function loadMemberCardDraft(storage: Pick<Storage, "getItem">, scope: string): MemberCardData | null {
  try {
    const text = storage.getItem(memberCardDraftKey(scope));
    return text === null ? null : parseMemberCardDraft(text);
  } catch {
    // A corrupt draft or disabled browser storage must not prevent making a new card.
    return null;
  }
}

/** The caller displays quota/privacy errors instead of claiming that the draft was saved. */
export function saveMemberCardDraft(storage: Pick<Storage, "setItem">, scope: string, data: MemberCardData): void {
  const text = serializeMemberCardDraft(data);
  storage.setItem(memberCardDraftKey(scope), text);
}
