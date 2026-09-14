# 公开档案馆的维护

公开首页、档案目录和文章页已合并到 `main` 并上线。当前两组届次和三篇文章全部为排版示例，不代表真实历史、作者或成果；没有从 Firebase 或本地工作台提取资料。本文说明如何在仓库中维护和发布这些公开内容。

## 内容与页面

- `/`：公开首页，馆藏选读、历届目录及成员工作台入口。
- `/archive`：按届次排列的公开目录。
- `/archive/<slug>`：独立文章，含馆藏信息、正文目录、同届文章和返回入口。
- `/blog`：保留旧入口，呈现同一份档案目录。

内容在 `src/content/archive.ts` 中维护。`archiveTerms` 的数组顺序决定届次展示顺序，`archiveRecords` 的数组顺序决定文章展示顺序；`number` 是展示编号，`slug` 是稳定的文章地址。修改标题不会改变地址。每篇文章的 `termId` 必须对应一个届次 ID。

正文按 `sections` 编写，每节包含一个标题和多个纯文本段落。React 会转义文本，不支持插入任意 HTML。无需数据库、内容管理后台或新的第三方服务。

新增真实内容时，使用已经确认可公开的稿件，设置 `isExample: false` 并补齐 `publishedOn`（`YYYY-MM-DD`）与 `byline`（公开署名）。同时使用真实届次名称，删掉不再需要的示例条目。示例和真实内容的发布日期与署名由类型区分，示例不会冒用真实作者或日期。若移除全部示例，页面的设计示例提示和对应 `noindex` 会随之移除；`/blog` 作为旧入口继续 `noindex`。文章和届次都需要通过同一 GitHub 审阅流程发布。

公开档案与工作台内的「纪要档案」是两个独立入口。会议、成员、选票、每周汇报和历史签到记录不会自动成为公开文章。工作台导出的 PDF、Word 和 LaTeX 纪要按实际汇报场次收录内容，也不会自动加入公开档案馆。

## 静态生成与路由

`bun run build` 先执行 Vite，再由 `scripts/prerender-public.tsx` 将公开页面生成为独立 HTML。公开 HTML 不带应用脚本，关闭 JavaScript 仍能阅读、跳转目录和打开文章；公开样式使用系统字体。旧工作台的在线字体单独随工作台 CSS 加载，不进入公开页面。

原 Vite 应用壳保存在 `dist/workspace.html`，只为 `/portal`、`/workspace`、`/local` 服务，保留登录、本地数据和懒加载逻辑。`vercel.json` 明确映射公开目录、文章与三个工作台入口。不存在的文章或路径由 `dist/404.html` 返回 404，不再以首页作为通用 200 兜底。Firebase 代理、`/preview/` 文件及其安全头保持原样。

开发服务器继续使用 React 方便热更新；它的 SPA fallback 不代表生产 HTTP 路由。检查静态产物需先构建，再运行 `bun run check:public`；Vercel 预览还需核对公共页面的直接访问、文章标题和未知文章的 HTTP 404。原 `/preview/` 的资源应继续带独立 CSP。

## 设计参考

沿用工作台的深紫页眉、白底、清晰分隔线、蓝色文本链接和黄色键盘焦点。首页与文章增加宋体标题、馆藏编号和届次目录，让长篇资料适合阅读。参考 [英国议会委员会网站](https://committees.parliament.uk/) 的公开资料组织方式及 [GOV.UK Design System](https://design-system.service.gov.uk/components/) 的导航、面包屑和链接模式，使用项目自身品牌与组件。
