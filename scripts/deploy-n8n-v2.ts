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
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SECRET_KEY = process.env.SUPABASE_SECRET_KEY;

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
  console.log("Starting n8n Candidate Evaluation Flow deployment...");

  // 1. Create/Retrieve Supabase credential
  console.log("Checking Supabase credentials...");
  const supabaseCredId = await getOrCreateCredential("Semillero2_Supabase_V2", "supabaseApi", {
    host: SUPABASE_URL,
    serviceRole: SUPABASE_SECRET_KEY,
    allowedHttpRequestDomains: "none",
  });

  // 2. Create/Retrieve Gemini credential
  console.log("Checking Gemini credentials...");
  const geminiCredId = await getOrCreateCredential("Semillero2_Gemini_V2", "googlePalmApi", {
    apiKey: GEMINI_API_KEY,
    host: "https://generativelanguage.googleapis.com",
    allowedHttpRequestDomains: "none",
  });

  // 3. Define the E2E Candidate Evaluation workflow
  const workflowDefinition = {
    name: "Semillero2: End-to-End Candidate Evaluation",
    settings: {},
    nodes: [
      {
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
      },
      {
        parameters: {
          promptType: "Define below",
          text: "={{ $json.body.text }}",
          systemMessage: "You are an AI recruitment assistant evaluating a candidate's CV for a job vacancy. Analyze the candidate's CV text. You MUST respond with a raw JSON object containing exactly these five keys:\n- summary: a brief candidate summary (max 3 sentences).\n- classification: 'Qualified', 'Unqualified', or 'Review'.\n- suggestions: an array of recommendations for next steps (e.g. ['Schedule interview', 'Reject', 'Verify references']).\n- riskLevel: 'Low', 'Medium', or 'High'.\n- ai_score: a number between 0 and 100 representing general suitability.\n\nDo not include markdown code blocks or any text outside the JSON.",
        },
        id: "llm-chain",
        name: "LLM Chain Evaluation",
        type: "@n8n/n8n-nodes-langchain.chainLlm",
        typeVersion: 1.4,
        position: [350, 300],
      },
      {
        parameters: {
          model: "gemini-1.5-flash",
          options: {},
        },
        id: "gemini-model",
        name: "Gemini Chat Model",
        type: "@n8n/n8n-nodes-langchain.lmChatGoogleGemini",
        typeVersion: 1,
        position: [300, 480],
        credentials: {
          googlePalmApi: {
            id: geminiCredId,
            name: "Semillero2_Gemini_V2",
          },
        },
      },
      {
        parameters: {
          jsonSchema: "{\n  \"type\": \"object\",\n  \"properties\": {\n    \"summary\": {\n      \"type\": \"string\"\n    },\n    \"classification\": {\n      \"type\": \"string\",\n      \"enum\": [\"Qualified\", \"Unqualified\", \"Review\"]\n    },\n    \"suggestions\": {\n      \"type\": \"array\",\n      \"items\": {\n        \"type\": \"string\"\n      }\n    },\n    \"riskLevel\": {\n      \"type\": \"string\",\n      \"enum\": [\"Low\", \"Medium\", \"High\"]\n    },\n    \"ai_score\": {\n      \"type\": \"number\"\n    }\n  },\n  \"required\": [\"summary\", \"classification\", \"suggestions\", \"riskLevel\", \"ai_score\"]\n}",
        },
        id: "json-parser",
        name: "Structured Output Parser",
        type: "@n8n/n8n-nodes-langchain.outputParserStructured",
        typeVersion: 1,
        position: [460, 480],
      },
      {
        parameters: {
          jsCode: `const input = $input.first().json;
const webhookData = $('Webhook Trigger').first().json.body;
return [{
  json: {
    candidate_id: webhookData.candidateId,
    interview_id: webhookData.interviewId,
    ai_score: input.ai_score,
    evaluation: {
      summary: input.summary,
      classification: input.classification,
      suggestions: input.suggestions,
      riskLevel: input.riskLevel
    }
  }
}];`,
        },
        id: "format-data",
        name: "Format Evaluation Data",
        type: "n8n-nodes-base.code",
        typeVersion: 2,
        position: [600, 300],
      },
      {
        parameters: {
          operation: "insert",
          table: "scores",
          options: {},
        },
        id: "supabase-insert",
        name: "Insert Score to Supabase",
        type: "n8n-nodes-base.supabase",
        typeVersion: 1,
        position: [800, 300],
        credentials: {
          supabaseApi: {
            id: supabaseCredId,
            name: "Semillero2_Supabase_V2",
          },
        },
      },
      {
        parameters: {
          options: {},
        },
        id: "respond-webhook",
        name: "Respond to Webhook",
        type: "n8n-nodes-base.respondToWebhook",
        typeVersion: 1.1,
        position: [1000, 300],
      },
    ],
    connections: {
      "Webhook Trigger": {
        main: [
          [
            {
              node: "LLM Chain Evaluation",
              type: "main",
              index: 0,
            },
          ],
        ],
      },
      "Gemini Chat Model": {
        ai_languageModel: [
          [
            {
              node: "LLM Chain Evaluation",
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
              node: "LLM Chain Evaluation",
              type: "outputParser",
              index: 0,
            },
          ],
        ],
      },
      "LLM Chain Evaluation": {
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
    },
  };

  console.log("Deploying workflow to n8n...");
  // Check if it already exists
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

  const webhookUrl = `${N8N_HOST}/webhook/${deployResult.id}/webhook/evaluate-candidate`;
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
