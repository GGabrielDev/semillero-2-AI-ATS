import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase";
import { generateEmbedding } from "@/lib/embeddings";
import { extractCandidateProfile } from "@/lib/gemini";

// Polyfill missing DOM APIs in Next.js Serverless / Node environment for pdfjs-dist
if (typeof global !== "undefined") {
  const g = global as Record<string, unknown>;
  if (!g["DOMMatrix"]) g["DOMMatrix"] = class DOMMatrix {};
  if (!g["ImageData"]) g["ImageData"] = class ImageData {};
  if (!g["Path2D"]) g["Path2D"] = class Path2D {};
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    if (!file) {
      return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Dynamic import to ensure global polyfills run first
    const { PDFParse } = await import("pdf-parse");

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
    const duplicateAction = formData.get("duplicateAction") || "check";

    let candidateId = "00000000-0000-0000-0000-000000000000";
    let candidateName = profile.candidateName;
    let isDuplicate = false;
    let existingCandidateData = null;

    if (!isTest) {
      // Initialize Supabase admin client
      const supabase = createServerSupabaseClient();

      interface DbCandidate {
        id: string;
        name: string;
        contact_info: {
          email: string;
          phone: string;
          skills?: string[];
          summary?: string;
        };
      }

      // Check for duplicate candidate (by email or exact name match)
      let existingCandidate: DbCandidate | null = null;
      if (profile.email) {
        const { data } = await supabase
          .from("candidates")
          .select("*")
          .eq("contact_info->>email", profile.email)
          .maybeSingle();
        existingCandidate = data as DbCandidate | null;
      }

      if (!existingCandidate && profile.candidateName) {
        const { data } = await supabase
          .from("candidates")
          .select("*")
          .ilike("name", profile.candidateName)
          .maybeSingle();
        existingCandidate = data as DbCandidate | null;
      }

      if (existingCandidate) {
        if (duplicateAction === "check") {
          isDuplicate = true;
          existingCandidateData = {
            id: existingCandidate.id,
            name: existingCandidate.name,
            contact_info: existingCandidate.contact_info,
          };
        } else if (duplicateAction === "overwrite") {
          const { data: updated, error: updateError } = await supabase
            .from("candidates")
            .update({
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
            .eq("id", existingCandidate.id)
            .select("*")
            .single();

          if (updateError || !updated) {
            return NextResponse.json(
              { error: updateError?.message || "Failed to overwrite candidate" },
              { status: 500 }
            );
          }

          candidateId = updated.id;
          candidateName = updated.name;
        } else {
          // ignore: insert as new candidate
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
        }
      } else {
        // No duplicate found, insert new candidate
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
      }
    }

    if (isDuplicate) {
      return NextResponse.json({
        success: true,
        isDuplicate: true,
        existingCandidate: existingCandidateData,
        newProfile: profile,
      });
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
