import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase";
import { generateEmbedding } from "@/lib/embeddings";
import fs from "fs/promises";
import path from "path";

interface TestResult {
  fileName: string;
  status: "success" | "failed";
  error?: string;
  candidateId?: string;
  candidateName?: string;
  evaluation?: unknown;
}

export async function GET(request: NextRequest) {
  try {
    const supabase = createServerSupabaseClient();
    const origin = request.nextUrl.origin;
    const bulkMode = request.nextUrl.searchParams.get("bulk") === "true";

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

    // 2. Identify files to test
    const testAssetsDir = path.join(process.cwd(), "test-assets");
    let filesToTest: string[] = [];

    try {
      const files = await fs.readdir(testAssetsDir);
      filesToTest = files.filter(f => f.toLowerCase().endsWith(".pdf"));
    } catch (err) {
      return NextResponse.json({ error: `Failed to read test-assets folder: ${err instanceof Error ? err.message : err}` }, { status: 500 });
    }

    if (filesToTest.length === 0) {
      return NextResponse.json({ error: "No PDF CV assets found in test-assets folder." }, { status: 400 });
    }

    // If not bulk mode, limit to just the default single file
    if (!bulkMode) {
      const defaultFile = "curriculum-vitae-english.pdf";
      if (filesToTest.includes(defaultFile)) {
        filesToTest = [defaultFile];
      } else {
        filesToTest = [filesToTest[0]]; // Fallback to first available file
      }
    }

    const results: TestResult[] = [];

    // 3. Process test files sequentially
    for (const fileName of filesToTest) {
      const cvPath = path.join(testAssetsDir, fileName);
      let fileBuffer: Buffer;
      let candidateId: string | null = null;

      try {
        fileBuffer = await fs.readFile(cvPath);
      } catch (fsError) {
        results.push({
          fileName,
          status: "failed",
          error: `Could not read file: ${fsError instanceof Error ? fsError.message : fsError}`,
        });
        continue;
      }

      try {
        // Step A: Parse CV (creates candidate record in DB)
        const formData = new FormData();
        const fileBlob = new Blob([new Uint8Array(fileBuffer)], { type: "application/pdf" });
        formData.append("file", fileBlob, fileName);
        formData.append("isTest", "false"); // Must insert in DB so evaluate API can read it

        const parseCvUrl = `${origin}/candidates/api/parse-cv`;
        const parseResponse = await fetch(parseCvUrl, {
          method: "POST",
          body: formData,
        });

        if (!parseResponse.ok) {
          const errText = await parseResponse.text();
          throw new Error(`Parse-CV API error: ${parseResponse.status} - ${errText}`);
        }

        const parseResult = await parseResponse.json();
        candidateId = parseResult.candidateId;
        const candidateName = parseResult.candidateName;

        if (!candidateId || candidateId === "00000000-0000-0000-0000-000000000000") {
          throw new Error("Parse-CV API returned invalid candidateId");
        }

        // Step B: Run AI Evaluation (triggers n8n evaluation with isTest: true)
        const evaluateUrl = `${origin}/candidates/api/evaluate`;
        const evaluateResponse = await fetch(evaluateUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            candidateId,
            jobId: job.id,
            isTest: true, // In-memory evaluation to avoid inserting test score in Supabase
          }),
        });

        if (!evaluateResponse.ok) {
          const errText = await evaluateResponse.text();
          throw new Error(`Evaluate API error: ${evaluateResponse.status} - ${errText}`);
        }

        const evalResult = await evaluateResponse.json();
        const n8nResponse = evalResult.n8nResponse;

        // Step C: Verify n8n output structure
        const hasEvaluation = n8nResponse && typeof n8nResponse === "object" && "evaluation" in n8nResponse;
        const hasAiScore = n8nResponse && typeof n8nResponse === "object" && "ai_score" in n8nResponse;

        if (hasEvaluation && hasAiScore) {
          results.push({
            fileName,
            status: "success",
            candidateId,
            candidateName,
            evaluation: n8nResponse,
          });
        } else {
          throw new Error(`Invalid response structure from n8n: ${JSON.stringify(n8nResponse)}`);
        }
      } catch (err: unknown) {
        results.push({
          fileName,
          status: "failed",
          error: err instanceof Error ? err.message : String(err),
          candidateId: candidateId || undefined,
        });
      } finally {
        // Step D: Cleanup candidate from database (cascades to scores/interviews)
        if (candidateId && candidateId !== "00000000-0000-0000-0000-000000000000") {
          console.log(`Cleaning up test candidate: ${candidateId}`);
          await supabase.from("candidates").delete().eq("id", candidateId);
        }
      }
    }

    const overallSuccess = results.every(r => r.status === "success");

    return NextResponse.json({
      status: overallSuccess ? "success" : "partial_or_full_failure",
      bulkMode,
      totalCount: results.length,
      successCount: results.filter(r => r.status === "success").length,
      jobUsed: {
        id: job.id,
        title: job.title,
      },
      results,
    });

  } catch (error: unknown) {
    console.error("Error in webhook-test API:", error);
    const errorMessage = error instanceof Error ? error.message : "Internal Server Error";
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
