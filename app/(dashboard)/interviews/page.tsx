"use client";

import React, { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";

interface Interview {
  id: string;
  candidate_id: string;
  job_id: string;
  interview_date: string;
  stage: string;
  feedback: string | null;
  created_at: string;
  candidates: {
    name: string;
  } | null;
  jobs: {
    title: string;
  } | null;
}

export default function InterviewsPage() {
  const [interviews, setInterviews] = useState<Interview[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [editStates, setEditStates] = useState<
    Record<string, { stage: string; feedback: string }>
  >({});
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function fetchInterviews() {
      try {
        const { data, error } = await supabase
          .from("interviews")
          .select("*, candidates(name), jobs(title)")
          .order("interview_date", { ascending: false });

        if (error) throw error;
        if (active) {
          const typedData = (data as unknown as Interview[]) || [];
          setInterviews(typedData);

          // Initialize edit states
          const initialEditStates: Record<string, { stage: string; feedback: string }> = {};
          typedData.forEach((item) => {
            initialEditStates[item.id] = {
              stage: item.stage,
              feedback: item.feedback || "",
            };
          });
          setEditStates(initialEditStates);
          setLoading(false);
        }
      } catch (err) {
        console.error("Error fetching interviews:", err);
        if (active) {
          setLoading(false);
        }
      }
    }

    fetchInterviews();

    return () => {
      active = false;
    };
  }, []);

  const handleStateChange = (id: string, field: "stage" | "feedback", value: string) => {
    setEditStates((prev) => ({
      ...prev,
      [id]: {
        ...prev[id],
        [field]: value,
      },
    }));
  };

  const handleUpdate = async (id: string) => {
    const editState = editStates[id];
    if (!editState) return;

    try {
      setUpdatingId(id);
      setActionMessage(null);

      const { error } = await supabase
        .from("interviews")
        .update({
          stage: editState.stage,
          feedback: editState.feedback,
        })
        .eq("id", id);

      if (error) throw error;

      setActionMessage("Interview updated successfully!");
      // Hide message after 3 seconds
      setTimeout(() => setActionMessage(null), 3000);

      // Refresh interview data locally
      setInterviews((prev) =>
        prev.map((item) =>
          item.id === id
            ? { ...item, stage: editState.stage, feedback: editState.feedback }
            : item
        )
      );
    } catch (err: unknown) {
      console.error("Error updating interview:", err);
      setActionMessage("Failed to update interview.");
    } finally {
      setUpdatingId(null);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Interviews</h1>
          <p className="text-slate-600 text-sm">
            Manage scheduled candidate interview stages and write evaluation feedback.
          </p>
        </div>
        {actionMessage && (
          <div className="px-4 py-2 bg-slate-50 border border-slate-200 rounded-md text-xs font-semibold text-slate-600">
            {actionMessage}
          </div>
        )}
      </div>

      {loading ? (
        <div className="bg-white p-6 rounded-lg shadow-sm border border-slate-200">
          <p className="text-slate-500 text-sm">Loading interviews...</p>
        </div>
      ) : interviews.length === 0 ? (
        <div className="bg-white p-6 rounded-lg shadow-sm border border-slate-200">
          <p className="text-slate-500 text-sm">
            No interviews scheduled. Upload candidate CVs under the Jobs tab to trigger evaluations.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6">
          {interviews.map((interview) => {
            const currentEdit = editStates[interview.id] || {
              stage: interview.stage,
              feedback: interview.feedback || "",
            };

            return (
              <div
                key={interview.id}
                className="bg-white p-6 rounded-lg shadow-sm border border-slate-200 flex flex-col gap-4"
              >
                {/* Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
                  <div>
                    <h2 className="text-base font-bold text-slate-900">
                      {interview.candidates?.name || "Unknown Candidate"}
                    </h2>
                    <p className="text-sm text-slate-600 font-medium">
                      Role: {interview.jobs?.title || "Unknown Job"}
                    </p>
                    <p className="text-xs text-slate-500 mt-1">
                      Date Scheduled:{" "}
                      {new Date(interview.interview_date).toLocaleString()}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                      Stage:
                    </label>
                    <select
                      value={currentEdit.stage}
                      onChange={(e) =>
                        handleStateChange(interview.id, "stage", e.target.value)
                      }
                      className="px-2 py-1 text-sm bg-white border border-slate-200 rounded-md text-slate-900 focus:outline-none"
                    >
                      <option value="Screening">Screening</option>
                      <option value="Technical">Technical</option>
                      <option value="Cultural">Cultural</option>
                      <option value="Offer">Offer</option>
                      <option value="Hired">Hired</option>
                      <option value="Rejected">Rejected</option>
                    </select>
                  </div>
                </div>

                {/* Feedback Area */}
                <div className="flex flex-col gap-2">
                  <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    Interview Feedback
                  </label>
                  <textarea
                    value={currentEdit.feedback}
                    onChange={(e) =>
                      handleStateChange(
                        interview.id,
                        "feedback",
                        e.target.value
                      )
                    }
                    placeholder="Write detailed assessment feedback, questions, or observations..."
                    rows={3}
                    className="w-full px-3 py-2 border border-slate-200 rounded-md text-slate-900 bg-white placeholder:text-slate-500 text-sm focus:outline-none"
                  />
                </div>

                {/* Save Button */}
                <div className="flex justify-end">
                  <button
                    onClick={() => handleUpdate(interview.id)}
                    disabled={updatingId === interview.id}
                    className="py-2 px-4 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-md transition duration-200 disabled:opacity-50"
                  >
                    {updatingId === interview.id ? "Saving..." : "Update Interview"}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
