# JWKS serverless compatibility

`jwks-rsa@4.1.0.patch` replaces its two synchronous `require('jose')` calls with native dynamic imports. Vercel's Node runtime rejected the original ESM-only dependency during function initialization. Both the utilities and the passport entrypoint are loaded by the public package entrypoint, even when only Firebase Auth is used.

The patch retains Firebase Admin 14, JOSE 6, key filtering, supported algorithms and signature verification. It does not enable experimental Node flags or downgrade authentication dependencies. Module loading failure reaches the passport callback as an error; malformed tokens retain the existing rejection behavior.

Related upstream reports: [Auth0 issue #507](https://github.com/auth0/node-jwks-rsa/issues/507), [proposed upstream fix #508](https://github.com/auth0/node-jwks-rsa/pull/508). Our patch uses direct native imports because this dependency executes under Node; it does not copy the proposed fix's dynamic `Function` loader.

Use `bun install --frozen-lockfile` so Bun applies the version-specific patch from `package.json`. An npm-only installation will not apply Bun patches. Run `npm run test:server-runtime` after installation: it tests API startup with synchronous ESM loading disabled, RSA JWK conversion, valid and tampered signatures, and passport callback rejection. These tests do not connect to a database or external JWKS endpoint.

Remove this patch and its `patchedDependencies` entry after upgrading to an upstream version that passes the same tests and an actual Vercel invocation. Do not remove it based only on a successful static build.
