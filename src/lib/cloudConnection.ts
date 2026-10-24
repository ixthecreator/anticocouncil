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
