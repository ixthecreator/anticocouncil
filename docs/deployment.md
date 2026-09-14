# 部署与云端配置

网站前端由 Vercel 托管；账号使用 Firebase Authentication，业务数据使用 Firestore。`backend/` 不参与正式网站的构建或请求处理。

## 维护现有站点

正式入口为 [www.anticocouncil.com](https://www.anticocouncil.com/)，生产分支为 `main`，关联 [Vercel 项目 anticocouncil](https://vercel.com/ixthecreators-projects/anticocouncil)。当前仓库的默认 Firebase 项目为 `antico-council`，见 [`.firebaserc`](../.firebaserc)。

1. 从最新 `main` 创建分支，完成修改与 [README 中的检查](../README.md#检查与构建)，提交 PR。
2. 在 Vercel 预览中检查受影响的页面。预览环境有独立的变量和域名配置，构建成功不代表认证已可用，也不代表它拥有独立数据库。
3. 合并到 `main`，等待 Vercel 生产部署成功，再核对正式域名。现有安装命令为 `bun install --frozen-lockfile`，构建命令为 `bun run build`，输出目录为 `dist`。
4. 如果修改了 `firestore.rules`，另行确认目标项目并部署规则。Vercel 发布不会应用这些规则，也不会修改 Authentication 的提供方或授权域名。

前端环境变量在构建时写入产物。修改 Vercel 变量后需要重新部署；不要把服务账号私钥或其他服务端凭据写入 `VITE_*`。

## 在自己的项目部署

### 1. 创建 Firebase 项目和 Web 应用

在自己的 Firebase 项目中创建 Web 应用和 Firestore 数据库，启用网站需要的邮箱密码及 Google 登录提供方。以 [`.env.example`](../.env.example) 为模板配置本地与 Vercel 环境变量，所需字段见 [README](../README.md#云端配置)。

`VITE_FIREBASE_DATABASE_ID` 默认为 `(default)`。这个变量只决定客户端读哪个数据库，不负责创建数据库，也不会改变 Firebase CLI 的规则部署目标。

本地只查看界面时使用 `/local` 即可；调试云端功能时应连接单独的测试项目。缺少配置的部署仍能提供公开页面与本地模式。

### 2. 替换站点专用配置

以下值不是环境变量。部署为另一个站点时，须同步修改源码及对应测试，不能只更换 Firebase Web 配置：

| 文件 | 需要核对的配置 |
| --- | --- |
| [`src/lib/cloudAccess.ts`](../src/lib/cloudAccess.ts) | `OWNER_EMAIL`（所有者邮箱）和 `PASSWORD_RESET_RETURN_URL`（密码邮件完成后的返回页） |
| [`firestore.rules`](../firestore.rules) | `owner()` 和授权/申请校验中的所有者邮箱，必须与前端一致 |
| [`vercel.json`](../vercel.json) | `/__/auth/:path*` 与 `/__/firebase/init.json` 的代理目标，必须指向自己的 Firebase 项目 |
| [`src/SiteRouter.tsx`](../src/SiteRouter.tsx) | `cloudAliases` 中的旧域名，以及云端入口跳转的正式域名 |
| [`.firebaserc`](../.firebaserc)、[`firebase.json`](../firebase.json) | 默认项目与要部署规则的数据库 |

指定的所有者完成邮箱验证后即可进入工作台，不依赖已有成员授权记录。普通成员先申请加入，管理员批准后获得 `member` 角色；所有者可再提升其管理员权限。不要把“首个注册用户”当作所有者初始化方式。

所有者是本应用的权限角色，不是 Firebase 项目或 Vercel 账户的所有者。前端检查与 Firestore 规则应作为同一权限变更核对和发布。

### 3. 配置 Google 整页登录和邮件返回地址

当前站点使用正式域名作为 `authDomain`，并通过 Vercel 反向代理 Firebase 登录辅助页面。复制这一方案时：

1. 在 Vercel 绑定自己的 HTTPS 正式域名，并将该主机名填入 `VITE_FIREBASE_AUTH_DOMAIN`（不带 `https://` 或路径）。
2. 在 Firebase Authentication 的授权域名中添加实际使用的主机名；本地云端调试需要单独核对 `localhost`。
3. 在对应 Google OAuth Web 客户端核对网站来源 `https://<站点域名>` 和返回 URI `https://<站点域名>/__/auth/handler`。
4. 保留 `vercel.json` 的登录代理及其 `no-store` 头，将两处 `antico-council.firebaseapp.com` 替换为自己的 Firebase 项目域名。认证路径不能落入页面重写，也不能以 302 跳转替代代理。
5. 将 `PASSWORD_RESET_RETURN_URL` 改为自己的工作台地址，核对该域名已获 Firebase 授权，并重新构建。随后实际验证登录返回与邮件密码流程。

这个方案对应 Firebase 的 [重定向登录建议：反向代理认证请求](https://firebase.google.com/docs/auth/web/redirect-best-practices#option_3_proxy_auth_requests_to_firebaseappcom)。`bun run dev` 和 `bun run preview` 不执行 `vercel.json`，不能用它们证明同源登录代理已配置正确；需要在配置好的 HTTPS 部署上验证。

当前代码只把 `anticocouncil-sigma.vercel.app` 上的 `/portal` 和 `/workspace` 跳转至正式 `www`，保留路径、查询参数和锚点；并不会自动覆盖每一个 Vercel 预览域名。根域名到 `www` 的跳转则需要在 Vercel 域名设置中核对。

### 4. 单独部署 Firestore 规则

先安装并登录 [Firebase CLI](https://firebase.google.com/docs/cli)。确认本地规则已使用正确的所有者配置，在仓库根目录执行下列命令，将 `YOUR_PROJECT_ID` 替换为实际目标项目：

```sh
firebase login
firebase deploy --only firestore:rules --project YOUR_PROJECT_ID
```

仓库中的 `firebase.json` 当前针对默认数据库。若使用命名数据库，还须将规则配置改为包含目标 `database` 的条目，并与 `VITE_FIREBASE_DATABASE_ID` 保持一致，例如：

```json
{
  "firestore": [
    { "database": "YOUR_DATABASE_ID", "rules": "firestore.rules" }
  ]
}
```

项目与数据库必须事先存在。不要因为前端成功连接某个数据库，就推断规则也发布到了该数据库；部署完成后应核对目标与生效规则。CLI 会用本地规则覆盖目标中的现有规则，具体配置见 [Firebase CLI 的多数据库说明](https://firebase.google.com/docs/cli#configuration_for_multiple_cloud_firestore_databases)。

规则中的八个业务集合对已获批成员开放；成员授权和申请另有角色约束。目前业务记录里可能包含逐人选票，规则尚未提供个人选票隔离。不能把隐藏界面或改为不含个人选票的文档导出当作数据库隐私保护。

## 路由与发布检查

公开 HTML 与工作台应用壳各有用途，部署时保留完整 `dist/` 和 `vercel.json`，不要只上传首页或添加全站 SPA 兜底。

| 路径 | 生产行为 |
| --- | --- |
| `/`、`/archive`、`/archive/<slug>`、`/blog` | 构建生成的公开 HTML，不包含应用脚本 |
| `/portal`、`/workspace`、`/local` | 使用 `dist/workspace.html`，按需加载工作台 |
| `/preview/` | 独立静态演示，保留专用 CSP 与静态资源 |
| `/__/auth/*`、`/__/firebase/init.json` | Firebase 同源代理 |
| 不存在的文章或页面 | 静态 404 页面及 HTTP 404 |

发布后核对首页、文章、三个工作台入口能直接打开和刷新，未知文章返回 404。涉及登录或权限的修改还需使用测试账号验证：邮箱验证、申请审批、获批后的读写、成员停用、Google 返回和密码邮件；仅检查 HTTP 200 或构建通过不能替代这些流程。

## 常见问题

| 现象 | 核对方式 |
| --- | --- |
| 云端提示配置不完整 | 检查 Vercel 对应环境的三个必填变量，补齐后重新构建 |
| 注册成功但进不了工作台 | 确认邮箱验证和成员审批；Firebase Auth 中有账号不等于已获授权 |
| 已获批仍提示权限不足 | 检查项目、数据库、实际规则，以及授权记录的邮箱、角色和 `active` 值 |
| Google 登录返回后一直等待 | 检查授权域名、OAuth 回调、代理和浏览器网络报错；用系统浏览器复现，避免把拦截误判为应用授权失败 |
| 本地数据“消失” | 检查域名、端口、浏览器及 `/local` 入口是否改变；各来源数据独立，需从原环境导出迁移 |
| 生产工作台变成静态首页 | 检查是否错误地把工作台路径重写到 `index.html`，应指向 `workspace.html` |
