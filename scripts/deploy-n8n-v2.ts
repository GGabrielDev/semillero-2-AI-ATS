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
      console.log(`Reusing existing credential: ${name} (ID: ${existingCred.id})...`);
      return existingCred.id;
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

  // BRANCH A: Candidate Evaluation Webhook Branch
  const evalWebhookNode = {
    parameters: {
      httpMethod: "POST",
      path: "evaluate-candidate",
      responseMode: "responseNode",
      options: {},
    },
    id: "eval-webhook-trigger",
    name: "Webhook Trigger",
    type: "n8n-nodes-base.webhook",
    typeVersion: 1.1,
    position: [100, 200],
  };

  const evalChainNode = {
    parameters: {
      promptType: "define",
      hasOutputParser: true,
      needsFallback: configureFallback,
      enableFallbackModel: configureFallback,
      hasFallbackModel: configureFallback,
      text: "=Candidate CV Text:\n{{ $('Webhook Trigger').item.json.body.text }}\n\nTarget Job Vacancy:\nTitle: {{ $('Webhook Trigger').item.json.body.jobTitle }}\nRequirements:\n{{ $('Webhook Trigger').item.json.body.jobRequirements }}",
      systemMessage: "You are an AI recruitment assistant. Your job is to carefully assess if the candidate qualifies for the specific job vacancy. Evaluate their CV text against the target Job Title and Job Requirements. Be objective: if the candidate does not have the core stack, experience, or skills required for this specific job, they MUST be classified as 'Unqualified' with a low suitability score.\n\nSuitability Score (ai_score) Calibration Rules:\n- If the candidate does not match the vacancy at all, or lacks all core technical skills required for the job, the score MUST be extremely low (between 0 and 15). Never give a middle score like 50 to a complete mismatch.\n- If the candidate has minor overlaps but lacks the core tech stack/experience, the score MUST be below 50.\n- If the candidate is a borderline or partial fit (50-74% match), the score must be between 50 and 74.\n- Only candidates who are highly qualified and match the core stack and experience should receive a score of 75 or higher.\n\nYou MUST respond with a raw JSON object containing exactly these five keys:\n- summary: a brief evaluation summary explaining why they match or fail to match the specific job requirements (max 3 sentences).\n- classification: 'Qualified' (if they match the requirements well), 'Unqualified' (if they lack critical skills/stack for this specific job), or 'Review' (if they are a borderline match).\n- suggestions: an array of recommendations (e.g. ['Schedule technical interview', 'Reject', 'Verify experience with X']).\n- riskLevel: 'Low', 'Medium', or 'High' (suitability/fit risk).\n- ai_score: an integer between 0 and 100 representing suitability for this specific job. Return a whole integer (do NOT return a decimal fraction like 0.88, return an integer like 88).",
    },
    id: "eval-llm-chain",
    name: "LLM Chain Evaluation (Primary)",
    type: "@n8n/n8n-nodes-langchain.chainLlm",
    typeVersion: 1.9,
    position: [400, 200],
  };

  const evalPrimaryModelNode = {
    parameters: primaryConfig.nodeParameters,
    id: "eval-primary-model",
    name: "Primary Chat Model",
    type: primaryConfig.nodeType,
    typeVersion: 1,
    position: [300, 380],
    credentials: {
      [primaryConfig.credentialType]: {
        id: primaryCredId,
        name: `Semillero2_Primary_${primaryConfig.credentialType}`,
      },
    },
  };

  const evalJsonParserNode = {
    parameters: {
      jsonSchema: "{\n  \"type\": \"object\",\n  \"properties\": {\n    \"summary\": {\n      \"type\": \"string\"\n    },\n    \"classification\": {\n      \"type\": \"string\",\n      \"enum\": [\"Qualified\", \"Unqualified\", \"Review\"]\n    },\n    \"suggestions\": {\n      \"type\": \"array\",\n      \"items\": {\n        \"type\": \"string\"\n      }\n    },\n    \"riskLevel\": {\n      \"type\": \"string\",\n      \"enum\": [\"Low\", \"Medium\", \"High\"]\n    },\n    \"ai_score\": {\n      \"type\": \"integer\",\n      \"minimum\": 0,\n      \"maximum\": 100,\n      \"description\": \"An integer score between 0 and 100 representing suitability. 100 means perfect fit, 0 means no fit.\"\n    }\n  },\n  \"required\": [\"summary\", \"classification\", \"suggestions\", \"riskLevel\", \"ai_score\"]\n}",
    },
    id: "eval-json-parser",
    name: "Structured Output Parser",
    type: "@n8n/n8n-nodes-langchain.outputParserStructured",
    typeVersion: 1,
    position: [430, 380],
  };

  const evalSetNode = {
    parameters: {
      assignments: {
        assignments: [
          {
            name: "candidate_id",
            value: "={{ $('Webhook Trigger').item.json.body.candidateId }}",
            type: "string",
          },
          {
            name: "job_id",
            value: "={{ $('Webhook Trigger').item.json.body.jobId }}",
            type: "string",
          },
          {
            name: "ai_score",
            value: "={{ $json.ai_score <= 1 ? Math.round($json.ai_score * 100) : ($json.ai_score <= 10 ? Math.round($json.ai_score * 10) : Math.round($json.ai_score)) }}",
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
    id: "eval-format-data",
    name: "Format Evaluation Data",
    type: "n8n-nodes-base.set",
    typeVersion: 3.4,
    position: [700, 200],
  };

  const evalCheckIfTestNode = {
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
    id: "eval-check-if-test",
    name: "Check If Test",
    type: "n8n-nodes-base.if",
    typeVersion: 2.2,
    position: [900, 200],
  };

  const evalSupabaseInsertNode = {
    parameters: {
      operation: "create",
      tableId: "scores",
      dataToSend: "autoMapInputData",
      options: {},
    },
    id: "eval-supabase-insert",
    name: "Insert Score to Supabase",
    type: "n8n-nodes-base.supabase",
    typeVersion: 1,
    position: [1100, 320],
    credentials: {
      supabaseApi: {
        id: supabaseCredId,
        name: "Semillero2_Supabase_V3",
      },
    },
  };

  const evalRespondWebhookNode = {
    parameters: {
      options: {},
    },
    id: "eval-respond-webhook",
    name: "Respond to Webhook",
    type: "n8n-nodes-base.respondToWebhook",
    typeVersion: 1.1,
    position: [1300, 200],
  };


  // BRANCH B: Candidate Profiling Webhook Branch (isolated vacuum extraction)
  const profileCandidateWebhookNode = {
    parameters: {
      httpMethod: "POST",
      path: "extract-candidate-profile",
      responseMode: "responseNode",
      options: {},
    },
    id: "cand-webhook-trigger",
    name: "Webhook Trigger - Candidate",
    type: "n8n-nodes-base.webhook",
    typeVersion: 1.1,
    position: [100, 600],
  };

  const profileCandidateChainNode = {
    parameters: {
      promptType: "define",
      hasOutputParser: true,
      needsFallback: configureFallback,
      enableFallbackModel: configureFallback,
      hasFallbackModel: configureFallback,
      text: "={{ $('Webhook Trigger - Candidate').item.json.body.text }}",
      systemMessage: "You are an AI recruitment assistant. Analyze the candidate's CV text. Extract the candidate's actual name, email, phone, a list of professional skills/technologies (buzzwords in lowercase), and a brief summary. You MUST respond with a raw JSON object containing exactly these five keys:\n- candidateName: actual name of candidate\n- email: contact email\n- phone: contact phone\n- skills: array of lowercase skill strings\n- summary: brief summary\n\nDo not include markdown code blocks or any text outside the JSON.",
    },
    id: "cand-llm-chain",
    name: "LLM Chain Profiling (Candidate)",
    type: "@n8n/n8n-nodes-langchain.chainLlm",
    typeVersion: 1.9,
    position: [400, 600],
  };

  const profileCandidatePrimaryModelNode = {
    parameters: primaryConfig.nodeParameters,
    id: "cand-primary-model",
    name: "Primary Chat Model - Candidate",
    type: primaryConfig.nodeType,
    typeVersion: 1,
    position: [300, 780],
    credentials: {
      [primaryConfig.credentialType]: {
        id: primaryCredId,
        name: `Semillero2_Primary_${primaryConfig.credentialType}`,
      },
    },
  };

  const profileCandidateJsonParserNode = {
    parameters: {
      jsonSchema: "{\n  \"type\": \"object\",\n  \"properties\": {\n    \"candidateName\": { \"type\": \"string\" },\n    \"email\": { \"type\": \"string\" },\n    \"phone\": { \"type\": \"string\" },\n    \"skills\": {\n      \"type\": \"array\",\n      \"items\": { \"type\": \"string\" }\n    },\n    \"summary\": { \"type\": \"string\" }\n  },\n  \"required\": [\"candidateName\", \"email\", \"phone\", \"skills\", \"summary\"]\n}",
    },
    id: "cand-json-parser",
    name: "Structured Output Parser - Candidate",
    type: "@n8n/n8n-nodes-langchain.outputParserStructured",
    typeVersion: 1,
    position: [430, 780],
  };

  const profileCandidateRespondWebhookNode = {
    parameters: {
      options: {},
    },
    id: "cand-respond-webhook",
    name: "Respond to Webhook - Candidate",
    type: "n8n-nodes-base.respondToWebhook",
    typeVersion: 1.1,
    position: [700, 600],
  };


  // BRANCH C: Job Description Profiling Webhook Branch (isolated vacuum extraction)
  const profileJobWebhookNode = {
    parameters: {
      httpMethod: "POST",
      path: "extract-job-profile",
      responseMode: "responseNode",
      options: {},
    },
    id: "job-webhook-trigger",
    name: "Webhook Trigger - Job",
    type: "n8n-nodes-base.webhook",
    typeVersion: 1.1,
    position: [100, 1000],
  };

  const profileJobChainNode = {
    parameters: {
      promptType: "define",
      hasOutputParser: true,
      needsFallback: configureFallback,
      enableFallbackModel: configureFallback,
      hasFallbackModel: configureFallback,
      text: "={{ $('Webhook Trigger - Job').item.json.body.requirements }}",
      systemMessage: "You are an AI recruitment assistant. Analyze the job description/requirements. Extract the key skills/technologies/abilities required (as lowercase buzzwords) and a brief summary of the vacancy. You MUST respond with a raw JSON object containing exactly these two keys:\n- skills: array of lowercase skill strings\n- summary: brief summary\n\nDo not include markdown code blocks or any text outside the JSON.",
    },
    id: "job-llm-chain",
    name: "LLM Chain Profiling (Job)",
    type: "@n8n/n8n-nodes-langchain.chainLlm",
    typeVersion: 1.9,
    position: [400, 1000],
  };

  const profileJobPrimaryModelNode = {
    parameters: primaryConfig.nodeParameters,
    id: "job-primary-model",
    name: "Primary Chat Model - Job",
    type: primaryConfig.nodeType,
    typeVersion: 1,
    position: [300, 1180],
    credentials: {
      [primaryConfig.credentialType]: {
        id: primaryCredId,
        name: `Semillero2_Primary_${primaryConfig.credentialType}`,
      },
    },
  };

  const profileJobJsonParserNode = {
    parameters: {
      jsonSchema: "{\n  \"type\": \"object\",\n  \"properties\": {\n    \"skills\": {\n      \"type\": \"array\",\n      \"items\": { \"type\": \"string\" }\n    },\n    \"summary\": { \"type\": \"string\" }\n  },\n  \"required\": [\"skills\", \"summary\"]\n}",
    },
    id: "job-json-parser",
    name: "Structured Output Parser - Job",
    type: "@n8n/n8n-nodes-langchain.outputParserStructured",
    typeVersion: 1,
    position: [430, 1180],
  };

  const profileJobRespondWebhookNode = {
    parameters: {
      options: {},
    },
    id: "job-respond-webhook",
    name: "Respond to Webhook - Job",
    type: "n8n-nodes-base.respondToWebhook",
    typeVersion: 1.1,
    position: [700, 1000],
  };


  // BRANCH D: AI Next Step Suggestion Webhook Branch
  const suggestWebhookNode = {
    parameters: {
      httpMethod: "POST",
      path: "suggest-next-steps",
      responseMode: "responseNode",
      options: {},
    },
    id: "suggest-webhook-trigger",
    name: "Webhook Trigger - Suggest",
    type: "n8n-nodes-base.webhook",
    typeVersion: 1.1,
    position: [100, 1400],
  };

  const suggestChainNode = {
    parameters: {
      promptType: "define",
      hasOutputParser: false,
      needsFallback: configureFallback,
      enableFallbackModel: configureFallback,
      hasFallbackModel: configureFallback,
      text: "=Candidate Name: {{ $('Webhook Trigger - Suggest').item.json.body.candidateName }}\nVacancy: {{ $('Webhook Trigger - Suggest').item.json.body.jobTitle }}\nCurrent Stage: {{ $('Webhook Trigger - Suggest').item.json.body.currentStage }}\nCandidate Summary: {{ $('Webhook Trigger - Suggest').item.json.body.candidateSummary || 'None provided' }}\nCandidate Skills: {{ JSON.stringify($('Webhook Trigger - Suggest').item.json.body.candidateSkills || []) }}\nJob Requirements: {{ $('Webhook Trigger - Suggest').item.json.body.jobRequirements || 'None provided' }}\n\nComments History:\n{{ JSON.stringify($('Webhook Trigger - Suggest').item.json.body.commentHistory || []) }}",
      systemMessage: "You are an AI recruitment co-pilot. Suggest the next step for this candidate in their interview process. Requirements:\n1. MUST be extremely brief and concise (max 3-4 bullet points).\n2. MUST focus on actionable suggestions based on their current stage, comment history, and candidate profile.\n3. Respond in Spanish if the body.lang parameter is 'es', otherwise English.\n4. Use standard Markdown formatting. Do not include any pre-text or post-text. Return only the markdown content.",
    },
    id: "suggest-llm-chain",
    name: "LLM Chain Suggestion (Next Steps)",
    type: "@n8n/n8n-nodes-langchain.chainLlm",
    typeVersion: 1.9,
    position: [400, 1400],
  };

  const suggestPrimaryModelNode = {
    parameters: primaryConfig.nodeParameters,
    id: "suggest-primary-model",
    name: "Primary Chat Model - Suggest",
    type: primaryConfig.nodeType,
    typeVersion: 1,
    position: [300, 1580],
    credentials: {
      [primaryConfig.credentialType]: {
        id: primaryCredId,
        name: `Semillero2_Primary_${primaryConfig.credentialType}`,
      },
    },
  };

  const suggestSetNode = {
    parameters: {
      assignments: {
        assignments: [
          {
            name: "suggestion",
            value: "={{ $json.text }}",
            type: "string",
          },
        ],
      },
      include: "none",
      options: {},
    },
    id: "suggest-format-data",
    name: "Format Suggestion Data",
    type: "n8n-nodes-base.set",
    typeVersion: 3.4,
    position: [700, 1400],
  };

  const suggestRespondWebhookNode = {
    parameters: {
      options: {},
    },
    id: "suggest-respond-webhook",
    name: "Respond to Webhook - Suggest",
    type: "n8n-nodes-base.respondToWebhook",
    typeVersion: 1.1,
    position: [900, 1400],
  };

  // Base nodes array
  const wNodes: any[] = [
    evalWebhookNode,
    evalChainNode,
    evalPrimaryModelNode,
    evalJsonParserNode,
    evalSetNode,
    evalCheckIfTestNode,
    evalSupabaseInsertNode,
    evalRespondWebhookNode,

    profileCandidateWebhookNode,
    profileCandidateChainNode,
    profileCandidatePrimaryModelNode,
    profileCandidateJsonParserNode,
    profileCandidateRespondWebhookNode,

    profileJobWebhookNode,
    profileJobChainNode,
    profileJobPrimaryModelNode,
    profileJobJsonParserNode,
    profileJobRespondWebhookNode,

    suggestWebhookNode,
    suggestChainNode,
    suggestPrimaryModelNode,
    suggestSetNode,
    suggestRespondWebhookNode
  ];

  // Base connections map
  const wConnections: any = {
    // BRANCH A
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
            type: "ai_outputParser",
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

    // BRANCH B
    "Webhook Trigger - Candidate": {
      main: [
        [
          {
            node: "LLM Chain Profiling (Candidate)",
            type: "main",
            index: 0,
          },
        ],
      ],
    },
    "Primary Chat Model - Candidate": {
      ai_languageModel: [
        [
          {
            node: "LLM Chain Profiling (Candidate)",
            type: "ai_languageModel",
            index: 0,
          },
        ],
      ],
    },
    "Structured Output Parser - Candidate": {
      outputParser: [
        [
          {
            node: "LLM Chain Profiling (Candidate)",
            type: "ai_outputParser",
            index: 0,
          },
        ],
      ],
    },
    "LLM Chain Profiling (Candidate)": {
      main: [
        [
          {
            node: "Respond to Webhook - Candidate",
            type: "main",
            index: 0,
          },
        ],
      ],
    },

    // BRANCH C
    "Webhook Trigger - Job": {
      main: [
        [
          {
            node: "LLM Chain Profiling (Job)",
            type: "main",
            index: 0,
          },
        ],
      ],
    },
    "Primary Chat Model - Job": {
      ai_languageModel: [
        [
          {
            node: "LLM Chain Profiling (Job)",
            type: "ai_languageModel",
            index: 0,
          },
        ],
      ],
    },
    "Structured Output Parser - Job": {
      outputParser: [
        [
          {
            node: "LLM Chain Profiling (Job)",
            type: "ai_outputParser",
            index: 0,
          },
        ],
      ],
    },
    "LLM Chain Profiling (Job)": {
      main: [
        [
          {
            node: "Respond to Webhook - Job",
            type: "main",
            index: 0,
          },
        ],
      ],
    },

    // BRANCH D
    "Webhook Trigger - Suggest": {
      main: [
        [
          {
            node: "LLM Chain Suggestion (Next Steps)",
            type: "main",
            index: 0,
          },
        ],
      ],
    },
    "Primary Chat Model - Suggest": {
      ai_languageModel: [
        [
          {
            node: "LLM Chain Suggestion (Next Steps)",
            type: "ai_languageModel",
            index: 0,
          },
        ],
      ],
    },
    "LLM Chain Suggestion (Next Steps)": {
      main: [
        [
          {
            node: "Format Suggestion Data",
            type: "main",
            index: 0,
          },
        ],
      ],
    },
    "Format Suggestion Data": {
      main: [
        [
          {
            node: "Respond to Webhook - Suggest",
            type: "main",
            index: 0,
          },
        ],
      ],
    }
  };

  // Connect Fallback Models if configured
  if (configureFallback && fallbackConfig) {
    console.log("Adding Fallback Chat Models...");

    const evalFallbackModelNode = {
      parameters: fallbackConfig.nodeParameters,
      id: "eval-fallback-model",
      name: "Fallback Chat Model",
      type: fallbackConfig.nodeType,
      typeVersion: 1,
      position: [560, 380],
      credentials: {
        [fallbackConfig.credentialType]: {
          id: fallbackCredId,
          name: `Semillero2_Fallback_${fallbackConfig.credentialType}`,
        },
      },
    };

    const candFallbackModelNode = {
      parameters: fallbackConfig.nodeParameters,
      id: "cand-fallback-model",
      name: "Fallback Chat Model - Candidate",
      type: fallbackConfig.nodeType,
      typeVersion: 1,
      position: [560, 780],
      credentials: {
        [fallbackConfig.credentialType]: {
          id: fallbackCredId,
          name: `Semillero2_Fallback_${fallbackConfig.credentialType}`,
        },
      },
    };

    const jobFallbackModelNode = {
      parameters: fallbackConfig.nodeParameters,
      id: "job-fallback-model",
      name: "Fallback Chat Model - Job",
      type: fallbackConfig.nodeType,
      typeVersion: 1,
      position: [560, 1180],
      credentials: {
        [fallbackConfig.credentialType]: {
          id: fallbackCredId,
          name: `Semillero2_Fallback_${fallbackConfig.credentialType}`,
        },
      },
    };

    wNodes.push(evalFallbackModelNode, candFallbackModelNode, jobFallbackModelNode);

    // Setup fallback connections
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

    wConnections["Fallback Chat Model - Candidate"] = {
      ai_languageModel: [
        [
          {
            node: "LLM Chain Profiling (Candidate)",
            type: "ai_languageModel",
            index: 1,
          },
        ],
      ],
    };

    wConnections["Fallback Chat Model - Job"] = {
      ai_languageModel: [
        [
          {
            node: "LLM Chain Profiling (Job)",
            type: "ai_languageModel",
            index: 1,
          },
        ],
      ],
    };

    const suggestFallbackModelNode = {
      parameters: fallbackConfig.nodeParameters,
      id: "suggest-fallback-model",
      name: "Fallback Chat Model - Suggest",
      type: fallbackConfig.nodeType,
      typeVersion: 1,
      position: [560, 1580],
      credentials: {
        [fallbackConfig.credentialType]: {
          id: fallbackCredId,
          name: `Semillero2_Fallback_${fallbackConfig.credentialType}`,
        },
      },
    };

    wNodes.push(suggestFallbackModelNode);

    wConnections["Fallback Chat Model - Suggest"] = {
      ai_languageModel: [
        [
          {
            node: "LLM Chain Suggestion (Next Steps)",
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
