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

interface UploadFileStatus {
  name: string;
  status: "uploading" | "success" | "error";
  errorMessage?: string;
}

export default function CandidatesPage() {
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadSuccess, setUploadSuccess] = useState<string | null>(null);
  const [uploadStatuses, setUploadStatuses] = useState<UploadFileStatus[]>([]);

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

  // Upload PDF CVs in a vacuum
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const fileList = Array.from(files);
    
    // Set initial status
    const initialStatuses = fileList.map((file) => ({
      name: file.name,
      status: "uploading" as const,
    }));
    setUploadStatuses(initialStatuses);
    setUploading(true);
    setUploadError(null);
    setUploadSuccess(null);

    const uploadPromises = fileList.map(async (file, index) => {
      if (file.type !== "application/pdf") {
        setUploadStatuses((prev) =>
          prev.map((status, idx) =>
            idx === index
              ? { ...status, status: "error" as const, errorMessage: "Only PDF files are allowed" }
              : status
          )
        );
        return;
      }

      try {
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

        await res.json();
        setUploadStatuses((prev) =>
          prev.map((status, idx) =>
            idx === index
              ? { ...status, status: "success" as const }
              : status
          )
        );
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Error uploading CV";
        setUploadStatuses((prev) =>
          prev.map((status, idx) =>
            idx === index
              ? { ...status, status: "error" as const, errorMessage: msg }
              : status
          )
        );
      }
    });

    await Promise.all(uploadPromises);
    setUploading(false);
    fetchCandidates();
    e.target.value = "";
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
          {uploading ? "Uploading CVs..." : "Upload CV Files"}
          <input
            type="file"
            accept=".pdf"
            multiple
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
        {uploadStatuses.length > 0 && (
          <div className="mt-4 w-full max-w-md border border-slate-200 rounded-md p-4 bg-slate-50 text-left">
            <h4 className="text-xs font-semibold text-slate-900 mb-2 uppercase tracking-wider">
              Upload Progress
            </h4>
            <ul className="divide-y divide-slate-200">
              {uploadStatuses.map((item, idx) => (
                <li key={idx} className="py-2 flex flex-col gap-1 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-slate-700 truncate max-w-[250px]" title={item.name}>
                      {item.name}
                    </span>
                    {item.status === "uploading" && (
                      <span className="text-slate-600 font-semibold flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-pulse"></span>
                        Uploading...
                      </span>
                    )}
                    {item.status === "success" && (
                      <span className="text-green-600 font-semibold flex items-center gap-1">
                        ✓ Success
                      </span>
                    )}
                    {item.status === "error" && (
                      <span className="text-red-600 font-semibold flex items-center gap-1">
                        ✗ Error
                      </span>
                    )}
                  </div>
                  {item.errorMessage && (
                    <p className="text-red-600 font-normal mt-0.5">{item.errorMessage}</p>
                  )}
                </li>
              ))}
            </ul>
          </div>
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
