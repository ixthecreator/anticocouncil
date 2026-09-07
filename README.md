# 安提柯议会 · Antico Council

安提柯议会协作门户与工作台，基于 React 19、Vite、TypeScript、Tailwind 和 Firebase。门户以八个工作模块为入口；工作台涵盖例会签到、汇报表决、会后执行、编辑排期和后勤资料管理，支持手机布局及四种配色。

## 本轮状态

2026 年 9 月 7 日：新版门户、登录与成员审批界面、Firebase 连接状态处理及受限访问规则已加入代码。云端目标改为自有 Firebase 项目 `antico-council`，不再默认连接原作者的数据库。

**Google 与邮箱密码登录提供方的启用、Firestore 权限规则发布仍待用户具体授权及后续验收。当前不能据此认定云端协作已启用。** 新版部署、PDF 在线路径和真实账号的完整登录审批流程，需在最终发布后确认。此前已经完成的 GitHub、Vercel 和域名接入继续沿用。

## 页面入口

- `/`：公开协作门户，支持模块名称/功能搜索、“会议协作”和“日常工作”分类筛选；不读取会议或成员数据。
- `/workspace#session`：例会现场。其余工作模块使用 `post`、`supervision`、`archive`、`activity`、`editorial`、`assets`、`inventory` 锚点直达。
- `/workspace`：先进入工作区入口，再根据所选模式加载本地记录，或完成云端身份与成员资格确认。
- `/blog`：文章栏目预留页，尚未发布文章，也没有文章编辑后台。
- `/antico-council-guide.pdf`：门户使用说明的固定公开路径，对应仓库文件 `public/antico-council-guide.pdf`。发布包须包含此文件，并单独验收它返回 PDF 而非单页应用 HTML。
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

没有配置或仅填写部分变量时，云端入口会解释配置问题，公开门户和本地模式仍可使用。Firebase 仅在云端功能需要时初始化；不会静默回退到原项目。原配置只作为显式迁移参考保留，不代表已迁移任何业务数据。

## 云端共同使用设计

本节描述已实现的代码行为；正式可用性以登录提供方、部署配置和 Firestore 规则均完成启用后的验收为准。

1. 使用邮箱密码注册/登录，或使用 Google 登录。邮箱注册者须先完成邮件验证。
2. 邮箱验证后提交成员姓名及加入申请，等待所有者或管理员批准。
3. 获批且未停用的成员进入同一议会工作区，共同维护八类业务记录；没有个人分库或自动隔离的多组织空间。
4. 管理员可审批申请、停用或恢复其他普通成员。所有者可调整其他成员的管理员角色。用户不能审批自己或修改自己的授权，管理员不能修改其他管理员或所有者。
5. `workspaceAccess` 保存授权，`accessRequests` 保存申请；这两类记录与业务页面中的成员名册分开。客户端判断用于展示，实际读写权限由部署后的 Firestore 规则执行。

工作区只在当前身份通过验证且取得有效成员授权后挂载。缓存或未提交的本地授权写入不能放行；切换账号和模式会隔离组件状态，管理员降级后关闭成员管理面板。

登录审批控制的是进入共享工作区的资格。当前业务成员姓名、签到和投票仍按工作区内成员记录操作，尚未逐票绑定登录账号，也不是正式实名投票系统。

## 本地数据、连接与备份

- 新访客首先看到云端入口；已有本地模式偏好则保留。可从入口选择本地工作区。本地模式不要求登录，也不自动上传记录；有未确认的保存时应先处理完成再切换。
- 本地记录保存在当前浏览器、当前域名。旧 `local_*` 数据继续兼容读取，正常写入 `antico_workspace_v2`；切换云端不覆盖这些记录。
- 连接状态区分本地、连接中、已连接、离线和错误。八类集合均收到有效服务端确认后才允许修改；缓存数据可供只读查看，不能充当连接成功的证据。
- 任一集合权限或格式错误都会阻止修改。重试会重新建立监听，并保留独立的保存错误。断网恢复后重新确认连接。
- 云端写入以服务端确认作为保存成功依据。超过 15 秒仍未确认时会显示等待提醒，不会把未知结果误报为成功或失败；请保留页面并避免重复提交。
- 「设置 → 导出备份」保存八类业务记录及资料附件；备份不包含账号密码、成员授权表或审批申请。导入先校验，再按编号合并，同编号更新，其余记录保留。
- 云端导入分批执行，不是跨所有批次的一次事务。发生明确错误时会报告已完成条数；重新导入同一备份不会创建重复编号，但应避开多人同时编辑并先备份。
- 本地数据损坏时可导出原始存储。使用正常备份恢复前，损坏原件保留在 `antico_workspace_v2_recovery`；原始排查文件需修复内部 JSON 后才能作为业务备份导入。

更换域名、浏览器或设备前，先从旧工作台导出，再到新环境导入。GitHub 同步代码，不能代替业务数据备份。自有 Firebase 与原项目的数据也不会自动互通，迁移应在明确选择来源并保留备份后单独进行。

## 功能与结构

| 文件或模块 | 职责 |
| --- | --- |
| `src/SiteRouter.tsx`、`src/WorkspaceEntry.tsx` | 公开页路由及工作区代码按需加载 |
| `src/components/LandingPage.tsx` | 门户、模块搜索筛选、文章预留页及未找到页 |
| `src/components/WorkspaceGateway.tsx` | 本地/云端入口、登录验证、成员申请与管理 |
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

已有核心测试覆盖表决、备份校验、日期和导出；新增测试覆盖缓存误报连接、集合错误恢复、配置缺失以及客户端成员权限判断。客户端权限测试不等于 Firestore 规则模拟器测试，也不等于真实账号联调。Google/邮箱登录、验证邮件、审批、停用后的实际拒绝访问和本轮最终生产构建仍须按发布记录验收。

Windows 本地验证环境对 esbuild 子进程管道有限制，因此曾使用进程内 TypeScript/Bun 转换配合 Vite/Rollup 和 Tailwind 生成验证产物。项目标准构建配置保持 Vite；正式发布以 Vercel 对源码的标准生产构建为准。

自有私有仓库为 [ixthecreator/anticocouncil](https://github.com/ixthecreator/anticocouncil)，关联 [Vercel 项目 anticocouncil](https://vercel.com/ixthecreators-projects/anticocouncil)。生产分支为 `main`，推送后由 Vercel 自动构建。安装命令为 `bun install --frozen-lockfile`，构建命令为 `bun run build`，输出目录为 `dist`；`vercel.json` 保留单页应用路径重写。

正式入口为 [www.anticocouncil.com](https://www.anticocouncil.com)，根域名跳转至 `www`；保留 [Vercel 默认地址](https://anticocouncil-sigma.vercel.app)。这些域名和先前版本已完成接入，不代表本轮 Firebase 提供方与权限规则已经启用。门户 PDF 发布时须确认 `public/antico-council-guide.pdf` 被复制到构建输出，并在线检查 PDF 响应。

本项目由 [Fiochanqwq/newmeetingapp](https://github.com/Fiochanqwq/newmeetingapp) 延续改进，保留原有仓库历史与代码署名。
