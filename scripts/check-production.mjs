// Smoke-checks the live site: status codes plus a marker that proves the right
// file was served (public HTML vs workspace shell vs 404). Prints a Markdown
// report and exits non-zero on any failure. Usage: SITE_URL=https://… node scripts/check-production.mjs
const site = (process.env.SITE_URL || "https://www.anticocouncil.com").replace(/\/+$/, "");

const checks = [
  { path: "/", status: 200, marker: "安提柯议会公开档案馆", label: "首页" },
  { path: "/archive", status: 200, marker: "公开档案馆 · 安提柯议会", label: "档案目录" },
  { path: "/archive/sample-working-records", status: 200, marker: "会议与工作记录的整理", label: "档案文章" },
  { path: "/portal", status: 200, marker: "data-workspace-only", label: "成员工作台" },
  { path: "/local", status: 200, marker: "data-workspace-only", label: "本地工作台" },
  { path: "/preview/", status: 200, marker: "新 UI 试用区", label: "示例演示" },
  { path: "/wechat-workbench/", status: 200, marker: "<title>", label: "微信草稿箱" },
  { path: "/__/auth/handler", status: 200, marker: "", label: "Firebase 登录代理" },
  { path: "/archive/__smoke-missing__", status: 404, marker: "页面未找到", label: "不存在的文章返回 404" },
];

async function run(check) {
  const started = Date.now();
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const response = await fetch(site + check.path, {
        redirect: "follow",
        headers: { "User-Agent": "anticocouncil-uptime-check" },
        signal: AbortSignal.timeout(20_000),
      });
      const body = await response.text();
      const problems = [];
      if (response.status !== check.status) problems.push(`状态码 ${response.status}，应为 ${check.status}`);
      if (!body.includes(check.marker)) problems.push(`页面缺少「${check.marker}」`);
      if (!problems.length || attempt === 3) return { ...check, ok: !problems.length, detail: problems.join("；") || "正常", ms: Date.now() - started };
    } catch (error) {
      if (attempt === 3) return { ...check, ok: false, detail: `请求失败：${error.cause?.code || error.name}`, ms: Date.now() - started };
    }
    await new Promise((resolve) => setTimeout(resolve, attempt * 5_000));
  }
}

const results = await Promise.all(checks.map(run));
const failed = results.filter((r) => !r.ok);
console.log(`### ${failed.length ? `${failed.length} 项异常` : "全部正常"} · ${site}\n`);
console.log("| 页面 | 地址 | 结果 | 耗时 |\n| --- | --- | --- | --- |");
for (const r of results) console.log(`| ${r.label} | \`${r.path}\` | ${r.ok ? "正常" : "**" + r.detail + "**"} | ${r.ms} ms |`);
process.exit(failed.length ? 1 : 0);
