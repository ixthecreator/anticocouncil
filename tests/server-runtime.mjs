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
    // Match the serverless restriction as well as native ESM resolution.
    const result = spawnSync(process.execPath, ["--no-experimental-require-module", "--input-type=module", "-e", `
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

test("patched JWKS loads and verifies RSA keys with synchronous ESM loading disabled", () => {
  const result = spawnSync(process.execPath, ["--no-experimental-require-module", "--input-type=module", "-e", `
    import assert from "node:assert/strict";
    import { createPublicKey, generateKeyPairSync, sign, verify } from "node:crypto";
    import { createRequire } from "node:module";
    import { dirname, join } from "node:path";
    const require = createRequire(import.meta.url);
    const adminRequire = createRequire(require.resolve("firebase-admin/auth"));
    const jwks = adminRequire("jwks-rsa");
    const { retrieveSigningKeys } = adminRequire(join(dirname(adminRequire.resolve("jwks-rsa")), "utils.js"));
    const { publicKey, privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
    const publicJwk = { ...publicKey.export({ format: "jwk" }), kid: "fixture", alg: "RS256", use: "sig" };
    const privateJwk = { ...privateKey.export({ format: "jwk" }), kid: "private", alg: "RS256" };
    const keys = await retrieveSigningKeys([publicJwk, privateJwk, { kty: "RSA", n: "broken" }, { ...publicJwk, use: "enc" }]);
    assert.equal(keys.length, 1);
    assert.equal(keys[0].kid, "fixture");
    assert.deepEqual(createPublicKey(keys[0].getPublicKey()).export({ type: "spki", format: "der" }), publicKey.export({ type: "spki", format: "der" }));
    const encode = value => Buffer.from(JSON.stringify(value)).toString("base64url");
    const unsigned = encode({ alg: "RS256", kid: "fixture" }) + "." + encode({ sub: "fixture-user" });
    const signature = sign("RSA-SHA256", Buffer.from(unsigned), privateKey);
    const token = unsigned + "." + signature.toString("base64url");
    const secretProvider = jwks.passportJwtSecret({
      jwksUri: "https://unused.invalid/jwks",
      getKeysInterceptor: async () => [publicJwk],
    });
    const provide = raw => new Promise((resolve, reject) => {
      secretProvider({}, raw, (error, key) => error ? reject(error) : resolve(key));
    });
    const key = await provide(token);
    assert.equal(verify("RSA-SHA256", Buffer.from(unsigned), key, signature), true);
    assert.equal(verify("RSA-SHA256", Buffer.from(unsigned + "tampered"), key, signature), false);
    assert.equal(await provide("invalid-token"), null);
    const rejected = encode({ alg: "none", kid: "fixture" }) + "." + encode({ sub: "fixture-user" }) + ".";
    assert.equal(await provide(rejected), null);
    console.log("JWKS conversion, passport callback and RSA verification verified without network access.");
  `], { cwd: resolve(dirname(fileURLToPath(import.meta.url)), ".."), encoding: "utf8", timeout: 30_000 });
  assert.equal(result.status, 0, result.stderr || result.error?.message);
  assert.match(result.stdout, /RSA verification verified without network access/);
});
