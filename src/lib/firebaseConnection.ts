import type { FirebaseOptions } from "firebase/app";

export type WorkspaceConnection = "local" | "connecting" | "connected" | "offline" | "error";
export type SnapshotState = {
  fromCache: boolean;
  hasPendingWrites: boolean;
};
export type CollectionConnection = {
  source: "loading" | "cache" | "server";
  hasBeenOnServer: boolean;
  hasPendingWrites: boolean;
  error: string;
};
export const newCollectionConnection = (): CollectionConnection => ({
  source: "loading",
  hasBeenOnServer: false,
  hasPendingWrites: false,
  error: "",
});
export function receiveCollectionSnapshot(
  previous: CollectionConnection,
  metadata: SnapshotState,
): CollectionConnection {
  return {
    source: metadata.fromCache ? "cache" : "server",
    hasBeenOnServer: previous.hasBeenOnServer || !metadata.fromCache,
    hasPendingWrites: metadata.hasPendingWrites,
    error: "",
  };
}
export function summarizeCloudConnection(
  collections: CollectionConnection[],
  browserOffline = false,
  timedOut = false,
): { connection: WorkspaceConnection; ready: boolean; error: string; hasPendingWrites: boolean } {
  const error = collections.find((item) => item.error)?.error || "";
  const hasPendingWrites = collections.some((item) => item.hasPendingWrites);
  if (error) return { connection: "error", ready: false, error, hasPendingWrites };
  if (browserOffline)
    return { connection: "offline", ready: false, error: "网络已断开，云端数据暂时只能查看。恢复网络后将重新连接。", hasPendingWrites };
  if (collections.length > 0 && collections.every((item) => item.source === "server"))
    return { connection: "connected", ready: !hasPendingWrites, error: "", hasPendingWrites };
  if (timedOut || collections.some((item) => item.source === "cache" && item.hasBeenOnServer))
    return { connection: "offline", ready: false, error: "尚未取得完整的云端确认，当前缓存可能不完整。请检查网络后重试，或切换到本地工作区。", hasPendingWrites };
  return { connection: "connecting", ready: false, error: "", hasPendingWrites };
}

// Kept only for an explicitly requested migration; never used as a default.
export const legacyFirebaseConfiguration = {
  config: {
    projectId: "gen-lang-client-0812096423",
    appId: "1:397125428761:web:189b42a558d95ecb04ac88",
    apiKey: "AIzaSyDYmxxAHH44HeQYxiUxnO0rRVTLFW00YeA",
    authDomain: "gen-lang-client-0812096423.firebaseapp.com",
    storageBucket: "gen-lang-client-0812096423.firebasestorage.app",
    messagingSenderId: "397125428761",
  },
  databaseId: "ai-studio-swissgridmeeting-a16ddb46-1d3b-4bec-b582-68e11ee0149e",
};

export type FirebaseConfiguration = {
  config: FirebaseOptions | null;
  databaseId: string;
  error: string;
};
export function resolveFirebaseConfiguration(env: Record<string, unknown>): FirebaseConfiguration {
  const read = (key: string) => typeof env[key] === "string" ? env[key].trim() : "";
  const required = ["VITE_FIREBASE_PROJECT_ID", "VITE_FIREBASE_API_KEY", "VITE_FIREBASE_APP_ID"];
  const missing = required.filter((key) => !read(key));
  const databaseId = read("VITE_FIREBASE_DATABASE_ID") || read("VITE_FIRESTORE_DATABASE_ID") || "(default)";
  const configured = Object.keys(env).some((key) =>
    (key.startsWith("VITE_FIREBASE_") || key === "VITE_FIRESTORE_DATABASE_ID") && read(key),
  );
  if (missing.length) return {
    config: null,
    databaseId,
    error: configured
      ? `Firebase 配置不完整，缺少 ${missing.join("、")}。请在部署环境补齐并重新构建；本地工作区仍可使用。`
      : "尚未配置自有 Firebase。请先完成项目配置并重新部署；本地工作区仍可使用。",
  };
  const projectId = read("VITE_FIREBASE_PROJECT_ID");
  if (/[\s/]/.test(projectId) || !/^(\(default\)|[a-zA-Z0-9][a-zA-Z0-9-]*)$/.test(databaseId))
    return { config: null, databaseId, error: "Firebase 项目编号或数据库编号格式无效。请检查部署配置；本地工作区仍可使用。" };
  return {
    config: {
      projectId,
      apiKey: read("VITE_FIREBASE_API_KEY"),
      appId: read("VITE_FIREBASE_APP_ID"),
      authDomain: read("VITE_FIREBASE_AUTH_DOMAIN") || `${projectId}.firebaseapp.com`,
      ...(read("VITE_FIREBASE_STORAGE_BUCKET") ? { storageBucket: read("VITE_FIREBASE_STORAGE_BUCKET") } : {}),
      ...(read("VITE_FIREBASE_MESSAGING_SENDER_ID") ? { messagingSenderId: read("VITE_FIREBASE_MESSAGING_SENDER_ID") } : {}),
      ...(read("VITE_FIREBASE_MEASUREMENT_ID") ? { measurementId: read("VITE_FIREBASE_MEASUREMENT_ID") } : {}),
    },
    databaseId,
    error: "",
  };
}
