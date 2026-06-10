import { Logger } from "./logger";

export interface CandidateProfile {
  candidateName: string;
  email: string;
  phone: string;
  skills: string[];
  summary: string;
}

export interface JobProfile {
  skills: string[];
  summary: string;
}

export async function extractCandidateProfile(text: string): Promise<CandidateProfile> {
  const webhookUrl = process.env.NEXT_PUBLIC_N8N_WEBHOOK_URL;
  const baseUrl = webhookUrl
    ? webhookUrl.replace(/\/evaluate-candidate$/, "")
    : "https://n8n.gaboggamer.online/webhook";
  
  const targetUrl = `${baseUrl}/extract-candidate-profile`;

  try {
    const start = Date.now();
    const response = await fetch(targetUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ text }),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`n8n candidate profiling error: ${response.status} - ${errText}`);
    }

    const data = await response.json();
    
    // In n8n response, it might be inside an array or directly the object.
    let profile = Array.isArray(data) ? data[0] : data;
    
    // Extract nested json property if present
    if (profile && profile.json) {
      profile = profile.json;
    }

    if (!profile || !profile.candidateName) {
      throw new Error("Invalid response structure from n8n candidate profiling");
    }

    // Normalize skills to lowercase
    if (Array.isArray(profile.skills)) {
      profile.skills = profile.skills.map((s: string) => s.toLowerCase().trim());
    } else {
      profile.skills = [];
    }

    Logger.info("Extracted candidate profile via n8n successfully", {
      candidateName: profile.candidateName,
      skillsCount: profile.skills?.length,
    }, Date.now() - start);

    return profile as CandidateProfile;
  } catch (error) {
    Logger.error("Failed to extract candidate profile via n8n", error);
    throw error;
  }
}

export async function extractJobProfile(requirements: string): Promise<JobProfile> {
  const webhookUrl = process.env.NEXT_PUBLIC_N8N_WEBHOOK_URL;
  const baseUrl = webhookUrl
    ? webhookUrl.replace(/\/evaluate-candidate$/, "")
    : "https://n8n.gaboggamer.online/webhook";
  
  const targetUrl = `${baseUrl}/extract-job-profile`;

  try {
    const start = Date.now();
    const response = await fetch(targetUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ requirements }),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`n8n job profiling error: ${response.status} - ${errText}`);
    }

    const data = await response.json();
    let profile = Array.isArray(data) ? data[0] : data;
    
    if (profile && profile.json) {
      profile = profile.json;
    }

    if (!profile || !profile.skills) {
      throw new Error("Invalid response structure from n8n job profiling");
    }

    // Normalize skills to lowercase
    if (Array.isArray(profile.skills)) {
      profile.skills = profile.skills.map((s: string) => s.toLowerCase().trim());
    } else {
      profile.skills = [];
    }

    Logger.info("Extracted job profile via n8n successfully", {
      skillsCount: profile.skills?.length,
    }, Date.now() - start);

    return profile as JobProfile;
  } catch (error) {
    Logger.error("Failed to extract job profile via n8n", error);
    throw error;
  }
}
