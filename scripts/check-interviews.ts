import "./load-env";
import { createServerSupabaseClient } from "@/lib/supabase";

async function main() {
  const supabase = createServerSupabaseClient();
  const { data: interviews, error } = await supabase
    .from("interviews")
    .select("*, candidates(name, contact_info), jobs(title, requirements)");

  if (error) {
    console.error("Error fetching interviews:", error.message);
    return;
  }

  console.log("Found interviews:", interviews?.length);
  for (const i of interviews || []) {
    const candidateId = i.candidate_id;
    const jobId = i.job_id;
    
    // Fetch latest score
    const { data: scores } = await supabase
      .from("scores")
      .select("*")
      .eq("candidate_id", candidateId)
      .eq("job_id", jobId)
      .order("created_at", { ascending: false })
      .limit(1);

    const score = scores?.[0];
    console.log(`Interview ID: ${i.id}`);
    console.log(`  Candidate: ${i.candidates?.name}`);
    console.log(`  Job: ${i.jobs?.title}`);
    console.log(`  AI Score: ${score ? score.ai_score : "No Score"}`);
    console.log(`  AI Classification: ${score ? score.evaluation.classification : "No Score"}`);
    console.log("---------------------------------------");
  }
}

main().catch(console.error);
