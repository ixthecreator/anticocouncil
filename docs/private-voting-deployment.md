# 私人投票部署、旧票迁移与恢复手册

本文是发布操作手册，**不表示生产部署、旧票迁移、凭据配置、IAM 授权或数据库备份已经执行**。检查日期：2026-09-10。操作员应为每次发布另外保存实际执行记录。

本次继续使用现有 Firebase Authentication 和 Cloud Firestore，目标项目为 `antico-council`，保持既有 `asia-east2` 数据库位置。发布前核实实际 database ID 和位置；不要新建数据库、搬迁地域或进行 Supabase 迁移。`asia-east2` 是位置，不能填写到 database ID 中。

代码入口：`api/voting.ts`、`server/firebaseAdmin.ts`、`server/votingService.ts`、`server/votingHttp.ts`；客户端入口为 `src/lib/privateVoting.ts`。旧票迁移是逐议题 API，没有启动时自动迁移、批量清库或自动结束投票的任务。

## 1. 发布必须同时满足的条件

| 条件 | 发布时应留下的证据 |
| --- | --- |
| 客户端、API、最终 Firestore Rules 使用同一版本 | Git commit、Vercel deployment ID、规则版本 |
| API 使用 Node 22 或更高兼容版本 | 项目 Node 设置及实际函数运行版本 |
| 服务端身份能验证 Firebase 用户并执行事务 | 隔离测试项目中的授权、撤销令牌、提交、结束测试 |
| 已完成独立、可恢复的数据库备份 | 备份位置、完成状态、清单校验、隔离恢复验证 |
| 旧 `issues` 已安全处理，未残留身份映射 | 管理端分页扫描结果、逐项迁移回执 |
| 普通用户和业务管理员均不能读取别人的私票 | 两个账号的 Firestore Rules 验收结果 |

缺服务端身份时，API 必须保持失败状态；不要临时开放 Firestore 写权限、把计票改回浏览器，或跳过令牌撤销检查来恢复按钮可用。

## 2. Vercel 运行环境

### Node 与构建

`firebase-admin@14.3.0` 的安装包要求 Node `>=22`。根 `package.json` 应固定 `"engines": { "node": "22.x" }`，或选择经过验证的更高版本。构建命令使用 Bun，不代表线上 Node 函数也使用 Bun。

服务端相对模块导入使用编译后 `.js` 扩展名；不要仅靠 Vite/打包器验证模块可加载。`test:server-runtime` 会独立编译入口，再由原生 Node 加载验证，避免“构建成功、函数启动失败”。

根目录 `api/voting.ts` 会作为 Vercel Node 函数单独构建，支持当前默认导出的 Node `request/response` handler。无需把它复制到 `dist`，也无需添加 Edge runtime。现有 Vite 静态输出与该函数可以共存；保留 `/__/auth/*` Firebase 代理、`/preview/` 演示和静态归档路由，避免新增覆盖 `/api/*` 的 SPA catch-all。[Vercel Node 运行时](https://vercel.com/docs/functions/runtimes/node-js)、[Node 版本设置](https://vercel.com/docs/functions/runtimes/node-js/node-js-versions)。

在无生产凭据的环境执行仓库验证：

```sh
bun install --frozen-lockfile
bun run lint
bun test
bun run test:server-runtime
bun run test:rules
bun run build
bun run check:public
```

同时运行 Firestore Rules 模拟器验收；纯服务层单元测试不能证明已经部署的规则正确。普通 `vite dev` 不启动 `api/voting.ts`，本地云端 API 联调应使用能够运行 Vercel Functions 的环境；浏览器 `/local` 演示不调用该 API。

### 环境变量

| 变量 | 设置与边界 |
| --- | --- |
| `VITE_FIREBASE_PROJECT_ID` | 前端和服务端都读取；生产必须指向已核实的 `antico-council`。它是公开配置，不是凭据。 |
| `VITE_FIREBASE_DATABASE_ID` | 填现有 database ID；未设置时为 `(default)`。不要填地域。 |
| `VITE_FIRESTORE_DATABASE_ID` | 兼容旧变量；仅在上一项未设置时使用。避免两个值不一致。 |
| `FIREBASE_SERVICE_ACCOUNT_JSON` | **仅服务端秘密**。当前实现支持完整服务账号 JSON；`project_id` 必须与上面的项目相同。通过 Vercel 的环境变量管理设置，不加入仓库、PR、终端历史或截图。 |
| `PRIVATE_VOTING_MAINTENANCE` | 初次迁移设为 `true` 并部署，普通写 API 返回 503；仅保留经认证的本人回执和管理员旧票迁移。完成规则和旧票验收后设为 `false` 并重新部署。 |
| `GOOGLE_APPLICATION_CREDENTIALS` | 使用既有 ADC 时指向服务器上实际可读取的凭据配置文件，不是 JSON 内容。不能假定开发机路径在线上也存在。 |
| `GOOGLE_CLOUD_PROJECT` / `GCLOUD_PROJECT` | 可不设置；若设置，必须与目标项目一致，服务端会检查。 |

当前优先读取显式 `FIREBASE_SERVICE_ACCOUNT_JSON`；未提供时使用 `applicationDefault()`。Vercel 本身不会自动提供 Google Cloud ADC。已有、经过验证的 ADC 可以复用；Vercel OIDC/WIF 还需另行接入，见最后一节。

私钥、服务账号 JSON、Google OAuth access token 均不得放在 `VITE_*` 变量中。生产也不得设置 `FIREBASE_AUTH_EMULATOR_HOST` 或 `FIRESTORE_EMULATOR_HOST`。现有 Google/邮箱登录配置、Auth domain 与回调代理继续沿用本项目配置。

Production、Preview、Development 分开配置。普通预览分支使用隔离测试项目和测试身份，不向所有预览部署分发生产数据库权限。环境变量改变后生成新部署并验证实际函数；不要只依据控制台中已保存的变量判断发布完成。

## 3. 最小 IAM 与三类管理员的区别

用户请求仍使用 **Firebase ID token**。服务端先 `verifyIdToken(token, true)`，检查令牌撤销及账号停用，再读取最新 `workspaceAccess/{uid}`；邮箱须已验证且与审批记录一致。`members` 是业务名册，不可替代 Auth UID。

`checkRevoked=true` 会读取用户记录。本版本 Admin SDK 的 `base-auth.js` 通过 `getUser()` 完成停用/撤销检查；官方用户查询 API 要求 `firebaseauth.users.get`。[Firebase 会话管理](https://firebase.google.com/docs/auth/admin/manage-sessions)、[accounts.lookup 权限](https://docs.cloud.google.com/identity-platform/docs/reference/rest/v1/accounts/lookup)。

针对当前 API，可由 IAM 管理员建立仅含以下权限的自定义运行角色；这是按当前实际 RPC 推导的最小权限集合，须在隔离项目验证：

| 权限 | 本服务用途 |
| --- | --- |
| `firebaseauth.users.get` | 验证当前用户是否停用、令牌是否撤销 |
| `datastore.databases.get` | 开始或回滚 Firestore 事务；此权限不是数据库元信息读取 |
| `datastore.entities.get` | 事务读取议题、审批、轮次、本人选票、旧档案 |
| `datastore.entities.list` | 查询会议关联的议题、签到记录；查询也需要 `entities.get` |
| `datastore.entities.create` | 创建轮次、一次性选票和旧票备份 |
| `datastore.entities.update` | 更新计数、结案状态、取消状态、移除旧公开身份字段 |
| `datastore.entities.delete` | 删除确认没有关联记录的会议 |

上述 Firestore 映射依据官方方法权限表；更便于管理的预定义角色组合是 `roles/datastore.user` 和 `roles/firebaseauth.viewer`，但范围比这个自定义集合更宽。[Firestore IAM](https://firebase.google.com/docs/firestore/security/iam)、[Firebase Auth 角色](https://docs.cloud.google.com/iam/docs/roles-permissions/firebaseauth)。

不需要给运行身份 `Owner`、`Editor`、`Firebase Admin`、Auth 用户修改权限、索引管理、导入导出、IAM 修改或服务账号密钥创建权限。本接口不签发 custom token，也不需要为此授予 `signBlob`。备份操作员和部署操作员使用另外的管理权限。

IAM 数据权限不能等同于“只准修改这一条会议”：应用层必须限制调用用途。可按官方指导进一步使用 database 级 IAM 条件，避免运行身份访问同项目其他数据库；不要声称 Firestore Rules 能限制 Admin SDK。[按数据库配置访问](https://firebase.google.com/docs/firestore/manage-databases)。

| 身份 | 能做什么 |
| --- | --- |
| 获批普通成员 | 提交本人一票、查看本人回执、结束后读取匿名汇总；保留原有会议编辑/安全删除权限 |
| 业务管理员 / 应用所有者 | 另外允许开始、结束、零票取消、旧票迁移和旧票结算；API 不提供查看他人票或进行中汇总的接口 |
| Google Cloud IAM / 平台运维管理员 | 可能直接读取数据库与备份，具有基础设施权限；需要单独控制访问与保管职责 |

“个人选票仅本人可见”是客户端与业务 API 的访问保证，**不是对平台超级管理员的密码学匿名保证**。Admin SDK 使用 IAM 并绕过 Firestore Rules；不能把业务管理员的页面权限当成平台权限隔离。[官方规则边界](https://firebase.google.com/docs/firestore/security/rules-conditions)。

## 4. 先建立可以恢复的数据库备份

页面下载的工作区 JSON 只覆盖业务数据，**不包含 `privateVotes`、其 `ballots` 子集合或 `legacyVoteArchives` 中的私人原始记录**。它不能恢复投票审计，也不能用于重建“某人已经投过票”的约束。不要把正式私票加进普通用户 JSON 下载来解决备份问题。

### 官方托管全量导出

已经获得计费授权、并已启用 Blaze 时，使用 Firestore 官方 managed export。选择整个数据库，可覆盖所有根集合与子集合；仅导出 `privateVotes` collection group 不会自动包含名为 `ballots` 的子集合。以下只是操作模板，不表示已执行：

```sh
gcloud firestore export 'gs://REPLACE_WITH_PRIVATE_BUCKET/REPLACE_WITH_RELEASE_PREFIX' \
  --project='antico-council' \
  --database='(default)'
```

先把 database ID、私有 bucket 和独立发布前缀替换成核实过的值。导出操作员需要相应导出权限；负责写 bucket 的 Firestore service agent 与投票运行服务账号是不同身份，按官方导出文档核对其权限。

托管导出需要启用计费，会有读取与存储费用；同一 Firebase 项目启用计费会转为 Blaze，**本次修复不自动授权这个变更**。导出不是开始时刻的严格快照，所以迁移备份期间应冻结写入。导出不包含 Auth 用户、Security Rules 或索引定义；这些配置须另存。[官方导入导出说明](https://firebase.google.com/docs/firestore/manage-data/export-import)。

导出成功后，记录 operation 完成状态、备份前缀、数据库 ID、时间和集合清单。先恢复到隔离环境验证 UID 文档路径、子集合和数据类型；正式恢复不能靠“下载文件成功”来证明可用。定时备份、PITR 和恢复也有独立计费条件，不能当作 Spark 免费功能默认开启。[Firestore 备份计费](https://firebase.google.com/docs/firestore/pricing)。

### 保持 Spark 时的边界

Spark 下不能运行上述托管导出。如果本次保持 Spark，迁移前须由受控运维流程制作并验证**管理员级逻辑备份**，而不是使用网站 JSON：

1. 冻结写入，使用授权的服务器 SDK/REST 分页遍历全部根集合、文档及所有子集合，保留完整文档路径。
2. 保留 Firestore 类型信息，包括 Timestamp、DocumentReference、GeoPoint、Bytes、整数等；不要直接把所有值做普通 `JSON.stringify` 后就认定可以无损恢复。
3. 至少包括所有业务集合、`workspaceAccess`、`accessRequests`、`privateVotes/*/ballots/*` 和 `legacyVoteArchives`；迁移前尚不存在的集合应在清单中记录为空。访问权限、规则、索引、环境配置另存，Auth 用户另行备份并保留 UID。
4. 将备份存于访问受限、加密的独立位置；记录清单、文档/子集合数量、校验值与时间。原数据库中的 `legacyVoteArchives` 不是独立灾备。
5. 使用同一工具在隔离环境恢复，核对路径、类型、数量和抽样内容。将读取消耗纳入 Spark 配额；耗尽配额不能被误判为“已备份全部数据”。

**本仓库当前未提供这个递归逻辑备份/恢复工具，也未验证生产备份。** 如果没有合格的既有工具，就先补齐并审核工具，或单独决定是否启用官方备份；不要跳过这一步直接修改唯一的生产数据。[Firestore 配额与计费功能边界](https://firebase.google.com/docs/firestore/quotas)。

## 5. 初次上线顺序：维护、dry-run、迁移、最终规则

只部署新 UI 不能让旧 `issues.ballots` 变私密；Firestore Rules 也不能把同一个可读文档的某个字段隐藏起来。必须先安全转存旧数据，并阻止旧页面在迁移后把身份映射重新写回。

### A. 冻结与准备

1. 确认目标项目、database ID、`asia-east2` 位置、当前规则、当前应用版本、实际用户/议题清单。README 中的旧计数不能用作生产清单。
2. 准备候选版本、最终规则和维护规则，先完成隔离测试。所有生产操作记录到访问受限的发布清单，不在 PR 中贴旧票、令牌或备份内容。
3. 进入维护窗口：阻止普通客户端读取/写入旧业务数据，至少冻结所有议题与关联数据写入，保留认证及必要的审批读取。维护规则必须去掉旧通配规则中对这些集合的宽泛授权；**额外添加一个 `allow write: if false` 不会覆盖另一个匹配规则的允许条件**。
4. 完成冻结状态下的独立备份。确认旧客户端、已打开的标签页和离线写入队列不能继续改写旧议题。
5. 在只允许发布操作员使用的受控环境验证新的生产目标 API。普通 Preview 不接生产凭据。先部署 `PRIVATE_VOTING_MAINTENANCE=true`，等待原部署的在途请求结束，再开始迁移；仅将前端按钮隐藏不足以冻结 Admin SDK。若这不是第一次上线、库中已有私人轮次，维护期间还必须阻止普通用户调用旧、新部署的写 API；仅冻结 Firestore 客户端规则不能阻止 Admin SDK 写入。未具备该隔离手段时不要开始迁移。

此时可以部署服务代码，但尚不能宣布私人投票上线。服务身份、管理员 Firebase 登录及 `workspaceAccess` 校验必须都通过；旧投票不自动开始新轮次。

### B. 每个议题先 dry-run

平台操作员从数据库分页读取议题清单。对所有含 `ballots`、`voters`、`votes` 或旧投票模式的议题逐项审查，不能只处理 `status='voting'`，已经通过、否决、执行、完成和归档的议题也可能携带身份映射。

通过经过认证的 API 调用以下 JSON。请求须携带当前管理员/所有者的 Firebase ID token，不能用 Firebase CLI 登录 token、Google OAuth token，或手工填写 UID 代替。

```http
POST /api/voting
Content-Type: application/json
Authorization: Bearer <由受控登录会话提供的 Firebase ID token>
```

```json
{ "action": "migrate-legacy", "issueId": "REPLACE_WITH_ISSUE_ID", "dryRun": true }
```

`dryRun` 省略时也是 `true`。成功返回 `migration`（`paused`、`closed`、`not-needed` 或 `already-migrated`）及需要处理时的字段名，不返回个人票，也不返回进行中的票数。清单记录议题 ID、迁移类型和成功/错误码即可。

本 PR 提供逐项 API；批量清单和受控调用工具由发布操作员准备并审查，不会自动扫描/迁移生产。不要跳过 HTTP 认证、构造一个假所有者身份后直接调用可注入的纯服务函数。

以下情况停止处理该项并人工核查：损坏或不完整的计数/选项、无法确定的旧计票模式、含旧票但状态为 `agenda` 或未知状态、既有私人 `voteRoundId`、备份与当前记录冲突。不要为了让脚本继续而删除数据、猜测选项或伪造 UID。

### C. 审核后逐项提交

只对已审核项发送：

```json
{ "action": "migrate-legacy", "issueId": "REPLACE_WITH_ISSUE_ID", "dryRun": false }
```

迁移在一个事务中创建 `legacyVoteArchives/{issueId}`，保存原状态、原始投票字段、按原模式得到的汇总、规则、操作时间和操作人；然后才修改可读议题。重复调用不会覆盖第一次备份。

| 旧议题 | 迁移后的行为 |
| --- | --- |
| 已结束：passed / rejected / authorization / execution / completed | 保持历史状态，标记 `voteMode:'legacy'`，保留匿名 `votes`，移除身份映射。不会用今天的规则重新改写历史通过/否决结果。 |
| 进行中：voting | 保持 `status:'voting'`，标记 `voteMode:'legacy'`，移除公开 `ballots` / `voters` / `votes`，暂停接收新票；原票和冻结汇总仅留在服务器档案。 |
| 没有旧投票数据 | no-op。 |

成员模式按原 `ballots` 统计，手动模式保留原手动 `votes`；两者不拼接、不推断补票。旧名册 ID 或姓名原样保存在私有档案中，不假装它们已经绑定 Firebase Auth UID。

正在进行的旧表决**不属于部署自动结案步骤**。迁移完成后，业务管理员另行决定是否调用：

```json
{ "action": "finish-legacy", "issueId": "REPLACE_WITH_ISSUE_ID" }
```

该操作使用服务器档案中的冻结汇总计算结果；没有有效票时拒绝结案，保持暂停，等待另行处理。不会自动判否决、重投或取消。新私人轮次也不能覆盖这些旧历史。

### D. 验证清理，再部署最终规则

平台操作员重新分页扫描全部 `issues`，确认没有残留 `ballots`、`voters` 或其他旧身份字段；进行中的 legacy 项不含公开 `votes`。核对每个已迁移 ID 都有对应私有档案、状态正确。不要只看 dry-run 成功数，也不要只根据客户端隐藏了某个按钮来判断完成。

然后部署并验证最终 Firestore Rules，至少保证：

- `privateVotes/{roundId}` 聚合文档、`legacyVoteArchives/{issueId}` 对客户端一律拒绝读写。
- `privateVotes/{roundId}/ballots/{uid}` 至多允许已获批本人 `get`；禁止 `list`，也禁止客户端 create/update/delete。业务管理员没有读取他人票的例外。
- 客户端不能新建旧 `ballots/voters`，不能改写投票轮次、规则、票数、结案时间或绕过 API 进入/退出投票状态；已开始投票的议题标题、说明、类别等投票对象字段被冻结。
- 禁止硬删除需要保留投票历史的议题。会议硬删除只走 API；关联议题/签到写入须检查提交后父会议存在，防止删除竞争造成孤儿记录。
- 原有通配 business collection 规则不能再为上述受保护集合提供另一条宽泛允许路径。

默认数据库可使用以下规则部署模板；命令应由有部署权限的操作员在核对项目与规则版本后执行。本次文档编写没有执行它：

```sh
firebase deploy --only firestore:rules --project antico-council
```

若实际使用命名数据库，先配置并核对 Firebase CLI 的目标映射；当前 `firebase.json` 的单一 rules 配置不能作为已经部署到命名库的证据。最终规则和迁移验证完成后，才解除维护、启用候选 UI/API。

过去已下载到浏览器、旧 JSON、截图或聊天中的公开选票无法通过数据库迁移收回。发布记录应准确写“已阻止今后的访问/改写”，不能写成“旧票从未公开”。

## 6. 上线验收与正常 API 契约

所有 POST 只接受规定字段；不接收客户端 UID、成员姓名、票数或结果。GET 只提供本人的回执。认证后的成功 JSON 为 `{ok:true,...}`，失败为 `{ok:false,error:{code,message}}`，带 `no-store`。

| 方法 / action | 参数 | 权限及结果 |
| --- | --- | --- |
| POST start | issueId, rule: simple / absolute | 管理员；agenda → voting，创建新的私人 roundId |
| POST cast | issueId, roundId, choice: approve / reject / abstain | 获批账号本人；只返回个人 choice/createdAt 与 alreadyCast |
| GET my-ballot | issueId, roundId | 获批账号本人；返回本人回执或 null |
| POST close | issueId, roundId | 管理员；至少一票，原子停止接收新票并写议题 votes/status/voteClosedAt；回执返回 status/votes/closedAt |
| POST cancel | issueId, roundId | 管理员；仅零票，议题回 agenda，空轮次保留 cancelled 审计；已有票拒绝 |
| POST delete-meeting | meetingId | 获批账号；关联议题或签到存在时拒绝，否则事务删除会议 |
| POST migrate-legacy | issueId, dryRun? | 管理员；默认 dry-run，详见迁移步骤 |
| POST finish-legacy | issueId | 管理员；仅对已暂停迁移的旧表决显式结算 |

先在隔离项目完成完整测试，再在发布维护窗口使用专门标注的验收议题进行有限冒烟，不拿真实议题制造测试票：

1. 普通成员不能 start/close/cancel/migrate；未审批、停用、未验证邮箱、错误项目 token 不能投票。
2. A、B 使用不同账号。A 投票后只能读取 A 的回执；B 和业务管理员直接 get A 的 ballot 或 list ballots 都被规则拒绝。
3. A 同时提交两次同选项只计一次；不同选项拒绝；网络回执丢失后同选项重试仍返回原 createdAt。
4. 进行中 API、客户端文档和导出均不出现实时汇总；结束后公布匿名总数。已结束轮次拒绝新票，close 与 cast 竞争时不存在“有回执却漏计”或“结案后新增”的情况。
5. 取消空轮次后留下 cancelled 审计；重新开始使用新的 roundId，旧 roundId 不能投票。首票与取消竞争只能有一个成功。
6. 邮箱登录、Google 登录、刷新直链、退出或切换账号期间的请求取消正常；读取本人回执失败时不能误当成“未投票”。
7. 有议题或签到的会议不能删除；删除空会议与新建关联记录竞争后，不存在指向已删除会议的记录。

记录版本、结果和错误码，不把请求的 Authorization、个人选项或旧票内容放入公开日志。投票业务管理员仍不能浏览 server-only 原始档案。

## 7. 常见失败与处理

| 现象 | 处理 |
| --- | --- |
| `/api/voting` 返回 HTML 或 404 | 核对 API 是否被 Vercel 构建，项目根目录是否正确，是否被 SPA rewrite 覆盖；普通 Vite dev 不提供这个函数。 |
| 503 `service-unavailable` | 核对服务端凭据、project/database ID、Node 版本、API/IAM 权限与 Google 上游连接；不要把私钥或 SDK 错误复制到前端。缺凭据不会自动退回公开投票。 |
| 401 `unauthenticated` | 用户 token 无效、过期、撤销或账号停用时重新确认登录；服务账号 IAM 故障不靠让用户反复登录解决。 |
| 403 `access-denied` / `admin-required` | 核对当前 Auth UID、已验证邮箱和最新 `workspaceAccess`；名册里有同名成员不等于账号已批准。 |
| 409 `already-voted` | 不能改票；同一选项可安全重试并读取原回执。 |
| 409 `round-mismatch` / `voting-closed` | 刷新议题，保留原票；不要用新 roundId 自动重投。 |
| 409 `legacy-voting` / `invalid-legacy-*` | 按旧票步骤核查；不要删除原票来让新轮次开始。 |
| 409 `empty-vote` / `vote-not-empty` | 无票不能生成结论；有票不能取消。旧零票项仍需另行处理。 |
| 500 或提交超时，结果未知 | 保留“尚未确认”状态。先重新读取本人回执，或使用同一选项重试；不要据此假定服务端没有提交。 |

本 API 不提供未认证的生产数据库健康详情。静态页面正常和某个无 token 请求返回 401，都不能证明服务凭据、Firestore 事务及规则已经正确接通。

## 8. 回滚与恢复

**应用回滚不等于数据库回滚，数据迁移不等于可逆的 UI 发布。** 在维护窗口记录以下材料：迁移前备份、迁移回执清单、原/新部署版本、最终安全规则、服务身份配置位置；不要在记录里复制密钥。

| 阶段 | 可采用的恢复方式 |
| --- | --- |
| 尚未提交任何旧票迁移，也未接受新私人选票 | 可回滚候选应用；继续维护，保留备份。已有的旧隐私问题不会因回滚消失。 |
| 已迁移旧票，尚未接受新私人选票 | 保留 server-only 档案和收紧后的规则，修复并前进；若必须恢复数据，先在隔离环境验证备份。不要把原 ballots 重新写入可读 issues。 |
| 已接受任何新私人选票 | 保留 ballot UID 文档、roundId、计数及审计。停止受影响写入口后修复 API；不能回滚到允许改票的旧实现，不能清空轮次让所有人重新投票。 |
| 服务凭据泄露或失效 | 停止/限制所有仍持有该身份的部署，撤销或轮换相应凭据，保持数据库安全规则；重新验证后才恢复 API。 |

维护时需同时阻止客户端写入和 API 写入，因为 Admin SDK 不受客户端规则限制。旧 Vercel 部署 URL 也可能继续存在，要纳入访问控制和凭据处置范围。

恢复先指向隔离数据库，核对所有私票及旧档案，再决定受控切换；不要将备份直接导入正在接收投票的生产库。托管 import 会覆盖同 ID 文档，并保留导出未覆盖的其他文档，因此它不是一条“撤销所有后来变化”的命令。[导入行为](https://firebase.google.com/docs/firestore/manage-data/export-import)。

若无法证明某个轮次的完整性，保持暂停并由授权管理员核查原始档案和备份；不补造票数，不伪造 UID，不把手动旧票伪装为新账号票。零票取消只用于明确的管理员操作，不作为部署脚本的自动清理动作。

## 9. 备选：Vercel OIDC + Google Workload Identity Federation

**可行，但尚未实现，也不是设置几个环境变量就会自动启用。** Vercel 官方支持通过 OIDC 换取 Google Cloud 短期凭据，所有 Vercel 计划均可使用该能力；可保留专用服务账号身份，通过 impersonation 使用它，而不创建或上传服务账号私钥。[Vercel GCP 联邦指南](https://vercel.com/docs/oidc/gcp)。

如以后选择该路线，工作项是：

1. 核对 Google Cloud 的计费与组织策略。Google 官方通用 WIF 配置指南列出启用 billing，以及 IAM、Resource Manager、Service Account Credentials、STS APIs 等前置条件。不能承诺此路线对现有 Spark 项目完全没有计费配置影响，也不在本次文档中替用户启用。[Google WIF 前置条件](https://docs.cloud.google.com/iam/docs/workload-identity-federation-with-other-providers)。
2. 创建或复用可信的 Workload Identity Pool/Provider，使用项目实际的 Vercel issuer 模式，配置准确 audience。属性映射/条件同时限制 Vercel team、project 和 `production` 环境；尽可能使用稳定的 `owner_id`、`project_id`，不要授权整个 pool 的所有身份访问生产。
3. 只给受限 federated principal 授予目标服务账号上的 `roles/iam.workloadIdentityUser`；服务账号本身继续使用第 3 节的数据权限。不要用项目 Owner、全局 Service Account Token Creator 或 Storage 管理角色替代本项目需要的角色。[Google 服务账号 impersonation](https://docs.cloud.google.com/iam/docs/workload-identity-federation-with-other-providers)。
4. 增加服务端凭据适配：从请求上下文取得 `@vercel/oidc` 的 `getVercelOidcToken()`，用 `google-auth-library` 的外部账号凭据完成 STS 交换及服务账号 impersonation，正确刷新短期 access token。Vercel token 不能在模块顶层提前读取，也不能当作 Firebase 用户 ID token。[Vercel OIDC 参考](https://vercel.com/docs/oidc/reference)。
5. 分别验证 Firebase Auth 撤销检查和 Firestore 事务的身份注入。本版本 Firebase Admin 的 `getFirestore(app)` 路径只接受其支持的 certificate/ADC 身份；不能随意传一个自定义 `getAccessToken` 对象就假定两个 SDK 都已接通。需要设计兼容 ADC 的外部凭据来源，或明确接入 Firestore 的 GoogleAuth 客户端并对 Auth 单独适配，完成冷启动、过期刷新与并发请求测试。
6. 先让隔离 Preview 只访问测试项目，确认它不能换取生产权限；再测试 Production，最后移除并撤销旧长期 key。团队/项目改名、issuer/audience 改动需重新核对信任条件。

备选环境变量是 provider 标识、project number、service account email、audience 等配置值，不是长期私钥。**当前 `FIREBASE_SERVICE_ACCOUNT_JSON` 解析器只接受 `type:'service_account'`，不能把 `external_account` WIF JSON 填进这个变量。** 完成上述适配前，继续使用已经验证可用的 ADC 或受限服务账号 JSON；不要为了“无密钥”关闭认证或扩大数据库规则。

本手册只记录此备选及其代价，没有创建 WIF pool/provider、服务账号 key、云资源或任何生产部署。
