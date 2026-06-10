import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase";
import { generateEmbedding } from "@/lib/embeddings";
import { PDFParse } from "pdf-parse";
import { extractCandidateProfile } from "@/lib/gemini";

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const jobId = formData.get("jobId") as string | null;

    if (!file) {
      return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Extract text from PDF using PDFParse v2 API
    const parser = new PDFParse({ data: buffer });
    const pdfData = await parser.getText();
    const text = pdfData.text;
    await parser.destroy();

    if (!text) {
      return NextResponse.json({ error: "Failed to extract text from PDF" }, { status: 400 });
    }

    // Clean text
    const cleanText = text.replace(/\s+/g, " ").trim();

    // Extract professional profile using Gemini 1.5 Flash
    const profile = await extractCandidateProfile(cleanText);

    // Generate candidate embedding
    const embedding = await generateEmbedding(cleanText);

    const isTest = formData.get("isTest") === "true";

    let candidateId = "00000000-0000-0000-0000-000000000000";
    let candidateName = profile.candidateName;

    if (!isTest) {
      // Initialize Supabase admin client
      const supabase = createServerSupabaseClient();

      // Insert candidate with extracted details (including skills, summary, and cv_text)
      const { data: candidate, error: candidateError } = await supabase
        .from("candidates")
        .insert({
          name: profile.candidateName,
          contact_info: {
            email: profile.email,
            phone: profile.phone,
            skills: profile.skills || [],
            summary: profile.summary || "",
            cv_text: cleanText,
          },
          embedding,
        })
        .select("*")
        .single();

      if (candidateError || !candidate) {
        return NextResponse.json(
          { error: candidateError?.message || "Failed to insert candidate" },
          { status: 500 }
        );
      }

      candidateId = candidate.id;
      candidateName = candidate.name;

      // Create an initial interview record if jobId is provided (but do not trigger n8n evaluate webhook yet)
      if (jobId) {
        const { error: interviewError } = await supabase
          .from("interviews")
          .insert({
            candidate_id: candidate.id,
            job_id: jobId,
            interview_date: new Date().toISOString(),
            stage: "Screening",
          });
        if (interviewError) {
          console.error("Failed to insert interview:", interviewError.message);
        }
      }
    }

    return NextResponse.json({
      success: true,
      candidateId,
      candidateName,
      profile,
    });
  } catch (error: unknown) {
    console.error("Error in parse-cv route:", error);
    const errorMessage = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
