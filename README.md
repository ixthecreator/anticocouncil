# 安提柯议会 · Antico Council

安提柯议会公开首页与协作工作台。基于 React 19、Vite、TypeScript、Tailwind 与 Firebase，包含例会签到、汇报与表决、会后执行、编辑排期和后勤资料管理。界面统一为侧栏导航、会议概览、清晰表单与卡片，并支持手机布局和四种配色。

## 页面入口

- `/`：公开 Landing Page，介绍议会与协作空间，不读取会议或成员数据。
- `/workspace`：协作工作台，进入后再加载工作区代码与所选数据源。
- `/blog`：文章栏目预留页，目前没有发布文章，也没有文章后台。后续可增加独立文章内容、详情路径及静态生成。
- 其他路径显示未找到页面。跨页使用标准链接，支持直接打开、刷新与浏览器返回。

## 启动与验证

项目沿用 `bun.lock`。安装 Bun 后执行：

```sh
bun install --frozen-lockfile
bun run dev
bun run lint
bun test
bun run build
```

开发地址为 `http://localhost:3000`。生产输出为 `dist/`，通过仓库根目录的 `vercel.json` 在 Vercel 发布；构建命令 `bun run build`，输出目录 `dist`。当前界面不调用 Gemini，因此本地运行不需要 Gemini API 密钥。

## 功能与结构

| 页面或模块                           | 职责                                             |
| ------------------------------------ | ------------------------------------------------ |
| `src/SiteRouter.tsx`                 | 公开页、工作台与文章预留页的路由分发             |
| `src/components/LandingPage.tsx`     | 公开首页、文章预留页与未找到页                   |
| `src/components/WorkspaceShell.tsx`  | 统一导航、按页搜索、配色、备份设置与保存状态     |
| `src/App.tsx`                        | 工作区入口、会议选择、导航、搜索与导入导出       |
| `src/lib/useWorkspace.ts`            | 本地/云端隔离、保存反馈、数据加载与恢复          |
| `src/lib/firebase.ts`                | 原 Firebase 接入、事务修改和分批导入             |
| `src/lib/workspace.ts`               | 数据校验、投票规则、跨会议汇报查询、完整纪要     |
| `src/components/AttendanceView.tsx`  | 成员登记、签到去重、分享队列、已汇报与免汇报记录 |
| `src/components/SessionView.tsx`     | 议程讨论、会议记录、按成员投票与主持人录票       |
| `src/components/ActivityView.tsx`    | 沙龙排期、月份筛选、编辑、活动链接和状态         |
| `src/components/OperationsView.tsx`  | 微信/QQ选题排版、作者名片、素材成果、文创库存    |
| `src/components/PostMeetingView.tsx` | 通过、授权、执行、完成的会后推进                 |
| `src/components/ArchiveView.tsx`     | 历届会议查看与批量导出                           |
| `src/components/SupervisionView.tsx` | 跨会议执行跟踪                                   |
| `src/lib/latex.ts`                   | 中文 LaTeX 纪要和用户内容转义                    |
| `backend/`                           | 保留的 Spring Boot 示例，当前前端未连接它        |

`main.txt` 已与当前实现同步。原文件中宣称的 GitHub/Gist 数据同步、Spring Boot 前端接入在原代码中并未实际接通，本次没有把它们作为已实现能力。

## 例会流程

1. 新建或选择例会。
2. 添加成员并签到；同一会议同一成员只保留一条签到，按签到时间排列分享顺序。
3. 记录“待汇报 / 已汇报 / 本次免汇报”。历史汇报按会议日期显示，免汇报必须填写原因，不自动写死周三/周日规则。
4. 添加议题、负责人和截止日期。可发起表决，也可直接安排执行。
5. 成员投票以成员编号计一票，结束前可以改票。主持人录票保留旧议题的兼容能力，有票后不能切换计票模式。
6. 保存常规报告和会议摘要，导出完整 TXT 纪要。纪要包含本次签到、汇报、议程、执行结论和票数，搜索不会截断导出内容。

## 数据与协作边界

- 新浏览器默认使用本地工作区；若已有 `storage_mode` 选择则沿用。旧 `local_*` 数据按需读取，写入统一的 `antico_workspace_v2`。本地数据不跨设备自动同步。
- 云端模式沿用现有 Firebase 项目和数据库；只有选择云端时才订阅它。前端未新增账号认证。成员姓名是自行选择的身份标签，不能用于防冒名或正式实名投票。
- 仓库原有 `firestore.rules` 允许公开读写，本次未修改或部署规则。公开多人上线前需要接入认证、成员权限和经后端验证的投票权限。不要把当前实现描述为已具备生产级访问控制。
- 已在浏览器确认可读取原有云端会议；未修改云端业务记录，也未执行数据库规则部署或多人并发集成测试。事务与分批导入实现已加入代码。
- 作者名片与资料支持上传 PNG/JPG/WEBP/PDF（单文件最多 400 KB），保存在当前工作区备份内；大文件使用 HTTP(S) 资料链接。浏览器容量不足时会显示保存错误，原记录保留。
- 选题可按作者姓名调取资料库中同名作者的名片。同名作者需要在资料名称或作者字段中自行区分。
- 外部表格只保留业务入口，没有抓取、迁移或修改表中数据。文档中的第三方密码未进入源代码。

## 备份与恢复

右上角「设置 → 导出备份」导出所有八类记录，包括资料附件。导入会先验证整个备份，再按编号合并；同编号记录更新，其他记录保留。旧四类数据备份仍可导入，不会清空新增业务。

云端按条数和字节数分批导入；网络中断会报告已完成条数，可重新导入同一备份，同编号不重复。导入不是跨全部批次的一次事务，请避开多人同时编辑期间，并先保留现有备份。

本地记录损坏时，「设置 → 导出备份」仍可导出原始存储供排查；另选正常 JSON 备份并确认导入可恢复工作区。损坏原件会保留在 `antico_workspace_v2_recovery`。原始排查文件不是正常业务备份，应先修复其内部 JSON 再导入。

## 本次验证

- TypeScript 检查通过。
- 13 项核心规则测试通过，覆盖改票去重、结束后拒绝投票、多数规则、旧计票格式、跨会议汇报、纪要完整性、备份校验、链接安全、日期语义、中文导出和过期状态操作。
- 本地浏览器检查覆盖会议创建、成员签到、免汇报保存、改票、刷新恢复、表决结束和活动搜索。
- 当前 Windows 执行环境限制 esbuild 的子进程管道，标准 Vite 启动在该环境报 EPERM；本次使用进程内 TypeScript/Bun 转换配合 Vite/Rollup 和 Tailwind 生成验证产物，未改动项目标准构建配置。压缩关闭，因此附带静态包大于正常生产构建。
- 本轮另检查了公开页/工作台/文章入口、桌面与手机布局、新建会议、按页搜索和深夜配色。最终部署状态以部署记录为准。

## GitHub 与 Vercel

项目已推送到自有私有仓库 [ixthecreator/anticocouncil](https://github.com/ixthecreator/anticocouncil)，并关联 [Vercel 项目 anticocouncil](https://vercel.com/ixthecreators-projects/anticocouncil)。生产分支为 `main`，推送代码后由 Vercel 自动构建与发布。首次标准生产构建已成功，临时生产地址为 [anticocouncil-sigma.vercel.app](https://anticocouncil-sigma.vercel.app)。GitHub 同步的是项目代码，业务数据继续保存在浏览器或 Firebase。

仓库根目录的 `vercel.json` 使用 Vite，安装 `bun install --frozen-lockfile`，构建 `bun run build`，输出 `dist`。SPA 重写支持 `/workspace` 与 `/blog` 直接打开与刷新。

Vercel 已将 `www.anticocouncil.com` 分配到 Production，并将 `anticocouncil.com` 设置为 308 跳转到 `www`。Namecheap PremiumDNS 已保存以下记录，TTL 均为 30 分钟；原邮件设置保留。首次绑定后的 HTTPS 验收结果见交付部署记录。

| 类型 | 主机 | 值 |
| --- | --- | --- |
| A | `@` | `216.198.79.1` |
| CNAME | `www` | `692d5a0bed12b64c.vercel-dns-017.com.` |

更换域名会更换浏览器数据存储位置。旧域名的本地数据需通过「设置 → 导出备份」保存，再到新域名的「设置 → 导入备份」恢复；同一 Firebase 云端数据源不受域名变化影响。工作台路径和公开首页的分离不等同于登录权限控制。

本项目由 [Fiochanqwq/newmeetingapp](https://github.com/Fiochanqwq/newmeetingapp) 延续改进，保留原有仓库历史与代码署名。
