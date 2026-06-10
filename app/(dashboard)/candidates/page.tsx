"use client";

import React, { useState, useEffect } from "react";

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
  created_at: string;
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
  scores?: Score[];
  created_at: string;
}

export default function CandidatesPage() {
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadSuccess, setUploadSuccess] = useState<string | null>(null);

  const fetchCandidates = () => {
    fetch("/api/candidates")
      .then((res) => {
        if (!res.ok) throw new Error("Failed to fetch candidates");
        return res.json();
      })
      .then((data) => {
        setCandidates(data);
        setLoading(false);
      })
      .catch((err) => {
        console.error(err);
        setLoading(false);
      });
  };

  useEffect(() => {
    fetchCandidates();
  }, []);

  // Upload PDF CV in a vacuum
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

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

      const res = await fetch("/candidates/api/parse-cv", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || "Failed to process CV");
      }

      const resData = await res.json();
      setUploadSuccess(`CV for ${resData.candidateName || file.name} successfully parsed!`);
      fetchCandidates();
    } catch (err: unknown) {
      setUploadError(err instanceof Error ? err.message : "Error uploading CV");
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Candidates</h1>
          <p className="text-slate-600 text-sm">
            A list of all candidates parsed and analyzed by the AI recruitment pipeline.
          </p>
        </div>
      </div>

      {/* CV Uploader (Vacuum Ingestion) */}
      <div className="bg-white p-6 rounded-lg shadow-sm border border-slate-200 flex flex-col items-center justify-center text-center">
        <h3 className="text-sm font-semibold text-slate-900 mb-1">
          Ingest Candidate CV (in a Vacuum)
        </h3>
        <p className="text-xs text-slate-500 mb-4 max-w-md">
          Upload a candidate CV PDF to parse contact info, skills, and summary. 
          No job position will be associated initially, keeping the data isolated.
        </p>
        <label className="relative cursor-pointer bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded-md text-sm transition duration-200">
          {uploading ? "Processing CV..." : "Upload CV File"}
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

      {loading ? (
        <div className="bg-white p-6 rounded-lg shadow-sm border border-slate-200">
          <p className="text-slate-500 text-sm">Loading candidates...</p>
        </div>
      ) : candidates.length === 0 ? (
        <div className="bg-white p-6 rounded-lg shadow-sm border border-slate-200">
          <p className="text-slate-500 text-sm">
            No candidates found. Upload a CV above to get started.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6">
          {candidates.map((candidate) => {
            return (
              <div
                key={candidate.id}
                className="bg-white p-6 rounded-lg shadow-sm border border-slate-200 flex flex-col gap-4"
              >
                {/* Candidate Info Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
                  <div>
                    <h2 className="text-lg font-bold text-slate-900">
                      {candidate.name}
                    </h2>
                    <div className="text-xs text-slate-500 mt-1">
                      Email:{" "}
                      <span className="text-slate-600 font-medium mr-3">
                        {candidate.contact_info.email}
                      </span>
                      Phone:{" "}
                      <span className="text-slate-600 font-medium">
                        {candidate.contact_info.phone}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Extracted Profile (Summary & Skills) */}
                <div className="flex flex-col gap-2">
                  {candidate.contact_info.summary && (
                    <div>
                      <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block mb-1">
                        Professional Summary (Extracted)
                      </span>
                      <p className="text-slate-600 text-sm leading-relaxed">
                        {candidate.contact_info.summary}
                      </p>
                    </div>
                  )}
                  {candidate.contact_info.skills && candidate.contact_info.skills.length > 0 && (
                    <div className="mt-1">
                      <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block mb-1">
                        Skills & Technologies
                      </span>
                      <div className="flex flex-wrap gap-1.5">
                        {candidate.contact_info.skills.map((skill) => (
                          <span
                            key={skill}
                            className="px-2 py-0.5 bg-slate-50 text-slate-600 text-xs rounded border border-slate-200"
                          >
                            {skill}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
