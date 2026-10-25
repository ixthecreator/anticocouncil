import { resolveCloudbaseConfiguration } from "./cloudbaseConnection";

export const cloudbaseConfiguration = resolveCloudbaseConfiguration(
  (import.meta as ImportMeta & { env?: Record<string, unknown> }).env || {},
);

// The parts of the CloudBase Web SDK this site uses. Keeping them narrow lets tests
// replace the SDK and documents exactly which service behaviour the site relies on.
export interface CloudbaseAuthError { code?: string; category?: string; message?: string }
export type CloudbaseAuthResult<T extends object> =
  | { data: T; error: null }
  | { data: { [K in keyof T]: null }; error: CloudbaseAuthError };
export interface CloudbaseUser { id: string; email?: string | null; user_metadata?: { name?: unknown; nickName?: unknown } }
type CodeCallback = (params: { token: string; messageId?: string }) => Promise<CloudbaseAuthResult<{ user?: CloudbaseUser | null }>>;
type PasswordCallback = (params: { nonce: string; password: string }) => Promise<CloudbaseAuthResult<{ user?: CloudbaseUser | null }>>;
export interface CloudbaseAuth {
  getSession(): Promise<CloudbaseAuthResult<{ user?: CloudbaseUser | null }>>;
  refreshSession(): Promise<CloudbaseAuthResult<{ user?: CloudbaseUser | null }>>;
  onAuthStateChange(callback: (event: string) => void): { data: { subscription: { unsubscribe(): void } } };
  signInWithPassword(params: { email: string; password: string }): Promise<CloudbaseAuthResult<{ user?: CloudbaseUser | null }>>;
  signUp(params: { email: string; password: string; name: string }): Promise<CloudbaseAuthResult<{ verifyOtp?: CodeCallback }>>;
  resend(params: { type: "signup"; email: string }): Promise<CloudbaseAuthResult<{ messageId?: string | null }>>;
  resetPasswordForEmail(email: string): Promise<CloudbaseAuthResult<{ updateUser?: PasswordCallback | null }>>;
  // Resolves with `{ error }` at run time, although the SDK's own types say otherwise.
  signOut(): Promise<unknown>;
}
export type CloudbaseRecord = Record<string, unknown>;
// Database calls report service errors in `code` when the SDK is configured not to throw.
export interface CloudbaseResult { code?: string; message?: string }
export interface CloudbaseQuery {
  watch(options: { onChange(snapshot: { docs: CloudbaseRecord[] }): void; onError(error: unknown): void }): { close(): void };
  update(data: CloudbaseRecord): Promise<CloudbaseResult & { updated?: number }>;
}
export interface CloudbaseCollection extends CloudbaseQuery {
  doc(id: string): {
    get(): Promise<CloudbaseResult & { data?: CloudbaseRecord[] | CloudbaseRecord | null }>;
    set(data: CloudbaseRecord): Promise<CloudbaseResult>;
    remove(): Promise<CloudbaseResult>;
  };
  where(query: CloudbaseRecord): CloudbaseQuery;
  add(data: CloudbaseRecord): Promise<CloudbaseResult>;
}
export interface CloudbaseDatabase {
  collection(name: string): CloudbaseCollection;
  command: { set(value: unknown): unknown; remove(): unknown; exists(value: boolean): unknown };
}
export interface CloudbaseApp {
  auth: CloudbaseAuth;
  database(): CloudbaseDatabase;
  callFunction(options: { name: string; data: CloudbaseRecord }): Promise<CloudbaseResult & { result?: unknown }>;
}

let loading: Promise<CloudbaseApp> | undefined;
export function getCloudbaseApp(): Promise<CloudbaseApp> {
  const config = cloudbaseConfiguration.config;
  if (!config) return Promise.reject(new Error(cloudbaseConfiguration.error));
  // The SDK is downloaded only when a CloudBase deployment first needs it.
  if (!loading) {
    loading = Promise.all([
      import("@cloudbase/js-sdk/app"),
      import("@cloudbase/js-sdk/auth"),
      import("@cloudbase/js-sdk/database"),
      import("@cloudbase/js-sdk/realtime"),
      import("@cloudbase/js-sdk/functions"),
    ]).catch(() => {
      throw new Error("无法加载云开发组件，请检查网络后重新载入页面。");
    }).then(([{ default: cloudbase }, { registerAuth }, { registerDatabase }, { registerRealtime }, { registerFunctions }]) => {
      // A module also registers itself when it loads after the SDK core; the console then
      // warns of a duplicate component, which is harmless. Registering here covers either order.
      registerAuth(cloudbase);
      registerDatabase(cloudbase);
      // watch() needs the realtime module; the database module refuses to watch without it.
      registerRealtime(cloudbase);
      registerFunctions(cloudbase);
      // Assigned without a cast, so the compiler checks these types against the SDK's own.
      const app: CloudbaseApp = cloudbase.init({ ...config, persistence: "local" });
      return app;
    });
    // A failed download can be retried by the next caller.
    loading.catch(() => { loading = undefined; });
  }
  return loading;
}
