import * as fs from "fs";
import * as path from "path";
import * as readline from "readline";

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

// Interactive prompt helper
function askQuestion(query: string): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) =>
    rl.question(query, (ans) => {
      rl.close();
      resolve(ans.trim());
    })
  );
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
      console.log(`Deleting existing credential to recreate: ${name} (ID: ${existingCred.id})...`);
      await n8nRequest(`/api/v1/credentials/${existingCred.id}`, "DELETE");
    }
    const newCred = await n8nRequest("/api/v1/credentials", "POST", {
      name,
      type,
      data,
    });
    console.log(`Created new credential: ${name} (ID: ${newCred.id})`);
    return newCred.id;
  } catch (err: any) {
    console.error(`Error setting up credential ${name}:`, err.message);
    process.exit(1);
  }
}

// LLM provider node configuration details
interface ProviderConfig {
  nodeType: string;
  credentialType: string;
  credentialData: any;
  nodeParameters: any;
}

function getProviderConfig(provider: string, apiKey: string, modelName: string): ProviderConfig {
  switch (provider) {
    case "1": // Deepseek (Native)
      return {
        nodeType: "@n8n/n8n-nodes-langchain.lmChatDeepSeek",
        credentialType: "deepSeekApi",
        credentialData: {
          apiKey,
          allowedHttpRequestDomains: "all",
        },
        nodeParameters: {
          model: modelName || "deepseek-chat",
          options: {},
        },
      };
    case "2": // OpenAI
      return {
        nodeType: "@n8n/n8n-nodes-langchain.lmChatOpenAi",
        credentialType: "openAiApi",
        credentialData: {
          apiKey,
          header: false,
          allowedHttpRequestDomains: "all",
        },
        nodeParameters: {
          model: modelName || "gpt-4o-mini",
          options: {},
        },
      };
    case "3": // Google Gemini
      return {
        nodeType: "@n8n/n8n-nodes-langchain.lmChatGoogleGemini",
        credentialType: "googlePalmApi",
        credentialData: {
          apiKey,
          host: "https://generativelanguage.googleapis.com",
          allowedHttpRequestDomains: "all",
        },
        nodeParameters: {
          model: modelName || "gemini-1.5-flash",
          options: {},
        },
      };
    case "4": // Anthropic
      return {
        nodeType: "@n8n/n8n-nodes-langchain.lmChatAnthropic",
        credentialType: "anthropicApi",
        credentialData: {
          apiKey,
          allowedHttpRequestDomains: "all",
        },
        nodeParameters: {
          model: modelName || "claude-3-5-sonnet-latest",
          options: {},
        },
      };
    default:
      throw new Error("Invalid provider chosen");
  }
}

async function main() {
  console.log("\n==================================================");
  console.log("Welcome to n8n Kickstart Interactive Setup");
  console.log("==================================================");

  // 1. Ask for Primary Provider
  console.log("\nSelect Primary LLM Provider:");
  console.log("1. Deepseek (Native Node)");
  console.log("2. OpenAI (Standard)");
  console.log("3. Google Gemini");
  console.log("4. Anthropic");
  const primaryProviderChoice = await askQuestion("Enter choice (1-4) [default: 1]: ") || "1";

  let defaultModel = "deepseek-chat";
  if (primaryProviderChoice === "2") defaultModel = "gpt-4o-mini";
  else if (primaryProviderChoice === "3") defaultModel = "gemini-1.5-flash";
  else if (primaryProviderChoice === "4") defaultModel = "claude-3-5-sonnet-latest";

  const primaryModelName = await askQuestion(`Enter primary model name [default: ${defaultModel}]: `) || defaultModel;

  let defaultKey = "";
  if (primaryProviderChoice === "1") defaultKey = process.env.DEEPSEEK_API_KEY || "";
  else if (primaryProviderChoice === "3") defaultKey = process.env.GEMINI_API_KEY || "";

  const primaryApiKey = await askQuestion(`Enter API key [default: ${defaultKey ? "Loaded from .env" : "None"}]: `) || defaultKey;
  if (!primaryApiKey) {
    console.error("API Key is required.");
    process.exit(1);
  }

  // 2. Ask for Fallback Provider
  const configureFallback = (await askQuestion("\nDo you want to configure a Fallback LLM Model? (y/n) [default: n]: ") || "n").toLowerCase() === "y";
  let fallbackProviderChoice = "";
  let fallbackModelName = "";
  let fallbackApiKey = "";

  if (configureFallback) {
    console.log("\nSelect Fallback LLM Provider:");
    console.log("1. Deepseek (Native Node)");
    console.log("2. OpenAI (Standard)");
    console.log("3. Google Gemini");
    console.log("4. Anthropic");
    fallbackProviderChoice = await askQuestion("Enter choice (1-4) [default: 3]: ") || "3";

    let defaultFallbackModel = "gemini-1.5-flash";
    if (fallbackProviderChoice === "1") defaultFallbackModel = "deepseek-chat";
    else if (fallbackProviderChoice === "2") defaultFallbackModel = "gpt-4o-mini";
    else if (fallbackProviderChoice === "4") defaultFallbackModel = "claude-3-5-sonnet-latest";

    fallbackModelName = await askQuestion(`Enter fallback model name [default: ${defaultFallbackModel}]: `) || defaultFallbackModel;

    let defaultFallbackKey = "";
    if (fallbackProviderChoice === "1") defaultFallbackKey = process.env.DEEPSEEK_API_KEY || "";
    else if (fallbackProviderChoice === "3") defaultFallbackKey = process.env.GEMINI_API_KEY || "";

    fallbackApiKey = await askQuestion(`Enter fallback API key [default: ${defaultFallbackKey ? "Loaded from .env" : "None"}]: `) || defaultFallbackKey;
    if (!fallbackApiKey) {
      console.error("Fallback API Key is required when fallback is enabled.");
      process.exit(1);
    }
  }

  console.log("\n==================================================");
  console.log("Setting up credentials on n8n server...");
  console.log("==================================================");

  // 1. Manage IMAP Credentials
  const imapCredId = await getOrCreateCredential("Semillero2_IMAP", "imap", {
    host: EMAIL_HOST,
    port: EMAIL_PORT,
    user: EMAIL_USER,
    password: EMAIL_PASSWORD,
    secure: true,
  });

  // 2. Manage Supabase Credentials using modern keys structure
  const supabaseCredId = await getOrCreateCredential("Semillero2_Supabase", "supabaseApi", {
    host: SUPABASE_URL,
    serviceRole: SUPABASE_SECRET_KEY,
    allowedHttpRequestDomains: "all",
  });

  // 3. Manage Primary Model Credentials
  const primaryConfig = getProviderConfig(primaryProviderChoice, primaryApiKey, primaryModelName);
  const primaryCredId = await getOrCreateCredential("Semillero2_Primary_Model", primaryConfig.credentialType, primaryConfig.credentialData);

  // 4. Manage Fallback Model Credentials (if enabled)
  let fallbackConfig: ProviderConfig | null = null;
  let fallbackCredId = "";
  if (configureFallback) {
    fallbackConfig = getProviderConfig(fallbackProviderChoice, fallbackApiKey, fallbackModelName);
    fallbackCredId = await getOrCreateCredential("Semillero2_Fallback_Model", fallbackConfig.credentialType, fallbackConfig.credentialData);
  }

  // Define nodes dynamically
  console.log("\nBuilding workflow configurations...");

  const parserNode = {
    parameters: {
      jsonSchema: "{\n  \"type\": \"object\",\n  \"properties\": {\n    \"summary\": {\n      \"type\": \"string\"\n    },\n    \"classification\": {\n      \"type\": \"string\",\n      \"enum\": [\"Qualified\", \"Unqualified\", \"Review\"]\n    },\n    \"suggestions\": {\n      \"type\": \"array\",\n      \"items\": {\n        \"type\": \"string\"\n      }\n    },\n    \"riskLevel\": {\n      \"type\": \"string\",\n      \"enum\": [\"Low\", \"Medium\", \"High\"]\n    }\n  },\n  \"required\": [\"summary\", \"classification\", \"suggestions\", \"riskLevel\"]\n}",
    },
    id: "w3-parser-primary-id",
    name: "Structured Output Parser",
    type: "@n8n/n8n-nodes-langchain.outputParserStructured",
    typeVersion: 1,
    position: [680, 480],
  };

  const primaryChainNode = {
    parameters: {
      promptType: "Define below", // Fixed casing as required!
      text: "={{ $json.text }}",
      systemMessage: "You are an AI recruitment assistant. Analyze the candidate's CV text. You MUST respond with a raw JSON object containing exactly these four keys:\n- summary: a brief profile summary.\n- classification: 'Qualified', 'Unqualified', or 'Review'.\n- suggestions: an array of recommendations for next steps.\n- riskLevel: 'Low', 'Medium', or 'High'.\n\nDo not include markdown code blocks or any text outside the JSON.",
    },
    id: "w3-chain-primary-id",
    name: "Basic LLM Chain (Primary)",
    type: "@n8n/n8n-nodes-langchain.chainLlm",
    typeVersion: 1.4,
    position: [480, 300],
    continueOnFail: configureFallback, // enable continue on fail only if fallback exists
  };

  const primaryModelNode = {
    parameters: primaryConfig.nodeParameters,
    id: "w3-model-primary-id",
    name: "Primary Chat Model",
    type: primaryConfig.nodeType,
    typeVersion: 1,
    position: [480, 480],
    credentials: {
      [primaryConfig.credentialType]: {
        id: primaryCredId,
        name: "Semillero2_Primary_Model",
      },
    },
  };

  const parsePrimaryNode = {
    parameters: {
      jsCode: `return [{
  json: {
    name: $('Execute Workflow Trigger').item.json.name || "Unknown Candidate",
    email: $('Execute Workflow Trigger').item.json.email || "unknown@example.com",
    summary: $input.first().json.summary,
    seniority: $input.first().json.classification
  }
}];`,
    },
    id: "w3-parse-primary-id",
    name: "Parse Primary Response",
    type: "n8n-nodes-base.code",
    typeVersion: 2,
    position: [900, 200],
  };

  const supabaseInsertNode = {
    parameters: {
      operation: "insert",
      table: "candidates",
      options: {},
    },
    id: "w3-supabase-id",
    name: "Insert Candidate to Supabase",
    type: "n8n-nodes-base.supabase",
    typeVersion: 1,
    position: [1150, 300],
    credentials: {
      supabaseApi: {
        id: supabaseCredId,
        name: "Semillero2_Supabase",
      },
    },
  };

  // Build the complete list of nodes and connections for Workflow 3
  const w3Nodes: any[] = [
    {
      parameters: {},
      id: "w3-trigger-id",
      name: "Execute Workflow Trigger",
      type: "n8n-nodes-base.executeWorkflowTrigger",
      typeVersion: 1,
      position: [250, 300],
    },
    primaryChainNode,
    primaryModelNode,
    parserNode,
    supabaseInsertNode,
  ];

  const w3Connections: any = {
    "Execute Workflow Trigger": {
      main: [
        [
          {
            node: "Basic LLM Chain (Primary)",
            type: "main",
            index: 0,
          },
        ],
      ],
    },
    "Primary Chat Model": {
      ai_languageModel: [
        [
          {
            node: "Basic LLM Chain (Primary)",
            type: "ai_languageModel",
            index: 0,
          },
        ],
      ],
    },
    "Structured Output Parser": {
      outputParser: [
        [
          {
            node: "Basic LLM Chain (Primary)",
            type: "outputParser",
            index: 0,
          },
        ],
      ],
    },
  };

  if (configureFallback && fallbackConfig) {
    console.log("Configuring error handling and fallback route...");

    const checkErrorNode = {
      parameters: {
        conditions: {
          boolean: [
            {
              value1: "={{ $json.hasOwnProperty('error') }}",
              value2: true,
            },
          ],
        },
      },
      id: "w3-check-error-id",
      name: "Check Primary Error",
      type: "n8n-nodes-base.if",
      typeVersion: 2.2,
      position: [680, 200],
    };

    const fallbackChainNode = {
      parameters: {
        promptType: "Define below",
        text: "={{ $('Execute Workflow Trigger').item.json.text }}",
        systemMessage: "You are an AI recruitment assistant. Analyze the candidate's CV text. You MUST respond with a raw JSON object containing exactly these four keys:\n- summary: a brief profile summary.\n- classification: 'Qualified', 'Unqualified', or 'Review'.\n- suggestions: an array of recommendations for next steps.\n- riskLevel: 'Low', 'Medium', or 'High'.\n\nDo not include markdown code blocks or any text outside the JSON.",
      },
      id: "w3-chain-fallback-id",
      name: "Basic LLM Chain (Fallback)",
      type: "@n8n/n8n-nodes-langchain.chainLlm",
      typeVersion: 1.4,
      position: [900, 400],
    };

    const fallbackModelNode = {
      parameters: fallbackConfig.nodeParameters,
      id: "w3-model-fallback-id",
      name: "Fallback Chat Model",
      type: fallbackConfig.nodeType,
      typeVersion: 1,
      position: [900, 580],
      credentials: {
        [fallbackConfig.credentialType]: {
          id: fallbackCredId,
          name: "Semillero2_Fallback_Model",
        },
      },
    };

    const parserFallbackNode = {
      parameters: {
        jsonSchema: "{\n  \"type\": \"object\",\n  \"properties\": {\n    \"summary\": {\n      \"type\": \"string\"\n    },\n    \"classification\": {\n      \"type\": \"string\",\n      \"enum\": [\"Qualified\", \"Unqualified\", \"Review\"]\n    },\n    \"suggestions\": {\n      \"type\": \"array\",\n      \"items\": {\n        \"type\": \"string\"\n      }\n    },\n    \"riskLevel\": {\n      \"type\": \"string\",\n      \"enum\": [\"Low\", \"Medium\", \"High\"]\n    }\n  },\n  \"required\": [\"summary\", \"classification\", \"suggestions\", \"riskLevel\"]\n}",
      },
      id: "w3-parser-fallback-id",
      name: "Structured Output Parser (Fallback)",
      type: "@n8n/n8n-nodes-langchain.outputParserStructured",
      typeVersion: 1,
      position: [1050, 580],
    };

    const parseFallbackNode = {
      parameters: {
        jsCode: `return [{
  json: {
    name: $('Execute Workflow Trigger').item.json.name || "Unknown Candidate",
    email: $('Execute Workflow Trigger').item.json.email || "unknown@example.com",
    summary: $input.first().json.summary,
    seniority: $input.first().json.classification
  }
}];`,
      },
      id: "w3-parse-fallback-id",
      name: "Parse Fallback Response",
      type: "n8n-nodes-base.code",
      typeVersion: 2,
      position: [1120, 400],
    };

    w3Nodes.push(checkErrorNode, parsePrimaryNode, fallbackChainNode, fallbackModelNode, parserFallbackNode, parseFallbackNode);

    // Wire fallback connections
    w3Connections["Basic LLM Chain (Primary)"] = {
      main: [
        [
          {
            node: "Check Primary Error",
            type: "main",
            index: 0,
          },
        ],
      ],
    };

    w3Connections["Check Primary Error"] = {
      main: [
        [
          {
            node: "Basic LLM Chain (Fallback)",
            type: "main",
            index: 0,
          },
        ], // Output 0 (true -> Error happened)
        [
          {
            node: "Parse Primary Response",
            type: "main",
            index: 0,
          },
        ], // Output 1 (false -> Success)
      ],
    };

    w3Connections["Fallback Chat Model"] = {
      ai_languageModel: [
        [
          {
            node: "Basic LLM Chain (Fallback)",
            type: "ai_languageModel",
            index: 0,
          },
        ],
      ],
    };

    w3Connections["Structured Output Parser (Fallback)"] = {
      outputParser: [
        [
          {
            node: "Basic LLM Chain (Fallback)",
            type: "outputParser",
            index: 0,
          },
        ],
      ],
    };

    w3Connections["Basic LLM Chain (Fallback)"] = {
      main: [
        [
          {
            node: "Parse Fallback Response",
            type: "main",
            index: 0,
          },
        ],
      ],
    };

    w3Connections["Parse Primary Response"] = {
      main: [
        [
          {
            node: "Insert Candidate to Supabase",
            type: "main",
            index: 0,
          },
        ],
      ],
    };

    w3Connections["Parse Fallback Response"] = {
      main: [
        [
          {
            node: "Insert Candidate to Supabase",
            type: "main",
            index: 0,
          },
        ],
      ],
    };
  } else {
    // If no fallback, wire directly Primary Chain -> Parse Primary Response -> Supabase
    w3Nodes.push(parsePrimaryNode);
    w3Connections["Basic LLM Chain (Primary)"] = {
      main: [
        [
          {
            node: "Parse Primary Response",
            type: "main",
            index: 0,
          },
        ],
      ],
    };
    w3Connections["Parse Primary Response"] = {
      main: [
        [
          {
            node: "Insert Candidate to Supabase",
            type: "main",
            index: 0,
          },
        ],
      ],
    };
  }

  // 5. Deploy Workflow 3
  console.log("\nDeploying Workflow 3: Core AI Parsing Sub-workflow...");
  const workflow3Definition = {
    name: "Semillero2: Core AI Parsing Sub-workflow",
    settings: {},
    nodes: w3Nodes,
    connections: w3Connections,
  };

  const w3Result = await n8nRequest("/api/v1/workflows", "POST", workflow3Definition);
  const w3Id = w3Result.id;
  console.log(`Workflow 3 deployed successfully (ID: ${w3Id})`);

  // 6. Define Workflow 1: The API Gateway (Web UI Ingestion)
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

  // 7. Define Workflow 2: Email Ingestion Listener
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
