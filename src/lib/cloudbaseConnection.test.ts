import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { resolveCloudbaseConfiguration } from "./cloudbaseConnection";
import { resolveCloudService } from "./cloudService";
import { collectionNames } from "./workspace";

test("Firebase stays the service unless a build asks for CloudBase by name", () => {
  expect(resolveCloudService({})).toBe("firebase");
  expect(resolveCloudService({ VITE_CLOUD_BACKEND: "firebase" })).toBe("firebase");
  expect(resolveCloudService({ VITE_CLOUD_BACKEND: "CloudBase" })).toBe("firebase");
  expect(resolveCloudService({ VITE_CLOUD_BACKEND: " cloudbase " })).toBe("cloudbase");
});

test("a CloudBase build needs an environment id and defaults to Shanghai", () => {
  expect(resolveCloudbaseConfiguration({}).config).toBeNull();
  expect(resolveCloudbaseConfiguration({}).error).toContain("尚未配置腾讯云开发环境");
  expect(resolveCloudbaseConfiguration({ VITE_CLOUDBASE_ENV_ID: " antico-1a2b3c " })).toEqual({
    config: { env: "antico-1a2b3c", region: "ap-shanghai" },
    error: "",
  });
  expect(resolveCloudbaseConfiguration({ VITE_CLOUDBASE_ENV_ID: "antico-1a2b3c", VITE_CLOUDBASE_REGION: "ap-guangzhou" }).config?.region).toBe("ap-guangzhou");
});

test("malformed environment settings are refused before any request", () => {
  for (const env of [
    { VITE_CLOUDBASE_ENV_ID: "https://example.com" },
    { VITE_CLOUDBASE_ENV_ID: "Antico" },
    { VITE_CLOUDBASE_ENV_ID: "antico-1", VITE_CLOUDBASE_REGION: "shanghai" },
  ]) {
    const result = resolveCloudbaseConfiguration(env);
    expect(result.config).toBeNull();
    expect(result.error).toContain("格式无效");
  }
});

test("every collection the site uses has exactly one CloudBase security rule", () => {
  const read = (file: string) => JSON.parse(readFileSync(new URL(`../../cloudbase/rules/${file}`, import.meta.url), "utf8"));
  const assignments = read("collections.json") as Record<string, string[]>;
  const covered = Object.values(assignments).flat();
  expect(new Set(covered).size).toBe(covered.length);
  expect([...covered].sort()).toEqual([...collectionNames, "workspaceAccess", "accessRequests", "accessRoster"].sort());
  for (const file of Object.keys(assignments)) {
    const rule = read(file);
    expect(Object.keys(rule).sort()).toEqual(["read", "write"]);
  }
  // Workspace records follow the membership record; membership changes only go through the function.
  expect(read("workspace-records.json").read).toContain("database.workspaceAccess.${auth.uid}");
  expect(read("own-records.json")).toEqual({ read: "doc.uid == auth.uid", write: false });
  expect(read("server-only.json")).toEqual({ read: false, write: false });
});
