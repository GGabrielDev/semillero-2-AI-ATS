import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { candidateId, jobId, isTest } = body;

    if (!candidateId || !jobId) {
      return NextResponse.json(
        { error: "candidateId and jobId are required" },
        { status: 400 }
      );
    }

    const supabase = createServerSupabaseClient();

    // 1. Fetch candidate details
    const { data: candidate, error: candidateError } = await supabase
      .from("candidates")
      .select("*")
      .eq("id", candidateId)
      .single();

    if (candidateError || !candidate) {
      return NextResponse.json(
        { error: candidateError?.message || "Candidate not found" },
        { status: 404 }
      );
    }

    const contactInfo = candidate.contact_info as {
      email?: string;
      phone?: string;
      skills?: string[];
      summary?: string;
      cv_text?: string;
    };

    const cvText = contactInfo.cv_text || "";
    const email = contactInfo.email || "unknown@example.com";
    const candidateName = candidate.name;

    // 2. Fetch job details
    const { data: job, error: jobError } = await supabase
      .from("jobs")
      .select("*")
      .eq("id", jobId)
      .single();

    if (jobError || !job) {
      return NextResponse.json(
        { error: jobError?.message || "Job not found" },
        { status: 404 }
      );
    }

    const jobRequirementsText = (job.requirements as { text?: string })?.text || "";

    // 3. Call n8n webhook passing jobId instead of interviewId
    let n8nResponseData = null;
    const webhookUrl = process.env.NEXT_PUBLIC_N8N_WEBHOOK_URL;

    if (webhookUrl) {
      try {
        const n8nResponse = await fetch(webhookUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            candidateId,
            jobId,
            candidateName,
            candidateEmail: email,
            text: cvText,
            jobTitle: job.title,
            jobRequirements: jobRequirementsText,
            isTest: isTest === true || isTest === "true",
          }),
        });

        if (n8nResponse.ok) {
          const contentType = n8nResponse.headers.get("content-type");
          if (contentType && contentType.includes("application/json")) {
            n8nResponseData = await n8nResponse.json();
          } else {
            n8nResponseData = { message: await n8nResponse.text() };
          }
        } else {
          const errText = await n8nResponse.text();
          n8nResponseData = { error: `n8n response not ok: ${n8nResponse.status} - ${errText}` };
        }
      } catch (err: unknown) {
        n8nResponseData = { error: err instanceof Error ? err.message : "Failed to call n8n webhook" };
      }
    } else {
      n8nResponseData = { error: "NEXT_PUBLIC_N8N_WEBHOOK_URL is not set" };
    }

    return NextResponse.json({
      success: true,
      candidateId,
      jobId,
      candidateName,
      n8nResponse: n8nResponseData,
    });
  } catch (error: unknown) {
    console.error("Error in evaluate route:", error);
    const errorMessage = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
