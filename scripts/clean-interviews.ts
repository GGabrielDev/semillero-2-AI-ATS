import "./load-env";
import { createServerSupabaseClient } from "@/lib/supabase";

const skillsMatch = (candSkill: string, jobSkill: string): boolean => {
  const c = candSkill.toLowerCase().trim();
  const j = jobSkill.toLowerCase().trim();
  if (c === j) return true;
  if (c.includes(j) || j.includes(c)) return true;
  
  const cWords = c.split(/[\s,./()&+-]+/).filter(w => w.length > 2);
  const jWords = j.split(/[\s,./()&+-]+/).filter(w => w.length > 2);
  
  const stopWords = ['and', 'for', 'with', 'the', 'management', 'administration', 'development', 'developer', 'engineer', 'system', 'systems', 'integration', 'operations', 'knowledge', 'experience', 'expert', 'proficiency', 'proficient'];
  
  const sharedWords = cWords.filter(w => jWords.includes(w) && !stopWords.includes(w));
  return sharedWords.length > 0;
};

async function main() {
  const supabase = createServerSupabaseClient();
  
  // 1. Fetch all interviews
  const { data: interviews, error: interviewsError } = await supabase
    .from("interviews")
    .select("*, candidates(*), jobs(*)");

  if (interviewsError) {
    console.error("Error fetching interviews:", interviewsError.message);
    return;
  }

  console.log(`Analyzing ${interviews?.length} interviews...`);
  
  for (const i of interviews || []) {
    const candidate = i.candidates;
    const job = i.jobs;
    if (!candidate || !job) continue;

    // Check skills overlap
    const jobSkills: string[] = job.requirements?.skills || [];
    const candidateSkills: string[] = candidate.contact_info?.skills || [];
    const matchedSkills = jobSkills.filter((js) =>
      candidateSkills.some((cs) => skillsMatch(cs, js))
    );
    
    const overlapCount = matchedSkills.length;
    const totalRequired = jobSkills.length;
    const matchPct = totalRequired > 0 ? Math.round((overlapCount / totalRequired) * 100) : 0;
    const isPotentialMatch = matchPct >= 75;

    // Fetch score
    const { data: scores } = await supabase
      .from("scores")
      .select("*")
      .eq("candidate_id", candidate.id)
      .eq("job_id", job.id)
      .order("created_at", { ascending: false })
      .limit(1);

    const score = scores?.[0];
    const isUnqualified = score?.evaluation?.classification === "Unqualified";

    if (!isPotentialMatch || isUnqualified) {
      console.log(`Deleting interview ID ${i.id}:`);
      console.log(`  Candidate: ${candidate.name}`);
      console.log(`  Job: ${job.title}`);
      console.log(`  Reason: ${!isPotentialMatch ? `Skill mismatch (${matchPct}% overlap)` : 'Deemed Unqualified by AI'}`);
      
      const { error: deleteError } = await supabase
        .from("interviews")
        .delete()
        .eq("id", i.id);

      if (deleteError) {
        console.error(`  Failed to delete: ${deleteError.message}`);
      } else {
        console.log("  Successfully deleted.");
      }
    } else {
      console.log(`Keeping interview ID ${i.id} for ${candidate.name} - ${job.title}`);
    }
  }
}

main().catch(console.error);
