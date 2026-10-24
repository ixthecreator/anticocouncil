import type { FirebaseOptions } from "firebase/app";

// The connection helpers are backend-neutral; re-exported so existing imports keep working.
export * from "./cloudConnection";

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
