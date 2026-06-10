import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase";
import { generateEmbedding } from "@/lib/embeddings";
import { extractJobProfile } from "@/lib/gemini";

export async function GET() {
  try {
    const supabase = createServerSupabaseClient();
    const { data: jobs, error } = await supabase
      .from("jobs")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(jobs);
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Internal Server Error";
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { title, requirements } = body;

    if (!title || !requirements) {
      return NextResponse.json({ error: "Title and requirements are required" }, { status: 400 });
    }

    const jobProfile = await extractJobProfile(requirements);
    const embedding = await generateEmbedding(requirements);
    const supabase = createServerSupabaseClient();

    const { data: job, error } = await supabase
      .from("jobs")
      .insert({
        title,
        requirements: { 
          text: requirements,
          skills: jobProfile.skills,
          summary: jobProfile.summary
        },
        embedding,
      })
      .select("*")
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(job);
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Internal Server Error";
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
