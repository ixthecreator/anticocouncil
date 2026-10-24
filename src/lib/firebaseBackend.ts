import {
  approveWorkspaceRequest, cancelGoogleLogin, cloudAccessError, declineWorkspaceRequest, getCloudAuth,
  loginWithEmail, loginWithGoogle, logoutCloud, observeCloudAuthentication, refreshCloudAuthentication,
  registerWithEmail, requestPasswordReset, requestWorkspaceAccess, resendVerification, setSitePassword,
  updateWorkspaceMember, watchOwnWorkspaceAccess, watchWorkspaceMembership,
} from "./cloudAccess";
import type { CloudBackend } from "./cloudBackend";
import {
  changeDoc, firebaseConfiguration, firebaseErrorMessage, importDocs, removeDoc, saveDoc, subscribeToCollection,
} from "./firebase";

export const firebaseBackend: CloudBackend = {
  configurationError: firebaseConfiguration.error,
  accessErrorMessage: cloudAccessError,
  dataErrorMessage: firebaseErrorMessage,

  observeAuthentication: onChange => observeCloudAuthentication(getCloudAuth(), onChange),
  loginWithEmail: async (email, password) => { await loginWithEmail(email, password); },
  registerWithEmail,
  resendVerification,
  refreshAuthentication: refreshCloudAuthentication,
  requestPasswordReset,
  setSitePassword,
  logout: logoutCloud,
  googleLogin: { start: loginWithGoogle, cancel: cancelGoogleLogin },

  watchOwnAccess: watchOwnWorkspaceAccess,
  watchMembership: watchWorkspaceMembership,
  requestAccess: requestWorkspaceAccess,
  approveRequest: approveWorkspaceRequest,
  declineRequest: declineWorkspaceRequest,
  updateMember: updateWorkspaceMember,

  subscribeCollection: subscribeToCollection,
  saveRecord: saveDoc,
  removeRecord: removeDoc,
  changeRecord: changeDoc,
  importRecords: importDocs,
};
