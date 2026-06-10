"use client";

import React, { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { useApp } from "@/components/AppContext";

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

const translations = {
  en: {
    interviewsTitle: "Interviews",
    interviewsSubtitle: "Manage scheduled candidate interview stages and write evaluation feedback.",
    loadingInterviews: "Loading interviews...",
    noInterviews: "No interviews scheduled. Upload candidate CVs under the Jobs tab to trigger evaluations.",
    unknownCandidate: "Unknown Candidate",
    unknownJob: "Unknown Job",
    role: "Role",
    dateScheduled: "Date Scheduled",
    stage: "Stage",
    interviewFeedback: "Interview Feedback",
    feedbackPlaceholder: "Write detailed assessment feedback, questions, or observations...",
    saving: "Saving...",
    updateInterview: "Update Interview",
    updateSuccess: "Interview updated successfully!",
    updateFailed: "Failed to update interview.",
    screening: "Screening",
    technical: "Technical",
    cultural: "Cultural",
    offer: "Offer",
    hired: "Hired",
    rejected: "Rejected"
  },
  es: {
    interviewsTitle: "Entrevistas",
    interviewsSubtitle: "Gestione las etapas de entrevistas programadas de los candidatos y escriba comentarios de evaluación.",
    loadingInterviews: "Cargando entrevistas...",
    noInterviews: "No hay entrevistas programadas. Cargue los CV de los candidatos en la pestaña Vacantes para activar las evaluaciones.",
    unknownCandidate: "Candidato Desconocido",
    unknownJob: "Puesto Desconocido",
    role: "Puesto",
    dateScheduled: "Fecha Programada",
    stage: "Etapa",
    interviewFeedback: "Comentarios de la Entrevista",
    feedbackPlaceholder: "Escriba comentarios detallados de la evaluación, preguntas u observaciones...",
    saving: "Guardando...",
    updateInterview: "Actualizar Entrevista",
    updateSuccess: "¡Entrevista actualizada con éxito!",
    updateFailed: "Error al actualizar la entrevista.",
    screening: "Preselección",
    technical: "Técnica",
    cultural: "Cultural",
    offer: "Oferta",
    hired: "Contratado",
    rejected: "Rechazado"
  }
};

export default function InterviewsPage() {
  const { lang } = useApp();
  const t = translations[lang];

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

      setActionMessage(t.updateSuccess);
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
      setActionMessage(t.updateFailed);
    } finally {
      setUpdatingId(null);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">{t.interviewsTitle}</h1>
          <p className="text-slate-600 dark:text-slate-300 text-sm">
            {t.interviewsSubtitle}
          </p>
        </div>
        {actionMessage && (
          <div className="px-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md text-xs font-semibold text-slate-600 dark:text-slate-300">
            {actionMessage}
          </div>
        )}
      </div>

      {loading ? (
        <div className="bg-white dark:bg-slate-900 p-6 rounded-lg shadow-sm border border-slate-200 dark:border-slate-800">
          <p className="text-slate-500 dark:text-slate-400 text-sm">{t.loadingInterviews}</p>
        </div>
      ) : interviews.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 p-6 rounded-lg shadow-sm border border-slate-200 dark:border-slate-800">
          <p className="text-slate-500 dark:text-slate-400 text-sm">
            {t.noInterviews}
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
                className="bg-white dark:bg-slate-900 p-6 rounded-lg shadow-sm border border-slate-200 dark:border-slate-800 flex flex-col gap-4"
              >
                {/* Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
                  <div>
                    <h2 className="text-base font-bold text-slate-900 dark:text-white">
                      {interview.candidates?.name || t.unknownCandidate}
                    </h2>
                    <p className="text-sm text-slate-600 dark:text-slate-300 font-medium">
                      {t.role}: {interview.jobs?.title || t.unknownJob}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                      {t.dateScheduled}:{" "}
                      {new Date(interview.interview_date).toLocaleString()}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                      {t.stage}:
                    </label>
                    <select
                      value={currentEdit.stage}
                      onChange={(e) =>
                        handleStateChange(interview.id, "stage", e.target.value)
                      }
                      className="px-2 py-1 text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md text-slate-900 dark:text-white focus:outline-none"
                    >
                      <option value="Screening">{t.screening}</option>
                      <option value="Technical">{t.technical}</option>
                      <option value="Cultural">{t.cultural}</option>
                      <option value="Offer">{t.offer}</option>
                      <option value="Hired">{t.hired}</option>
                      <option value="Rejected">{t.rejected}</option>
                    </select>
                  </div>
                </div>

                {/* Feedback Area */}
                <div className="flex flex-col gap-2">
                  <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    {t.interviewFeedback}
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
                    placeholder={t.feedbackPlaceholder}
                    rows={3}
                    className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-md text-slate-900 dark:text-white bg-white dark:bg-slate-800 placeholder:text-slate-500 dark:placeholder:text-slate-400 text-sm focus:outline-none"
                  />
                </div>

                {/* Save Button */}
                <div className="flex justify-end">
                  <button
                    onClick={() => handleUpdate(interview.id)}
                    disabled={updatingId === interview.id}
                    className="py-2 px-4 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-md transition duration-200 disabled:opacity-50"
                  >
                    {updatingId === interview.id ? t.saving : t.updateInterview}
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
