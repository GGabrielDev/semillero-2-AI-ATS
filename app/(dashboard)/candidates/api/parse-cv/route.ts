import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase";
import { generateEmbedding } from "@/lib/embeddings";
import { PDFParse } from "pdf-parse";
import { extractCandidateProfile } from "@/lib/gemini";

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
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

      // Decoupled: We no longer create an initial interview record on upload.
      // Interviews are only queued when recruiter manually takes action.
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
