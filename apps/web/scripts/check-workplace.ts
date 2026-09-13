/**
 * Preflight Ambiguous AI before a demo recording.
 * Confirms users/me, then MCP auth_whoami.
 */
import { configuredWorkplace } from "../src/lib/server/workplace";

async function main() {
  const apiKey = process.env.AMBIGUOUS_API_KEY?.trim();
  if (!apiKey) {
    console.error("Set AMBIGUOUS_API_KEY in root .env before the demo.");
    process.exitCode = 1;
    return;
  }

  const me = await fetch("https://app.ambiguous.ai/api/users/me", {
    headers: { Authorization: `Bearer ${apiKey}` },
  });
  if (!me.ok) {
    console.error(`Ambiguous users/me failed: HTTP ${me.status}`);
    process.exitCode = 1;
    return;
  }
  console.log("users/me", await me.json());

  const connection = configuredWorkplace();
  try {
    const identity = await connection.workplace.identity();
    console.log("auth_whoami");
    console.log(`  Workspace: ${identity.workspaceId}`);
    console.log(`  Identity:  ${identity.name} (${identity.id})`);
    process.exitCode = 0;
  } catch (error) {
    console.error(
      "Ambiguous workplace check failed:",
      error instanceof Error ? error.message : error,
    );
    process.exitCode = 1;
  } finally {
    try {
      await connection.close();
    } catch {
      // Ignore cleanup errors on exit.
    }
  }
}

main();
