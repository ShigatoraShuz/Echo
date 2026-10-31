import { test } from "node:test";
import assert from "node:assert/strict";
import net from "node:net";
import http from "node:http";
import { spawn } from "node:child_process";
import { localEnvironment, checkPort } from "./run-local-dev.mjs";

test("adds loopback exclusions while preserving proxy settings without mutating the parent", () => {
  const input = { NO_PROXY: "existing.internal", no_proxy: "other.internal", HTTPS_PROXY: "http://proxy.invalid" };
  const result = localEnvironment(input);
  for (const host of ["existing.internal", "other.internal", "localhost", "127.0.0.1", "::1"])
    assert.ok(result.NO_PROXY.split(",").includes(host));
  assert.equal(result.HTTPS_PROXY, input.HTTPS_PROXY);
  assert.equal(input.NO_PROXY, "existing.internal");
  assert.equal(result.no_proxy, result.NO_PROXY);
});
test("rejects an occupied loopback port and does not stop its owner", async () => {
  const server = net.createServer();
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const port = server.address().port;
  try {
    await assert.rejects(checkPort(port), /already starts frontend and backend/);
    assert.equal(server.listening, true);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
  await checkPort(port);
});

test("child Node fetch reaches loopback even with environment proxies enabled", async () => {
  const server = http.createServer((req, res) => res.end("synthetic"));
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  try {
    const url = `http://127.0.0.1:${server.address().port}`;
    const child = spawn(
      process.execPath,
      [
        "-e",
        `fetch(${JSON.stringify(url)},{signal:AbortSignal.timeout(3000)}).then(async r=>{if(await r.text()!=='synthetic')process.exitCode=1}).catch(()=>process.exitCode=1)`,
      ],
      {
        env: localEnvironment({
          ...process.env,
          NODE_USE_ENV_PROXY: "1",
          HTTP_PROXY: "http://127.0.0.1:1",
          HTTPS_PROXY: "http://127.0.0.1:1",
        }),
        stdio: "pipe",
        windowsHide: true,
      },
    );
    const code = await new Promise((resolve, reject) => {
      child.once("exit", resolve);
      child.once("error", reject);
    });
    assert.equal(code, 0);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});
