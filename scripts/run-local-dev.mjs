import net from "node:net";
import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = fileURLToPath(new URL("../", import.meta.url));
const require = createRequire(import.meta.url);
export function localEnvironment(environment) {
  const exclusions = [environment.NO_PROXY, environment.no_proxy]
    .filter(Boolean)
    .join(",")
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);
  const bypass = [...new Set([...exclusions, "localhost", "127.0.0.1", "::1", "[::1]"])].join(",");
  return { ...environment, NO_PROXY: bypass, no_proxy: bypass };
}
async function listening(port, host) {
  return await new Promise((resolve) => {
    const socket = net.connect({ port, host });
    socket.once("connect", () => {
      socket.destroy();
      resolve(true);
    });
    socket.once("error", () => {
      socket.destroy();
      resolve(false);
    });
    socket.setTimeout(1500, () => {
      socket.destroy();
      resolve(true);
    });
  });
}
export async function checkPort(port, host = "0.0.0.0") {
  if ((await listening(port, "127.0.0.1")) || (await listening(port, "::1")))
    throw new Error(
      `Port ${port} is already in use. start-local-core.ps1 already starts frontend and backend; do not run a second npm run dev.`,
    );
  await new Promise((resolve, reject) => {
    const probe = net.createServer();
    probe.once("error", (error) => {
      if (error.code === "EAFNOSUPPORT" && host === "::") return checkPort(port, "0.0.0.0").then(resolve, reject);
      reject(
        new Error(
          `Port ${port} is unavailable. Stop the existing development instance first. start-local-core.ps1 already starts frontend and backend; do not run a second npm run dev.`,
          { cause: error },
        ),
      );
    });
    probe.listen({ port, host, exclusive: true }, () => probe.close((error) => (error ? reject(error) : resolve())));
  });
}
export async function run(target) {
  const services = {
    frontend: {
      port: 3000,
      bin: require.resolve("next/dist/bin/next"),
      args: ["dev", "--hostname", "127.0.0.1", "--port", "3000"],
    },
    backend: { port: 4200, bin: require.resolve("tsx/cli"), args: ["watch", "--env-file=.env", "src/server.ts"] },
  };
  if (!["all", "frontend", "backend"].includes(target)) throw Error("Expected all, frontend or backend.");
  const names = target === "all" ? ["frontend", "backend"] : [target];
  await Promise.all(names.map((name) => checkPort(services[name].port)));
  const children = [];
  let stopping = false;
  const stop = () => {
    if (stopping) return;
    stopping = true;
    for (const child of children) if (child.exitCode === null) child.kill();
  };
  process.once("SIGINT", stop);
  process.once("SIGTERM", stop);
  for (const name of names) {
    const service = services[name];
    const child = spawn(process.execPath, [service.bin, ...service.args], {
      cwd: path.join(root, name),
      env: localEnvironment(process.env),
      stdio: "inherit",
      windowsHide: true,
    });
    children.push(child);
    child.once("error", () => {
      process.exitCode = 1;
      stop();
    });
    child.once("exit", (code) => {
      if (!stopping) {
        process.exitCode = code ?? 1;
        stop();
      }
    });
  }
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    await run(process.argv[2]);
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
