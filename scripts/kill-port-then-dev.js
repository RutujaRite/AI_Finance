const { execSync, spawn } = require("child_process");

const PORT = 3001;

// Kill any process currently using port 3001
try {
  const output = execSync(`netstat -ano | findstr :${PORT}`, {
    encoding: "utf8",
  });

  const lines = output.trim().split("\n");

  const pids = new Set();

  for (const line of lines) {
    const parts = line.trim().split(/\s+/);
    const pid = parts[parts.length - 1];

    if (/^\d+$/.test(pid) && pid !== "0") {
      pids.add(pid);
    }
  }

  for (const pid of pids) {
    try {
      execSync(`taskkill /PID ${pid} /F`, {
        stdio: "ignore",
      });

      console.log(`Killed process ${pid} on port ${PORT}`);
    } catch (error) {
      // Process may already be stopped
    }
  }
} catch (error) {
  // No process is using the port
}

console.log(`Starting Next.js on port ${PORT}...`);

const next = spawn(
  process.platform === "win32" ? "npx.cmd" : "npx",
  ["next", "dev", "--port", String(PORT)],
  {
    stdio: "inherit",
    cwd: process.cwd(),
  }
);

next.on("close", (code) => {
  process.exit(code ?? 0);
});

next.on("error", (error) => {
  console.error("Failed to start Next.js:", error.message);
  process.exit(1);
});

process.on("SIGINT", () => {
  next.kill("SIGINT");
});

process.on("SIGTERM", () => {
  next.kill("SIGTERM");
});