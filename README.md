# 安提柯议会 · Antico Council

安提柯议会协作网站，基于 React 19、Vite、TypeScript、Tailwind 和 Firebase。公开开始页提供 Portal 与 Blog 两个入口；Portal 是登录后使用的操作面板，涵盖例会签到、汇报表决、会后执行、编辑排期和后勤资料管理，支持手机布局及四种配色。

## 本轮状态

2026 年 9 月 8 日：公开开始页、云端 Portal、独立本地试用及 Google 整页登录代码已发布，并同步更新 12 页中文使用说明。Google 与邮箱密码提供方、三个认证域名和成员访问规则已启用；真实登录后的 Portal 访问和业务读写尚未验证成功。

新增密码功能与使用说明已发布：登录页提供邮件找回与 Google 账号的邮件设置入口，已登录账号可直接设置独立的本站密码。本轮通过 TypeScript 检查、62 项测试、315 项断言、诊断构建及 Vercel 标准生产构建；本地浏览器已验证两个入口、返回流程和无效邮箱拦截，生产浏览器已验证忘记密码入口及返回。尚未发送真实密码邮件或实际修改密码。

本轮应用角色调整已发布：新所有者规则已发布并复读确认，原所有者的有效管理员授权记录已写入并 GET 核对。应用版本 `d80798a` 已完成 Vercel 生产构建和发布，通过 TypeScript 检查、46 项测试和 234 项断言；远程 Rules API 的 7 个新角色模拟场景全部通过。这不涉及 Firebase 项目、Google Cloud IAM、GitHub 或 Vercel 的平台所有权转移。

本轮已发布并验收的应用版本为 `074c3d2f4468ed50066ce6d528bd37a8106f1fb1`（`074c3d2`），[对应 Vercel 生产部署成功](https://vercel.com/ixthecreators-projects/anticocouncil/4ScCgqDWsT4Mz6ZP6fNGubyCP6AE)。后续文档提交另计，不改变这里记录的应用验收版本。

自有 Firebase Spark 项目 `antico-council`、Web 应用和位于 `asia-east2` 的 Firestore 默认数据库已创建，Vercel 的 7 项 Firebase 环境变量已设置，线上构建已确认对应新 Web 应用，不再默认连接原作者的数据库。

Google 与邮箱密码登录提供方已启用，`anticocouncil.com`、`www.anticocouncil.com` 和 `anticocouncil-sigma.vercel.app` 三个认证域名已添加。新 `firestore.rules` 已发布，重新读取 release 和 ruleset 后与本地规则内容完全一致。角色变更前匿名 REST HTTP 403 与四个旧角色规则模拟保留为历史记录，不能代替新角色的实际访问验证。

此前内置浏览器中，Google 账号选择和用户授权后已能返回本站，Firebase Authentication 用户列表已有原所有者 Google 账号记录，但回到网站后仍出现 `network-request-failed`，未实际进入 Portal。当前 Auth 用户列表仍只有原账号，新所有者尚未注册或完成真实登录。普通浏览器对新版的验证反馈仍待确认；真实业务读写、邮箱注册验证、申请审批与成员停用的完整联调尚未完成。

已确认内置浏览器直接访问 Google 的公开 `getProjectConfig` 接口时出现 `net::ERR_BLOCKED_BY_CLIENT`；同一接口在服务器检查中返回 HTTP 200，授权域名和跨域响应正常。认证辅助页会先调用该接口验证父页面域名，失败可能使回跳继续等待。这是当前环境中实际观察到的阻塞，普通浏览器是否能完成登录仍须实际确认。

## 新 UI 示例试用区

`/preview/` 是公开的独立静态试用区，使用虚构成员与示例记录，可体验会议签到、表决、执行更新、纪要查询与下载。演示基准日固定为 2026 年 9 月 9 日，以保留两条「今日截止」及长标题效果。首页页脚提供「新 UI 试用」入口，试用区页脚可返回网站首页。

试用操作仅保存到独立的 `antico-ui-preview-v1` 浏览器存储；重置只清除此键。该页面不加载 Firebase、不读写正式工作区数据，网络连接受独立页面策略禁止。`/portal`、`/workspace` 和 `/local` 继续使用原正式 UI；React 新 UI 接入仍保留在单独的草稿 PR 中。

试用文件位于 `public/preview/`，构建时复制到 `dist/preview/`。`vercel.json` 在单页应用兜底前为试用入口指定独立 HTML，静态文件使用 `/preview/` 绝对路径以兼容有无尾斜线的入口。

## 页面入口

- `/`：独立公开开始页，提供 Portal 与 Blog 两个选项；没有模块搜索或八模块公开卡，不读取会议或成员数据。
- `/portal`：云端操作面板。须登录、验证邮箱并取得成员批准；当前指定的所有者完成邮箱验证后无需申请。
- `/portal#session`：例会现场。其余工作模块使用 `post`、`supervision`、`archive`、`activity`、`editorial`、`assets`、`inventory` 锚点直达。
- `/workspace`：保留的旧工作台入口，执行与 `/portal` 相同的云端身份与成员资格检查。
- `/local`：独立本地试用，不要求登录。使用同一浏览器、同一网站的原本地记录，仅改变页面路径不需要迁移数据。
- `/blog`：文章栏目预留页，尚未发布文章，也没有文章编辑后台。
- `/antico-council-guide.pdf`：使用说明的固定公开路径，对应仓库文件 `public/antico-council-guide.pdf`；新增密码说明已发布，线上文件与本地逐字节一致。
- 其他路径显示未找到页面。公开页、工作台和文章页支持直接打开、刷新及浏览器返回。

## 启动与配置

项目沿用 `bun.lock`：

```sh
bun install --frozen-lockfile
bun run dev
bun run lint
bun test
bun run build
```

开发地址为 `http://localhost:3000`，生产输出为 `dist/`。当前界面不调用 Gemini，本地使用不需要 Gemini API 密钥。

Firebase 使用 `.env.example` 中的 `VITE_FIREBASE_*` 配置。在本地复制为 `.env.local`；部署时在 Vercel 的对应环境设置相同变量并重新构建。所需变量为 `VITE_FIREBASE_PROJECT_ID`、`VITE_FIREBASE_API_KEY`、`VITE_FIREBASE_APP_ID`；可配置授权域名、存储桶、消息发送编号和 `VITE_FIREBASE_DATABASE_ID`。数据库编号未指定时使用 `(default)`，命名数据库须显式填写。仓库不会保存实际登录凭据或服务账号私钥。

没有配置或仅填写部分变量时，云端入口会解释配置问题，公开开始页和 `/local` 本地试用仍可使用。Firebase 仅在云端功能需要时初始化；不会静默回退到原项目。原配置只作为显式迁移参考保留，不代表已迁移任何业务数据。

## 云端共同使用设计

登录提供方已启用，新角色授权记录已写入，新规则和应用生产版本均已发布。本节描述调整后的应用角色与使用流程；真实账号登录、邮件验证、完整审批和成员停用的端到端结果仍需分别验收。

| 应用账号 | 角色 |
| --- | --- |
| `yulun8964@gmail.com` | 新所有者；邮箱验证即可直接进入，无需加入申请。 |
| `ez4eason@gmail.com` | 管理员；已通过正常成员授权记录设置 `role: admin`、`active: true`。 |

1. 使用邮箱密码注册/登录，或使用 Google 登录。Google 登录使用当前页面前往 Google，完成后返回网站；邮箱注册者须先完成邮件验证。
2. 邮箱验证后提交成员姓名及加入申请，等待所有者或管理员批准；当前指定的新所有者邮箱验证后可直接进入，无需加入申请。
3. 获批且未停用的成员进入同一议会工作区，共同维护八类业务记录；没有个人分库或自动隔离的多组织空间。
4. 管理员可审批申请、停用或恢复其他普通成员。所有者可调整其他成员的管理员角色。用户不能审批自己或修改自己的授权，管理员不能修改其他管理员或所有者。
5. `workspaceAccess` 保存授权，`accessRequests` 保存申请；这两类记录与业务页面中的成员名册分开。客户端判断用于展示，实际读写权限由部署后的 Firestore 规则执行。

原所有者的管理员资格来自正常的 `workspaceAccess/{uid}` 记录：邮箱必须与账号一致，`role` 为 `admin` 且 `active` 为 `true`。该账号没有永久所有者身份或按邮箱直接放行的特例；新所有者可停用或降级它，账号也不能修改自己的授权。这里的所有者与管理员仅指本应用的协作权限，不代表平台账户或项目的所有权。

工作区只在当前身份通过验证且取得有效成员授权后挂载。缓存或未提交的本地授权写入不能放行；切换账号和模式会隔离组件状态，管理员降级后关闭成员管理面板。

登录审批控制的是进入共享工作区的资格。当前业务成员姓名、签到和投票仍按工作区内成员记录操作，尚未逐票绑定登录账号，也不是正式实名投票系统。

## 找回与设置本站密码

登录页提供“忘记密码？”与“给 Google 账号设置本站密码”两个入口。填写原账号邮箱后，点击“发送密码重置邮件”或“发送密码设置邮件”，按邮件中的链接设置密码，再用邮箱与新密码登录；不需要数字验证码。统一提示不会确认邮箱是否已注册，60 秒后可重新发送，链接过期时重新申请。密码设置不会代替邮箱验证或成员审批。

已经能够登录的成员，优先从账号菜单选择“设置本站密码”；已验证但尚待审批的账号也可从页底进入。两次填写至少 8 位的新密码并点击“保存本站密码”。首次添加使用 Firebase 的账号关联功能，保留同一账号、Google 登录方式与成员权限；已有本站密码时直接修改。本密码独立于 Google 或邮箱本身的密码。

如提示需要重新登录，可重新登录后再设置，或使用“向当前邮箱发送重置链接”。邮件重置用于原账号，但其 Google 登录关联可能变化，完成后应使用邮箱与新密码登录；不能承诺该邮件方式始终保留 Google 关联。系统不提供单独的 Google 重新关联入口。

Firebase 默认邮件模板语言已保存并复读确认为简体中文，SDK 发信语言设置为 `zh-CN`；当前发件地址为 `noreply@antico-council.firebaseapp.com`。此项确认配置，不代表已验证真实邮件投递。

## 本地数据、连接与备份

- 路径决定数据位置：`/portal` 与 `/workspace` 固定使用云端，不会因旧的本地偏好绕过登录审批；`/local` 固定使用本地记录，不要求登录。前往另一入口不会自动上传或合并记录；有未确认的保存时应先处理完成再离开。
- 本地记录保存在当前浏览器、当前域名。旧 `local_*` 数据继续兼容读取，正常写入 `antico_workspace_v2`；切换云端不覆盖这些记录。
- 连接状态区分本地、连接中、已连接、离线和错误。八类集合均收到有效服务端确认后才允许修改；缓存数据可供只读查看，不能充当连接成功的证据。
- 任一集合权限或格式错误都会阻止修改。重试会重新建立监听，并保留独立的保存错误。断网恢复后重新确认连接。
- 云端写入以服务端确认作为保存成功依据。超过 15 秒仍未确认时会显示等待提醒，不会把未知结果误报为成功或失败；请保留页面并避免重复提交。
- 「设置 → 导出备份」保存八类业务记录及资料附件；备份不包含账号密码、成员授权表或审批申请。导入先校验，再按编号合并，同编号更新，其余记录保留。
- 云端导入分批执行，不是跨所有批次的一次事务。发生明确错误时会报告已完成条数；重新导入同一备份不会创建重复编号，但应避开多人同时编辑并先备份。
- 本地数据损坏时可导出原始存储。使用正常备份恢复前，损坏原件保留在 `antico_workspace_v2_recovery`；原始排查文件需修复内部 JSON 后才能作为业务备份导入。

同一网站从旧路径进入 `/local` 会继续读取原本地记录，无需因路由调整迁移。更换域名、浏览器或设备前，先从旧工作台导出，再到新环境导入。GitHub 同步代码，不能代替业务数据备份。自有 Firebase 与原项目的数据也不会自动互通，迁移应在明确选择来源并保留备份后单独进行。

## 功能与结构

| 文件或模块 | 职责 |
| --- | --- |
| `src/SiteRouter.tsx`、`src/WorkspaceEntry.tsx` | 公开页路由及工作区代码按需加载 |
| `src/components/LandingPage.tsx` | 公开开始页、文章预留页及未找到页 |
| `src/components/WorkspaceGateway.tsx` | 云端登录验证、成员申请与管理，以及独立本地模式 |
| `src/components/AccountPassword.tsx` | 邮件密码找回、Google 账号邮件设置入口与已登录账号的本站密码设置 |
| `src/lib/cloudAccess.ts`、`firestore.rules` | 身份与角色行为、服务端访问约束 |
| `src/lib/firebase.ts`、`src/lib/firebaseConnection.ts` | 自有项目配置、惰性连接、快照状态、事务和分批写入 |
| `src/lib/useWorkspace.ts` | 本地/云端数据隔离、只读缓存、保存反馈与恢复 |
| `src/components/WorkspaceShell.tsx`、`src/App.tsx` | 工作台导航、主题、搜索、数据状态及导入导出 |
| `AttendanceView`、`SessionView` | 成员登记、签到汇报、议题与表决 |
| `PostMeetingView`、`SupervisionView`、`ArchiveView` | 会后执行、跨会议督办及历史纪要 |
| `ActivityView`、`OperationsView` | 月度沙龙、编辑安排、资料库与文创库存 |
| `src/lib/workspace.ts`、`src/lib/latex.ts` | 数据校验、投票规则、纪要与中文 LaTeX 导出 |
| `public/antico-council-guide.pdf` | 门户公开使用说明的发布文件路径 |
| `backend/` | 保留的 Spring Boot 示例，当前前端未连接它 |

会议流程为：新建或选择例会 → 添加成员并签到 → 记录待汇报/已汇报/免汇报 → 讨论与表决 → 授权执行 → 完成归档。历史汇报按会议日期计算，免汇报需填写原因，不自动写死周三/周日规则。成员投票按成员编号计一票，结束前可改票；保留旧主持人录票格式。

资料库支持 PNG/JPG/WEBP/PDF 附件，单文件最多 400 KB，存入当前工作区业务数据；大文件使用 HTTP(S) 链接。同名作者资料需要自行区分。外部表格仅保留业务入口，未抓取或迁移其内容。

## 验证与发布

新增密码功能通过 TypeScript 检查、62 项测试、315 项断言及诊断构建。浏览器已验证登录页两个密码入口、进入与返回，以及 HTML 对无效邮箱的拦截；独立模拟页面验证密码不一致、近期登录提示、慢响应时禁用、键盘焦点、手机布局和中性发信提示及 60 秒重发等待，未发送真实邮件。测试包含 Firebase SDK 初始化和同一标签页中较晚返回的 Google 结果不能覆盖当前密码登录的边界；跨标签页 Google 登录取消没有新增覆盖。

应用 `074c3d2` 的 Vercel 标准生产构建与发布已成功。线上产物校验通过，包含三个密码入口和当前 Google 登录逻辑，使用正确的 Firebase Web 应用、新所有者及原管理员正常授权方式，没有旧所有者邮箱放行特例；生产浏览器忘记密码入口及返回正常。实际收信、邮件链接设置、设密后登录及共享业务读写仍待用户验证。

新角色源码 `d80798a` 已通过 TypeScript 检查、46 项测试、234 项断言和构建，覆盖核心业务、备份、连接状态、客户端角色判断及登录诊断；这不是 Firestore 规则模拟或真实账号联调。本轮角色更新已完成 Vercel 标准生产发布，线上代码已确认使用新所有者邮箱、自有 Firebase Web 应用，且没有旧邮箱的身份放行硬编码。真实云端会话与业务读写仍需验收。

线上已确认公开开始页和 Blog 内容及桌面布局正常；自有 Vercel 默认域名的 `/portal?check=entry#members` 完整跳至 `www` 并保留查询和锚点，`/local` 保留原域名且无需登录即可进入本地工作区。

角色变更前的 Firebase 成员规则曾发布并确认持久化，匿名业务数据 REST 请求返回 HTTP 403。当时 Firebase 控制台完成 4 项实际模拟：未登录拒绝、已验证但未获批成员拒绝、当时的所有者已验证时允许、其邮箱未验证时拒绝。这些旧规则结果不能视为新所有者规则已验证，也不能代替完整登录审批或成员停用的端到端验证。

本轮新规则发布后已复读确认与本地 `firestore.rules` 的 LF 内容一致，SHA-256 为 `28e2d241debba1ff3688a1724c03f2f0f9fc198c1bd22483ae5b1e2700b7a585`。管理员记录也已独立 GET 核对其邮箱、`role: admin` 和布尔值 `active: true`。

远程 Rules API 对当前新规则完成 7 个模拟场景，全部通过，编译问题与诊断均为零：新所有者邮箱已验证且无成员记录时允许、未验证时拒绝；原所有者有有效管理员记录时允许、无记录时拒绝；原所有者不能降级另一管理员、不能将普通成员提升为管理员；新所有者可以降级原所有者的管理员记录。这些测试使用模拟身份和模拟成员记录，没有真实登录或更改业务数据；新所有者真实登录、业务读写及管理员停用后的实际失权仍待验证。

Windows 本地验证环境对 esbuild 子进程管道有限制，因此曾使用进程内 TypeScript/Bun 转换配合 Vite/Rollup 和 Tailwind 生成验证产物。项目标准构建配置保持 Vite；正式发布以 Vercel 对源码的标准生产构建为准。

自有私有仓库为 [ixthecreator/anticocouncil](https://github.com/ixthecreator/anticocouncil)，关联 [Vercel 项目 anticocouncil](https://vercel.com/ixthecreators-projects/anticocouncil)。生产分支为 `main`，推送后由 Vercel 自动构建。安装命令为 `bun install --frozen-lockfile`，构建命令为 `bun run build`，输出目录为 `dist`。

Google 整页登录使用正式 `www` 域名作为 Firebase `authDomain`。Google OAuth 已保存 `https://www.anticocouncil.com` 来源及 `https://www.anticocouncil.com/__/auth/handler` 返回地址。`vercel.json` 须保留 Firebase `/__/auth/:path*` 与 `/__/firebase/init.json` 同源代理和单页应用路径重写，代理须优先于页面兜底；静态包也须携带完整配置，不能只复制首页重写。变更认证域名、代理或环境变量后，应重新构建并验收真实登录返回流程。

OAuth 受众已确认为“外部、正式版”。正式 `www` 的认证 `handler`、`iframe`、`handler.js` 均返回 HTTP 200 和 `no-store`，响应与 Firebase 原文一致，无 HTTP 302；`createAuthUri` 公共配置检查返回 HTTP 200，并生成正确的 Google 客户端和 `www` 回调。这些检查未登录或记录凭据，也不代表已完成真实登录和数据读写。

自有 Vercel 默认域名的 `/portal` 与 `/workspace` 会前往正式 `www` 域名并保留路径、查询参数与模块锚点；公开页与 `/local` 留在原域名，保留其本地数据位置。Google 登录完成后返回发起页面，仍须通过邮箱验证和服务端成员授权检查；回跳失败显示具体原因，等待超时可使用“重新载入登录页”。

正式入口为 [www.anticocouncil.com](https://www.anticocouncil.com)，根域名跳转至 `www`；保留 [Vercel 默认地址](https://anticocouncil-sigma.vercel.app)。密码说明更新后的 PDF 为 12 页、695,020 字节，SHA-256 为 `26cb877ba95ba5bda756210c6efd063d80394dfe4e33e54ca164a036a76d83e1`；中文字体、10 处章节跳转和 8 个 Portal 模块链接已验证，并检查了 4 张变更页渲染。线上新版已与本地文件逐字节核对一致。网站发布、Firebase 配置和真实登录分别验收。

本项目由 [Fiochanqwq/newmeetingapp](https://github.com/Fiochanqwq/newmeetingapp) 延续改进，保留原有仓库历史与代码署名。
