import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { candidateId, jobId } = body;

    if (!candidateId || !jobId) {
      return NextResponse.json(
        { error: "candidateId and jobId are required" },
        { status: 400 }
      );
    }

    const supabase = createServerSupabaseClient();

    // 1. Check if interview record already exists
    const { data: existingInterviews, error: fetchError } = await supabase
      .from("interviews")
      .select("id")
      .eq("candidate_id", candidateId)
      .eq("job_id", jobId)
      .limit(1);

    if (fetchError) {
      return NextResponse.json({ error: fetchError.message }, { status: 500 });
    }

    if (existingInterviews && existingInterviews.length > 0) {
      return NextResponse.json({
        success: true,
        message: "Candidate already promoted to interviews.",
        interviewId: existingInterviews[0].id,
      });
    }

    // 2. Insert new interview record
    const { data: newInterview, error: insertError } = await supabase
      .from("interviews")
      .insert({
        candidate_id: candidateId,
        job_id: jobId,
        interview_date: new Date().toISOString(),
        stage: "Screening",
      })
      .select("id")
      .single();

    if (insertError || !newInterview) {
      return NextResponse.json(
        { error: insertError?.message || "Failed to create interview record" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Candidate successfully promoted to interviews.",
      interviewId: newInterview.id,
    });
  } catch (error: unknown) {
    console.error("Error in promote API:", error);
    const errorMessage = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
