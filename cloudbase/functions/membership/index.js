"use strict";
// Entry point of the CloudBase function `membership`. Deployment: docs/cloudbase.md.
const cloudbase = require("@cloudbase/node-sdk");
const { createMembership } = require("./membership");

const app = cloudbase.init({ env: cloudbase.SYMBOL_CURRENT_ENV });
const db = app.database();
// Far above the council's size; the server returns at most 1000 records per read.
const LIST_LIMIT = 1000;

// The SDK reports a failed request in `code` instead of throwing it.
function checked(result) {
  if (result && result.code) throw Object.assign(new Error(result.message || result.code), { code: result.code });
  return result;
}
// Outside a transaction a read returns a list; inside one, the record or null.
function single(result) {
  const data = checked(result).data;
  const row = Array.isArray(data) ? data[0] : data;
  return row && typeof row === "object" ? row : null;
}

const store = {
  get: async (name, id) => single(await db.collection(name).doc(id).get()),
  list: async name => checked(await db.collection(name).limit(LIST_LIMIT).get()).data || [],
  remove: async (name, id) => { checked(await db.collection(name).doc(id).remove()); },
  transaction: work => db.runTransaction(async transaction => work({
    get: async (name, id) => single(await transaction.collection(name).doc(id).get()),
    set: async (name, id, data) => { checked(await transaction.collection(name).doc(id).set(data)); },
    update: async (name, id, data) => { checked(await transaction.collection(name).doc(id).update(data)); },
    remove: async (name, id) => { checked(await transaction.collection(name).doc(id).remove()); },
  })),
};
const run = createMembership(store);

async function callerUid(auth, context) {
  try {
    const { uid } = await auth.getAuthContext(context);
    if (uid) return String(uid);
  } catch {
    // Older runtimes keep the caller only in the process environment.
  }
  return String(auth.getUserInfo().uid || "");
}
// The email comes from the account service, never from the request.
async function caller(context) {
  const auth = app.auth();
  const uid = await callerUid(auth, context);
  if (!uid) return null;
  const info = checked(await auth.getEndUserInfo(uid)).userInfo || {};
  const text = value => typeof value === "string" ? value.trim() : "";
  return { uid, email: text(info.email), name: text(info.nickName) || text(info.name) || text(info.username) };
}

exports.main = async (event, context) => {
  let account;
  try {
    account = await caller(context);
  } catch (error) {
    console.error("membership caller lookup failed", error);
    return { ok: false, message: "成员服务暂时无法确认当前账号，请稍后重试。" };
  }
  return run(account, event);
};
