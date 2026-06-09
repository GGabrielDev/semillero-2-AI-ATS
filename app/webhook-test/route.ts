import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase";
import { generateEmbedding } from "@/lib/embeddings";
import fs from "fs/promises";
import path from "path";

export async function GET(request: NextRequest) {
  try {
    const supabase = createServerSupabaseClient();
    const origin = request.nextUrl.origin;

    // 1. Fetch or create a Job Vacancy for testing
    let job = null;
    const { data: existingJobs, error: jobsFetchError } = await supabase
      .from("jobs")
      .select("*")
      .limit(1);

    if (jobsFetchError) {
      return NextResponse.json({ error: `Failed to fetch jobs: ${jobsFetchError.message}` }, { status: 500 });
    }

    if (existingJobs && existingJobs.length > 0) {
      job = existingJobs[0];
    } else {
      // Create a default job if none exist
      const title = "Senior AI Research Engineer";
      const requirementsText = "We are seeking a Senior AI Research Engineer with expert knowledge in Large Language Models, PyTorch, LangChain, and agentic reasoning architectures.";
      const embedding = await generateEmbedding(requirementsText);

      const { data: newJob, error: jobInsertError } = await supabase
        .from("jobs")
        .insert({
          title,
          requirements: { text: requirementsText },
          embedding,
        })
        .select("*")
        .single();

      if (jobInsertError || !newJob) {
        return NextResponse.json({ error: `Failed to create mock job: ${jobInsertError?.message}` }, { status: 500 });
      }
      job = newJob;
    }

    // 2. Read the Curriculum Vitae test asset
    const cvPath = path.join(process.cwd(), "test-assets", "curriculum-vitae-english.pdf");
    let fileBuffer;
    try {
      fileBuffer = await fs.readFile(cvPath);
    } catch (fsError) {
      return NextResponse.json({
        error: `Could not read test CV asset at ${cvPath}. Please ensure it exists. Detailed error: ${fsError instanceof Error ? fsError.message : fsError}`
      }, { status: 400 });
    }

    const testMode = request.nextUrl.searchParams.get("testMode") !== "false";

    // 3. Prepare Form Data for parse-cv endpoint
    const formData = new FormData();
    const fileBlob = new Blob([fileBuffer], { type: "application/pdf" });
    formData.append("file", fileBlob, "curriculum-vitae-english.pdf");
    formData.append("jobId", job.id);
    formData.append("isTest", testMode ? "true" : "false");

    // 4. Send POST request to local parse-cv API
    const parseCvUrl = `${origin}/candidates/api/parse-cv`;
    let parseResult;
    try {
      const parseResponse = await fetch(parseCvUrl, {
        method: "POST",
        body: formData,
      });

      if (!parseResponse.ok) {
        const errText = await parseResponse.text();
        return NextResponse.json({
          error: `Parse-CV API returned non-OK status: ${parseResponse.status} - ${errText}`
        }, { status: 500 });
      }

      parseResult = await parseResponse.json();
    } catch (fetchError) {
      return NextResponse.json({
        error: `Failed to call local parse-cv route: ${fetchError instanceof Error ? fetchError.message : fetchError}`
      }, { status: 500 });
    }

    const { candidateId, interviewId, n8nResponse } = parseResult;

    // 5. Verification - Poll the Supabase `scores` table to verify n8n updated the DB
    let scoreRecord = null;
    let verificationAttempts = 0;
    const maxAttempts = 10;
    const delayMs = 1500;

    for (let i = 0; i < maxAttempts; i++) {
      verificationAttempts++;
      // Wait for n8n execution to finish and write back
      await new Promise((resolve) => setTimeout(resolve, delayMs));

      const { data: score, error: scoreError } = await supabase
        .from("scores")
        .select("*")
        .eq("candidate_id", candidateId)
        .eq("interview_id", interviewId)
        .maybeSingle();

      if (score && !scoreError) {
        scoreRecord = score;
        break;
      }
    }

    return NextResponse.json({
      status: scoreRecord ? "success" : "completed_with_pending_evaluation",
      message: scoreRecord
        ? "Pipeline test executed and verified successfully!"
        : "Pipeline executed but AI evaluation write-back is pending or failed.",
      testDetails: {
        jobUsed: {
          id: job.id,
          title: job.title,
          status: existingJobs && existingJobs.length > 0 ? "reused" : "created",
        },
        parseCvResponse: {
          candidateId,
          interviewId,
          n8nWebhookResponse: n8nResponse,
        },
        verification: {
          attempts: verificationAttempts,
          verified: !!scoreRecord,
          scoreData: scoreRecord,
        }
      }
    });

  } catch (error: unknown) {
    console.error("Error in webhook-test API:", error);
    const errorMessage = error instanceof Error ? error.message : "Internal Server Error";
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
