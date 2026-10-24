import type { AccessActor, AccessRequest, AccessRole, CloudIdentity, WorkspaceAccess } from "./accessPolicy";
import type { SnapshotState } from "./cloudConnection";
import { firebaseBackend } from "./firebaseBackend";

// Everything the workspace needs from its cloud service. Components and hooks use
// only this contract, so a different service can replace Firebase in one place.
export interface CloudAuthenticationState {
  identity: CloudIdentity | null;
  ready: boolean;
  error: string;
  redirectError: string;
  redirectPending: boolean;
}
export interface OwnAccessListener {
  // `confirmed` is false for a cached record or a local write the server has not
  // accepted yet; such a record never grants access.
  access(access: WorkspaceAccess | null, confirmed: boolean): void;
  accessError(error: unknown): void;
  // Reports only answers from the server.
  request(request: AccessRequest | null): void;
  requestError(error: unknown): void;
}
export interface MembershipListener {
  members(members: WorkspaceAccess[]): void;
  requests(requests: AccessRequest[]): void;
  error(error: unknown): void;
}
export interface CloudBackend {
  // Empty when the deployment is configured for this service.
  configurationError: string;
  accessErrorMessage(error: unknown): string;
  dataErrorMessage(error: unknown): string;

  observeAuthentication(onChange: (state: CloudAuthenticationState) => void): () => void;
  loginWithEmail(email: string, password: string): Promise<void>;
  registerWithEmail(name: string, email: string, password: string): Promise<void>;
  resendVerification(): Promise<void>;
  refreshAuthentication(): Promise<void>;
  requestPasswordReset(email: string): Promise<void>;
  setSitePassword(password: string, confirmation: string, expectedIdentity: Pick<CloudIdentity, "uid" | "email">): Promise<void>;
  logout(): Promise<void>;
  // Present only when the service offers Google sign-in.
  googleLogin?: { start(): Promise<void>; cancel(): void };

  watchOwnAccess(uid: string, listener: OwnAccessListener): () => void;
  watchMembership(listener: MembershipListener): () => void;
  requestAccess(name: string): Promise<void>;
  approveRequest(uid: string): Promise<void>;
  declineRequest(uid: string): Promise<void>;
  updateMember(actor: AccessActor, target: WorkspaceAccess, changes: { active?: boolean; role?: AccessRole }): Promise<void>;

  subscribeCollection(name: string, onRows: (rows: any[], state: SnapshotState) => void, onError: (error: Error) => void): () => void;
  saveRecord(name: string, record: any): Promise<void>;
  removeRecord(name: string, id: string): Promise<void>;
  changeRecord(name: string, id: string, change: (record: any) => any): Promise<void>;
  importRecords(data: Record<string, any[]>): Promise<void>;
}

export const cloudBackend: CloudBackend = firebaseBackend;
