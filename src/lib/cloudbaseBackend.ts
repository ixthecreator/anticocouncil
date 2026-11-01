import {
  approveWorkspaceRequest, cloudbaseAccessError, declineWorkspaceRequest, loginWithEmail, logoutCloudbase,
  observeCloudbaseAuthentication, refreshCloudbaseAuthentication, registerWithEmail, requestPasswordReset,
  requestWorkspaceAccess, resendVerification, updateWorkspaceMember, watchOwnWorkspaceAccess, watchWorkspaceMembership,
} from "./cloudbaseAccess";
import { cloudbaseConfiguration } from "./cloudbaseApp";
import { changeRecord, cloudbaseErrorMessage, importRecords, removeRecord, saveRecord, subscribeToCollection } from "./cloudbaseData";
import type { CloudBackend } from "./cloudBackend";

// Tencent CloudBase, reachable from mainland China. Accounts confirm their email with a
// code, membership changes go through a cloud function, and votes keep only totals.
export const cloudbaseBackend: CloudBackend = {
  configurationError: cloudbaseConfiguration.error,
  emailProof: "code",
  namedBallots: false,
  accessErrorMessage: cloudbaseAccessError,
  dataErrorMessage: cloudbaseErrorMessage,

  observeAuthentication: observeCloudbaseAuthentication,
  loginWithEmail,
  registerWithEmail,
  resendVerification,
  refreshAuthentication: refreshCloudbaseAuthentication,
  requestPasswordReset,
  logout: logoutCloudbase,

  watchOwnAccess: watchOwnWorkspaceAccess,
  watchMembership: watchWorkspaceMembership,
  requestAccess: requestWorkspaceAccess,
  approveRequest: approveWorkspaceRequest,
  declineRequest: declineWorkspaceRequest,
  updateMember: updateWorkspaceMember,

  subscribeCollection: (name, onRows, onError) => subscribeToCollection(name, onRows, onError),
  saveRecord,
  removeRecord,
  changeRecord,
  importRecords,
};
