import * as fs from "fs";
import * as path from "path";

// Helper to manually load .env file
function loadEnv() {
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
}

loadEnv();

const N8N_HOST = process.env.N8N_HOST || "https://n8n.gaboggamer.online";
const N8N_API_KEY = process.env.N8N_API_KEY;
const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY;
const EMAIL_USER = process.env.EMAIL_USER;
const EMAIL_PASSWORD = process.env.EMAIL_PASSWORD;
const EMAIL_HOST = process.env.EMAIL_HOST;
const EMAIL_PORT = parseInt(process.env.EMAIL_PORT || "465", 10);
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SECRET_KEY = process.env.SUPABASE_SECRET_KEY;

if (!N8N_API_KEY) {
  console.error("Error: N8N_API_KEY is not defined in .env file.");
  process.exit(1);
}

// n8n request helper
async function n8nRequest(endpoint: string, method: string = "GET", body?: any) {
  const response = await fetch(`${N8N_HOST}${endpoint}`, {
    method,
    headers: {
      "X-N8N-API-KEY": N8N_API_KEY!,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`n8n API request failed: ${response.status} ${response.statusText} - ${text}`);
  }

  return response.json();
}

async function getOrCreateCredential(name: string, type: string, data: any) {
  try {
    const credsList = await n8nRequest("/api/v1/credentials");
    const existingCred = credsList.data.find((c: any) => c.name === name && c.type === type);
    if (existingCred) {
      console.log(`Reusing existing credential: ${name} (ID: ${existingCred.id})`);
      return existingCred.id;
    } else {
      const newCred = await n8nRequest("/api/v1/credentials", "POST", {
        name,
        type,
        data,
      });
      console.log(`Created new credential: ${name} (ID: ${newCred.id})`);
      return newCred.id;
    }
  } catch (err: any) {
    console.error(`Error setting up credential ${name}:`, err.message);
    process.exit(1);
  }
}

async function main() {
  console.log("Kickstarting n8n configuration with native integrations...");

  // 1. Manage IMAP Credentials
  const imapCredId = await getOrCreateCredential("Semillero2_IMAP", "imap", {
    host: EMAIL_HOST,
    port: EMAIL_PORT,
    user: EMAIL_USER,
    password: EMAIL_PASSWORD,
    secure: true,
  });

  // 2. Manage OpenAI/Deepseek Credentials with explicit required validation flags
  const openAiCredId = await getOrCreateCredential("Semillero2_OpenAI", "openAiApi", {
    apiKey: DEEPSEEK_API_KEY,
    url: "https://api.deepseek.com/v1",
    header: false,
    allowedHttpRequestDomains: "none",
  });

  // 3. Manage Supabase Credentials using modern keys structure (sb_secret_...)
  const supabaseCredId = await getOrCreateCredential("Semillero2_Supabase", "supabaseApi", {
    host: SUPABASE_URL,
    serviceRole: SUPABASE_SECRET_KEY,
    allowedHttpRequestDomains: "none",
  });

  // 4. Define Workflow 3: Core AI Parsing Sub-workflow
  console.log("Deploying Workflow 3: Core AI Parsing Sub-workflow (Native AI & Supabase)...");
  const workflow3Definition = {
    name: "Semillero2: Core AI Parsing Sub-workflow",
    settings: {},
    nodes: [
      {
        parameters: {},
        id: "w3-trigger-id",
        name: "Execute Workflow Trigger",
        type: "n8n-nodes-base.executeWorkflowTrigger",
        typeVersion: 1,
        position: [250, 300],
      },
      {
        parameters: {
          promptType: "defineBelow",
          text: "={{ $json.text }}",
          systemMessage: "You are an AI recruitment assistant. Analyze the candidate's CV text. You MUST respond with a raw JSON object containing exactly these four keys:\n- summary: a brief profile summary.\n- classification: 'Qualified', 'Unqualified', or 'Review'.\n- suggestions: an array of recommendations for next steps.\n- riskLevel: 'Low', 'Medium', or 'High'.\n\nDo not include markdown code blocks or any text outside the JSON.",
        },
        id: "w3-chain-id",
        name: "Basic LLM Chain",
        type: "@n8n/n8n-nodes-langchain.chainLlm",
        typeVersion: 1.4,
        position: [480, 300],
      },
      {
        parameters: {
          model: "deepseek-chat",
          options: {
            baseURL: "https://api.deepseek.com/v1",
          },
        },
        id: "w3-model-id",
        name: "OpenAI Chat Model",
        type: "@n8n/n8n-nodes-langchain.lmChatOpenAi",
        typeVersion: 1,
        position: [480, 480],
        credentials: {
          openAiApi: {
            id: openAiCredId,
            name: "Semillero2_OpenAI",
          },
        },
      },
      {
        parameters: {
          jsCode: `const content = $input.first().json.response.text;
const cleanedText = content.replace(/\`\`\`json\\n?|\\n?\`\`\`/g, "").trim();
const evaluation = JSON.parse(cleanedText);
return [{
  json: {
    name: $('Execute Workflow Trigger').item.json.name || "Unknown Candidate",
    email: $('Execute Workflow Trigger').item.json.email || "unknown@example.com",
    summary: evaluation.summary,
    seniority: evaluation.classification
  }
}];`,
        },
        id: "w3-parse-id",
        name: "Parse LLM Response",
        type: "n8n-nodes-base.code",
        typeVersion: 2,
        position: [700, 300],
      },
      {
        parameters: {
          operation: "insert",
          table: "candidates",
          options: {},
        },
        id: "w3-supabase-id",
        name: "Insert Candidate to Supabase",
        type: "n8n-nodes-base.supabase",
        typeVersion: 1,
        position: [920, 300],
        credentials: {
          supabaseApi: {
            id: supabaseCredId,
            name: "Semillero2_Supabase",
          },
        },
      },
    ],
    connections: {
      "Execute Workflow Trigger": {
        main: [
          [
            {
              node: "Basic LLM Chain",
              type: "main",
              index: 0,
            },
          ],
        ],
      },
      "OpenAI Chat Model": {
        ai_languageModel: [
          [
            {
              node: "Basic LLM Chain",
              type: "ai_languageModel",
              index: 0,
            },
          ],
        ],
      },
      "Basic LLM Chain": {
        main: [
          [
            {
              node: "Parse LLM Response",
              type: "main",
              index: 0,
            },
          ],
        ],
      },
      "Parse LLM Response": {
        main: [
          [
            {
              node: "Insert Candidate to Supabase",
              type: "main",
              index: 0,
            },
          ],
        ],
      },
    },
  };

  const w3Result = await n8nRequest("/api/v1/workflows", "POST", workflow3Definition);
  const w3Id = w3Result.id;
  console.log(`Workflow 3 deployed successfully (ID: ${w3Id})`);

  // 5. Define Workflow 1: The API Gateway (Web UI Ingestion)
  console.log("Deploying Workflow 1: The API Gateway...");
  const workflow1Definition = {
    name: "Semillero2: API Gateway (Web UI Ingestion)",
    settings: {},
    nodes: [
      {
        parameters: {
          path: "parse-cv",
          options: {},
        },
        id: "w1-webhook-id",
        name: "Webhook",
        type: "n8n-nodes-base.webhook",
        typeVersion: 1,
        position: [100, 300],
      },
      {
        parameters: {
          jsCode: `return $input.first().json.body.candidates.map(c => ({ json: c }));`,
        },
        id: "w1-extract-id",
        name: "Extract Candidates Array",
        type: "n8n-nodes-base.code",
        typeVersion: 2,
        position: [320, 300],
      },
      {
        parameters: {
          batchSize: 1,
          options: {},
        },
        id: "w1-loop-id",
        name: "Loop Over Candidates",
        type: "n8n-nodes-base.splitInBatches",
        typeVersion: 3,
        position: [540, 300],
      },
      {
        parameters: {
          workflowId: w3Id,
          options: {},
        },
        id: "w1-exec-id",
        name: "Execute Workflow 3",
        type: "n8n-nodes-base.executeWorkflow",
        typeVersion: 1,
        position: [760, 200],
      },
    ],
    connections: {
      Webhook: {
        main: [
          [
            {
              node: "Extract Candidates Array",
              type: "main",
              index: 0,
            },
          ],
        ],
      },
      "Extract Candidates Array": {
        main: [
          [
            {
              node: "Loop Over Candidates",
              type: "main",
              index: 0,
            },
          ],
        ],
      },
      "Loop Over Candidates": {
        main: [
          [], // Output 0 (Done)
          [
            {
              node: "Execute Workflow 3",
              type: "main",
              index: 0,
            },
          ], // Output 1 (Loop)
        ],
      },
      "Execute Workflow 3": {
        main: [
          [
            {
              node: "Loop Over Candidates",
              type: "main",
              index: 0,
            },
          ],
        ],
      },
    },
  };

  const w1Result = await n8nRequest("/api/v1/workflows", "POST", workflow1Definition);
  const w1Id = w1Result.id;
  const webhookPath = `${N8N_HOST}/webhook/${w1Id}/webhook/parse-cv`;
  console.log(`Workflow 1 deployed successfully (ID: ${w1Id})`);
  console.log(`Webhook URL: ${webhookPath}`);

  // 6. Define Workflow 2: Email Ingestion Listener
  console.log("Deploying Workflow 2: Email Ingestion Listener...");
  const workflow2Definition = {
    name: "Semillero2: Email Ingestion Listener",
    settings: {},
    nodes: [
      {
        parameters: {
          postProcessAction: "markAsRead",
          format: "resolved",
          downloadAttachments: true,
          options: {
            customEmailConfig: '["UNSEEN"]',
          },
        },
        id: "w2-imap-id",
        name: "Email Trigger (IMAP)",
        type: "n8n-nodes-base.emailReadImap",
        typeVersion: 2,
        position: [100, 300],
        credentials: {
          imap: {
            id: imapCredId,
            name: "Semillero2_IMAP",
          },
        },
      },
      {
        parameters: {
          operation: "pdf",
          binaryPropertyName: "attachment_0",
        },
        id: "w2-extract-id",
        name: "Extract From PDF",
        type: "n8n-nodes-base.extractFromFile",
        typeVersion: 1,
        position: [320, 300],
      },
      {
        parameters: {
          jsCode: `const item = $input.first().json;
const text = item.text || "";
const emailBody = $('Email Trigger (IMAP)').item.json.textHtml || $('Email Trigger (IMAP)').item.json.text || "";
const fromEmail = $('Email Trigger (IMAP)').item.json.from.value[0].address;
const fromName = $('Email Trigger (IMAP)').item.json.from.value[0].name || fromEmail.split('@')[0];
return [{
  json: {
    name: fromName,
    email: fromEmail,
    text: \`Email Body:\\n\${emailBody}\\n\\nResume Text:\\n\${text}\`
  }
}];`,
        },
        id: "w2-format-id",
        name: "Format Email Data",
        type: "n8n-nodes-base.code",
        typeVersion: 2,
        position: [540, 300],
      },
      {
        parameters: {
          workflowId: w3Id,
          options: {},
        },
        id: "w2-exec-id",
        name: "Execute Workflow 3",
        type: "n8n-nodes-base.executeWorkflow",
        typeVersion: 1,
        position: [760, 300],
      },
    ],
    connections: {
      "Email Trigger (IMAP)": {
        main: [
          [
            {
              node: "Extract From PDF",
              type: "main",
              index: 0,
            },
          ],
        ],
      },
      "Extract From PDF": {
        main: [
          [
            {
              node: "Format Email Data",
              type: "main",
              index: 0,
            },
          ],
        ],
      },
      "Format Email Data": {
        main: [
          [
            {
              node: "Execute Workflow 3",
              type: "main",
              index: 0,
            },
          ],
        ],
      },
    },
  };

  const w2Result = await n8nRequest("/api/v1/workflows", "POST", workflow2Definition);
  console.log(`Workflow 2 deployed successfully (ID: ${w2Result.id})`);

  console.log("\n==================================================");
  console.log("KICKSTART SETUP COMPLETE.");
  console.log("==================================================");
  console.log("Use the following curl command to test the API Gateway directly:");
  console.log(`curl -X POST -H "Content-Type: application/json" \\
  -d '{"source": "web", "candidates": [{"name": "Jane Developer", "email": "jane.dev@example.com", "text": "Jane is a Senior Frontend Engineer with 8 years of experience in React, Next.js, and TypeScript. Extremely qualified."}]}' \\
  "${webhookPath}"`);
  console.log("==================================================");
}

main().catch((err) => {
  console.error("Kickstart script failed:", err);
  process.exit(1);
});
