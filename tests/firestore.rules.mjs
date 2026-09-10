import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { before, beforeEach, after, test } from 'node:test';
import { initializeTestEnvironment, assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { collection, collectionGroup, deleteDoc, deleteField, doc, getDoc, getDocs, serverTimestamp, setDoc, setLogLevel, updateDoc, writeBatch } from 'firebase/firestore';

// Never connect this suite to a real project or to an implicitly selected host.
const projectId = 'demo-antico-council';
assert.equal(process.env.FIRESTORE_EMULATOR_HOST, '127.0.0.1:8088', 'Run test:rules with the configured local Firestore emulator.');
setLogLevel('silent');
const now = '2026-09-10T12:00:00.000Z';
const ownerEmail = 'yulun8964@gmail.com';
let env;
const account = (uid, email = `${uid}@example.test`, verified = true) => env.authenticatedContext(uid, { email, email_verified: verified }).firestore();
const ref = (db, path) => doc(db, path);
const meeting = (id = 'meeting-a') => ({ id, title: '例会', date: '2026-09-10', week: '星期四', summary: '', createdAt: now, issueIds: [] });
const issue = (id = 'issue-a', extra = {}) => ({ id, title: '待讨论议题', category: '组织', priority: 'medium', status: 'agenda', description: '提案背景', discussion: '', signature: '', createdAt: now, updatedAt: now, archived: false, meetingId: 'meeting-a', ...extra });
const attendance = (id = 'attendance-a', extra = {}) => ({ id, meetingId: 'meeting-a', memberId: 'member', memberName: '成员', checkedInAt: now, reportStatus: 'pending', reportNote: '', ...extra });
const fixtures = {
  meetings: meeting('record'),
  issues: issue('record'),
  members: { id: 'record', name: '成员', role: '成员', avatarSymbol: '成' },
  activities: { id: 'record', name: '读书会', time: '2026-09-10', organizer: '成员', participants: '全体' },
  attendance: attendance('record'),
  editorial: { id: 'record', title: '稿件', department: '微信编辑部', author: '', editor: '', designer: '', dueDate: '', status: '选题', notes: '' },
  assets: { id: 'record', title: '资料', kind: '美工素材', author: '', tags: '', url: '', fileName: '', fileData: '', notes: '', updatedAt: now },
  inventory: { id: 'record', title: '物资', location: '', keeper: '', notes: '', quantity: 0 },
};
const seed = (rows) => env.withSecurityRulesDisabled(async context => {
  const batch = writeBatch(context.firestore());
  for (const [path, data] of Object.entries(rows)) batch.set(ref(context.firestore(), path), data);
  await batch.commit();
});
before(async () => {
  env = await initializeTestEnvironment({ projectId, firestore: { host: '127.0.0.1', port: 8088, rules: readFileSync(new URL('../firestore.rules', import.meta.url), 'utf8') } });
});
beforeEach(async () => {
  await env.clearFirestore();
  await seed({
    'workspaceAccess/member': { name: '成员', email: 'member@example.test', role: 'member', active: true },
    'workspaceAccess/other': { name: '另一成员', email: 'other@example.test', role: 'member', active: true },
    'workspaceAccess/admin': { name: '管理员', email: 'admin@example.test', role: 'admin', active: true },
    'workspaceAccess/refused': { name: '停用', email: 'refused@example.test', role: 'member', active: false },
    'meetings/meeting-a': meeting(),
    'issues/issue-a': issue(),
    'privateVotes/round-a': { issueId: 'issue-a', roundId: 'round-a', status: 'open', rule: 'simple', counts: { approve: 1, reject: 0, abstain: 0 }, createdAt: now, createdBy: 'admin' },
    'privateVotes/round-a/ballots/member': { choice: 'approve', createdAt: now },
    'privateVotes/round-a/ballots/admin': { choice: 'reject', createdAt: now },
    'legacyVoteArchives/issue-a': { issueId: 'issue-a', originalFields: { ballots: { member: 'approve' } } },
  });
});
after(async () => { await env?.cleanup(); });

test('approved member, administrator and owner can read all business collections', async () => {
  for (const db of [account('member'), account('admin'), account('owner', ownerEmail)]) {
    for (const name of Object.keys(fixtures)) await assertSucceeds(getDocs(collection(db, name)));
  }
});
test('anonymous, pending, refused, unverified and mismatched-email users cannot read or write business records', async () => {
  const databases = [env.unauthenticatedContext().firestore(), account('pending'), account('refused'), account('member', 'member@example.test', false), account('member', 'forged@example.test'), account('owner', ownerEmail, false)];
  for (const db of databases) {
    await assertFails(getDoc(ref(db, 'issues/issue-a')));
    await assertFails(setDoc(ref(db, 'members/record'), fixtures.members));
  }
});
test('approved user can get only their own private ballot; administrators and owner cannot inspect other ballots', async () => {
  await assertSucceeds(getDoc(ref(account('member'), 'privateVotes/round-a/ballots/member')));
  await assertSucceeds(getDoc(ref(account('admin'), 'privateVotes/round-a/ballots/admin')));
  for (const db of [account('other'), account('admin'), account('owner', ownerEmail), account('refused'), account('pending'), env.unauthenticatedContext().firestore()]) {
    await assertFails(getDoc(ref(db, 'privateVotes/round-a/ballots/member')));
  }
});
test('no client can list ballots, inspect round counts or read legacy identities', async () => {
  for (const db of [account('member'), account('admin'), account('owner', ownerEmail)]) {
    await assertFails(getDocs(collection(db, 'privateVotes/round-a/ballots')));
    await assertFails(getDocs(collectionGroup(db, 'ballots')));
    await assertFails(getDoc(ref(db, 'privateVotes/round-a')));
    await assertFails(getDocs(collection(db, 'privateVotes')));
    await assertFails(getDoc(ref(db, 'legacyVoteArchives/issue-a')));
    await assertFails(getDocs(collection(db, 'legacyVoteArchives')));
  }
});
test('all private vote and legacy archive mutations are server-only, including own ballot', async () => {
  for (const db of [account('member'), account('admin'), account('owner', ownerEmail)]) {
    for (const path of ['privateVotes/round-a', 'privateVotes/round-a/ballots/member', 'legacyVoteArchives/issue-a']) {
      await assertFails(setDoc(ref(db, path), { choice: 'reject' }));
      await assertFails(updateDoc(ref(db, path), { changed: true }));
      await assertFails(deleteDoc(ref(db, path)));
    }
    await assertFails(setDoc(ref(db, 'privateVotes/new-round/ballots/new-user'), { choice: 'approve', createdAt: now }));
  }
});
test('eight business collections accept complete valid records and reject wrong or reserved IDs', async () => {
  const db = account('member');
  for (const [name, data] of Object.entries(fixtures)) {
    await assertSucceeds(setDoc(ref(db, `${name}/record`), data));
    await assertFails(updateDoc(ref(db, `${name}/record`), { id: 'different-id' }));
    // Firestore itself rejects double-underscore reserved IDs before Rules run.
    await assert.rejects(setDoc(ref(db, `${name}/__proto__`), { ...data, id: '__proto__' }), { code: 'invalid-argument' });
    for (const id of ['constructor', 'prototype']) await assertFails(setDoc(ref(db, `${name}/${id}`), { ...data, id }));
  }
});
test('missing required fields and wrong field types are rejected at the rules boundary', async () => {
  const db = account('member');
  const fields = { meetings: 'summary', issues: 'discussion', members: 'avatarSymbol', activities: 'participants', attendance: 'reportNote', editorial: 'designer', assets: 'fileData', inventory: 'notes' };
  for (const [name, field] of Object.entries(fields)) {
    const missing = { ...fixtures[name] }; delete missing[field];
    await assertFails(setDoc(ref(db, `${name}/record`), missing));
    await assertFails(setDoc(ref(db, `${name}/record`), { ...fixtures[name], [field]: { malformed: true } }));
  }
});
test('invalid enums, optional strings and malformed dates are rejected', async () => {
  const cases = [
    ['meetings', { date: 'tomorrow' }], ['meetings', { regularReport: [] }],
    ['issues', { priority: 'unknown' }], ['issues', { status: 'unknown' }], ['issues', { archived: 'false' }], ['issues', { dueDate: 123 }], ['issues', { meetingId: {} }],
    ['activities', { status: 'unknown' }], ['activities', { description: 12 }],
    ['attendance', { reportStatus: 'unknown' }], ['attendance', { reportedAt: false }],
    ['editorial', { department: '不存在编辑部' }], ['editorial', { status: 'unknown' }], ['assets', { kind: 'unknown' }],
  ];
  const db = account('member');
  for (const [name, patch] of cases) await assertFails(setDoc(ref(db, `${name}/record`), { ...fixtures[name], ...patch }));
});
test('inventory quantity is a nonnegative safe integer, including update validation', async () => {
  const db = account('member');
  await assertSucceeds(setDoc(ref(db, 'inventory/record'), { ...fixtures.inventory, quantity: Number.MAX_SAFE_INTEGER }));
  for (const quantity of [-1, 0.5, Number.MAX_SAFE_INTEGER + 1, NaN, Infinity, '2', null]) await assertFails(updateDoc(ref(db, 'inventory/record'), { quantity }));
});
test('asset attachments and external links reject unsafe or oversized payloads', async () => {
  const db = account('member');
  await assertSucceeds(setDoc(ref(db, 'assets/record'), { ...fixtures.assets, url: 'https://example.test/reference', fileData: 'data:image/png;base64,YQ==' }));
  for (const url of ['http://localhost:3000/path', 'https://192.168.1.1:65535/', 'https://example.test/path?q=1#reference']) await assertSucceeds(updateDoc(ref(db, 'assets/record'), { url }));
  for (const patch of [{ url: 'javascript:alert(1)' }, { fileData: 'data:text/html;base64,YQ==' }, { fileData: 'data:image/svg+xml;base64,YQ==' }, { fileData: 'data:image/png;base64,???' }, { fileData: `data:image/png;base64,${'a'.repeat(550000)}` }]) {
    await assertFails(updateDoc(ref(db, 'assets/record'), patch));
  }
});
test('issue creation requires agenda and excludes every protected voting field', async () => {
  const db = account('member');
  for (const [field, value] of Object.entries({ ballots: {}, voters: {}, votes: { approve: 0, reject: 0, abstain: 0 }, voteMode: 'manual', voteRule: 'simple', voteRoundId: '', voteClosedAt: '' })) {
    await assertFails(setDoc(ref(db, 'issues/new'), issue('new', { [field]: value })));
  }
  for (const status of ['voting', 'passed', 'rejected', 'authorization', 'execution', 'completed']) await assertFails(setDoc(ref(db, 'issues/new'), issue('new', { status })));
});
test('members, administrators and owner cannot add, change or remove issue voting fields', async () => {
  await seed({ 'issues/closed': issue('closed', { status: 'passed', voteMode: 'private', voteRoundId: 'round-a', voteRule: 'simple', voteClosedAt: now, votes: { approve: 1, reject: 0, abstain: 0 } }) });
  for (const db of [account('member'), account('admin'), account('owner', ownerEmail)]) {
    for (const patch of [{ ballots: {} }, { voters: {} }, { votes: { approve: 999, reject: 0, abstain: 0 } }, { voteMode: 'manual' }, { voteRoundId: 'round-b' }, { voteRule: 'absolute' }, { voteClosedAt: 'changed' }]) {
      await assertFails(updateDoc(ref(db, 'issues/closed'), patch));
      await assertFails(updateDoc(ref(db, 'issues/issue-a'), patch));
    }
    for (const field of ['votes', 'voteMode', 'voteRoundId', 'voteRule', 'voteClosedAt']) await assertFails(updateDoc(ref(db, 'issues/closed'), { [field]: deleteField() }));
  }
});
test('proposal identity fields freeze during voting and after private or legacy voting', async () => {
  const db = account('member');
  for (const [id, patch] of Object.entries({ live: { status: 'voting' }, private: { status: 'passed', voteMode: 'private', voteRoundId: 'round-a' }, legacy: { status: 'rejected', voteMode: 'legacy' } })) {
    await seed({ [`issues/${id}`]: issue(id, patch) });
    for (const field of ['title', 'description', 'category']) await assertFails(updateDoc(ref(db, `issues/${id}`), { [field]: '更改提案' }));
    await assertFails(updateDoc(ref(db, `issues/${id}`), { meetingId: null }));
    await assertSucceeds(updateDoc(ref(db, `issues/${id}`), { discussion: '补充执行记录', priority: 'high', updatedAt: now }));
  }
});
test('client issue status transitions match the application state machine', async () => {
  const transitions = { agenda: ['agenda', 'execution'], voting: ['voting'], passed: ['passed', 'authorization'], rejected: ['rejected'], authorization: ['authorization', 'execution'], execution: ['execution', 'completed'], completed: ['completed'] };
  const db = account('member');
  for (const [before, allowed] of Object.entries(transitions)) {
    for (const next of Object.keys(transitions)) {
      await seed({ 'issues/state': issue('state', { status: before }) });
      const attempt = updateDoc(ref(db, 'issues/state'), { status: next });
      await (allowed.includes(next) ? assertSucceeds(attempt) : assertFails(attempt));
    }
  }
});
test('voting cannot be newly archived, but a legacy archived voting issue can be restored', async () => {
  await seed({ 'issues/live': issue('live', { status: 'voting' }), 'issues/hidden': issue('hidden', { status: 'voting', archived: true }) });
  const db = account('member');
  await assertFails(updateDoc(ref(db, 'issues/live'), { archived: true, archivedAt: now }));
  await assertSucceeds(updateDoc(ref(db, 'issues/hidden'), { archived: false }));
});
test('issue edits cannot change creation time or insert unrecognized fields', async () => {
  const db = account('member');
  await assertFails(updateDoc(ref(db, 'issues/issue-a'), { createdAt: 'rewritten' }));
  await assertFails(updateDoc(ref(db, 'issues/issue-a'), { unexpected: true }));
  await assertSucceeds(updateDoc(ref(db, 'issues/issue-a'), { title: '改进提案', archived: true, archivedAt: now, serialNumber: '2026-001' }));
});
test('issue and attendance creation or parent changes require an existing meeting; unassigned issues are allowed', async () => {
  const db = account('member');
  await assertFails(setDoc(ref(db, 'issues/missing'), issue('missing', { meetingId: 'missing' })));
  await assertFails(setDoc(ref(db, 'attendance/missing'), attendance('missing', { meetingId: 'missing' })));
  await assertSucceeds(setDoc(ref(db, 'issues/unassigned'), issue('unassigned', { meetingId: null })));
  await assertSucceeds(setDoc(ref(db, 'attendance/record'), attendance('record')));
  await assertFails(updateDoc(ref(db, 'issues/issue-a'), { meetingId: 'missing' }));
  await assertFails(updateDoc(ref(db, 'attendance/record'), { meetingId: 'missing' }));
  await assertFails(updateDoc(ref(db, 'issues/issue-a'), { meetingId: '../meeting-a' }));
});
test('getAfter allows a new meeting and its issue and attendance in one atomic batch', async () => {
  const db = account('member');
  const batch = writeBatch(db);
  batch.set(ref(db, 'meetings/new'), meeting('new'));
  batch.set(ref(db, 'issues/new'), issue('new', { meetingId: 'new' }));
  batch.set(ref(db, 'attendance/new'), attendance('new', { meetingId: 'new' }));
  await assertSucceeds(batch.commit());
});
test('unchanged legacy missing parents do not block unrelated issue or attendance repairs', async () => {
  await seed({ 'issues/orphan': issue('orphan', { meetingId: 'old-missing' }), 'attendance/orphan': attendance('orphan', { meetingId: 'old-missing' }) });
  const db = account('member');
  await assertSucceeds(updateDoc(ref(db, 'issues/orphan'), { discussion: '补充旧记录' }));
  await assertSucceeds(updateDoc(ref(db, 'attendance/orphan'), { reportNote: '补充旧记录' }));
  await assertFails(updateDoc(ref(db, 'issues/orphan'), { meetingId: 'another-missing' }));
  await assertFails(updateDoc(ref(db, 'attendance/orphan'), { meetingId: 'another-missing' }));
});
test('meetings issueIds must start empty and remain unchanged, including legacy lists', async () => {
  const db = account('member');
  for (const issueIds of [['issue-a'], [{ invalid: true }], 'issue-a']) await assertFails(setDoc(ref(db, 'meetings/new'), { ...meeting('new'), issueIds }));
  for (const issueIds of [['issue-a'], [{ invalid: true }]]) await assertFails(updateDoc(ref(db, 'meetings/meeting-a'), { issueIds }));
  await seed({ 'meetings/legacy': { ...meeting('legacy'), issueIds: ['old-issue'] } });
  await assertSucceeds(updateDoc(ref(db, 'meetings/legacy'), { title: '历史例会修正' }));
  await assertFails(updateDoc(ref(db, 'meetings/legacy'), { issueIds: [] }));
});
test('all client meeting deletions and voted issue deletions are denied, even for owner', async () => {
  await seed({ 'issues/live': issue('live', { status: 'voting' }), 'issues/private': issue('private', { status: 'passed', voteRoundId: 'round-a' }), 'issues/legacy': issue('legacy', { status: 'agenda', voteMode: 'legacy' }) });
  for (const db of [account('member'), account('admin'), account('owner', ownerEmail)]) {
    for (const path of ['meetings/meeting-a', 'issues/live', 'issues/private', 'issues/legacy']) await assertFails(deleteDoc(ref(db, path)));
  }
  await assertSucceeds(deleteDoc(ref(account('member'), 'issues/issue-a')));
});
test('ordinary record deletion still works for approved members', async () => {
  const db = account('member');
  for (const name of ['members', 'activities', 'attendance', 'editorial', 'assets', 'inventory']) {
    await seed({ [`${name}/record`]: fixtures[name] });
    await assertSucceeds(deleteDoc(ref(db, `${name}/record`)));
  }
});
test('member can inspect only their own access record while admin and owner can list', async () => {
  await assertSucceeds(getDoc(ref(account('member'), 'workspaceAccess/member')));
  await assertSucceeds(getDoc(ref(account('refused'), 'workspaceAccess/refused')));
  await assertFails(getDoc(ref(account('member'), 'workspaceAccess/other')));
  await assertFails(getDocs(collection(account('member'), 'workspaceAccess')));
  await assertSucceeds(getDocs(collection(account('admin'), 'workspaceAccess')));
  await assertSucceeds(getDocs(collection(account('owner', ownerEmail), 'workspaceAccess')));
});
test('pending users can request access only for themselves and refused users cannot reapply', async () => {
  const pending = account('pending');
  const request = { name: '申请人', email: 'pending@example.test', requestedAt: serverTimestamp() };
  await assertSucceeds(setDoc(ref(pending, 'accessRequests/pending'), request));
  await assertFails(setDoc(ref(pending, 'accessRequests/another'), request));
  await assertFails(setDoc(ref(pending, 'accessRequests/pending'), { ...request, role: 'admin' }));
  await assertFails(setDoc(ref(account('refused'), 'accessRequests/refused'), { ...request, email: 'refused@example.test' }));
  await assertFails(setDoc(ref(account('unverified', 'unverified@example.test', false), 'accessRequests/unverified'), { ...request, email: 'unverified@example.test' }));
});
test('admin can approve a matching request as member; only owner can appoint another admin', async () => {
  await seed({ 'accessRequests/pending': { name: '申请人', email: 'pending@example.test', requestedAt: new Date() } });
  const access = { name: '申请人', email: 'pending@example.test', role: 'member', active: true };
  await assertFails(setDoc(ref(account('member'), 'workspaceAccess/pending'), access));
  await assertFails(setDoc(ref(account('admin'), 'workspaceAccess/no-request'), { ...access, email: 'no-request@example.test' }));
  await assertFails(setDoc(ref(account('admin'), 'workspaceAccess/pending'), { ...access, email: 'forged@example.test' }));
  await assertFails(setDoc(ref(account('admin'), 'workspaceAccess/pending'), { ...access, role: 'admin' }));
  await assertSucceeds(setDoc(ref(account('admin'), 'workspaceAccess/pending'), access));
  await assertSucceeds(updateDoc(ref(account('owner', ownerEmail), 'workspaceAccess/pending'), { role: 'admin' }));
});
test('administrators cannot elevate themselves or other administrators, rewrite emails, or delete access history', async () => {
  const admin = account('admin');
  await assertFails(updateDoc(ref(admin, 'workspaceAccess/admin'), { active: false }));
  await assertFails(updateDoc(ref(admin, 'workspaceAccess/member'), { role: 'admin' }));
  await assertFails(updateDoc(ref(admin, 'workspaceAccess/member'), { email: 'changed@example.test' }));
  await assertSucceeds(updateDoc(ref(admin, 'workspaceAccess/member'), { active: false }));
  await assertFails(deleteDoc(ref(admin, 'workspaceAccess/member')));
  await assertFails(deleteDoc(ref(account('owner', ownerEmail), 'workspaceAccess/member')));
});
