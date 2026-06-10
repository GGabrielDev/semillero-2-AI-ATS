"use client";

import React, { useState, useEffect } from "react";
import { useApp } from "@/components/AppContext";

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
  interview?: {
    id: string;
    stage: string;
    interview_date: string;
    feedback: string | null;
  } | null;
  created_at: string;
}

interface SkillsOverlap {
  matchedSkills: string[];
  missingSkills: string[];
  overlapCount: number;
  totalRequired: number;
  matchPct: number;
  isPotentialMatch: boolean;
}

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

interface UploadFileStatus {
  name: string;
  status: "uploading" | "success" | "error";
  errorMessage?: string;
}

interface DuplicateState {
  fileName: string;
  existingCandidate: {
    id: string;
    name: string;
    contact_info: {
      email: string;
      phone: string;
      skills?: string[];
      summary?: string;
    };
  };
  newProfile: {
    candidateName?: string;
    name?: string;
    email?: string;
    phone?: string;
    skills?: string[];
    summary?: string;
  };
  comparison: {
    en: string;
    es: string;
  } | null;
  onResolve: (action: "overwrite" | "ignore" | "cancel") => void;
}

const translations = {
  en: {
    createVacancy: "Create Vacancy",
    jobTitle: "Job Title",
    jobTitlePlaceholder: "e.g., Senior React Developer",
    requirementsText: "Requirements text",
    requirementsPlaceholder: "Describe key candidate qualifications and tech stack...",
    creating: "Creating...",
    createVacancyBtn: "Create Vacancy",
    jobVacancies: "Job Vacancies",
    loadingJobs: "Loading jobs...",
    noVacancies: "No vacancies created yet.",
    createdDate: "Created",
    vacancyDetails: "Vacancy Details",
    vacancyId: "ID",
    description: "Description",
    extractedSkills: "Extracted Job Keywords / Required Skills",
    noSkillsExtracted: "No required skills extracted for this job yet.",
    uploadCvTitle: "Upload Candidate CV for this Vacancy (PDF)",
    uploadCvDesc: "Uploading a candidate CV parses the text and extracts their skills/profile. It associates them with this job, enabling you to check skills overlap before running the deep AI score model.",
    uploadingButton: "Uploading CVs...",
    uploadButton: "Choose CV Files",
    uploadProgress: "Upload Progress",
    success: "Success",
    error: "Error",
    uploading: "Uploading...",
    showingMatches: "Showing {count} qualified matches",
    unevaluatedCount: "({count} unevaluated)",
    bulkRunAi: "Bulk Run AI Evaluation ({count})",
    evaluating: "Evaluating...",
    findingMatches: "Finding matches...",
    noActiveMatches: "No active potential matches found.",
    noActiveMatchesDesc: "Upload CVs or check the mismatch/unqualified list below.",
    mismatchedOrUnqualified: "Mismatched or Unqualified Candidates",
    selectVacancyToGetStarted: "Select or create a job vacancy to get started",
    selectVacancyToGetStartedDesc: "Use the sidebar panel to choose a vacancy or fill in the form to establish a new open position.",
    potentialMatch: "Potential Match ({pct}% overlap)",
    skillMismatch: "Skill Mismatch ({pct}% overlap)",
    semanticSimilarity: "Semantic: {pct}%",
    skillsCheck: "Skills Check: {count} of {total} matching",
    missing: "missing",
    aiAssessmentResult: "AI ASSESSMENT RESULT",
    decision: "Decision",
    score: "Score",
    readyForDeepAssessment: "Ready for deep assessment. Only potential matches recommended for LLM budget optimization.",
    reRunAi: "Re-run AI",
    runAiEvaluation: "Run AI Evaluation",
    promoted: "Promoted",
    promoteToInterviews: "Promote to Interviews",
    duplicateDetected: "Duplicate Candidate Detected",
    duplicateMsg: "The system detected an existing candidate with the same email or name.",
    existingProfile: "Existing Profile",
    newProfile: "Newly Uploaded Profile",
    aiComparison: "AI Comparison Summary",
    comparingWithAi: "Comparing profiles with AI...",
    cancel: "Cancel",
    keepBoth: "Keep Both",
    overwrite: "Overwrite",
    requiredFields: "All fields are required"
  },
  es: {
    createVacancy: "Crear Vacante",
    jobTitle: "Título del Puesto",
    jobTitlePlaceholder: "ej., Desarrollador Senior React",
    requirementsText: "Texto de requisitos",
    requirementsPlaceholder: "Describa las cualificaciones clave del candidato y el stack tecnológico...",
    creating: "Creando...",
    createVacancyBtn: "Crear Vacante",
    jobVacancies: "Vacantes de Empleo",
    loadingJobs: "Cargando puestos...",
    noVacancies: "Aún no se han creado vacantes.",
    createdDate: "Creado",
    vacancyDetails: "Detalles de la Vacante",
    vacancyId: "ID",
    description: "Descripción",
    extractedSkills: "Palabras Clave Extraídas / Habilidades Requeridas",
    noSkillsExtracted: "Aún no se han extraído habilidades requeridas para este puesto.",
    uploadCvTitle: "Cargar CV de Candidato para esta Vacante (PDF)",
    uploadCvDesc: "Al cargar el CV de un candidato se analiza el texto y se extraen sus habilidades/perfil. Se asocia con este puesto, lo que permite verificar la coincidencia de habilidades antes de ejecutar el modelo de puntuación de IA profunda.",
    uploadingButton: "Cargando CVs...",
    uploadButton: "Elegir Archivos de CV",
    uploadProgress: "Progreso de Carga",
    success: "Éxito",
    error: "Error",
    uploading: "Cargando...",
    showingMatches: "Mostrando {count} coincidencias calificadas",
    unevaluatedCount: "({count} sin evaluar)",
    bulkRunAi: "Evaluación Masiva de IA ({count})",
    evaluating: "Evaluando...",
    findingMatches: "Buscando coincidencias...",
    noActiveMatches: "No se encontraron coincidencias potenciales activas.",
    noActiveMatchesDesc: "Cargue CVs o revise la lista de no coincidentes/no calificados a continuación.",
    mismatchedOrUnqualified: "Candidatos No Coincidentes o No Calificados",
    selectVacancyToGetStarted: "Seleccione o cree una vacante de empleo para comenzar",
    selectVacancyToGetStartedDesc: "Use el panel lateral para elegir una vacante o complete el formulario para establecer un nuevo puesto abierto.",
    potentialMatch: "Coincidencia Potencial ({pct}% coincidencia)",
    skillMismatch: "Falta de Coincidencia ({pct}% coincidencia)",
    semanticSimilarity: "Semántico: {pct}%",
    skillsCheck: "Verificación: {count} de {total} coincidentes",
    missing: "falta",
    aiAssessmentResult: "RESULTADO DE LA EVALUACIÓN DE IA",
    decision: "Decisión",
    score: "Puntaje",
    readyForDeepAssessment: "Listo para evaluación profunda. Solo se recomiendan coincidencias potenciales para optimización del presupuesto de LLM.",
    reRunAi: "Re-evaluar IA",
    runAiEvaluation: "Evaluar con IA",
    promoted: "Promocionado",
    promoteToInterviews: "Promocionar a Entrevistas",
    duplicateDetected: "Candidato Duplicado Detectado",
    duplicateMsg: "El sistema detectó un candidato existente con el mismo correo o nombre.",
    existingProfile: "Perfil Existente",
    newProfile: "Nuevo Perfil Cargado",
    aiComparison: "Resumen de Comparación de IA",
    comparingWithAi: "Comparando perfiles con IA...",
    cancel: "Cancelar",
    keepBoth: "Conservar Ambos",
    overwrite: "Sobrescribir",
    requiredFields: "Todos los campos son obligatorios"
  }
};

export default function JobsPage() {
  const { lang } = useApp();
  const t = translations[lang];

  const [jobs, setJobs] = useState<Job[]>([]);
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [matches, setMatches] = useState<Candidate[]>([]);
  
  const [loadingJobs, setLoadingJobs] = useState(true);
  const [loadingMatches, setLoadingMatches] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadSuccess, setUploadSuccess] = useState<string | null>(null);
  const [uploadStatuses, setUploadStatuses] = useState<UploadFileStatus[]>([]);
  const [duplicateData, setDuplicateData] = useState<DuplicateState | null>(null);

  // Evaluation states
  const [evaluatingIds, setEvaluatingIds] = useState<Record<string, boolean>>({});
  const [isBulkEvaluating, setIsBulkEvaluating] = useState(false);
  const [bulkEvalProgress, setBulkEvalProgress] = useState("");

  // Promotion states
  const [promotingIds, setPromotingIds] = useState<Record<string, boolean>>({});

  // Display states
  const [showHiddenCandidates, setShowHiddenCandidates] = useState(false);

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

    Promise.resolve().then(() => {
      if (active) setUploadStatuses([]);
    });

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

  // Upload PDF CVs
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0 || !selectedJob) return;

    const fileList = Array.from(files);

    const initialStatuses = fileList.map((file) => ({
      name: file.name,
      status: "uploading" as const,
    }));
    setUploadStatuses(initialStatuses);
    setUploading(true);
    setUploadError(null);
    setUploadSuccess(null);

    for (let i = 0; i < fileList.length; i++) {
      const file = fileList[i];
      
      if (file.type !== "application/pdf") {
        setUploadStatuses((prev) =>
          prev.map((status, idx) =>
            idx === i
              ? { ...status, status: "error" as const, errorMessage: "Only PDF files are allowed" }
              : status
          )
        );
        continue;
      }

      let currentAction = "check";
      let done = false;

      while (!done) {
        try {
          const formData = new FormData();
          formData.append("file", file);
          formData.append("duplicateAction", currentAction);
          formData.append("jobId", selectedJob.id);

          const res = await fetch("/candidates/api/parse-cv", {
            method: "POST",
            body: formData,
          });

          if (!res.ok) {
            const errData = await res.json();
            throw new Error(errData.error || "Failed to process CV");
          }

          const data = await res.json();

          if (data.isDuplicate) {
            // Trigger AI Comparison summary
            let comparisonResult = null;
            try {
              const compRes = await fetch("/api/candidates/compare", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  existingProfile: data.existingCandidate,
                  newProfile: data.newProfile,
                }),
              });
              if (compRes.ok) {
                const compData = await compRes.json();
                comparisonResult = compData.comparison;
              }
            } catch (compErr) {
              console.error("Comparison request failed:", compErr);
            }

            // Pause and wait for user's decision
            const userAction = await new Promise<"overwrite" | "ignore" | "cancel">((resolve) => {
              setDuplicateData({
                fileName: file.name,
                existingCandidate: data.existingCandidate,
                newProfile: data.newProfile,
                comparison: comparisonResult,
                onResolve: resolve,
              });
            });

            // Close dialog
            setDuplicateData(null);

            if (userAction === "cancel") {
              setUploadStatuses((prev) =>
                prev.map((status, idx) =>
                  idx === i
                    ? { ...status, status: "error" as const, errorMessage: "Upload cancelled by user" }
                    : status
                )
              );
              done = true;
            } else {
              // Resend request with overwrite or ignore parameter
              currentAction = userAction === "overwrite" ? "overwrite" : "ignore";
            }
          } else {
            // Success
            setUploadStatuses((prev) =>
              prev.map((status, idx) =>
                idx === i
                  ? { ...status, status: "success" as const }
                  : status
              )
            );
            done = true;
          }
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : "Error uploading CV";
          setUploadStatuses((prev) =>
            prev.map((status, idx) =>
              idx === i
                ? { ...status, status: "error" as const, errorMessage: msg }
                : status
            )
          );
          done = true;
        }
      }
    }

    setUploading(false);

    // Refresh matches for current job
    const matchesRes = await fetch(`/api/candidates?jobId=${selectedJob.id}`);
    if (matchesRes.ok) {
      const matchesData = await matchesRes.json();
      setMatches(matchesData);
    }
    
    e.target.value = "";
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

  // Bulk evaluate visible matches without scores sequentially
  const handleBulkEvaluate = async () => {
    if (!selectedJob) return;

    // Find all visible candidates without scores
    const candidatesToEval = matches.filter((match) => {
      const jobSkills = selectedJob.requirements.skills || [];
      const candidateSkills = match.contact_info.skills || [];
      const matchedSkills = jobSkills.filter((js) =>
        candidateSkills.some((cs) => skillsMatch(cs, js))
      );
      const matchPct = jobSkills.length > 0 ? Math.round((matchedSkills.length / jobSkills.length) * 100) : 0;
      const isPotentialMatch = matchPct >= 75;
      const latestScore = match.scores?.[0];
      return isPotentialMatch && !latestScore;
    });

    if (candidatesToEval.length === 0) {
      alert("No candidates to evaluate.");
      return;
    }

    try {
      setIsBulkEvaluating(true);
      for (let i = 0; i < candidatesToEval.length; i++) {
        const candidate = candidatesToEval[i];
        setBulkEvalProgress(`Evaluating ${i + 1} of ${candidatesToEval.length} (${candidate.name})...`);

        const res = await fetch("/candidates/api/evaluate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ candidateId: candidate.id, jobId: selectedJob.id }),
        });

        if (!res.ok) {
          console.error(`Failed to evaluate ${candidate.name}`);
        }
      }

      setBulkEvalProgress("All evaluations completed!");
      setTimeout(() => setBulkEvalProgress(""), 3000);

      // Refresh matches for current job
      const matchesRes = await fetch(`/api/candidates?jobId=${selectedJob.id}`);
      if (matchesRes.ok) {
        const matchesData = await matchesRes.json();
        setMatches(matchesData);
      }
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Error bulk evaluating candidates");
    } finally {
      setIsBulkEvaluating(false);
    }
  };

  // Promote candidate to interviews
  const handlePromote = async (candidateId: string) => {
    if (!selectedJob) return;
    try {
      setPromotingIds((prev) => ({ ...prev, [candidateId]: true }));
      const res = await fetch("/candidates/api/promote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ candidateId, jobId: selectedJob.id }),
      });
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || "Failed to promote candidate");
      }

      const resData = await res.json();

      // Update local state to reflect that the candidate is now promoted
      setMatches((prev) =>
        prev.map((match) =>
          match.id === candidateId
            ? {
                ...match,
                interview: {
                  id: resData.interviewId,
                  stage: "Screening",
                  interview_date: new Date().toISOString(),
                  feedback: null,
                },
              }
            : match
        )
      );
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Error promoting candidate");
    } finally {
      setPromotingIds((prev) => ({ ...prev, [candidateId]: false }));
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Left Column: Create Form & Vacancies List */}
      <div className="lg:col-span-1 flex flex-col gap-6">
        {/* Create vacancy form */}
        <div className="bg-white dark:bg-slate-900 p-6 rounded-lg shadow-sm border border-slate-200 dark:border-slate-800">
          <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-4">{t.createVacancy}</h2>
          <form onSubmit={handleCreateJob} className="flex flex-col gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">
                {t.jobTitle}
              </label>
              <input
                type="text"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder={t.jobTitlePlaceholder}
                className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-md text-slate-900 dark:text-white bg-white dark:bg-slate-800 placeholder:text-slate-500 dark:placeholder:text-slate-400 text-sm focus:outline-none"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">
                {t.requirementsText}
              </label>
              <textarea
                value={newRequirements}
                onChange={(e) => setNewRequirements(e.target.value)}
                placeholder={t.requirementsPlaceholder}
                rows={4}
                className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-md text-slate-900 dark:text-white bg-white dark:bg-slate-800 placeholder:text-slate-500 dark:placeholder:text-slate-400 text-sm focus:outline-none"
                required
              />
            </div>
            {formError && (
              <p className="text-xs text-red-600 dark:text-red-400 font-semibold">{formError}</p>
            )}
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-md transition duration-200 disabled:opacity-50"
            >
              {isSubmitting ? t.creating : t.createVacancyBtn}
            </button>
          </form>
        </div>

        {/* Vacancy list */}
        <div className="bg-white dark:bg-slate-900 p-6 rounded-lg shadow-sm border border-slate-200 dark:border-slate-800 flex-1">
          <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-4">{t.jobVacancies}</h2>
          {loadingJobs ? (
            <p className="text-slate-500 dark:text-slate-400 text-sm">{t.loadingJobs}</p>
          ) : jobs.length === 0 ? (
            <p className="text-slate-500 dark:text-slate-400 text-sm">{t.noVacancies}</p>
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
                      ? "border-blue-600 bg-slate-50 dark:bg-slate-800/50 dark:border-blue-500 font-semibold text-slate-900 dark:text-white"
                      : "border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 text-slate-900 dark:text-slate-300 bg-white dark:bg-slate-900"
                  }`}
                >
                  <div className="font-semibold">{job.title}</div>
                  <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    {t.createdDate}: {new Date(job.created_at).toLocaleDateString()}
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
          <div className="bg-white dark:bg-slate-900 p-6 rounded-lg shadow-sm border border-slate-200 dark:border-slate-800 flex flex-col gap-6">
            {/* Header */}
            <div>
              <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                {t.vacancyDetails}
              </div>
              <h1 className="text-2xl font-bold text-slate-900 dark:text-white mt-1">
                {selectedJob.title}
              </h1>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                {t.vacancyId}: {selectedJob.id}
              </p>
            </div>

            {/* Requirements & Extracted Job Skills */}
            <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-md border border-slate-200 dark:border-slate-800 flex flex-col gap-3">
              <div>
                <h3 className="text-sm font-semibold text-slate-900 dark:text-white mb-1">
                  {t.description}
                </h3>
                <p className="text-slate-600 dark:text-slate-300 text-sm whitespace-pre-wrap leading-relaxed">
                  {selectedJob.requirements.text}
                </p>
              </div>
              {selectedJob.requirements.skills && selectedJob.requirements.skills.length > 0 && (
                <div>
                  <h3 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">
                    {t.extractedSkills}
                  </h3>
                  <div className="flex flex-wrap gap-1.5">
                    {selectedJob.requirements.skills.map((skill) => (
                      <span
                        key={skill}
                        className="px-2 py-0.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-xs rounded-md font-medium"
                      >
                        {skill}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* PDF Uploader */}
            <div className="border border-dashed border-slate-200 dark:border-slate-800 rounded-lg p-6 flex flex-col items-center justify-center text-center">
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white mb-1">
                {t.uploadCvTitle}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mb-4 max-w-md">
                {t.uploadCvDesc}
              </p>
              <label className="relative cursor-pointer bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded-md text-sm transition duration-200">
                {uploading ? t.uploadingButton : t.uploadButton}
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
                <p className="text-xs text-red-600 dark:text-red-400 mt-3 font-semibold">
                  {uploadError}
                </p>
              )}
              {uploadSuccess && (
                <p className="text-xs text-green-600 dark:text-green-400 mt-3 font-semibold">
                  {uploadSuccess}
                </p>
              )}
              {uploadStatuses.length > 0 && (
                <div className="mt-4 w-full max-w-md border border-slate-200 dark:border-slate-800 rounded-md p-4 bg-slate-50 dark:bg-slate-800/50 text-left">
                  <h4 className="text-xs font-semibold text-slate-900 dark:text-white mb-2 uppercase tracking-wider">
                    {t.uploadProgress}
                  </h4>
                  <ul className="divide-y divide-slate-200 dark:divide-slate-800">
                    {uploadStatuses.map((item, idx) => (
                      <li key={idx} className="py-2 flex flex-col gap-1 text-xs">
                        <div className="flex items-center justify-between">
                          <span className="font-medium text-slate-700 dark:text-slate-300 truncate max-w-[250px]" title={item.name}>
                            {item.name}
                          </span>
                          {item.status === "uploading" && (
                            <span className="text-slate-600 dark:text-slate-400 font-semibold flex items-center gap-1">
                              <span className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-pulse"></span>
                              {t.uploading}
                            </span>
                          )}
                          {item.status === "success" && (
                            <span className="text-green-600 dark:text-green-400 font-semibold flex items-center gap-1">
                              ✓ {t.success}
                            </span>
                          )}
                          {item.status === "error" && (
                            <span className="text-red-600 dark:text-red-400 font-semibold flex items-center gap-1">
                              ✗ {t.error}
                            </span>
                          )}
                        </div>
                        {item.errorMessage && (
                          <p className="text-red-650 dark:text-red-400 font-normal mt-0.5">{item.errorMessage}</p>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            {/* Matches List */}
            <div>
              {/* Computed lists */}
              {(() => {
                const getSkillsOverlap = (match: Candidate) => {
                  const jobSkills = selectedJob.requirements.skills || [];
                  const candidateSkills = match.contact_info.skills || [];
                  const matchedSkills = jobSkills.filter((js) =>
                    candidateSkills.some((cs) => skillsMatch(cs, js))
                  );
                  const missingSkills = jobSkills.filter((js) =>
                    !candidateSkills.some((cs) => skillsMatch(cs, js))
                  );
                  const overlapCount = matchedSkills.length;
                  const totalRequired = jobSkills.length;
                  const matchPct = totalRequired > 0 ? Math.round((overlapCount / totalRequired) * 100) : 0;
                  const isPotentialMatch = matchPct >= 75;

                  return {
                    matchedSkills,
                    missingSkills,
                    overlapCount,
                    totalRequired,
                    matchPct,
                    isPotentialMatch,
                  };
                };

                const visibleMatches: { candidate: Candidate; overlap: SkillsOverlap }[] = [];
                const hiddenMatches: { candidate: Candidate; overlap: SkillsOverlap }[] = [];

                matches.forEach((match) => {
                  const overlap = getSkillsOverlap(match);
                  const latestScore = match.scores?.[0];
                  const isUnqualified = latestScore?.evaluation.classification === "Unqualified";

                  if (!overlap.isPotentialMatch || isUnqualified) {
                    hiddenMatches.push({ candidate: match, overlap });
                  } else {
                    visibleMatches.push({ candidate: match, overlap });
                  }
                });

                const visibleMatchesToEval = visibleMatches.filter(
                  ({ candidate }) => !candidate.scores?.[0]
                );

                const renderCandidateCard = (match: Candidate, overlap: SkillsOverlap) => {
                  const similarityPct = match.similarity
                    ? Math.round(match.similarity * 100)
                    : null;
                  const latestScore = match.scores?.[0];
                  const { matchedSkills, missingSkills, overlapCount, totalRequired, matchPct, isPotentialMatch } = overlap;
                  const isUnqualified = latestScore?.evaluation.classification === "Unqualified";
                  const jobSkills = selectedJob.requirements.skills || [];
                  
                  return (
                    <div
                      key={match.id}
                      className="p-5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-col gap-4 shadow-sm hover:border-slate-300 dark:hover:border-slate-705 transition duration-200"
                    >
                      {/* Upper info panel */}
                      <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                        <div className="flex flex-col gap-1">
                          <div className="text-slate-900 dark:text-white font-bold text-base">
                            {match.name}
                          </div>
                          <div className="text-xs text-slate-500 dark:text-slate-400">
                            Email: <span className="text-slate-700 dark:text-slate-300 font-medium mr-3">{match.contact_info.email}</span>
                            Phone: <span className="text-slate-700 dark:text-slate-300 font-medium">{match.contact_info.phone}</span>
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-2">
                          {/* Pre-selection status badge */}
                          <span
                            className={`px-2.5 py-1 text-xs font-semibold rounded-md border ${
                              isPotentialMatch
                                ? "bg-green-50 dark:bg-green-950/30 text-green-700 dark:text-green-400 border-green-200 dark:border-green-900/50"
                                : "bg-slate-50 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-700"
                            }`}
                          >
                            {isPotentialMatch
                              ? t.potentialMatch.replace("{pct}", String(matchPct))
                              : t.skillMismatch.replace("{pct}", String(matchPct))}
                          </span>
                          
                          {/* Semantic embedding similarity badge */}
                          {similarityPct !== null && (
                            <span className="px-2.5 py-1 text-xs font-semibold rounded-md border bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-900/50">
                              {t.semanticSimilarity.replace("{pct}", String(similarityPct))}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Skills overlap details */}
                      <div className="bg-slate-50 dark:bg-slate-800/50 p-3 rounded-md border border-slate-100 dark:border-slate-800 flex flex-col gap-2">
                        <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                          {t.skillsCheck.replace("{count}", String(overlapCount)).replace("{total}", String(totalRequired))}
                        </div>
                        
                        <div className="flex flex-wrap gap-1.5">
                          {/* Display matched skills in green */}
                          {matchedSkills.map((skill: string) => (
                            <span
                              key={skill}
                              className="px-2 py-0.5 bg-green-100 dark:bg-green-955 text-green-800 dark:text-green-300 border border-green-200 dark:border-green-800 text-xs rounded-md font-medium"
                            >
                              {skill}
                            </span>
                          ))}

                          {/* Display missing skills in light red/gray dashed */}
                          {missingSkills.map((skill: string) => (
                            <span
                              key={skill}
                              className="px-2 py-0.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 border-dashed text-slate-400 dark:text-slate-500 text-xs rounded-md"
                            >
                              {skill} ({t.missing})
                            </span>
                          ))}

                          {/* Fallback if no skills are loaded */}
                          {jobSkills.length === 0 && (
                            <span className="text-xs text-slate-500 dark:text-slate-400 italic">
                              {t.noSkillsExtracted}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Bottom evaluation / action panel */}
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-3 border-t border-slate-100 dark:border-slate-800">
                        <div className="flex-1">
                          {latestScore ? (
                            <div className="flex flex-col gap-1">
                              <div className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wider font-semibold">
                                {t.aiAssessmentResult}
                              </div>
                              <div className="text-sm text-slate-700 dark:text-slate-300 font-medium">
                                {t.decision}: <span className="font-bold text-slate-900 dark:text-white">{latestScore.evaluation.classification}</span>
                                <span className="mx-2 font-normal text-slate-300 dark:text-slate-700">|</span>
                                {t.score}: <span className="font-bold text-blue-600 dark:text-blue-400 text-base">{latestScore.ai_score} / 100</span>
                              </div>
                              <div className="text-xs text-slate-500 dark:text-slate-400 leading-normal max-w-lg mt-1">
                                {latestScore.evaluation.summary}
                              </div>
                            </div>
                          ) : (
                            <div className="text-xs text-slate-500 dark:text-slate-400 italic">
                              {t.readyForDeepAssessment}
                            </div>
                          )}
                        </div>

                        <div className="flex flex-wrap items-center gap-2 self-end sm:self-center">
                          {/* Run/Re-run AI evaluation */}
                          <button
                            onClick={() => handleEvaluate(match.id)}
                            disabled={evaluatingIds[match.id] || isBulkEvaluating}
                            className="px-3 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-semibold rounded-md border border-slate-200 dark:border-slate-700 transition duration-200 disabled:opacity-50"
                          >
                            {evaluatingIds[match.id]
                              ? t.evaluating
                              : latestScore
                              ? t.reRunAi
                              : t.runAiEvaluation}
                          </button>

                          {/* Promote to Interview Pipeline */}
                          {match.interview ? (
                            <span className="px-3 py-1.5 bg-green-50 dark:bg-green-955/30 border border-green-200 dark:border-green-900/50 text-green-700 dark:text-green-400 text-xs font-semibold rounded-md">
                              {t.promoted} ({match.interview.stage})
                            </span>
                          ) : (
                            <button
                              onClick={() => handlePromote(match.id)}
                              disabled={
                                promotingIds[match.id] ||
                                isBulkEvaluating ||
                                isUnqualified ||
                                !isPotentialMatch
                              }
                              className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-md transition duration-200 disabled:opacity-50 disabled:bg-slate-100 dark:disabled:bg-slate-800 disabled:text-slate-400 dark:disabled:text-slate-600 disabled:border disabled:border-slate-200 dark:disabled:border-slate-755"
                              title={
                                isUnqualified
                                  ? (lang === "es" ? "No se pueden promocionar candidatos no calificados" : "Cannot promote unqualified candidates")
                                  : !isPotentialMatch
                                  ? (lang === "es" ? "Coincidencia de habilidades muy baja para promocionar" : "Skill overlap too low to promote")
                                  : (lang === "es" ? "Promocionar a Entrevistas" : "Promote to Interviews")
                              }
                            >
                              {promotingIds[match.id] ? (lang === "es" ? "Promocionando..." : "Promoting...") : t.promoteToInterviews}
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                };

                return (
                  <div className="flex flex-col gap-6">
                    {/* Toolbar / Header */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
                      <div className="flex items-center gap-2">
                        <span className="text-slate-600 dark:text-slate-300 text-sm font-semibold">
                          {t.showingMatches.replace("{count}", String(visibleMatches.length))}
                        </span>
                        {visibleMatchesToEval.length > 0 && (
                          <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                            {t.unevaluatedCount.replace("{count}", String(visibleMatchesToEval.length))}
                          </span>
                        )}
                      </div>
                      
                      {visibleMatchesToEval.length > 0 && (
                        <button
                          onClick={handleBulkEvaluate}
                          disabled={isBulkEvaluating}
                          className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-md transition duration-200 disabled:opacity-50 shadow-sm flex items-center gap-1.5"
                        >
                          {isBulkEvaluating ? (
                            <>
                              <span className="w-2 h-2 rounded-full bg-white animate-ping"></span>
                              {bulkEvalProgress || t.evaluating}
                            </>
                          ) : (
                            t.bulkRunAi.replace("{count}", String(visibleMatchesToEval.length))
                          )}
                        </button>
                      )}
                    </div>

                    {/* Visible Matches List */}
                    {loadingMatches ? (
                      <p className="text-slate-500 dark:text-slate-400 text-sm">{t.findingMatches}</p>
                    ) : visibleMatches.length === 0 && !loadingMatches ? (
                      <div className="p-8 text-center border border-slate-100 dark:border-slate-800 rounded-lg bg-slate-50/50 dark:bg-slate-800/20">
                        <p className="text-slate-500 dark:text-slate-400 text-sm font-medium">{t.noActiveMatches}</p>
                        <p className="text-slate-400 dark:text-slate-500 text-xs mt-1">{t.noActiveMatchesDesc}</p>
                      </div>
                    ) : (
                      <div className="flex flex-col gap-4">
                        {visibleMatches.map(({ candidate, overlap }) =>
                          renderCandidateCard(candidate, overlap)
                        )}
                      </div>
                    )}

                    {/* Expandable Hidden Matches List */}
                    {hiddenMatches.length > 0 && (
                      <div className="border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden">
                        <button
                          onClick={() => setShowHiddenCandidates(!showHiddenCandidates)}
                          className="w-full flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 transition duration-200 border-b border-slate-200 dark:border-slate-800"
                        >
                          <div className="flex items-center gap-2 text-slate-700 dark:text-slate-300 font-semibold text-sm">
                            <span>{t.mismatchedOrUnqualified}</span>
                            <span className="px-2 py-0.5 bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs rounded-full font-bold">
                              {hiddenMatches.length}
                            </span>
                          </div>
                          <svg
                            className={`w-5 h-5 text-slate-500 transform transition-transform duration-200 ${
                              showHiddenCandidates ? "rotate-180" : ""
                            }`}
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                        </button>

                        {showHiddenCandidates && (
                          <div className="p-4 bg-slate-50/50 dark:bg-slate-900/50 border-t border-slate-200 dark:border-slate-800 flex flex-col gap-4">
                            {hiddenMatches.map(({ candidate, overlap }) =>
                              renderCandidateCard(candidate, overlap)
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>
          </div>
        ) : (
          <div className="bg-white dark:bg-slate-900 p-12 rounded-lg shadow-sm border border-slate-200 dark:border-slate-800 flex flex-col items-center justify-center text-center">
            <p className="text-slate-600 dark:text-slate-300 font-semibold mb-2">
              {t.selectVacancyToGetStarted}
            </p>
            <p className="text-slate-500 dark:text-slate-400 text-xs max-w-sm">
              {t.selectVacancyToGetStartedDesc}
            </p>
          </div>
        )}
      </div>

      {/* Duplicate Detection dialog */}
      {duplicateData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 dark:bg-slate-950/70 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 rounded-lg shadow-md border border-slate-200 dark:border-slate-800 max-w-xl w-full p-6 flex flex-col gap-4 max-h-[90vh] overflow-y-auto">
            <div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                {t.duplicateDetected}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                {t.duplicateMsg} ({duplicateData.fileName})
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              {/* Existing Profile */}
              <div className="border border-slate-200 dark:border-slate-800 rounded-md p-3 bg-slate-50 dark:bg-slate-800/50">
                <h4 className="text-xs font-semibold text-slate-900 dark:text-white uppercase tracking-wider mb-2">
                  {t.existingProfile}
                </h4>
                <div className="text-sm font-bold text-slate-900 dark:text-white">
                  {duplicateData.existingCandidate.name}
                </div>
                <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  Email: <span className="text-slate-600 dark:text-slate-300 font-medium">{duplicateData.existingCandidate.contact_info.email}</span>
                </div>
                <div className="text-xs text-slate-500 dark:text-slate-400">
                  Phone: <span className="text-slate-600 dark:text-slate-300 font-medium">{duplicateData.existingCandidate.contact_info.phone || "N/A"}</span>
                </div>
                {duplicateData.existingCandidate.contact_info.summary && (
                  <p className="text-slate-600 dark:text-slate-300 mt-2 line-clamp-3">
                    {duplicateData.existingCandidate.contact_info.summary}
                  </p>
                )}
              </div>

              {/* New Profile */}
              <div className="border border-slate-200 dark:border-slate-800 rounded-md p-3 bg-slate-50 dark:bg-slate-800/50">
                <h4 className="text-xs font-semibold text-slate-900 dark:text-white uppercase tracking-wider mb-2">
                  {t.newProfile}
                </h4>
                <div className="text-sm font-bold text-slate-900 dark:text-white">
                  {duplicateData.newProfile.candidateName || duplicateData.newProfile.name || "Unknown"}
                </div>
                <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  Email: <span className="text-slate-600 dark:text-slate-300 font-medium">{duplicateData.newProfile.email || "N/A"}</span>
                </div>
                <div className="text-xs text-slate-500 dark:text-slate-400">
                  Phone: <span className="text-slate-600 dark:text-slate-300 font-medium">{duplicateData.newProfile.phone || "N/A"}</span>
                </div>
                {duplicateData.newProfile.summary && (
                  <p className="text-slate-600 dark:text-slate-300 mt-2 line-clamp-3">
                    {duplicateData.newProfile.summary}
                  </p>
                )}
              </div>
            </div>

            {/* AI Comparison Summary */}
            <div className="border border-slate-200 dark:border-slate-800 rounded-md p-3 bg-blue-50 dark:bg-blue-950/20">
              <h4 className="text-xs font-semibold text-blue-600 dark:text-blue-400 uppercase tracking-wider mb-2">
                {t.aiComparison}
              </h4>
              {duplicateData.comparison ? (
                <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                  {duplicateData.comparison[lang] || duplicateData.comparison.en || duplicateData.comparison.es}
                </p>
              ) : (
                <p className="text-xs text-slate-500 dark:text-slate-400 italic">
                  {t.comparingWithAi}
                </p>
              )}
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-2 pt-2 border-t border-slate-200 dark:border-slate-800">
              <button
                onClick={() => duplicateData.onResolve("cancel")}
                className="px-3 py-1.5 border border-slate-200 dark:border-slate-700 rounded-md text-xs text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 transition"
              >
                {t.cancel}
              </button>
              <button
                onClick={() => duplicateData.onResolve("ignore")}
                className="px-3 py-1.5 bg-slate-600 hover:bg-slate-700 text-white rounded-md text-xs font-semibold transition"
              >
                {t.keepBoth}
              </button>
              <button
                onClick={() => duplicateData.onResolve("overwrite")}
                className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-md text-xs font-semibold transition"
              >
                {t.overwrite}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
