"use client";

import React, { useState, useEffect } from "react";

interface Job {
  id: string;
  title: string;
  requirements: {
    text: string;
    skills?: string[];
    summary?: string;
  };
  created_at: string;
}

interface Score {
  id: string;
  candidate_id: string;
  ai_score: number;
  evaluation: {
    summary: string;
    classification: string;
    suggestions: string;
    riskLevel: string;
  };
}

interface Candidate {
  id: string;
  name: string;
  contact_info: {
    email: string;
    phone: string;
    skills?: string[];
    summary?: string;
  };
  similarity?: number;
  scores?: Score[];
  created_at: string;
}

export default function JobsPage() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [matches, setMatches] = useState<Candidate[]>([]);
  
  const [loadingJobs, setLoadingJobs] = useState(true);
  const [loadingMatches, setLoadingMatches] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadSuccess, setUploadSuccess] = useState<string | null>(null);

  // Evaluation states
  const [evaluatingIds, setEvaluatingIds] = useState<Record<string, boolean>>({});

  // Form states
  const [newTitle, setNewTitle] = useState("");
  const [newRequirements, setNewRequirements] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Fetch all jobs on mount
  useEffect(() => {
    let active = true;
    fetch("/api/jobs")
      .then((res) => {
        if (!res.ok) throw new Error("Failed to fetch jobs");
        return res.json();
      })
      .then((data) => {
        if (active) {
          setJobs(data);
          setLoadingJobs(false);
          if (data.length > 0) {
            setSelectedJob(data[0]);
          }
        }
      })
      .catch((err) => {
        console.error(err);
        if (active) {
          setLoadingJobs(false);
        }
      });

    return () => {
      active = false;
    };
  }, []);

  // Fetch candidates/matches when selected job changes
  useEffect(() => {
    let active = true;

    if (!selectedJob) {
      Promise.resolve().then(() => {
        if (active) setMatches([]);
      });
      return;
    }

    Promise.resolve().then(() => {
      if (active) setLoadingMatches(true);
    });

    fetch(`/api/candidates?jobId=${selectedJob.id}`)
      .then((res) => {
        if (!res.ok) throw new Error("Failed to fetch candidate matches");
        return res.json();
      })
      .then((data) => {
        if (active) {
          setMatches(data);
          setLoadingMatches(false);
        }
      })
      .catch((err) => {
        console.error(err);
        if (active) {
          setLoadingMatches(false);
        }
      });

    return () => {
      active = false;
    };
  }, [selectedJob]);

  // Create vacancy
  const handleCreateJob = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim() || !newRequirements.trim()) {
      setFormError("All fields are required");
      return;
    }
    try {
      setIsSubmitting(true);
      setFormError(null);
      const res = await fetch("/api/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: newTitle, requirements: newRequirements }),
      });
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || "Failed to create vacancy");
      }
      const newJob = await res.json();
      setJobs((prev) => [newJob, ...prev]);
      setSelectedJob(newJob);
      setNewTitle("");
      setNewRequirements("");
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : "Error creating job");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Upload PDF CV
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedJob) return;

    if (file.type !== "application/pdf") {
      setUploadError("Please upload a PDF file");
      return;
    }

    try {
      setUploading(true);
      setUploadError(null);
      setUploadSuccess(null);

      const formData = new FormData();
      formData.append("file", file);
      formData.append("jobId", selectedJob.id);

      const res = await fetch("/candidates/api/parse-cv", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || "Failed to process CV");
      }

      const resData = await res.json();
      setUploadSuccess(`CV for ${resData.candidateName || file.name} successfully parsed and linked!`);

      // Refresh matches for current job
      const matchesRes = await fetch(`/api/candidates?jobId=${selectedJob.id}`);
      if (matchesRes.ok) {
        const matchesData = await matchesRes.json();
        setMatches(matchesData);
      }
    } catch (err: unknown) {
      setUploadError(err instanceof Error ? err.message : "Error uploading CV");
    } finally {
      setUploading(false);
      // Clear file input
      e.target.value = "";
    }
  };

  // Run deep AI evaluation via backend endpoint
  const handleEvaluate = async (candidateId: string) => {
    if (!selectedJob) return;
    try {
      setEvaluatingIds((prev) => ({ ...prev, [candidateId]: true }));
      const res = await fetch("/candidates/api/evaluate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ candidateId, jobId: selectedJob.id }),
      });
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || "Failed to trigger evaluation");
      }
      
      // Refresh matches for current job
      const matchesRes = await fetch(`/api/candidates?jobId=${selectedJob.id}`);
      if (matchesRes.ok) {
        const matchesData = await matchesRes.json();
        setMatches(matchesData);
      }
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Error evaluating candidate");
    } finally {
      setEvaluatingIds((prev) => ({ ...prev, [candidateId]: false }));
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Left Column: Create Form & Vacancies List */}
      <div className="lg:col-span-1 flex flex-col gap-6">
        {/* Create vacancy form */}
        <div className="bg-white p-6 rounded-lg shadow-sm border border-slate-200">
          <h2 className="text-lg font-bold text-slate-900 mb-4">Create Vacancy</h2>
          <form onSubmit={handleCreateJob} className="flex flex-col gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
                Job Title
              </label>
              <input
                type="text"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="e.g., Senior React Developer"
                className="w-full px-3 py-2 border border-slate-200 rounded-md text-slate-900 bg-white placeholder:text-slate-500 text-sm focus:outline-none"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
                Requirements text
              </label>
              <textarea
                value={newRequirements}
                onChange={(e) => setNewRequirements(e.target.value)}
                placeholder="Describe key candidate qualifications and tech stack..."
                rows={4}
                className="w-full px-3 py-2 border border-slate-200 rounded-md text-slate-900 bg-white placeholder:text-slate-500 text-sm focus:outline-none"
                required
              />
            </div>
            {formError && (
              <p className="text-xs text-red-600 font-semibold">{formError}</p>
            )}
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-md transition duration-200 disabled:opacity-50"
            >
              {isSubmitting ? "Creating..." : "Create Vacancy"}
            </button>
          </form>
        </div>

        {/* Vacancy list */}
        <div className="bg-white p-6 rounded-lg shadow-sm border border-slate-200 flex-1">
          <h2 className="text-lg font-bold text-slate-900 mb-4">Job Vacancies</h2>
          {loadingJobs ? (
            <p className="text-slate-500 text-sm">Loading jobs...</p>
          ) : jobs.length === 0 ? (
            <p className="text-slate-500 text-sm">No vacancies created yet.</p>
          ) : (
            <div className="flex flex-col gap-2">
              {jobs.map((job) => (
                <button
                  key={job.id}
                  onClick={() => {
                    setSelectedJob(job);
                    setUploadError(null);
                    setUploadSuccess(null);
                  }}
                  className={`w-full text-left p-3 rounded-md border text-sm transition duration-200 ${
                    selectedJob?.id === job.id
                      ? "border-blue-600 bg-slate-50 font-semibold"
                      : "border-slate-200 hover:border-slate-300"
                  }`}
                >
                  <div className="text-slate-900">{job.title}</div>
                  <div className="text-xs text-slate-500 mt-1">
                    Created: {new Date(job.created_at).toLocaleDateString()}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Right Column: Selected Job Details & Candidate Match */}
      <div className="lg:col-span-2">
        {selectedJob ? (
          <div className="bg-white p-6 rounded-lg shadow-sm border border-slate-200 flex flex-col gap-6">
            {/* Header */}
            <div>
              <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Vacancy Details
              </div>
              <h1 className="text-2xl font-bold text-slate-900 mt-1">
                {selectedJob.title}
              </h1>
              <p className="text-xs text-slate-500 mt-1">
                ID: {selectedJob.id}
              </p>
            </div>

            {/* Requirements & Extracted Job Skills */}
            <div className="p-4 bg-slate-50 rounded-md border border-slate-200 flex flex-col gap-3">
              <div>
                <h3 className="text-sm font-semibold text-slate-900 mb-1">
                  Description
                </h3>
                <p className="text-slate-600 text-sm whitespace-pre-wrap leading-relaxed">
                  {selectedJob.requirements.text}
                </p>
              </div>
              {selectedJob.requirements.skills && selectedJob.requirements.skills.length > 0 && (
                <div>
                  <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                    Extracted Job Keywords / Required Skills
                  </h3>
                  <div className="flex flex-wrap gap-1.5">
                    {selectedJob.requirements.skills.map((skill) => (
                      <span
                        key={skill}
                        className="px-2 py-0.5 bg-white border border-slate-200 text-slate-700 text-xs rounded-md font-medium"
                      >
                        {skill}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* PDF Uploader */}
            <div className="border border-dashed border-slate-200 rounded-lg p-6 flex flex-col items-center justify-center text-center">
              <h3 className="text-sm font-semibold text-slate-900 mb-1">
                Upload Candidate CV for this Vacancy (PDF)
              </h3>
              <p className="text-xs text-slate-500 mb-4 max-w-md">
                Uploading a candidate CV parses the text and extracts their skills/profile in a vacuum. It associates them with this job, enabling you to check skills overlap before running the deep AI score model.
              </p>
              <label className="relative cursor-pointer bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded-md text-sm transition duration-200">
                {uploading ? "Processing CV..." : "Choose CV File"}
                <input
                  type="file"
                  accept=".pdf"
                  onChange={handleFileUpload}
                  disabled={uploading}
                  className="hidden"
                />
              </label>
              {uploadError && (
                <p className="text-xs text-red-600 mt-3 font-semibold">
                  {uploadError}
                </p>
              )}
              {uploadSuccess && (
                <p className="text-xs text-green-600 mt-3 font-semibold">
                  {uploadSuccess}
                </p>
              )}
            </div>

            {/* Matches List */}
            <div>
              <h3 className="text-base font-bold text-slate-900 mb-3">
                Candidates & Compatibility Index
              </h3>
              {loadingMatches ? (
                <p className="text-slate-500 text-sm">Finding matches...</p>
              ) : matches.length === 0 ? (
                <p className="text-slate-500 text-sm">
                  No candidates have been uploaded or matched yet.
                </p>
              ) : (
                <div className="flex flex-col gap-4">
                  {matches.map((match) => {
                    const similarityPct = match.similarity
                      ? Math.round(match.similarity * 100)
                      : null;
                    const latestScore = match.scores?.[0];

                    // Programmatic skills matching logic
                    const jobSkills = selectedJob.requirements.skills || [];
                    const candidateSkills = match.contact_info.skills || [];

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
                    
                    const matchedSkills = jobSkills.filter(js => 
                      candidateSkills.some(cs => skillsMatch(cs, js))
                    );
                    const missingSkills = jobSkills.filter(js => 
                      !candidateSkills.some(cs => skillsMatch(cs, js))
                    );
                    
                    const overlapCount = matchedSkills.length;
                    const totalRequired = jobSkills.length;
                    const matchPct = totalRequired > 0 ? Math.round((overlapCount / totalRequired) * 100) : 0;
                    const isPotentialMatch = matchPct >= 75;

                    return (
                      <div
                        key={match.id}
                        className="p-5 rounded-lg border border-slate-200 bg-white flex flex-col gap-4 shadow-sm hover:border-slate-300 transition duration-200"
                      >
                        {/* Upper info panel */}
                        <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                          <div className="flex flex-col gap-1">
                            <div className="text-slate-900 font-bold text-base">
                              {match.name}
                            </div>
                            <div className="text-xs text-slate-500">
                              Email: <span className="text-slate-700 font-medium mr-3">{match.contact_info.email}</span>
                              Phone: <span className="text-slate-700 font-medium">{match.contact_info.phone}</span>
                            </div>
                          </div>

                          <div className="flex flex-wrap items-center gap-2">
                            {/* Pre-selection status badge */}
                            <span
                              className={`px-2.5 py-1 text-xs font-semibold rounded-md border ${
                                isPotentialMatch
                                  ? "bg-green-50 text-green-700 border-green-200"
                                  : "bg-slate-50 text-slate-500 border-slate-200"
                              }`}
                            >
                              {isPotentialMatch
                                ? `Potential Match (${matchPct}% overlap)`
                                : `Skill Mismatch (${matchPct}% overlap)`}
                            </span>
                            
                            {/* Semantic embedding similarity badge */}
                            {similarityPct !== null && (
                              <span className="px-2.5 py-1 text-xs font-semibold rounded-md border bg-blue-50 text-blue-700 border-blue-200">
                                Semantic: {similarityPct}%
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Skills overlap details */}
                        <div className="bg-slate-50 p-3 rounded-md border border-slate-100 flex flex-col gap-2">
                          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                            Skills Check: {overlapCount} of {totalRequired} matching
                          </div>
                          
                          <div className="flex flex-wrap gap-1.5">
                            {/* Display matched skills in green */}
                            {matchedSkills.map(skill => (
                              <span
                                key={skill}
                                className="px-2 py-0.5 bg-green-100 text-green-800 border border-green-200 text-xs rounded-md font-medium"
                              >
                                {skill}
                              </span>
                            ))}

                            {/* Display missing skills in light red/gray dashed */}
                            {missingSkills.map(skill => (
                              <span
                                key={skill}
                                className="px-2 py-0.5 bg-white border border-slate-200 border-dashed text-slate-400 text-xs rounded-md"
                              >
                                {skill} (missing)
                              </span>
                            ))}

                            {/* Fallback if no skills are loaded */}
                            {jobSkills.length === 0 && (
                              <span className="text-xs text-slate-500 italic">
                                No required skills extracted for this job yet.
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Bottom evaluation / action panel */}
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-3 border-t border-slate-100">
                          <div>
                            {latestScore ? (
                              <div className="flex flex-col gap-1">
                                <div className="text-xs text-slate-500">
                                  AI ASSESSMENT RESULT
                                </div>
                                <div className="text-sm text-slate-700 font-medium">
                                  Decision: <span className="font-bold text-slate-900">{latestScore.evaluation.classification}</span>
                                  <span className="mx-2 font-normal text-slate-300">|</span>
                                  Score: <span className="font-bold text-blue-600 text-base">{latestScore.ai_score} / 100</span>
                                </div>
                                <div className="text-xs text-slate-500 leading-normal max-w-lg mt-1">
                                  {latestScore.evaluation.summary}
                                </div>
                              </div>
                            ) : (
                              <div className="text-xs text-slate-500 italic">
                                Ready for deep assessment. Only potential matches recommended for LLM budget optimization.
                              </div>
                            )}
                          </div>

                          <div className="self-end sm:self-center">
                            <button
                              onClick={() => handleEvaluate(match.id)}
                              disabled={evaluatingIds[match.id]}
                              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-md transition duration-200 disabled:opacity-50 shadow-sm"
                            >
                              {evaluatingIds[match.id]
                                ? "Evaluating (n8n)..."
                                : latestScore
                                ? "Re-run Deep AI"
                                : "Run Deep AI Evaluation"}
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="bg-white p-12 rounded-lg shadow-sm border border-slate-200 flex flex-col items-center justify-center text-center">
            <p className="text-slate-600 font-semibold mb-2">
              Select or create a job vacancy to get started
            </p>
            <p className="text-slate-500 text-xs max-w-sm">
              Use the sidebar panel to choose a vacancy or fill in the form to establish a new open position.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
