// Which cloud service a build talks to, fixed when the site is built.
// Firebase stays the default until the move to CloudBase is finished.
export type CloudServiceName = "firebase" | "cloudbase";
export const resolveCloudService = (env: Record<string, unknown>): CloudServiceName =>
  typeof env.VITE_CLOUD_BACKEND === "string" && env.VITE_CLOUD_BACKEND.trim() === "cloudbase" ? "cloudbase" : "firebase";
export const cloudService = resolveCloudService(
  (import.meta as ImportMeta & { env?: Record<string, unknown> }).env || {},
);
