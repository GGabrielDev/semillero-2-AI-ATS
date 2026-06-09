import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase";
import { generateEmbedding } from "@/lib/embeddings";
import { PDFParse } from "pdf-parse";

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const jobId = formData.get("jobId") as string | null;

    if (!file) {
      return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
    }

    if (!jobId) {
      return NextResponse.json({ error: "Missing jobId" }, { status: 400 });
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

    // Extract name from file (strip extension)
    const name = file.name.replace(/\.[^/.]+$/, "");

    // Extract email and phone using regex
    const emailRegex = /[\w.-]+@[\w.-]+\.\w+/;
    const emailMatch = text.match(emailRegex);
    const email = emailMatch ? emailMatch[0] : "unknown@example.com";

    const phoneRegex = /(?:\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/;
    const phoneMatch = text.match(phoneRegex);
    const phone = phoneMatch ? phoneMatch[0] : "Not provided";

    // Generate candidate embedding
    const embedding = await generateEmbedding(cleanText);

    const isTest = formData.get("isTest") === "true";

    let candidateId = "00000000-0000-0000-0000-000000000000";
    let interviewId = "00000000-0000-0000-0000-000000000000";
    let candidateName = name;

    if (!isTest) {
      // Initialize Supabase admin client
      const supabase = createServerSupabaseClient();

      // Insert candidate
      const { data: candidate, error: candidateError } = await supabase
        .from("candidates")
        .insert({
          name,
          contact_info: { email, phone },
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

      // Insert an initial interview
      const { data: interview, error: interviewError } = await supabase
        .from("interviews")
        .insert({
          candidate_id: candidate.id,
          job_id: jobId,
          interview_date: new Date().toISOString(),
          stage: "Screening",
        })
        .select("*")
        .single();

      if (interviewError || !interview) {
        return NextResponse.json(
          { error: interviewError?.message || "Failed to insert interview" },
          { status: 500 }
        );
      }

      candidateId = candidate.id;
      interviewId = interview.id;
      candidateName = candidate.name;
    }

    // Call n8n webhook
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
            interviewId,
            candidateName,
            candidateEmail: email,
            text: cleanText,
            isTest,
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
      n8nResponseData = { message: "NEXT_PUBLIC_N8N_WEBHOOK_URL is not set" };
    }

    return NextResponse.json({
      success: true,
      candidateId,
      interviewId,
      candidateName,
      n8nResponse: n8nResponseData,
    });
  } catch (error: unknown) {
    console.error("Error in parse-cv route:", error);
    const errorMessage = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
