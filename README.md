# 安提柯议会 · Antico Council

安提柯议会的公开档案馆与成员协作工作台。公开页面用于整理文章和历届资料；工作台用于会议、议题、表决、会后执行、编辑排期和资料管理。

前端使用 React 19、TypeScript、Vite 和 Tailwind CSS，云端使用 Firebase Authentication 与 Firestore，也支持浏览器本地模式。

[访问网站](https://www.anticocouncil.com/) · [成员登录](https://www.anticocouncil.com/portal) · [示例演示](https://www.anticocouncil.com/preview/) · [部署说明](docs/deployment.md) · [档案维护](docs/public-archive.md)

本文说明当前 `main` 的实现。议会风格工作台、公开档案馆、注册登录及加载页样式、PDF / Word 导出和会议改名均已合并。未合并 PR 中的功能不属于此版本；提交与发布记录请查看 [GitHub 历史](https://github.com/ixthecreator/anticocouncil/commits/main/)。

## 页面与数据

| 入口 | 用途 | 数据与访问方式 |
| --- | --- | --- |
| `/`、`/archive`、`/archive/<slug>` | 首页、档案目录与文章 | 构建时生成的公开 HTML，无需登录；当前内容标为示例 |
| `/portal` | 成员工作台 | Firebase 共享数据；需要登录、验证邮箱并取得成员授权 |
| `/local` | 本地工作台 | 无需登录；记录保存在当前浏览器和站点，不会自动上传 |
| `/preview/` | 带示例数据的独立演示 | 不连接 Firebase；操作保存在单独的浏览器存储中 |
| `/workspace`、`/blog` | 兼容旧地址 | 分别对应云端工作台与公开档案目录 |

公开档案馆与工作台里的「纪要档案」是两套内容。内部会议、成员和选票不会自动发布到公开页面。

`/preview/` 保留固定演示日期与虚构记录，可体验同周两场例会共享汇报进度，并不完整复刻正式功能。本地工作台默认没有这些演示记录。

## 本地启动

准备 Git、Node.js **22.12 或更高版本**与 Bun。仓库使用 `bun.lock`，安装时保留锁文件；运行前端无需 Java、Spring Boot 或 Gemini API 密钥。

```sh
git clone https://github.com/ixthecreator/anticocouncil.git
cd anticocouncil
bun install --frozen-lockfile
bun run dev
```

私有仓库需要先取得 GitHub 访问权限。开发服务器默认为 `http://localhost:3000`；端口被占用时以终端输出为准。

- 打开 `http://localhost:3000/` 查看公开页面。
- 打开 `http://localhost:3000/local` 使用本地工作台，无需配置 Firebase。
- 打开 `http://localhost:3000/preview/` 查看示例演示。

开发服务器只负责前端，不会启动 `backend/`。该目录是未接入网站的历史示例，现状见 [backend/README.md](backend/README.md)。

## 云端配置

需要调试登录或共享数据时，将 [.env.example](.env.example) 复制为 `.env.local`，填写自己 Firebase Web 应用的配置并重启开发服务器。部署时在 Vercel 的对应环境填写相同变量，然后重新构建。

| 变量 | 要求与用途 |
| --- | --- |
| `VITE_FIREBASE_PROJECT_ID` | 必填，Firebase 项目 ID |
| `VITE_FIREBASE_API_KEY` | 必填，Web 应用 API key |
| `VITE_FIREBASE_APP_ID` | 必填，Web 应用 ID |
| `VITE_FIREBASE_AUTH_DOMAIN` | 默认 `<project-id>.firebaseapp.com`；正式站点的 Google 整页登录需要配套代理与授权域名配置 |
| `VITE_FIREBASE_DATABASE_ID` | 默认 `(default)`；命名数据库需显式填写 |
| `VITE_FIREBASE_STORAGE_BUCKET` | 可选，Web 应用配置中的存储桶名称 |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | 可选，Web 应用配置中的消息发送编号 |

`VITE_*` 会进入浏览器产物，不能放服务账号私钥或其他服务端凭据。缺少配置时云端入口会提示错误，公开页面和本地模式仍可使用，也不会回退连接旧项目。

**自行部署不能只改 `.env`。** 当前仓库还包含站点专用的所有者邮箱、密码邮件返回地址、Firebase 登录代理与域名跳转。请按 [部署说明](docs/deployment.md) 同步配置；Firestore 规则须单独发布，推送前端代码不会更新规则。

## 使用工作台

### 登录与成员权限

普通成员使用邮箱密码注册或 Google 登录，验证邮箱后返回页面并点击「已验证，刷新认证状态」，再填写姓名并申请加入；所有者或管理员批准后才能进入共享工作台。代码中指定的所有者在邮箱验证后可直接进入，并非首个注册者自动成为管理员。

- 管理员可审批、停用和恢复普通成员；所有者还可调整其他成员的管理员角色。
- 授权记录 `workspaceAccess`、申请记录 `accessRequests` 与业务中的成员名册分开管理。应用角色不代表 GitHub、Vercel 或 Firebase 平台权限。
- 登录页提供「忘记密码？」；Google 账号可在登录后通过账号菜单设置本站密码。密码设置不会替代邮箱验证或成员审批。

### 会议与文档

工作流程为：创建或选择例会 → 从成员名册安排本周汇报 → 讨论和表决 → 会后执行与督办 → 完成归档。工作台已移除签到入口；投票直接从成员名册选择，不以汇报安排为前提。

汇报按会议日期所在的周一至周日合并，同周会议共享名单和进度，每名成员每周只需安排一次。汇报状态由成员手动记录，免汇报需填写原因；编辑时可选择实际汇报场次。

旧数据中的已汇报、免汇报和带文字的待汇报记录继续可读。空白的旧待汇报签到不会自动加入本周汇报名单。工作台还提供月度沙龙、编辑安排、资料库和文创库存；默认使用议会紫，可在设置中切换主题。

在「例会与议程」或「会后执行」中，点击当前会议旁的「修改名称」即可改名。会议 ID 和关联记录保持不变；发生并发改名时会提示最新名称。

常规报告和会议摘要在「例会与议程 → 会议记录 → 编辑会议记录」中填写。

「纪要档案」支持当前会议或手动多选会议，导出 PDF、可编辑 Word（`.docx`）及完整纪要 LaTeX 源文件。PDF / Word 的内容区别如下：

| 内容 | 会前议程 | 完整会议纪要 |
| --- | --- | --- |
| 会议信息、会期与常规报告 | 包含 | 包含 |
| 关联事项 | 所有未归档事项，不按状态过滤 | 全部事项，包括已归档事项 |
| 事项标题、编号、类别、优先级、状态、负责人、截止日期和描述 | 包含 | 包含 |
| 讨论、决议、归档状态、会议摘要、该场汇报记录 | 不包含 | 包含 |
| 表决信息 | 不包含 | 仅已结束表决的汇总，不含个人选票 |

PDF / Word 在浏览器内生成，不上传会议内容。PDF 按需加载同源中文字体；遇到缺字会提示，可改用 Word。字体来源和重建方法见 [字体说明](public/fonts/README.md)。LaTeX 使用同一导出模型，固定导出完整纪要，下载的源文件需自行用 XeLaTeX 编译。

PDF、Word 和 LaTeX 纪要按实际汇报场次收录内容，不会把整周汇报复制到每场会议，也不再显示签到时间。

工作台锚点包括 `overview`（概览）、`proposals`（议题索引）、`session`（例会与议程）、`post`、`supervision`、`archive`、`activity`、`editorial`、`assets` 和 `inventory`，例如 `/portal#overview`。

### 保存与备份

- 本地数据按浏览器及站点来源隔离；不同协议、域名、端口或设备不会自动共享。主要存储键为 `antico_workspace_v2`，继续兼容旧 `local_*` 数据；演示区单独使用 `antico-ui-preview-v1`。
- `/local` 与云端入口不会自动同步或合并数据。换设备或域名前，先在原环境导出备份，再在目标环境导入。
- 云端取得完整服务端确认后才允许编辑。离线或连接异常时数据仅供查看；保存长时间未确认时，保留页面并等待提示，避免重复提交。
- 「设置 → 导出备份」包含八类业务记录及内嵌附件，不包含账号密码、授权或申请记录。导入会按 ID 合并，同 ID 的记录会更新，其他记录保留。
- 为兼容已有备份和云端记录，汇报仍沿用 `attendance` 集合及 `checkedInAt` 字段，无需先删除或转换旧签到数据。
- 云端导入分批提交，不能作为一次整体事务回滚。导入前先备份，并避开多人同时编辑；GitHub 代码备份不能代替业务数据备份。

## 当前限制

- **现有投票不是私密、不可修改的选票系统。** 选票按业务成员 ID 记录，未逐票绑定登录账号，表决结束前可以改票；工作区成员可读取业务记录。JSON 备份可能包含个人选票，PDF / Word 不导出个人选票并不代表原始记录已受隐私保护。
- 目前是单一共享议会工作区，没有按账号或组织隔离的多租户空间。Supabase 迁移及私密投票改造尚未合并到 `main`。
- 汇报名单需在工作台手动安排，尚未接入腾讯文档中的固定名单或自动轮值规则；示例演示的三人名单均为虚构。
- 云端登录与共享数据仍依赖 Firebase / Google 服务，邮箱密码登录也需要网络能访问 Firebase。
- [PDF 使用说明](public/antico-council-guide.pdf) 保留为旧版参考，部分导航及新功能尚未更新，请以当前页面和本文为准。

## 检查与构建

提交前在仓库根目录运行：

```sh
bun run lint
bun test
bun run build
bun run check:public
```

`lint` 实际执行 TypeScript 类型检查，不是 ESLint。测试覆盖业务数据、认证与连接状态、路由、会议改名和文档导出；自动测试不等于真实账号登录、收信、审批及云端业务写入的完整验收。

`build` 先执行 Vite，再生成静态公开页面，输出到 `dist/`。`check:public` 必须在构建后运行，检查公开页面、文章内容、链接、字体、工作台应用壳及 404；Vercel 的构建命令不会自动执行该检查。

生产公开首页不加载工作台脚本；`dist/workspace.html` 才是 `/portal`、`/workspace` 和 `/local` 使用的应用壳。不要将所有路径统一重写到 `index.html`。本地 `dev` / `preview` 不会执行 Vercel 的认证代理和完整路由配置，部署验证方法见 [部署说明](docs/deployment.md)。

## 协作与目录

从最新 `main` 创建功能分支，完成相关检查后提交 PR。合并到 `main` 后，由已关联的 Vercel 项目构建并发布；应确认部署成功后再把修改视为已上线。README 保留当前行为和可复现步骤，临时调试记录及测试次数写入对应 PR。

| 路径 | 职责 |
| --- | --- |
| `src/SiteRouter.tsx`、`src/WorkspaceEntry.tsx` | 页面路由、工作台按需加载 |
| `src/content/archive.ts`、`src/components/LandingPage.tsx` | 公开文章、届次与公开页面 |
| `src/components/AuthPageFrame.tsx`、`WorkspaceGateway.tsx`、`AccountPassword.tsx` | 登录、注册、权限检查、密码与加载页面 |
| `src/App.tsx`、`src/components/WorkspaceShell.tsx` | 工作台导航、状态、主题与备份入口 |
| `src/lib/cloudAccess.ts`、`firebase.ts`、`firebaseConnection.ts`、`useWorkspace.ts` | 认证、云端连接、保存与本地数据 |
| `src/lib/workspace.ts`、`src/types.ts` | 业务规则、数据校验与类型 |
| `src/lib/meetingExport.ts`、`meetingPdf.ts`、`meetingDocx.ts` | PDF / Word / LaTeX 共用导出模型与格式生成 |
| `scripts/`、`vercel.json` | 静态页面生成、产物检查与 Vercel 配置 |
| `firestore.rules`、`firebase.json`、`.firebaserc` | Firebase 权限规则与部署目标 |
| `public/preview/` | 独立示例演示 |

本项目由 [Fiochanqwq/newmeetingapp](https://github.com/Fiochanqwq/newmeetingapp) 延续改进，保留原有仓库历史与代码署名。
