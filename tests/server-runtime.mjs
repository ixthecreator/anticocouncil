import assert from "node:assert/strict";
import { mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { test } from "node:test";
import ts from "typescript";

test("compiled Vercel API starts under native Node ESM and rejects unauthenticated requests", async () => {
  const project = resolve(dirname(fileURLToPath(import.meta.url)), "..");
  const output = await mkdtemp(join(tmpdir(), "antico-server-runtime-"));
  try {
    // Vercel emits separate ESM files. A bundler would mask missing .js suffixes.
    const program = ts.createProgram([join(project, "api/voting.ts")], {
      rootDir: project, outDir: output, module: ts.ModuleKind.NodeNext,
      moduleResolution: ts.ModuleResolutionKind.NodeNext, target: ts.ScriptTarget.ES2022,
      skipLibCheck: true, noEmitOnError: true,
    });
    const diagnostics = ts.getPreEmitDiagnostics(program);
    assert.equal(diagnostics.length, 0, ts.formatDiagnosticsWithColorAndContext(diagnostics, {
      getCanonicalFileName: name => name, getCurrentDirectory: () => project, getNewLine: () => "\n",
    }));
    assert.equal(program.emit().emitSkipped, false);
    await writeFile(join(output, "package.json"), '{"type":"module"}');
    await symlink(join(project, "node_modules"), join(output, "node_modules"), "dir");
    const result = spawnSync(process.execPath, ["--input-type=module", "-e", `
      import assert from "node:assert/strict";
      import handler from "./api/voting.js";
      let payload;
      const headers = {};
      const response = { statusCode: 0, setHeader(key, value) { headers[key] = value; }, end(body) { payload = JSON.parse(body); } };
      await handler({ method: "GET", url: "/api/voting?action=my-ballot&issueId=fixture&roundId=fixture", headers: {} }, response);
      assert.equal(response.statusCode, 401);
      assert.equal(payload.error.code, "unauthenticated");
      assert.match(headers["Cache-Control"], /no-store/);
      console.log("Native Node ESM API boundary verified without database credentials.");
    `], { cwd: output, encoding: "utf8", timeout: 30_000 });
    assert.equal(result.status, 0, result.stderr || result.error?.message);
    assert.match(result.stdout, /Native Node ESM API boundary verified/);
  } finally {
    await rm(output, { recursive: true, force: true });
  }
});
