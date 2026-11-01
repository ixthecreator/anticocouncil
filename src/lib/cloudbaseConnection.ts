export type CloudbaseConfiguration = {
  config: { env: string; region: string } | null;
  error: string;
};
export function resolveCloudbaseConfiguration(env: Record<string, unknown>): CloudbaseConfiguration {
  const read = (key: string) => typeof env[key] === "string" ? env[key].trim() : "";
  const envId = read("VITE_CLOUDBASE_ENV_ID");
  // Shanghai is the only region whose services the migration plan relies on.
  const region = read("VITE_CLOUDBASE_REGION") || "ap-shanghai";
  if (!envId) return { config: null, error: "尚未配置腾讯云开发环境。请先完成环境配置并重新部署；本地工作区仍可使用。" };
  if (!/^[a-z0-9][a-z0-9-]{2,63}$/.test(envId) || !/^[a-z]{2}-[a-z]+$/.test(region))
    return { config: null, error: "云开发环境编号或地域格式无效。请检查部署配置；本地工作区仍可使用。" };
  return { config: { env: envId, region }, error: "" };
}
