import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase";

interface CandidateScore {
  id: string;
  candidate_id: string;
  ai_score: number;
  evaluation: {
    summary: string;
    classification: string;
    suggestions: string;
    riskLevel: string;
  };
  created_at: string;
}

interface RankedCandidate {
  id: string;
  name: string;
  contact_info: {
    email: string;
    phone: string;
  };
  similarity?: number;
  scores?: CandidateScore[];
}

export async function GET(request: NextRequest) {
  try {
    const supabase = createServerSupabaseClient();
    const jobId = request.nextUrl.searchParams.get("jobId");

    if (jobId) {
      // 1. Fetch the job embedding
      const { data: job, error: jobError } = await supabase
        .from("jobs")
        .select("embedding")
        .eq("id", jobId)
        .single();

      if (jobError || !job) {
        return NextResponse.json({ error: "Job not found or error fetching job" }, { status: 404 });
      }

      if (!job.embedding) {
        return NextResponse.json({ error: "Job embedding not generated yet" }, { status: 400 });
      }

      // 2. Query similarity ranking using match_candidates rpc
      const { data: rankedCandidates, error: matchError } = await supabase.rpc(
        "match_candidates",
        {
          query_embedding: job.embedding,
          match_threshold: -1.0,
          match_count: 50,
        }
      );

      if (matchError) {
        return NextResponse.json({ error: matchError.message }, { status: 500 });
      }

      const candidatesList = (rankedCandidates as unknown as RankedCandidate[]) || [];

      // 3. Fetch scores for these matched candidates to return AI scores/details
      if (candidatesList.length > 0) {
        const candidateIds = candidatesList.map((c) => c.id);
        const { data: scores, error: scoresError } = await supabase
          .from("scores")
          .select("*, interviews!inner(job_id)")
          .in("candidate_id", candidateIds)
          .eq("interviews.job_id", jobId)
          .order("created_at", { ascending: false });

        if (!scoresError && scores) {
          const typedScores = (scores as unknown as CandidateScore[]) || [];
          
          // Normalize scores on the fly (convert 0.88 to 88, 7.5 to 75) and enforce classification rules
          typedScores.forEach((s) => {
            if (s.ai_score <= 1.0) {
              s.ai_score = Math.round(s.ai_score * 100);
            } else if (s.ai_score <= 10.0) {
              s.ai_score = Math.round(s.ai_score * 10);
            } else {
              s.ai_score = Math.round(s.ai_score);
            }

            // Enforce classification rules:
            // 1. If score < 50, it MUST be Unqualified
            // 2. If score is between 50 and 74, and classification is Qualified, downgrade to Review
            if (s.ai_score < 50) {
              s.evaluation.classification = "Unqualified";
            } else if (s.ai_score >= 50 && s.ai_score < 75) {
              if (s.evaluation.classification === "Qualified") {
                s.evaluation.classification = "Review";
              }
            }
          });

          // Merge scores into rankedCandidates
          const scoresMap = new Map<string, CandidateScore[]>();
          typedScores.forEach((s) => {
            const list = scoresMap.get(s.candidate_id) || [];
            list.push(s);
            // Double safeguard: sort list descending by created_at
            list.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
            scoresMap.set(s.candidate_id, list);
          });

          candidatesList.forEach((c) => {
            c.scores = scoresMap.get(c.id) || [];
          });
        } else {
          candidatesList.forEach((c) => {
            c.scores = [];
          });
        }
      }

      return NextResponse.json(candidatesList);
    } else {
      // Fetch all candidates sorted by created_at descending, along with scores ordered descending
      const { data: candidates, error } = await supabase
        .from("candidates")
        .select("*, scores(*)")
        .order("created_at", { ascending: false })
        .order("created_at", { referencedTable: "scores", ascending: false });

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      // Safeguard: Sort and normalize scores inside each candidate in Javascript as well
      const typedCandidates = candidates || [];
      typedCandidates.forEach(cand => {
        if (cand.scores && Array.isArray(cand.scores)) {
          cand.scores.forEach((s: CandidateScore) => {
            if (s.ai_score <= 1.0) {
              s.ai_score = Math.round(s.ai_score * 100);
            } else if (s.ai_score <= 10.0) {
              s.ai_score = Math.round(s.ai_score * 10);
            } else {
              s.ai_score = Math.round(s.ai_score);
            }

            // Enforce classification rules:
            if (s.ai_score < 50) {
              s.evaluation.classification = "Unqualified";
            } else if (s.ai_score >= 50 && s.ai_score < 75) {
              if (s.evaluation.classification === "Qualified") {
                s.evaluation.classification = "Review";
              }
            }
          });
          cand.scores.sort((a: CandidateScore, b: CandidateScore) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        }
      });

      return NextResponse.json(typedCandidates);
    }
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Internal Server Error";
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
