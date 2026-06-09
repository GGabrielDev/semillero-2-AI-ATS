"use client";

import React, { useState, useEffect } from "react";

interface Job {
  id: string;
  title: string;
  requirements: { text: string };
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

      setUploadSuccess(`CV for ${file.name} successfully parsed and indexed!`);

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

            {/* Requirements */}
            <div className="p-4 bg-slate-50 rounded-md border border-slate-200">
              <h3 className="text-sm font-semibold text-slate-900 mb-2">
                Requirements
              </h3>
              <p className="text-slate-600 text-sm whitespace-pre-wrap">
                {selectedJob.requirements.text}
              </p>
            </div>

            {/* PDF Uploader */}
            <div className="border border-dashed border-slate-200 rounded-lg p-6 flex flex-col items-center justify-center text-center">
              <h3 className="text-sm font-semibold text-slate-900 mb-1">
                Upload Candidate CV (PDF)
              </h3>
              <p className="text-xs text-slate-500 mb-4 max-w-md">
                Uploading a candidate CV parses the text, calculates its semantic matching score, schedules a screening interview, and signals n8n workflow.
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
                Matched Candidates (Semantic Similarity)
              </h3>
              {loadingMatches ? (
                <p className="text-slate-500 text-sm">Finding matches...</p>
              ) : matches.length === 0 ? (
                <p className="text-slate-500 text-sm">
                  No candidates have been uploaded or matched yet.
                </p>
              ) : (
                <div className="flex flex-col gap-3">
                  {matches.map((match) => {
                    const similarityPct = match.similarity
                      ? Math.round(match.similarity * 100)
                      : null;
                    const latestScore = match.scores?.[0];

                    return (
                      <div
                        key={match.id}
                        className="p-4 rounded-md border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                      >
                        <div className="flex flex-col gap-1">
                          <div className="text-slate-900 font-bold text-sm">
                            {match.name}
                          </div>
                          <div className="text-xs text-slate-500">
                            Email: {match.contact_info.email} | Phone:{" "}
                            {match.contact_info.phone}
                          </div>
                          {latestScore && (
                            <div className="text-xs text-slate-600 mt-1">
                              <span className="font-semibold">AI Decision:</span>{" "}
                              {latestScore.evaluation.classification} (Score:{" "}
                              {latestScore.ai_score}/10)
                            </div>
                          )}
                        </div>
                        <div className="flex items-center gap-4">
                          {similarityPct !== null && (
                            <div className="text-right">
                              <span className="block text-xs font-semibold text-slate-500 uppercase tracking-wider">
                                Match Score
                              </span>
                              <span className="text-lg font-bold text-blue-600">
                                {similarityPct}%
                              </span>
                            </div>
                          )}
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
