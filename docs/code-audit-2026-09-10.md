# 代码检查与必要功能建议

日期：2026-09-10。范围：现有 React 工作台、Firebase 读写、表决、导入导出、公开档案路由。没有迁移 Supabase，也没有将内部资料发布到公开档案馆。

## 发布状态

- UI PR #1 已合并到 `main`，合并提交 `d2ca0f280c328884f8414aaac42cfd9eec41c83e`。正式首页、档案馆、文章页、工作台入口和 `/preview/` 已检查 HTTP 响应；未知档案文章返回 404。
- PDF、Word 与会议改名此前已通过 PR #4 合并到 `main`。
- 本次功能修复位于独立分支。服务端私密投票仍需配置 Vercel 凭据、处理旧票并部署规则；单凭前端和自动测试不能宣称正式云端投票已具备隐私保护。

## 已发现并在本分支修复

| 问题及影响 | 修复 | 验证位置 |
| --- | --- | --- |
| 普通共享议题保存逐人选票，提交者还可改票；客户端读得到进行中的票数 | Vercel 服务端验证当前登录身份及实时权限，事务内写独立私票；提交不可修改，只有结束时写公共汇总。本人回执单独读取 | `server/*.test.ts`、`src/lib/privateVoting.test.ts`、规则模拟器测试 |
| 旧表单全量保存，覆盖别人刚修改的库存、活动、会议记录和汇报状态 | 固定进入编辑时的原始快照，只合并实际修改字段；同字段冲突保留草稿；保存读取最新记录 | `editRecord.test.ts`、`AttendanceView.test.ts`、`issueEditing.test.ts` |
| 记录删除后，旧编辑窗口保存又把它创建回来 | 编辑已有记录时要求它仍存在；新建另行检查 ID 冲突 | `editRecord.test.ts`、`issueEditing.test.ts` |
| 手工调整状态可绕过表决，或改写已投票的命题 | 客户端与规则限制状态流转，私票结果只由服务端生成；投票命题冻结，仍可补充讨论和执行记录 | `issueEditing.test.ts`、服务端及规则测试 |
| 切换账号、离开工作区或重连后，旧文件读取／令牌请求／事务继续执行 | 每次异步边界和事务重试检查会话，失效操作终止；旧操作仍释放其忙碌计数 | `useWorkspace.test.ts`、`privateVoting.test.ts`、`firebasePersistence.test.ts` |
| 同一浏览器多标签分别读旧数据后保存，可能互相覆盖 | 支持 Web Locks 时串行执行“读最新数据→修改→验证→保存”；不支持时明确提示单标签编辑 | `workspacePersistence.test.ts` |
| 删除有议题或签到的会议，留下失去所属会议的记录 | 云端事务查询最新关联后删除，本地在写入锁内检查；新议题和签到也验证父会议 | 服务端会议删除测试、`firebasePersistence.test.ts` |
| 导入前只做部分校验，后部坏记录可能造成不必要的部分导入 | 写第一批前验证全部格式、ID、尺寸和父会议；限制每批大小和父记录访问数量 | `firebasePersistence.test.ts` |
| 旧备份可能回退正在表决的议题、覆盖结束结果 | 导入事务保留服务器状态、关联、归档及投票字段，冻结命题保持原值；新编号的历史投票不能通过普通 JSON 伪造恢复 | `firebasePersistence.test.ts` |
| 表单连续点击触发重复操作，保存期间继续编辑造成界面与已存内容不一致 | 同步提交锁及保存状态禁用控件；失败保留输入 | 公用 `WorkspaceForms`、本地浏览器验收 |
| TXT 纪要也会显示进行中票数 | 只有已结束的表决才导出匿名汇总；PDF/Word/LaTeX 继续使用结构化字段白名单 | `workspace.test.ts`、`meetingExport.test.ts` |
| 工作台仍请求 Google Fonts；档案把直接执行事项称作“经表决通过” | 工作台改用本机字体，PDF 字体仍同源按需加载；档案标题改为“通过与执行事项” | 源码与生产构建检查 |
| Vercel 可完成构建，但原生 Node ESM 因相对导入缺少扩展名而无法启动函数 | 服务端相对导入显式指向编译后的 `.js`，新增独立编译后用原生 Node 加载的测试 | `tests/server-runtime.mjs` |

## 验证结果

- `bun test`：219 项通过，1138 个断言。
- `bun run lint`：TypeScript 检查通过；服务端路径修复后 80 项服务端测试复核通过。
- `bun run test:server-runtime`：独立编译的原生 Node ESM 函数启动与未登录边界验证通过。
- Firestore Emulator：26 项通过，覆盖真实规则执行和跨角色访问。
- `bun run build` 与 `bun run check:public`：通过；检查了 6 个无应用脚本的公开页面及 404。
- 客户端构建产物未发现服务账号变量、Admin SDK 或 Google Fonts 请求地址；工作台包仍有超过 500 kB 的构建体积提示。

## 验证边界

本地浏览器使用专门创建的测试例会和测试委员，验证新建议题、签到、发起表决、零票取消、提交锁定、已有票拒绝取消、结束后匿名结果及档案文档入口。没有向正式数据库写测试成员或测试选票。

服务端事务测试涵盖同账号并发投票、改票拒绝、结束与首票竞争、零票取消竞争、权限撤销以及旧票幂等转存。数据库规则需另外使用 Firestore 模拟器验证，模拟器通过不能代替正式凭据、旧数据及两个真实账号的上线验收。

本地存储没有账号级隔离，演示界面对此有明确说明。过去已公开或下载的旧选票无法撤回其历史可见性。旧表决须转存后暂停，由管理员明确决定是否结算；迁移不会自动替会议作出通过或否决决定。

## 建议新增的必要功能

| 优先级 | 功能 | 必要原因与最小实现 |
| --- | --- | --- |
| 1 | 草稿恢复和离开提示 | 本次修复保留保存失败时的输入，但刷新或切换页面仍会丢掉未提交文字。先做按账号、工作区、记录分开的本机草稿与离开提示，恢复前比较最新版本；退出登录清理敏感草稿，不保存个人选票 |
| 1 | 可恢复删除与操作记录 | 库存、资料、编辑排期和活动仍可能被误删。改为标记删除并提供恢复，记录操作者、时间和变更字段；操作记录中不写个人选票，投票历史继续禁止普通删除 |
| 1 | 完整备份及受控恢复 | 当前 JSON 只覆盖业务集合，无法恢复服务端私票和授权结构。增加管理员运维侧的加密备份、恢复演练与导入差异预览，私票数据不进入普通成员下载；云服务备份如涉及计费应单独确定 |

公开档案馆近期只需补充经确认可公开的真实届次和稿件，继续通过 GitHub 审阅静态发布。现阶段无需新增评论、点赞、聊天、复杂 CMS 或自动公开内部纪要。签到与账号关联可在需要防止代签时再做，不能把手选成员名册当作已经完成实名验证。

## 附录：依赖审计与兼容补丁

2026-09-10 使用 Bun 1.4.2 的 `bun audit --json`，并通过 `npm ls --all --json` 和实际源码调用核对依赖路径。更新前是 **10 个包、12 条告警（3 条 high、9 条 moderate）**；定向更新后是 **5 个包、6 条告警，均为 moderate**。严重程度以此次 Bun 审计的 `severity` 字段计数；告警数量不等同于已确认可利用的应用漏洞数量，也没有审计清零。

执行的兼容更新命令如下。它只更新 `bun.lock`，没有新增直接依赖、强制 overrides 或跨 major 更新，保留 Node `22.x` 与 `test:rules` 配置。Bun 会按各父包声明的范围解析同名包的不同版本分支，见 [Bun 定向更新文档](https://bun.sh/docs/pm/cli/update)。

```sh
bun update dompurify postcss nanoid browserslist baseline-browser-mapping body-parser qs
```

| 已更新的依赖分支 | 更新前 → 更新后 | 当前项目使用路径 |
| --- | --- | --- |
| `dompurify` | `3.4.12` → `3.4.15` | `jspdf@4.2.1` 的可选 HTML 渲染依赖；目前会议 PDF 使用文字与表格绘制，没有调用 jsPDF 的 `html()` |
| `postcss` | `8.5.20` → `8.5.28` | Vite、Autoprefixer 构建时处理 CSS |
| `nanoid` 的 3.x 分支 | `3.3.16` → `3.3.18` | PostCSS；DOCX 使用的独立 `nanoid@5.1.16` 保持原版本 |
| `browserslist` | `4.28.6` → `4.28.9` | Autoprefixer、React 插件的 Babel 编译目标处理；清除该包的两条告警 |
| `baseline-browser-mapping` | `2.10.43` → `2.11.21` | Browserslist 的构建依赖 |
| `body-parser` 的 1.x 分支 | `1.20.6` → `1.20.8` | Express 4、Firebase CLI；新版允许 `qs@~6.16.0` |
| `qs` 的兼容分支 | `6.15.3` → `6.16.0` | body-parser、Express 5、exegesis、googleapis-common 等允许该版本的分支；Express 4 自身仍保留下面列出的旧分支 |

剩余告警及边界如下。依赖路径中的箭头表示父包引入子包；“没有当前调用路径”是对现有源码的检查结论，不能替代将来新增功能后的复核。

| 剩余包与告警数 | 核实的版本和依赖路径 | 当前影响与暂不强制升级的原因 |
| --- | --- | --- |
| `@opentelemetry/core`，1 条 | `firebase-tools@15.30.0` → `@google-cloud/pubsub@5.3.1` → `@opentelemetry/core@1.30.1` | 属于开发侧 Firebase CLI 链。公告涉及不受限的入站 Baggage 解析；当前投票 API 不引入该 Pub/Sub 链。补丁要求 `2.8.0`，超出父包的 1.x 范围，等待上游兼容更新。[公告](https://github.com/advisories/GHSA-8988-4f7v-96qf) |
| `csv-parse`，1 条 | `firebase-tools@15.30.0` → `csv-parse@5.6.0` | Firebase CLI 的 Auth CSV 导入使用该包；当前应用和 API 不解析 CSV，所检查的 CLI 调用也没有启用公告涉及的 `columns` 配置。补丁为 `7.0.2`，不能直接替换其 5.x 依赖。[公告](https://github.com/advisories/GHSA-8cw4-87c7-c6xx) |
| `qs`，2 条 | 直接依赖 `express@4.22.2` → `qs@6.15.3`；Firebase CLI 也使用此 Express 4 分支 | Express 4 的当前最新版仍声明 `~6.15.1`，因此不能在遵守范围的更新中安装 `6.16.0`。现有 `api/voting.ts` 使用原生 Node 请求对象，服务端自行限制并解析 JSON，不导入 Express 或 qs；但这些包仍在生产依赖清单内，不能称为纯开发依赖。若以后启用 Express 请求处理，须先复核并更新这一分支。[数组限制绕过](https://github.com/advisories/GHSA-x5fp-wj9c-mxmx)、[isBuffer 拒绝服务](https://github.com/advisories/GHSA-4mjr-xmp4-gh2g) |
| `stream-json`，1 条 | `firebase-tools@15.30.0` → `stream-json@1.9.1` | CLI 的 Auth JSON 导入、Realtime Database 导入和 Next.js 构建跟踪读取会使用相关过滤器；当前 Vite 应用及投票 API 不引入它。公告描述深层 JSON 导致高耗时，补丁为 `3.4.1`，超出当前 1.x 范围。不要将未经检查的外部 JSON 交给这些导入命令。[公告](https://github.com/advisories/GHSA-528h-pc64-c93x) |
| `uuid`，1 条 | Firebase CLI → `gaxios@6.7.1` → `uuid@9.0.1`；另有生产依赖 `firebase-admin@14.3.0` → 可选的 `@google-cloud/storage@7.22.0` → `gaxios@6.7.1`／`teeny-request@9.0.0` → `uuid@9.0.1` | 不能归为纯开发依赖。当前 API 只使用 Admin 的 app、auth、firestore 入口；无网络的模块初始化检查没有加载 Storage 或 uuid。所检查的 gaxios、teeny-request 调用为 `uuid.v4()`，公告影响的是带输出缓冲区参数的 v3／v5／v6。补丁最低为 `11.1.1`，不强制覆盖父包的 9.x 范围。[公告](https://github.com/advisories/GHSA-w5hq-g745-h8pq) |

后续应在 Firebase CLI、Express 4 和 Google Cloud Storage 等上游更新后重新执行定向更新及审计。若引入 Express 服务、Storage、Pub/Sub、CSV 或不可信 JSON 处理，应同时重新检查这些路径，不能沿用本次“当前未调用”的判断。此次只完成本地依赖解析与检查，没有据此声明生产部署已经更新。
