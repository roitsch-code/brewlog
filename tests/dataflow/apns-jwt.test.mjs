// APNs provider-JWT signing test. Bundles the REAL signProviderJwt and verifies
// it produces a valid ES256 JWT (header.payload.signature) that round-trips
// against the public key — so the one purely-testable bit of the push path (the
// crypto) can't silently regress. The network send itself needs a real key +
// device and is verified on-device.
//
//   node --test tests/dataflow/apns-jwt.test.mjs

import { test } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import { build } from "esbuild";
import { pathToFileURL } from "node:url";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import path from "node:path";

const ROOT = process.cwd();
const entry = `export { signProviderJwt } from ${JSON.stringify(path.join(ROOT, "src/lib/native/apnsPush.ts"))};`;
const dir = await mkdtemp(join(tmpdir(), "apns-"));
const out = join(dir, "a.mjs");
await build({
  stdin: { contents: entry, resolveDir: ROOT, loader: "ts" },
  bundle: true,
  format: "esm",
  platform: "node",
  outfile: out,
  logLevel: "silent",
});
const { signProviderJwt } = await import(pathToFileURL(out).href);

// A throwaway P-256 key (the shape APNs keys use).
const { privateKey, publicKey } = crypto.generateKeyPairSync("ec", { namedCurve: "P-256" });
const pem = privateKey.export({ type: "pkcs8", format: "pem" }).toString();

const b64urlJson = (seg) => JSON.parse(Buffer.from(seg, "base64url").toString("utf8"));

test("signProviderJwt builds a well-formed ES256 JWT", () => {
  const jwt = signProviderJwt(pem, "ABC1234DEF", "TEAM123456", 1_700_000_000);
  const [h, p, s] = jwt.split(".");
  assert.ok(h && p && s, "three segments");

  const header = b64urlJson(h);
  assert.equal(header.alg, "ES256");
  assert.equal(header.kid, "ABC1234DEF");

  const payload = b64urlJson(p);
  assert.equal(payload.iss, "TEAM123456");
  assert.equal(payload.iat, 1_700_000_000);
});

test("the signature verifies against the public key (ieee-p1363 / JWS)", () => {
  const jwt = signProviderJwt(pem, "K", "T", 1_700_000_000);
  const [h, p, s] = jwt.split(".");
  const ok = crypto.verify(
    "SHA256",
    Buffer.from(`${h}.${p}`),
    { key: publicKey, dsaEncoding: "ieee-p1363" },
    Buffer.from(s, "base64url"),
  );
  assert.equal(ok, true);
});

test("ES256 JWS signature is 64 bytes (r||s), not DER", () => {
  const jwt = signProviderJwt(pem, "K", "T", 1);
  const sig = Buffer.from(jwt.split(".")[2], "base64url");
  assert.equal(sig.length, 64);
});
