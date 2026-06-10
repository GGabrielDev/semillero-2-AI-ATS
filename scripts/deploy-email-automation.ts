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
const EMAIL_USER = process.env.EMAIL_USER;
const EMAIL_PASSWORD = process.env.EMAIL_PASSWORD;
const EMAIL_HOST = process.env.EMAIL_HOST;
const EMAIL_PORT = parseInt(process.env.EMAIL_PORT || "465", 10);
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

async function main() {
  console.log("\n==============================================");
  console.log("DEPLOYING EMAIL AUTOMATION FOR N8N");
  console.log("==============================================");

  // 1. Setup SMTP Credentials
  const smtpCredId = await getOrCreateCredential("Semillero2_SMTP", "smtp", {
    host: EMAIL_HOST,
    port: EMAIL_PORT,
    user: EMAIL_USER,
    password: EMAIL_PASSWORD,
    secure: true,
  });

  // 2. Setup IMAP Credentials
  const imapCredId = await getOrCreateCredential("Semillero2_IMAP_V2", "imap", {
    host: EMAIL_HOST,
    port: 993,
    user: EMAIL_USER,
    password: EMAIL_PASSWORD,
    secure: true,
  });

  // 3. Setup Supabase Credentials
  const supabaseCredId = await getOrCreateCredential("Semillero2_Supabase", "supabaseApi", {
    host: SUPABASE_URL,
    serviceRole: SUPABASE_SECRET_KEY,
    allowedHttpRequestDomains: "none",
  });

  // 4. Fetch Candidate Evaluation Workflow ID
  const workflowsList = await n8nRequest("/api/v1/workflows");
  const evalWf = workflowsList.data.find(
    (w: any) => w.name === "Semillero2: End-to-End Candidate Evaluation"
  );
  if (!evalWf) {
    console.error("Error: Could not find candidate evaluation workflow ID.");
    process.exit(1);
  }
  const evalWfId = evalWf.id;
  console.log(`Candidate Evaluation Workflow ID: ${evalWfId}`);

  // 5. Deploy / Update IMAP Ingestion Workflow
  const imapWf = workflowsList.data.find(
    (w: any) => w.name === "Semillero2: Email Ingestion Listener"
  );

  const imapWfDefinition = {
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
            name: "Semillero2_IMAP_V2",
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
          workflowId: evalWfId,
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

  let imapDeployResult;
  if (imapWf) {
    if (imapWf.isArchived) {
      console.log(`Deleting archived IMAP workflow (ID: ${imapWf.id})...`);
      await n8nRequest(`/api/v1/workflows/${imapWf.id}`, "DELETE");
      console.log("Creating new IMAP workflow...");
      imapDeployResult = await n8nRequest("/api/v1/workflows", "POST", imapWfDefinition);
    } else {
      console.log(`Updating existing IMAP workflow (ID: ${imapWf.id})...`);
      imapDeployResult = await n8nRequest(`/api/v1/workflows/${imapWf.id}`, "PUT", imapWfDefinition);
    }
  } else {
    console.log("Creating new IMAP workflow...");
    imapDeployResult = await n8nRequest("/api/v1/workflows", "POST", imapWfDefinition);
  }

  // Activate IMAP Ingestion Workflow
  console.log(`Activating IMAP Ingestion workflow (ID: ${imapDeployResult.id})...`);
  await n8nRequest(`/api/v1/workflows/${imapDeployResult.id}/activate`, "POST");

  // 6. Deploy / Update Stage Change Email Notifier
  const notifierWf = workflowsList.data.find(
    (w: any) => w.name === "Semillero2: Stage Change Email Notifier"
  );

  const notifierWfDefinition = {
    name: "Semillero2: Stage Change Email Notifier",
    settings: {},
    nodes: [
      {
        parameters: {
          httpMethod: "POST",
          path: "stage-changed",
          responseMode: "responseNode",
          options: {},
        },
        id: "notifier-webhook-id",
        name: "Stage Changed Webhook",
        type: "n8n-nodes-base.webhook",
        typeVersion: 1.1,
        position: [100, 300],
      },
      {
        parameters: {
          resource: "row",
          operation: "get",
          tableId: "candidates",
          rowId: "={{ $('Stage Changed Webhook').item.json.body.new_record.candidate_id }}",
        },
        id: "notifier-get-cand-id",
        name: "Get Candidate",
        type: "n8n-nodes-base.supabase",
        typeVersion: 1,
        position: [320, 300],
        credentials: {
          supabaseApi: {
            id: supabaseCredId,
            name: "Semillero2_Supabase",
          },
        },
      },
      {
        parameters: {
          resource: "row",
          operation: "get",
          tableId: "jobs",
          rowId: "={{ $('Stage Changed Webhook').item.json.body.new_record.job_id }}",
        },
        id: "notifier-get-job-id",
        name: "Get Job",
        type: "n8n-nodes-base.supabase",
        typeVersion: 1,
        position: [540, 300],
        credentials: {
          supabaseApi: {
            id: supabaseCredId,
            name: "Semillero2_Supabase",
          },
        },
      },
      {
        parameters: {
          jsCode: `const candidate = $('Get Candidate').first().json;
const candidateName = candidate.name;
const contactInfo = candidate.contact_info || {};
const candidateEmail = contactInfo.email || "unknown@example.com";
const jobTitle = $('Get Job').first().json.title;
const oldRecord = $('Stage Changed Webhook').first().json.body.old_record;
const oldStage = oldRecord ? oldRecord.stage : 'None';
const newStage = $('Stage Changed Webhook').first().json.body.new_record.stage;

let subject = '';
let html = '';

if (newStage === 'Screening') {
  subject = \`Application Received: \${jobTitle}\`;
  html = \`<p>Hello \${candidateName},</p>
          <p>Thank you for applying to the <strong>\${jobTitle}</strong> position. We have received your CV and are currently reviewing it.</p>
          <p>Best regards,<br/>The Recruitment Team</p>\`;
} else if (newStage === 'Technical') {
  subject = \`Next Steps - Technical Interview: \${jobTitle}\`;
  html = \`<p>Hello \${candidateName},</p>
          <p>Great news! Your application for the <strong>\${jobTitle}</strong> position has progressed to the <strong>Technical Interview</strong> stage.</p>
          <p>Our team will contact you shortly to schedule the interview. Please prepare by reviewing core concepts for the role.</p>
          <p>Best regards,<br/>The Recruitment Team</p>\`;
} else if (newStage === 'Cultural') {
  subject = \`Next Steps - Cultural Interview: \${jobTitle}\`;
  html = \`<p>Hello \${candidateName},</p>
          <p>We are pleased to invite you to the <strong>Cultural Fit Interview</strong> for the <strong>\${jobTitle}</strong> role.</p>
          <p>This conversation will be a casual discussion to get to know you better and answer any questions you have about our culture and team.</p>
          <p>Best regards,<br/>The Recruitment Team</p>\`;
} else if (newStage === 'Offer') {
  subject = \`Job Offer - \${jobTitle}!\`;
  html = \`<p>Hello \${candidateName},</p>
          <p>Congratulations! We are thrilled to extend a <strong>Job Offer</strong> for the <strong>\${jobTitle}</strong> position.</p>
          <p>We will send the official offer letter and details via email shortly. We look forward to having you join us!</p>
          <p>Best regards,<br/>The Hiring Team</p>\`;
} else if (newStage === 'Hired') {
  subject = \`Welcome to the Team!\`;
  html = \`<p>Hello \${candidateName},</p>
          <p>Welcome aboard! You have been officially <strong>Hired</strong> for the <strong>\${jobTitle}</strong> position.</p>
          <p>Our onboarding team will reach out with the next steps for your first day.</p>
          <p>Best regards,<br/>The Team</p>\`;
} else if (newStage === 'Rejected') {
  subject = \`Application Update: \${jobTitle}\`;
  html = \`<p>Hello \${candidateName},</p>
          <p>Thank you for your interest in the <strong>\${jobTitle}</strong> position and for taking the time to interview with us.</p>
          <p>Unfortunately, we have decided to proceed with other candidates whose profiles more closely align with our current needs.</p>
          <p>We will keep your profile in our database for future opportunities.</p>
          <p>Best regards,<br/>The Recruitment Team</p>\`;
} else {
  subject = \`Application Status Update: \${jobTitle}\`;
  html = \`<p>Hello \${candidateName},</p>
          <p>The status of your application for the <strong>\${jobTitle}</strong> position has been updated to: <strong>\${newStage}</strong>.</p>
          <p>Best regards,<br/>The Recruitment Team</p>\`;
}

return [{
  json: {
    toEmail: candidateEmail,
    subject,
    html
  }
}];`,
        },
        id: "notifier-code-id",
        name: "Format Notification Email",
        type: "n8n-nodes-base.code",
        typeVersion: 2,
        position: [760, 300],
      },
      {
        parameters: {
          fromEmail: '"Recruitment Team" <robot@gaboggamer.online>',
          toEmail: "={{ $json.toEmail }}",
          subject: "={{ $json.subject }}",
          html: "={{ $json.html }}",
          options: {},
        },
        id: "notifier-send-id",
        name: "Send Notification Email",
        type: "n8n-nodes-base.emailSend",
        typeVersion: 2.1,
        position: [980, 300],
        credentials: {
          smtp: {
            id: smtpCredId,
            name: "Semillero2_SMTP",
          },
        },
      },
      {
        parameters: {
          options: {},
        },
        id: "notifier-respond-id",
        name: "Respond to Webhook",
        type: "n8n-nodes-base.respondToWebhook",
        typeVersion: 1.1,
        position: [1200, 300],
      },
    ],
    connections: {
      "Stage Changed Webhook": {
        main: [
          [
            {
              node: "Get Candidate",
              type: "main",
              index: 0,
            },
          ],
        ],
      },
      "Get Candidate": {
        main: [
          [
            {
              node: "Get Job",
              type: "main",
              index: 0,
            },
          ],
        ],
      },
      "Get Job": {
        main: [
          [
            {
              node: "Format Notification Email",
              type: "main",
              index: 0,
            },
          ],
        ],
      },
      "Format Notification Email": {
        main: [
          [
            {
              node: "Send Notification Email",
              type: "main",
              index: 0,
            },
          ],
        ],
      },
      "Send Notification Email": {
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

  let notifierDeployResult;
  if (notifierWf) {
    if (notifierWf.isArchived) {
      console.log(`Deleting archived Notifier workflow (ID: ${notifierWf.id})...`);
      await n8nRequest(`/api/v1/workflows/${notifierWf.id}`, "DELETE");
      console.log("Creating new Notifier workflow...");
      notifierDeployResult = await n8nRequest("/api/v1/workflows", "POST", notifierWfDefinition);
    } else {
      console.log(`Updating existing Notifier workflow (ID: ${notifierWf.id})...`);
      notifierDeployResult = await n8nRequest(`/api/v1/workflows/${notifierWf.id}`, "PUT", notifierWfDefinition);
    }
  } else {
    console.log("Creating new Notifier workflow...");
    notifierDeployResult = await n8nRequest("/api/v1/workflows", "POST", notifierWfDefinition);
  }

  // Activate Notifier Workflow
  console.log(`Activating Notifier workflow (ID: ${notifierDeployResult.id})...`);
  await n8nRequest(`/api/v1/workflows/${notifierDeployResult.id}/activate`, "POST");

  const notifierWebhookUrl = `${N8N_HOST}/webhook/stage-changed`;
  console.log("\n==============================================");
  console.log("EMAIL AUTOMATION SETUP COMPLETE");
  console.log("==============================================");
  console.log(`IMAP Workflow ID: ${imapDeployResult.id}`);
  console.log(`Notifier Workflow ID: ${notifierDeployResult.id}`);
  console.log(`Notifier Webhook URL: ${notifierWebhookUrl}`);
  console.log("==============================================");
}

main().catch((err) => {
  console.error("Email automation setup failed:", err);
  process.exit(1);
});
