import * as fs from "fs";
import * as path from "path";

// Load .env variables
const envPath = path.join(__dirname, "../.env");
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, "utf8");
  for (const line of envContent.split("\n")) {
    const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)\s*$/);
    if (match) {
      const key = match[1];
      let value = match[2].trim();
      if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
      else if (value.startsWith("'") && value.endsWith("'")) value = value.slice(1, -1);
      process.env[key] = value;
    }
  }
}

const N8N_HOST = process.env.N8N_HOST || "https://n8n.gaboggamer.online";
const N8N_API_KEY = process.env.N8N_API_KEY;

if (!N8N_API_KEY) {
  console.error("Error: N8N_API_KEY is not defined in .env");
  process.exit(1);
}

async function main() {
  const workflowId = "OOIXDZVnULjRBdjQ";
  const response = await fetch(`${N8N_HOST}/api/v1/workflows/${workflowId}`, {
    headers: {
      "X-N8N-API-KEY": N8N_API_KEY!,
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    const text = await response.text();
    console.error(`Failed to fetch workflow: ${response.status} - ${text}`);
    process.exit(1);
  }

  const workflow = await response.json();
  console.log("\n================ DEPLOYED NODES ================");
  console.log(JSON.stringify(workflow.nodes, null, 2));
  console.log("\n============= DEPLOYED CONNECTIONS =============");
  console.log(JSON.stringify(workflow.connections, null, 2));
}

main().catch(console.error);
