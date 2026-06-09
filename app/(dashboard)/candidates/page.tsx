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
  };
  scores?: Score[];
  created_at: string;
}

export default function CandidatesPage() {
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    fetch("/api/candidates")
      .then((res) => {
        if (!res.ok) throw new Error("Failed to fetch candidates");
        return res.json();
      })
      .then((data) => {
        if (active) {
          setCandidates(data);
          setLoading(false);
        }
      })
      .catch((err) => {
        console.error(err);
        if (active) {
          setLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, []);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Candidates</h1>
        <p className="text-slate-600 text-sm">
          A list of all candidates parsed and analyzed by the AI recruitment pipeline.
        </p>
      </div>

      {loading ? (
        <div className="bg-white p-6 rounded-lg shadow-sm border border-slate-200">
          <p className="text-slate-500 text-sm">Loading candidates...</p>
        </div>
      ) : candidates.length === 0 ? (
        <div className="bg-white p-6 rounded-lg shadow-sm border border-slate-200">
          <p className="text-slate-500 text-sm">
            No candidates found. Upload CVs on the Jobs tab to parse them.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6">
          {candidates.map((candidate) => {
            // Get the latest score
            const latestScore =
              candidate.scores && candidate.scores.length > 0
                ? candidate.scores[0]
                : null;

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
                      <span className="text-slate-600 font-medium">
                        {candidate.contact_info.email}
                      </span>
                      <span className="mx-2">|</span>
                      Phone:{" "}
                      <span className="text-slate-600 font-medium">
                        {candidate.contact_info.phone}
                      </span>
                    </div>
                  </div>
                  {latestScore ? (
                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <span className="block text-xs font-semibold text-slate-500 uppercase tracking-wider">
                          AI Assessment
                        </span>
                        <span className="text-xl font-bold text-blue-600">
                          {latestScore.ai_score} / 10
                        </span>
                      </div>
                      <div className="px-3 py-1 bg-slate-50 text-slate-600 text-xs font-semibold rounded-md border border-slate-200">
                        {latestScore.evaluation.classification}
                      </div>
                    </div>
                  ) : (
                    <div className="px-3 py-1 bg-slate-50 text-slate-500 text-xs font-semibold rounded-md border border-slate-200">
                      Pending Evaluation
                    </div>
                  )}
                </div>

                {/* Score details if available */}
                {latestScore ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                    <div className="flex flex-col gap-1">
                      <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
                        AI Summary
                      </span>
                      <p className="text-slate-600 leading-relaxed">
                        {latestScore.evaluation.summary}
                      </p>
                      <div className="mt-2 text-xs text-slate-500">
                        Risk Level:{" "}
                        <span className="font-semibold text-slate-600">
                          {latestScore.evaluation.riskLevel}
                        </span>
                      </div>
                    </div>
                    <div className="flex flex-col gap-1">
                      <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
                        Action Items / Suggestions
                      </span>
                      <p className="text-slate-600 leading-relaxed whitespace-pre-line">
                        {latestScore.evaluation.suggestions}
                      </p>
                    </div>
                  </div>
                ) : (
                  <p className="text-slate-500 text-sm italic">
                    This candidate&apos;s CV has been indexed, but the AI evaluation
                    has not yet completed. The background n8n workflow updates
                    scores upon completion.
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
