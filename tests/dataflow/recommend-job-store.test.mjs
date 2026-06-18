// Recommendation job store tests. Bundles the REAL jobStore.ts with esbuild so
// the asserted behaviour is what the server runs.
//
//   node --test tests/dataflow/recommend-job-store.test.mjs
//
// Locks down: create → running; markDone surfaces the recommendation; markError
// surfaces the message; unknown id → undefined; markDone on an unknown id is a
// no-op; and TTL eviction drops a stale job when a new one is created.

import { test } from "node:test";
import assert from "node:assert/strict";
import { build } from "esbuild";
import { pathToFileURL } from "node:url";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import path from "node:path";

const ROOT = process.cwd();
const entry = `
export { createJob, getJob, markDone, markError } from ${JSON.stringify(
  path.join(ROOT, "src/lib/recommend/jobStore.ts"),
)};
`;
const dir = await mkdtemp(join(tmpdir(), "rec-job-"));
const out = join(dir, "b.mjs");
await build({
  stdin: { contents: entry, resolveDir: ROOT, loader: "ts" },
  bundle: true,
  format: "esm",
  platform: "node",
  outfile: out,
  logLevel: "silent",
});
const { createJob, getJob, markDone, markError } = await import(pathToFileURL(out).href);

const REC = { primaryMethod: "V60", candidates: [], reasoning: "x" };

test("createJob → running, then markDone → done with the recommendation", () => {
  const id = createJob();
  assert.equal(getJob(id).status, "running");
  markDone(id, REC);
  const job = getJob(id);
  assert.equal(job.status, "done");
  assert.deepEqual(job.recommendation, REC);
});

test("markError → error with the message", () => {
  const id = createJob();
  markError(id, "boom");
  const job = getJob(id);
  assert.equal(job.status, "error");
  assert.equal(job.error, "boom");
});

test("unknown id → undefined; markDone/markError on it are no-ops", () => {
  assert.equal(getJob("nope"), undefined);
  markDone("nope", REC); // must not throw
  markError("nope", "x"); // must not throw
  assert.equal(getJob("nope"), undefined);
});

test("TTL eviction: a stale job is dropped when a new job is created", () => {
  const realNow = Date.now;
  try {
    const base = 1_700_000_000_000;
    Date.now = () => base;
    const oldId = createJob();
    assert.equal(getJob(oldId).status, "running");
    // Jump >10 min — the next createJob() runs evictStale().
    Date.now = () => base + 11 * 60 * 1000;
    const freshId = createJob();
    assert.equal(getJob(oldId), undefined, "stale job evicted");
    assert.equal(getJob(freshId).status, "running", "fresh job survives");
  } finally {
    Date.now = realNow;
  }
});
