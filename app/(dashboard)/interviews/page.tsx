"use client";

import React, { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { useApp } from "@/components/AppContext";
import ReactMarkdown from "react-markdown";

interface Comment {
  id: string;
  text: string;
  timestamp: string; // ISO string
  author?: string;
  stage?: string;
  isAi?: boolean;
}

interface Interview {
  id: string;
  candidate_id: string;
  job_id: string;
  interview_date: string;
  stage: string;
  feedback: string | null;
  created_at: string;
  updated_at: string;
  pinned: boolean;
  candidates: {
    id: string;
    name: string;
    contact_info: {
      email: string;
      phone: string;
      skills?: string[];
      summary?: string;
    };
  } | null;
  jobs: {
    id: string;
    title: string;
    requirements: {
      text?: string;
    };
  } | null;
}

interface Job {
  id: string;
  title: string;
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
    interviewFeedback: "Interview Feedback & Timeline",
    feedbackPlaceholder: "Write assessment feedback, observations or notes...",
    saving: "Saving...",
    updateSuccess: "Interview updated successfully!",
    updateFailed: "Failed to update interview.",
    screening: "Screening",
    technical: "Technical",
    cultural: "Cultural",
    offer: "Offer",
    hired: "Hired",
    rejected: "Rejected",
    
    allPositions: "All Positions",
    openPositions: "Open Positions",
    addComment: "Add Comment",
    commentPlaceholder: "Type a new comment/update...",
    noCommentsYet: "No comments added yet.",
    backToMain: "Back to All Interviews",
    selectCandidateDetails: "Select a candidate to view details",
    pinCandidate: "Pin Candidate",
    unpinCandidate: "Unpin Candidate",
    postedByAgent: "Agent",
    noCandidatesInStage: "No candidates for this position.",
    candidates: "Candidates",
    
    aiSuggestButton: "Get AI Suggestion",
    suggesting: "Analyzing...",
    cooldownMessage: "Cooldown: change stage or wait {hours}h to query AI suggestion again"
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
    interviewFeedback: "Comentarios y Cronología",
    feedbackPlaceholder: "Escriba comentarios, observaciones o notas de la evaluación...",
    saving: "Guardando...",
    updateSuccess: "¡Entrevista actualizada con éxito!",
    updateFailed: "Error al actualizar la entrevista.",
    screening: "Preselección",
    technical: "Técnica",
    cultural: "Cultural",
    offer: "Oferta",
    hired: "Contratado",
    rejected: "Rechazado",
    
    allPositions: "Todos los Puestos",
    openPositions: "Puestos Abiertos",
    addComment: "Agregar Comentario",
    commentPlaceholder: "Escriba un nuevo comentario o actualización...",
    noCommentsYet: "Aún no hay comentarios agregados.",
    backToMain: "Volver a Todas las Entrevistas",
    selectCandidateDetails: "Seleccione un candidato para ver los detalles",
    pinCandidate: "Fijar Candidato",
    unpinCandidate: "Desfijar Candidato",
    postedByAgent: "Agente",
    noCandidatesInStage: "No hay candidatos para este puesto.",
    candidates: "Candidatos",
    
    aiSuggestButton: "Obtener Sugerencia IA",
    suggesting: "Analizando...",
    cooldownMessage: "Cooldown: cambie la etapa o espere {hours}h para volver a pedir sugerencia"
  }
};

const translateStage = (stage: string, lang: "en" | "es") => {
  if (lang === "es") {
    if (stage === "Screening") return "Preselección";
    if (stage === "Technical") return "Técnica";
    if (stage === "Cultural") return "Cultural";
    if (stage === "Offer") return "Oferta";
    if (stage === "Hired") return "Contratado";
    if (stage === "Rejected") return "Rechazado";
  }
  return stage;
};

function parseFeedback(feedbackText: string | null): Comment[] {
  if (!feedbackText) return [];
  try {
    const parsed = JSON.parse(feedbackText);
    if (Array.isArray(parsed)) {
      return parsed as Comment[];
    }
  } catch {
    // Ignore and fall back to plain text format
  }
  return [{ id: "legacy-initial", text: feedbackText, timestamp: new Date().toISOString() }];
}

function generateCommentId(): string {
  return Math.random().toString(36).substring(2, 9) + Date.now().toString(36);
}

export default function InterviewsPage() {
  const { lang } = useApp();
  const t = translations[lang];

  const [interviews, setInterviews] = useState<Interview[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [selectedInterviewId, setSelectedInterviewId] = useState<string | null>(null);
  
  const [newComment, setNewComment] = useState("");
  const [collapsedComments, setCollapsedComments] = useState<Record<string, boolean>>({});
  const [suggesting, setSuggesting] = useState(false);

  useEffect(() => {
    let active = true;

    async function loadData() {
      try {
        const [interviewsRes, jobsRes] = await Promise.all([
          supabase
            .from("interviews")
            .select("*, candidates(*), jobs(*)"),
          supabase
            .from("jobs")
            .select("id, title")
            .order("title", { ascending: true })
        ]);

        if (interviewsRes.error) throw interviewsRes.error;
        if (jobsRes.error) throw jobsRes.error;

        if (active) {
          setInterviews((interviewsRes.data as unknown as Interview[]) || []);
          setJobs((jobsRes.data as Job[]) || []);
          setLoading(false);
        }
      } catch (err) {
        console.error("Error loading data:", err);
        if (active) {
          setLoading(false);
        }
      }
    }

    loadData();

    return () => {
      active = false;
    };
  }, []);

  const updateInterviewField = async (id: string, updates: Partial<Interview>) => {
    try {
      const updated_at = new Date().toISOString();
      const { error } = await supabase
        .from("interviews")
        .update({
          ...updates,
          updated_at,
        })
        .eq("id", id);

      if (error) throw error;

      // Update state locally
      setInterviews((prev) =>
        prev.map((item) =>
          item.id === id
            ? { ...item, ...updates, updated_at }
            : item
        )
      );
    } catch (err) {
      console.error("Error updating interview:", err);
    }
  };

  const handleSelectJob = (jobId: string | null) => {
    setSelectedJobId(jobId);
    if (jobId) {
      const activeInt = interviews.find((i) => i.id === selectedInterviewId);
      if (activeInt && activeInt.job_id !== jobId) {
        setSelectedInterviewId(null);
      }
    }
  };

  const togglePin = async (id: string, currentPinned: boolean) => {
    await updateInterviewField(id, { pinned: !currentPinned });
  };

  const handleAddComment = async () => {
    if (!selectedInterviewId || !newComment.trim()) return;

    const currentInterview = interviews.find((i) => i.id === selectedInterviewId);
    if (!currentInterview) return;

    const existingComments = parseFeedback(currentInterview.feedback);
    const commentId = generateCommentId();
    
    const newCommentItem: Comment = {
      id: commentId,
      text: newComment.trim(),
      timestamp: new Date().toISOString(),
      author: lang === "es" ? "Agente" : "Agent"
    };

    const updatedComments = [...existingComments, newCommentItem];
    await updateInterviewField(selectedInterviewId, { feedback: JSON.stringify(updatedComments) });
    setNewComment("");
  };

  const toggleCommentCollapse = (commentId: string) => {
    setCollapsedComments((prev) => ({
      ...prev,
      [commentId]: !prev[commentId],
    }));
  };

  const getInterviewCountForJob = (jobId: string) => {
    return interviews.filter((item) => item.job_id === jobId).length;
  };

  const getSortedInterviews = (items: Interview[]) => {
    return [...items].sort((a, b) => {
      if (a.pinned && !b.pinned) return -1;
      if (!a.pinned && b.pinned) return 1;

      if (a.pinned && b.pinned) {
        const nameA = a.candidates?.name || "";
        const nameB = b.candidates?.name || "";
        return nameA.localeCompare(nameB);
      }

      const dateA = new Date(a.updated_at || a.created_at).getTime();
      const dateB = new Date(b.updated_at || b.created_at).getTime();
      return dateA - dateB;
    });
  };

  const getFilteredInterviews = () => {
    if (selectedJobId) {
      return interviews.filter((item) => item.job_id === selectedJobId);
    }
    return interviews;
  };

  const filteredInterviews = getFilteredInterviews();
  const sortedInterviews = getSortedInterviews(filteredInterviews);
  const selectedInterview = interviews.find((item) => item.id === selectedInterviewId) || null;
  const selectedInterviewComments = selectedInterview ? parseFeedback(selectedInterview.feedback) : [];

  // Cooldown calculation for AI suggestion
  const lastAiComment = [...selectedInterviewComments]
    .reverse()
    .find((c) => c.author === "AI Assistant" || c.author === "Asistente IA" || c.isAi);

  const getCooldownStatus = () => {
    if (!selectedInterview || !lastAiComment) return { active: false, hours: 0 };
    if (lastAiComment.stage && lastAiComment.stage !== selectedInterview.stage) return { active: false, hours: 0 };
    const lastTime = new Date(lastAiComment.timestamp).getTime();
    const oneDayMs = 24 * 60 * 60 * 1000;
    // eslint-disable-next-line react-hooks/purity
    const elapsed = Date.now() - lastTime;
    if (elapsed < oneDayMs) {
      return { active: true, hours: Math.ceil((oneDayMs - elapsed) / (1000 * 60 * 60)) };
    }
    return { active: false, hours: 0 };
  };

  const cooldownStatus = getCooldownStatus();
  const cooldownActive = cooldownStatus.active;
  const cooldownHours = cooldownStatus.hours;

  const handleGetAiSuggestion = async () => {
    if (!selectedInterview || cooldownActive || suggesting) return;

    setSuggesting(true);
    try {
      const response = await fetch("/api/interviews/suggest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          candidateName: selectedInterview.candidates?.name,
          jobTitle: selectedInterview.jobs?.title,
          currentStage: selectedInterview.stage,
          candidateSummary: selectedInterview.candidates?.contact_info?.summary,
          candidateSkills: selectedInterview.candidates?.contact_info?.skills,
          jobRequirements: selectedInterview.jobs?.requirements?.text,
          commentHistory: selectedInterviewComments,
          lang,
        }),
      });

      if (!response.ok) throw new Error("Failed to get suggestion");
      const data = await response.json();

      // Save suggestion as comment
      const commentId = generateCommentId();
      const newCommentItem: Comment = {
        id: commentId,
        text: data.suggestion,
        timestamp: new Date().toISOString(),
        author: lang === "es" ? "Asistente IA" : "AI Assistant",
        stage: selectedInterview.stage,
        isAi: true
      };

      const updatedComments = [...selectedInterviewComments, newCommentItem];
      await updateInterviewField(selectedInterview.id, { feedback: JSON.stringify(updatedComments) });
    } catch (err) {
      console.error("Error getting AI suggestion:", err);
    } finally {
      setSuggesting(false);
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

        {/* Back to main button */}
        {(selectedJobId !== null || selectedInterviewId !== null) && (
          <button
            onClick={() => {
              setSelectedJobId(null);
              setSelectedInterviewId(null);
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 rounded-md transition duration-200 cursor-pointer"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-3.5 h-3.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18" />
            </svg>
            {t.backToMain}
          </button>
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
        <div className="flex flex-col lg:flex-row items-start w-full overflow-hidden">
          {/* COLUMN 1: Open Positions Sidebar */}
          <div className={`transition-all duration-300 ease-in-out flex-shrink-0 ${
            selectedInterviewId 
              ? "w-0 opacity-0 overflow-hidden lg:pr-0 pointer-events-none" 
              : "w-full lg:w-1/4 lg:pr-6 mb-6 lg:mb-0"
          }`}>
            <div className="bg-white dark:bg-slate-900 p-4 rounded-lg shadow-sm border border-slate-200 dark:border-slate-800 flex flex-col gap-1.5">
              <h3 className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider px-2 mb-1">
                {t.openPositions}
              </h3>
              
              <button
                onClick={() => handleSelectJob(null)}
                className={`w-full text-left px-3 py-2 rounded-md text-sm transition-colors duration-150 flex items-center justify-between cursor-pointer ${
                  selectedJobId === null
                    ? "bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white font-medium"
                    : "text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/50"
                }`}
              >
                <span>{t.allPositions}</span>
                <span className="text-xs px-2 py-0.5 bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-full font-medium">
                  {interviews.length}
                </span>
              </button>

              {jobs.map((job) => {
                const count = getInterviewCountForJob(job.id);
                return (
                  <button
                    key={job.id}
                    onClick={() => handleSelectJob(job.id)}
                    className={`w-full text-left px-3 py-2 rounded-md text-sm transition-colors duration-150 flex items-center justify-between cursor-pointer ${
                      selectedJobId === job.id
                        ? "bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white font-medium"
                        : "text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/50"
                    }`}
                  >
                    <span className="truncate mr-2" title={job.title}>{job.title}</span>
                    <span className="text-xs px-2 py-0.5 bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-full font-medium flex-shrink-0">
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* COLUMN 2: Candidates List */}
          <div className={`transition-all duration-300 ease-in-out flex-shrink-0 ${
            selectedInterviewId 
              ? "w-full lg:w-1/3 lg:pr-6 mb-6 lg:mb-0" 
              : "w-full lg:w-1/4 lg:pr-6 mb-6 lg:mb-0"
          }`}>
            <div className="bg-white dark:bg-slate-900 p-4 rounded-lg shadow-sm border border-slate-200 dark:border-slate-800 flex flex-col gap-4">
              <div className="border-b border-slate-200 dark:border-slate-800 pb-2">
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  {t.candidates}
                </h3>
              </div>

              {sortedInterviews.length === 0 ? (
                <p className="text-slate-500 dark:text-slate-400 text-sm py-4 italic">
                  {t.noCandidatesInStage}
                </p>
              ) : (
                <div className="flex flex-col gap-3">
                  {sortedInterviews.map((interview) => (
                    <div
                      key={interview.id}
                      onClick={() => setSelectedInterviewId(interview.id)}
                      className={`cursor-pointer p-4 rounded-lg shadow-sm border transition duration-200 relative ${
                        selectedInterviewId === interview.id
                          ? "bg-slate-50 dark:bg-slate-800/40 border-blue-300 dark:border-blue-800"
                          : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700"
                      } ${
                        interview.pinned
                          ? "border-l-4 border-l-blue-600 pl-3"
                          : "border-l border-l-slate-200 dark:border-l-slate-800 pl-4"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <h4 className="text-sm font-bold text-slate-900 dark:text-white truncate">
                            {interview.candidates?.name || t.unknownCandidate}
                          </h4>
                          <p className="text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5">
                            {interview.jobs?.title || t.unknownJob}
                          </p>
                        </div>
                        
                        <div className="flex items-center gap-1.5 flex-shrink-0">
                          <span className={`px-2 py-0.5 text-[10px] font-semibold rounded-full ${
                            interview.stage === "Hired"
                              ? "bg-green-100 dark:bg-green-950/40 text-green-800 dark:text-green-300"
                              : interview.stage === "Rejected"
                              ? "bg-red-100 dark:bg-red-950/40 text-red-800 dark:text-red-300"
                              : "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300"
                          }`}>
                            {translateStage(interview.stage, lang)}
                          </span>
                          
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              togglePin(interview.id, interview.pinned);
                            }}
                            className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors cursor-pointer"
                            title={interview.pinned ? t.unpinCandidate : t.pinCandidate}
                          >
                            {interview.pinned ? (
                              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400">
                                <path d="M12 17v5M9 10.76a2 2 0 0 1-1.11 1.79l-1.78.89A.5.5 0 0 0 6.36 14h11.27a.5.5 0 0 0 .25-.56l-1.78-.89a2 2 0 0 1-1.11-1.79V4a2 2 0 0 1 2-2h-10a2 2 0 0 1 2 2v6.76z" />
                              </svg>
                            ) : (
                              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-3.5 h-3.5">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M12 17v5M9 10.76a2 2 0 0 1-1.11 1.79l-1.78.89A.5.5 0 0 0 6.36 14h11.27a.5.5 0 0 0 .25-.56l-1.78-.89a2 2 0 0 1-1.11-1.79V4a2 2 0 0 1 2-2h-10a2 2 0 0 1 2 2v6.76z" />
                              </svg>
                            )}
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* COLUMN 3: Candidate Details Pane */}
          <div className={`transition-all duration-300 ease-in-out flex-1 ${
            selectedInterviewId 
              ? "w-full lg:w-2/3" 
              : "w-full lg:w-2/4"
          }`}>
            <div className="bg-white dark:bg-slate-900 p-6 rounded-lg shadow-sm border border-slate-200 dark:border-slate-800 flex flex-col gap-6 min-h-[300px]">
              {!selectedInterview ? (
                <div className="flex-1 flex flex-col items-center justify-center text-center py-12">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-10 h-10 text-slate-300 dark:text-slate-600 mb-3">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M17.982 18.725A7.488 7.488 0 0 0 12 15.75a7.488 7.488 0 0 0-5.982 2.975m11.963 0a9 9 0 1 0-11.963 0m11.963 0A8.966 8.966 0 0 1 12 21a8.966 8.966 0 0 1-5.982-2.275M15 9.75a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
                  </svg>
                  <p className="text-slate-500 dark:text-slate-400 text-sm font-medium">
                    {t.selectCandidateDetails}
                  </p>
                </div>
              ) : (
                <div className="flex flex-col gap-6">
                  {/* Details Header */}
                  <div className="border-b border-slate-200 dark:border-slate-800 pb-4 flex flex-col gap-1.5">
                    <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                      {selectedInterview.candidates?.name || t.unknownCandidate}
                    </h2>
                    
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-600 dark:text-slate-300 font-medium">
                      <span>
                        {t.role}: <span className="font-bold text-slate-800 dark:text-slate-200">{selectedInterview.jobs?.title || t.unknownJob}</span>
                      </span>
                      <span className="text-slate-300 dark:text-slate-700 hidden sm:inline">|</span>
                      <span>
                        {t.dateScheduled}: <span className="text-slate-500 dark:text-slate-400">{new Date(selectedInterview.interview_date).toLocaleString()}</span>
                      </span>
                    </div>
                  </div>

                  {/* Stage Dropdown Selector */}
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                      {t.stage}:
                    </label>
                    <select
                      value={selectedInterview.stage}
                      onChange={(e) => updateInterviewField(selectedInterview.id, { stage: e.target.value })}
                      className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md text-slate-900 dark:text-white focus:outline-none focus:border-blue-500 transition-colors"
                    >
                      <option value="Screening">{t.screening}</option>
                      <option value="Technical">{t.technical}</option>
                      <option value="Cultural">{t.cultural}</option>
                      <option value="Offer">{t.offer}</option>
                      <option value="Hired">{t.hired}</option>
                      <option value="Rejected">{t.rejected}</option>
                    </select>
                  </div>

                  {/* Comments Thread System */}
                  <div className="flex flex-col gap-4 border-t border-slate-200 dark:border-slate-800 pt-4">
                    <div className="flex items-center justify-between gap-4">
                      <h3 className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                        {t.interviewFeedback}
                      </h3>
                      
                      {/* AI Suggestion Button */}
                      <button
                        onClick={handleGetAiSuggestion}
                        disabled={suggesting || cooldownActive}
                        title={cooldownActive ? t.cooldownMessage.replace("{hours}", String(cooldownHours)) : undefined}
                        className={`px-3 py-1.5 text-xs font-bold rounded-md border transition-all duration-200 cursor-pointer flex items-center gap-1.5 select-none ${
                          cooldownActive
                            ? "bg-slate-50 dark:bg-slate-800/50 text-slate-400 border-slate-200 dark:border-slate-800 cursor-not-allowed opacity-60"
                            : "bg-blue-50 hover:bg-blue-100 dark:bg-blue-950/20 dark:hover:bg-blue-950/45 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-800/80"
                        }`}
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-3.5 h-3.5">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904 9 21m0-12h.008v.008H9V9Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0ZM12 10.5h.008v.008H12V10.5Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm-.75 3h.008v.008H11.625V13.5Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0ZM15 9.75h.008v.008H15V9.75Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0ZM18 12h.008v.008H18V12Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm-.75 3h.008v.008H17.625V15Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0ZM2.25 12c0-5.385 4.365-9.75 9.75-9.75s9.75 4.365 9.75 9.75-4.365 9.75-9.75 9.75S2.25 17.385 2.25 12Zm11.379-3.379a3 3 0 0 0-4.242 4.242l4.242-4.242Z" />
                        </svg>
                        {suggesting ? t.suggesting : t.aiSuggestButton}
                      </button>
                    </div>

                    {/* Comment List */}
                    <div className="max-h-72 overflow-y-auto pr-1 flex flex-col gap-3">
                      {selectedInterviewComments.length === 0 ? (
                        <p className="text-slate-500 dark:text-slate-400 text-xs italic py-2">
                          {t.noCommentsYet}
                        </p>
                      ) : (
                        selectedInterviewComments.map((comment) => {
                          const isCollapsed = collapsedComments[comment.id] || false;
                          const isAiComment = comment.isAi || comment.author === "AI Assistant" || comment.author === "Asistente IA";
                          return (
                            <div
                              key={comment.id}
                              className={`p-3 rounded-lg border flex flex-col gap-1.5 transition-colors ${
                                isAiComment
                                  ? "bg-blue-50/20 dark:bg-blue-950/10 border-blue-100 dark:border-blue-900/50"
                                  : "bg-slate-50 dark:bg-slate-800/40 border-slate-100 dark:border-slate-800/60"
                              }`}
                            >
                              <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
                                <span className={`font-bold ${isAiComment ? "text-blue-600 dark:text-blue-400" : "text-slate-700 dark:text-slate-300"}`}>
                                  {comment.author || t.postedByAgent}
                                </span>
                                <div className="flex items-center gap-2">
                                  <span>
                                    {new Date(comment.timestamp).toLocaleString()}
                                  </span>
                                  <button
                                    onClick={() => toggleCommentCollapse(comment.id)}
                                    className="text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 font-semibold cursor-pointer select-none"
                                  >
                                    {isCollapsed ? "[+]" : "[-]"}
                                  </button>
                                </div>
                              </div>
                              
                              {!isCollapsed && (
                                <div className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed markdown-content">
                                  <ReactMarkdown>{comment.text}</ReactMarkdown>
                                </div>
                              )}
                            </div>
                          );
                        })
                      )}
                    </div>

                    {/* Add Comment Input */}
                    <div className="flex flex-col gap-2 mt-2">
                      <textarea
                        value={newComment}
                        onChange={(e) => setNewComment(e.target.value)}
                        placeholder={t.commentPlaceholder}
                        rows={3}
                        className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-md text-slate-900 dark:text-white bg-white dark:bg-slate-800 placeholder:text-slate-500 dark:placeholder:text-slate-400 text-sm focus:outline-none focus:border-blue-500 transition-colors"
                      />
                      <div className="flex justify-end">
                        <button
                          onClick={handleAddComment}
                          disabled={!newComment.trim()}
                          className="py-1.5 px-3.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-semibold rounded-md transition duration-200 cursor-pointer"
                        >
                          {t.addComment}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

