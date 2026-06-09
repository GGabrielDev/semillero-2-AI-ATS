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
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_PUBLISHABLE_KEY = process.env.SUPABASE_PUBLISHABLE_KEY;
const SUPABASE_SECRET_KEY = (process.env.SUPABASE_SECRET_KEY && process.env.SUPABASE_SECRET_KEY !== "sb_secret_your_secret_key")
  ? process.env.SUPABASE_SECRET_KEY
  : process.env.SUPABASE_PUBLISHABLE_KEY;

if (!N8N_API_KEY) {
  console.error("Error: N8N_API_KEY is not defined in .env");
  process.exit(1);
}

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
      console.log(`Deleting existing credential: ${name} (ID: ${existingCred.id})...`);
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
          allowedHttpRequestDomains: "none",
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
          allowedHttpRequestDomains: "none",
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
          allowedHttpRequestDomains: "none",
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
          allowedHttpRequestDomains: "none",
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

function normalizeProvider(provider: string): string {
  const p = provider.trim().toLowerCase();
  if (p === "1" || p === "deepseek") return "1";
  if (p === "2" || p === "openai") return "2";
  if (p === "3" || p === "gemini" || p === "google") return "3";
  if (p === "4" || p === "anthropic" || p === "claude") return "4";
  throw new Error(`Invalid provider: "${provider}". Choose from: deepseek (1), openai (2), gemini (3), anthropic (4)`);
}

function getDefaultModel(provider: string): string {
  if (provider === "1") return "deepseek-chat";
  if (provider === "2") return "gpt-4o-mini";
  if (provider === "3") return "gemini-1.5-flash";
  if (provider === "4") return "claude-3-5-sonnet-latest";
  throw new Error(`Invalid provider choice: ${provider}`);
}

function getApiKeyFromEnv(provider: string): string {
  if (provider === "1") return process.env.DEEPSEEK_API_KEY || "";
  if (provider === "2") return process.env.OPENAI_API_KEY || "";
  if (provider === "3") return process.env.GEMINI_API_KEY || "";
  if (provider === "4") return process.env.ANTHROPIC_API_KEY || "";
  return "";
}

function printUsage() {
  console.log(`
Usage: npx tsx scripts/deploy-n8n-v2.ts [options]

Options:
  --primary-provider=<name|num>   Primary LLM provider (1/deepseek, 2/openai, 3/gemini/google, 4/anthropic/claude) [default: deepseek]
  --primary-model=<model_name>    Primary model name [default based on provider]
  --primary-key=<api_key>         Primary API key [default: loaded from environment]
  --fallback                      Enable fallback LLM model [default: false]
  --fallback-provider=<name|num>  Fallback LLM provider (1/deepseek, 2/openai, 3/gemini/google, 4/anthropic/claude) [default: gemini]
  --fallback-model=<model_name>   Fallback model name [default based on provider]
  --fallback-key=<api_key>        Fallback API key [default: loaded from environment]
  -h, --help                      Show this help message
`);
}

async function main() {
  // Parse command line arguments
  const args: any = {};
  for (let i = 2; i < process.argv.length; i++) {
    const arg = process.argv[i];
    if (arg === "--help" || arg === "-h") {
      printUsage();
      process.exit(0);
    }
    if (arg.startsWith("--")) {
      const parts = arg.slice(2).split("=");
      const key = parts[0];
      const val = parts.length > 1 ? parts[1] : true;
      args[key] = val;
    }
  }

  console.log("Running in non-interactive mode using CLI flags.");

  let primaryProviderChoice: string;
  try {
    primaryProviderChoice = normalizeProvider(String(args["primary-provider"] || "deepseek"));
  } catch (err: any) {
    console.error(err.message);
    printUsage();
    process.exit(1);
  }

  const primaryModelName = String(args["primary-model"] || getDefaultModel(primaryProviderChoice));
  const primaryApiKey = String(args["primary-key"] || getApiKeyFromEnv(primaryProviderChoice));

  if (!primaryApiKey) {
    console.error(`Error: API Key for primary provider (${primaryProviderChoice}) is required.`);
    console.error(`Please provide --primary-key=<key> or set the corresponding environment variable (e.g. DEEPSEEK_API_KEY).`);
    printUsage();
    process.exit(1);
  }

  const configureFallback = args["fallback"] === true || args["fallback"] === "true";
  let fallbackProviderChoice = "";
  let fallbackModelName = "";
  let fallbackApiKey = "";

  if (configureFallback) {
    try {
      fallbackProviderChoice = normalizeProvider(String(args["fallback-provider"] || "gemini"));
    } catch (err: any) {
      console.error(err.message);
      printUsage();
      process.exit(1);
    }

    fallbackModelName = String(args["fallback-model"] || getDefaultModel(fallbackProviderChoice));
    fallbackApiKey = String(args["fallback-key"] || getApiKeyFromEnv(fallbackProviderChoice));

    if (!fallbackApiKey) {
      console.error(`Error: API Key for fallback provider (${fallbackProviderChoice}) is required when fallback is enabled.`);
      console.error(`Please provide --fallback-key=<key> or set the corresponding environment variable (e.g. GEMINI_API_KEY).`);
      printUsage();
      process.exit(1);
    }
  }

  console.log(`Primary Provider: ${primaryProviderChoice} (${primaryModelName})`);
  if (configureFallback) {
    console.log(`Fallback Provider: ${fallbackProviderChoice} (${fallbackModelName})`);
  } else {
    console.log("Fallback Provider: Disabled");
  }

  console.log("\nDeploying credentials to n8n...");
  const supabaseCredId = await getOrCreateCredential("Semillero2_Supabase_V3", "supabaseApi", {
    host: SUPABASE_URL,
    serviceRole: SUPABASE_SECRET_KEY,
    allowedHttpRequestDomains: "none",
  });

  const primaryConfig = getProviderConfig(primaryProviderChoice, primaryApiKey, primaryModelName);
  const primaryCredId = await getOrCreateCredential(
    `Semillero2_Primary_${primaryConfig.credentialType}`,
    primaryConfig.credentialType,
    primaryConfig.credentialData
  );

  let fallbackConfig: ProviderConfig | null = null;
  let fallbackCredId = "";
  if (configureFallback) {
    fallbackConfig = getProviderConfig(fallbackProviderChoice, fallbackApiKey, fallbackModelName);
    fallbackCredId = await getOrCreateCredential(
      `Semillero2_Fallback_${fallbackConfig.credentialType}`,
      fallbackConfig.credentialType,
      fallbackConfig.credentialData
    );
  }

  // 3. Define workflow nodes dynamically
  console.log("\nBuilding workflow nodes...");

  const webhookTriggerNode = {
    parameters: {
      httpMethod: "POST",
      path: "evaluate-candidate",
      responseMode: "responseNode",
      options: {},
    },
    id: "webhook-trigger",
    name: "Webhook Trigger",
    type: "n8n-nodes-base.webhook",
    typeVersion: 1.1,
    position: [100, 300],
  };

  const primaryChainNode = {
    parameters: {
      promptType: "define",                 // Correct underlying value for manually defining prompt!
      hasOutputParser: true,           // Enforce "Require Specific Output Format"
      needsFallback: configureFallback,       // True underlying parameter to enable Fallback Model in v1.8+
      enableFallbackModel: configureFallback, // True underlying key to enable fallback model (backward compatibility)
      hasFallbackModel: configureFallback,    // Secondary key for fallback model (safeguard)
      text: "={{ $('Webhook Trigger').item.json.body.text }}",
      systemMessage: "You are an AI recruitment assistant evaluating a candidate's CV for a job vacancy. Analyze the candidate's CV text. You MUST respond with a raw JSON object containing exactly these five keys:\n- summary: a brief candidate summary (max 3 sentences).\n- classification: 'Qualified', 'Unqualified', or 'Review'.\n- suggestions: an array of recommendations for next steps (e.g. ['Schedule interview', 'Reject', 'Verify references']).\n- riskLevel: 'Low', 'Medium', or 'High'.\n- ai_score: a number between 0 and 100 representing general suitability.\n\nDo not include markdown code blocks or any text outside the JSON.",
    },
    id: "llm-chain-primary",
    name: "LLM Chain Evaluation (Primary)",
    type: "@n8n/n8n-nodes-langchain.chainLlm",
    typeVersion: 1.9,
    position: [400, 300],
  };

  const primaryModelNode = {
    parameters: primaryConfig.nodeParameters,
    id: "primary-model",
    name: "Primary Chat Model",
    type: primaryConfig.nodeType,
    typeVersion: 1,
    position: [300, 480],
    credentials: {
      [primaryConfig.credentialType]: {
        id: primaryCredId,
        name: `Semillero2_Primary_${primaryConfig.credentialType}`,
      },
    },
  };

  const jsonParserNode = {
    parameters: {
      jsonSchema: "{\n  \"type\": \"object\",\n  \"properties\": {\n    \"summary\": {\n      \"type\": \"string\"\n    },\n    \"classification\": {\n      \"type\": \"string\",\n      \"enum\": [\"Qualified\", \"Unqualified\", \"Review\"]\n    },\n    \"suggestions\": {\n      \"type\": \"array\",\n      \"items\": {\n        \"type\": \"string\"\n      }\n    },\n    \"riskLevel\": {\n      \"type\": \"string\",\n      \"enum\": [\"Low\", \"Medium\", \"High\"]\n    },\n    \"ai_score\": {\n      \"type\": \"number\"\n    }\n  },\n  \"required\": [\"summary\", \"classification\", \"suggestions\", \"riskLevel\", \"ai_score\"]\n}",
    },
    id: "json-parser",
    name: "Structured Output Parser",
    type: "@n8n/n8n-nodes-langchain.outputParserStructured",
    typeVersion: 1,
    position: [430, 480],
  };

  // Replace Code node with a native Edit Fields (Set) node to avoid code blocks
  const setNode = {
    parameters: {
      assignments: {
        assignments: [
          {
            name: "candidate_id",
            value: "={{ $('Webhook Trigger').item.json.body.candidateId }}",
            type: "string",
          },
          {
            name: "interview_id",
            value: "={{ $('Webhook Trigger').item.json.body.interviewId }}",
            type: "string",
          },
          {
            name: "ai_score",
            value: "={{ $json.ai_score }}",
            type: "number",
          },
          {
            name: "evaluation",
            value: "={{ { summary: $json.summary, classification: $json.classification, suggestions: $json.suggestions, riskLevel: $json.riskLevel } }}",
            type: "object",
          },
        ],
      },
      include: "none",
      options: {},
    },
    id: "format-data",
    name: "Format Evaluation Data",
    type: "n8n-nodes-base.set",
    typeVersion: 3.4,
    position: [700, 300],
  };

  const checkIfTestNode = {
    parameters: {
      conditions: {
        options: {
          caseSensitive: true,
          leftValue: "",
          typeValidation: "loose"
        },
        combinator: "and",
        conditions: [
          {
            id: "is-test-check",
            operator: {
              name: "filter.operator.equals",
              type: "boolean",
              operation: "equals"
            },
            leftValue: "={{ $('Webhook Trigger').item.json.body.isTest }}",
            rightValue: true
          }
        ]
      }
    },
    id: "check-if-test",
    name: "Check If Test",
    type: "n8n-nodes-base.if",
    typeVersion: 2.2,
    position: [900, 300],
  };

  const supabaseInsertNode = {
    parameters: {
      operation: "create",
      tableId: "scores",
      dataToSend: "autoMapInputData",
      options: {},
    },
    id: "supabase-insert",
    name: "Insert Score to Supabase",
    type: "n8n-nodes-base.supabase",
    typeVersion: 1,
    position: [1100, 420],
    credentials: {
      supabaseApi: {
        id: supabaseCredId,
        name: "Semillero2_Supabase_V3",
      },
    },
  };

  const respondWebhookNode = {
    parameters: {
      options: {},
    },
    id: "respond-webhook",
    name: "Respond to Webhook",
    type: "n8n-nodes-base.respondToWebhook",
    typeVersion: 1.1,
    position: [1300, 300],
  };

  const wNodes: any[] = [
    webhookTriggerNode,
    primaryChainNode,
    primaryModelNode,
    jsonParserNode,
    setNode,
    checkIfTestNode,
    supabaseInsertNode,
    respondWebhookNode,
  ];

  const wConnections: any = {
    "Webhook Trigger": {
      main: [
        [
          {
            node: "LLM Chain Evaluation (Primary)",
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
            node: "LLM Chain Evaluation (Primary)",
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
            node: "LLM Chain Evaluation (Primary)",
            type: "ai_outputParser", // Correct destination port type!
            index: 0,
          },
        ],
      ],
    },
    "LLM Chain Evaluation (Primary)": {
      main: [
        [
          {
            node: "Format Evaluation Data",
            type: "main",
            index: 0,
          },
        ],
      ],
    },
    "Format Evaluation Data": {
      main: [
        [
          {
            node: "Check If Test",
            type: "main",
            index: 0,
          },
        ],
      ],
    },
    "Check If Test": {
      main: [
        [
          {
            node: "Respond to Webhook",
            type: "main",
            index: 0,
          },
        ],
        [
          {
            node: "Insert Score to Supabase",
            type: "main",
            index: 0,
          },
        ],
      ],
    },
    "Insert Score to Supabase": {
      main: [
        [
          {
            node: "Respond to Webhook",
            type: "main",
            index: 0,
          },
        ],
      ],
    },
  };

  if (configureFallback && fallbackConfig) {
    console.log("Adding Fallback Chat Model...");

    const fallbackModelNode = {
      parameters: fallbackConfig.nodeParameters,
      id: "fallback-model",
      name: "Fallback Chat Model",
      type: fallbackConfig.nodeType,
      typeVersion: 1,
      position: [560, 480],
      credentials: {
        [fallbackConfig.credentialType]: {
          id: fallbackCredId,
          name: `Semillero2_Fallback_${fallbackConfig.credentialType}`,
        },
      },
    };

    wNodes.push(fallbackModelNode);

    // Connect fallback model directly: source port is ai_languageModel, target port is ai_languageModel (index 1)!
    wConnections["Fallback Chat Model"] = {
      ai_languageModel: [
        [
          {
            node: "LLM Chain Evaluation (Primary)",
            type: "ai_languageModel",
            index: 1,
          },
        ],
      ],
    };
  }

  // Define complete workflow object
  const workflowDefinition = {
    name: "Semillero2: End-to-End Candidate Evaluation",
    settings: {},
    nodes: wNodes,
    connections: wConnections,
  };

  console.log("\nDeploying workflow to n8n...");
  const workflowsList = await n8nRequest("/api/v1/workflows");
  const existingWf = workflowsList.data.find(
    (w: any) => w.name === "Semillero2: End-to-End Candidate Evaluation"
  );

  let deployResult;
  if (existingWf) {
    console.log(`Updating existing workflow (ID: ${existingWf.id})...`);
    deployResult = await n8nRequest(`/api/v1/workflows/${existingWf.id}`, "PUT", workflowDefinition);
  } else {
    deployResult = await n8nRequest("/api/v1/workflows", "POST", workflowDefinition);
  }

  // Activate the workflow
  console.log(`Activating workflow (ID: ${deployResult.id})...`);
  await n8nRequest(`/api/v1/workflows/${deployResult.id}/activate`, "POST");

  const webhookUrl = `${N8N_HOST}/webhook/evaluate-candidate`;
  console.log("\n==============================================");
  console.log("DEPLOYMENT COMPLETE");
  console.log("==============================================");
  console.log(`Workflow ID: ${deployResult.id}`);
  console.log(`Webhook URL: ${webhookUrl}`);
  console.log("==============================================");

  // Update .env file automatically
  const envFilePath = path.join(__dirname, "../.env");
  if (fs.existsSync(envFilePath)) {
    let envContent = fs.readFileSync(envFilePath, "utf8");
    if (envContent.includes("NEXT_PUBLIC_N8N_WEBHOOK_URL=")) {
      envContent = envContent.replace(
        /NEXT_PUBLIC_N8N_WEBHOOK_URL=.*/,
        `NEXT_PUBLIC_N8N_WEBHOOK_URL=${webhookUrl}`
      );
    } else {
      envContent += `\nNEXT_PUBLIC_N8N_WEBHOOK_URL=${webhookUrl}\n`;
    }
    fs.writeFileSync(envFilePath, envContent, "utf8");
    console.log("Updated NEXT_PUBLIC_N8N_WEBHOOK_URL in .env");
  }
}

main().catch((err) => {
  console.error("Deployment failed:", err);
  process.exit(1);
});
