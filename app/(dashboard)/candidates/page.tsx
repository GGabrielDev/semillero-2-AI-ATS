"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { useApp } from "@/components/AppContext";

interface Score {
  id: string;
  candidate_id: string;
  job_id?: string;
  ai_score: number;
  evaluation: {
    summary: string | { en: string; es: string };
    classification: string;
    suggestions: string | { en: string; es: string };
    riskLevel: string;
  };
  jobs?: {
    title: string;
  };
  created_at: string;
}

interface Interview {
  id: string;
  candidate_id: string;
  job_id: string;
  stage: string;
  interview_date: string;
  feedback: string | null;
  jobs?: {
    title: string;
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
  interviews?: Interview[];
  created_at: string;
}

interface UploadFileStatus {
  name: string;
  status: "uploading" | "success" | "error";
  errorMessage?: string;
}

interface LinkedVacancy {
  jobId: string;
  jobTitle: string;
  aiScore: number | null;
  classification: string | null;
  stage: string | null;
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
    candidatesTitle: "Candidates",
    candidatesSubtitle: "A list of all candidates parsed and analyzed by the AI recruitment pipeline.",
    searchPlaceholder: "Search candidates...",
    searchBy: "Search by",
    name: "Name",
    email: "Email",
    skills: "Skills",
    deleteCandidate: "Delete Candidate",
    deleteConfirmation: "Are you sure you want to delete this candidate? This action cannot be undone.",
    noCandidateSelected: "Select a candidate to view details",
    uploadCv: "Ingest Candidate CV (in a Vacuum)",
    uploadCvDesc: "Upload a candidate CV PDF to parse contact info, skills, and summary. No job position will be associated initially, keeping the data isolated.",
    uploadButton: "Upload CV Files",
    uploadingButton: "Uploading CVs...",
    uploadProgress: "Upload Progress",
    success: "Success",
    error: "Error",
    phone: "Phone",
    createdDate: "Added on",
    professionalSummary: "Professional Summary (Extracted)",
    skillsAndTech: "Skills & Technologies",
    linkedVacancies: "Linked Vacancies",
    jobTitle: "Job Title",
    aiScore: "AI Suitability Score",
    classification: "Classification",
    stage: "Stage",
    noLinkedVacancies: "No vacancies linked to this candidate yet.",
    cancel: "Cancel",
    confirmDelete: "Yes, Delete",
    confirmTitle: "Confirm Deletion",
    duplicateDetected: "Duplicate Candidate Detected",
    duplicateMsg: "The system detected an existing candidate with the same email or name.",
    existingProfile: "Existing Profile",
    newProfile: "Newly Uploaded Profile",
    aiComparison: "AI Comparison Summary",
    overwrite: "Overwrite",
    keepBoth: "Keep Both",
    loading: "Loading candidates...",
    noCandidatesFound: "No candidates found. Upload a CV above to get started.",
  },
  es: {
    candidatesTitle: "Candidatos",
    candidatesSubtitle: "Lista de todos los candidatos analizados por el pipeline de reclutamiento de IA.",
    searchPlaceholder: "Buscar candidatos...",
    searchBy: "Buscar por",
    name: "Nombre",
    email: "Correo",
    skills: "Habilidades",
    deleteCandidate: "Eliminar Candidato",
    deleteConfirmation: "¿Está seguro de que desea eliminar a este candidato? Esta acción no se puede deshacer.",
    noCandidateSelected: "Seleccione un candidato para ver los detalles",
    uploadCv: "Ingresar CV de Candidato (Aislado)",
    uploadCvDesc: "Cargue un archivo PDF de CV de candidato para extraer información de contacto, habilidades y resumen. No se asociará ninguna vacante inicialmente.",
    uploadButton: "Cargar Archivos de CV",
    uploadingButton: "Cargando CVs...",
    uploadProgress: "Progreso de Carga",
    success: "Éxito",
    error: "Error",
    phone: "Teléfono",
    createdDate: "Añadido el",
    professionalSummary: "Resumen Profesional (Extraído)",
    skillsAndTech: "Habilidades y Tecnologías",
    linkedVacancies: "Vacantes Vinculadas",
    jobTitle: "Título del Puesto",
    aiScore: "Puntaje de Idoneidad de IA",
    classification: "Clasificación",
    stage: "Etapa",
    noLinkedVacancies: "Aún no hay vacantes vinculadas a este candidato.",
    cancel: "Cancelar",
    confirmDelete: "Sí, Eliminar",
    confirmTitle: "Confirmar Eliminación",
    duplicateDetected: "Candidato Duplicado Detectado",
    duplicateMsg: "El sistema detectó un candidato existente con el mismo correo o nombre.",
    existingProfile: "Perfil Existente",
    newProfile: "Nuevo Perfil Cargado",
    aiComparison: "Resumen de Comparación de IA",
    overwrite: "Sobrescribir",
    keepBoth: "Conservar ambos",
    loading: "Cargando candidatos...",
    noCandidatesFound: "No se encontraron candidatos. Cargue un CV arriba para comenzar.",
  }
};

const getBilingualText = (field: unknown, lang: "en" | "es") => {
  if (!field) return "";
  if (typeof field === "object" && field !== null) {
    const record = field as Record<string, string>;
    return record[lang] || record.en || record.es || "";
  }
  return String(field);
};

const translateClassification = (cls: string, lang: "en" | "es") => {
  if (lang === "es") {
    if (cls === "Qualified") return "Calificado";
    if (cls === "Review") return "En Revisión";
    if (cls === "Unqualified") return "No Calificado";
  }
  return cls;
};

const translateStage = (stage: string, lang: "en" | "es") => {
  if (lang === "es") {
    if (stage === "Screening") return "Preselección";
    if (stage === "Technical") return "Técnica";
    if (stage === "Cultural") return "Cultural";
    if (stage === "Offer") return "Oferta";
  }
  return stage;
};

export default function CandidatesPage() {
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [selectedCandidate, setSelectedCandidate] = useState<Candidate | null>(null);
  const [loading, setLoading] = useState(true);
  
  // Upload States
  const [uploading, setUploading] = useState(false);
  const [uploadStatuses, setUploadStatuses] = useState<UploadFileStatus[]>([]);
  
  // Search States
  const [searchQuery, setSearchQuery] = useState("");
  const [searchField, setSearchField] = useState<"name" | "email" | "skills">("name");
  const searchInputRef = useRef<HTMLInputElement>(null);

  // i18n Language Toggle State
  const { lang } = useApp();
  const t = translations[lang];

  // Delete & Duplicate States
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [duplicateData, setDuplicateData] = useState<DuplicateState | null>(null);

  const fetchCandidates = useCallback((selectIdAfterFetch?: string) => {
    fetch("/api/candidates")
      .then((res) => {
        if (!res.ok) throw new Error("Failed to fetch candidates");
        return res.json();
      })
      .then((data) => {
        setCandidates(data);
        setLoading(false);
        if (selectIdAfterFetch) {
          const matched = data.find((c: Candidate) => c.id === selectIdAfterFetch);
          if (matched) setSelectedCandidate(matched);
        } else if (data.length > 0 && !selectedCandidate) {
          // Default selection if none is currently selected
          setSelectedCandidate(data[0]);
        } else if (selectedCandidate) {
          // Keep current selection fresh
          const refreshed = data.find((c: Candidate) => c.id === selectedCandidate.id);
          setSelectedCandidate(refreshed || data[0] || null);
        }
      })
      .catch((err) => {
        console.error(err);
        setLoading(false);
      });
  }, [selectedCandidate]);

  useEffect(() => {
    fetchCandidates();
  }, [fetchCandidates]);

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
            
            // Refresh with new candidate selected if we received it
            if (data.candidateId) {
              fetchCandidates(data.candidateId);
            }
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
    fetchCandidates();
    e.target.value = "";
  };

  const handleDeleteCandidate = async () => {
    if (!selectedCandidate) return;
    try {
      const res = await fetch(`/api/candidates?id=${selectedCandidate.id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || "Failed to delete candidate");
      }
      
      setShowDeleteConfirm(false);
      
      // Remove from list and reset selected candidate
      const updatedCandidates = candidates.filter((c) => c.id !== selectedCandidate.id);
      setCandidates(updatedCandidates);
      setSelectedCandidate(updatedCandidates[0] || null);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Error deleting candidate");
    }
  };

  const handleSearchFieldChange = (field: "name" | "email" | "skills") => {
    setSearchField(field);
    if (searchInputRef.current) {
      searchInputRef.current.focus();
    }
  };

  // 1. Search filter
  const filteredCandidates = candidates.filter((candidate) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase().trim();
    if (searchField === "email") {
      return candidate.contact_info?.email?.toLowerCase().includes(q) ?? false;
    }
    if (searchField === "skills") {
      return candidate.contact_info?.skills?.some(skill => skill.toLowerCase().includes(q)) ?? false;
    }
    // Default to Name
    return candidate.name.toLowerCase().includes(q);
  });

  // 2. Alphabetical A-Z sort by candidate name
  const sortedCandidates = [...filteredCandidates].sort((a, b) =>
    a.name.localeCompare(b.name)
  );

  // Group linked vacancies (scores + interviews)
  const getLinkedVacancies = (cand: Candidate): LinkedVacancy[] => {
    const vacancyMap = new Map<string, LinkedVacancy>();

    if (cand.scores && Array.isArray(cand.scores)) {
      cand.scores.forEach((score) => {
        const jobId = score.job_id;
        if (!jobId) return;

        vacancyMap.set(jobId, {
          jobId,
          jobTitle: score.jobs?.title || "Unknown Position",
          aiScore: score.ai_score,
          classification: score.evaluation?.classification || null,
          stage: null,
        });
      });
    }

    if (cand.interviews && Array.isArray(cand.interviews)) {
      cand.interviews.forEach((interview) => {
        const jobId = interview.job_id;
        if (!jobId) return;

        const existing = vacancyMap.get(jobId);
        if (existing) {
          existing.stage = interview.stage || null;
        } else {
          vacancyMap.set(jobId, {
            jobId,
            jobTitle: interview.jobs?.title || "Unknown Position",
            aiScore: null,
            classification: null,
            stage: interview.stage || null,
          });
        }
      });
    }

    return Array.from(vacancyMap.values());
  };

  const linkedVacancies = selectedCandidate ? getLinkedVacancies(selectedCandidate) : [];

  return (
    <div className="flex flex-col gap-6">
      {/* CV Uploader (Vacuum Ingestion) */}
      <div className="bg-white dark:bg-slate-900 p-6 rounded-lg shadow-sm border border-slate-200 dark:border-slate-800 flex flex-col items-center justify-center text-center">
        <h3 className="text-sm font-semibold text-slate-900 dark:text-white mb-1">
          {t.uploadCv}
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
                        <span className="w-1.5 h-1.5 rounded-full bg-slate-500 animate-pulse"></span>
                        {lang === "es" ? "Cargando..." : "Uploading..."}
                      </span>
                    )}
                    {item.status === "success" && (
                      <span className="text-green-700 dark:text-green-400 font-semibold flex items-center gap-1">
                        ✓ {t.success}
                      </span>
                    )}
                    {item.status === "error" && (
                      <span className="text-red-700 dark:text-red-400 font-semibold flex items-center gap-1">
                        ✗ {t.error}
                      </span>
                    )}
                  </div>
                  {item.errorMessage && (
                    <p className="text-red-700 dark:text-red-400 font-normal mt-0.5">{item.errorMessage}</p>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {loading ? (
        <div className="bg-white dark:bg-slate-900 p-6 rounded-lg shadow-sm border border-slate-200 dark:border-slate-800">
          <p className="text-slate-500 dark:text-slate-400 text-sm">{t.loading}</p>
        </div>
      ) : candidates.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 p-6 rounded-lg shadow-sm border border-slate-200 dark:border-slate-800">
          <p className="text-slate-500 dark:text-slate-400 text-sm">
            {t.noCandidatesFound}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* LEFT COLUMN: Sidebar (1/3 width) */}
          <div className="md:col-span-1 bg-white dark:bg-slate-900 p-4 rounded-lg shadow-sm border border-slate-200 dark:border-slate-800 flex flex-col gap-4">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                {t.candidatesTitle}
              </h2>
            </div>

            {/* Search Input */}
            <div className="flex flex-col gap-2">
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={t.searchPlaceholder}
                className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-md text-slate-900 dark:text-white bg-white dark:bg-slate-800 placeholder:text-slate-500 dark:placeholder:text-slate-400 text-sm focus:outline-none"
              />

              {/* Search Quick Actions (only show when searchQuery !== "") */}
              {searchQuery !== "" && (
                <div className="flex flex-wrap items-center gap-1.5 pt-1">
                  <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                    {t.searchBy}:
                  </span>
                  <button
                    onClick={() => handleSearchFieldChange("name")}
                    className={`px-2 py-0.5 text-xs rounded transition font-medium border ${
                      searchField === "name"
                        ? "bg-blue-600 text-white border-blue-600"
                        : "bg-slate-50 dark:bg-slate-850 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800"
                    }`}
                  >
                    {lang === "en" ? "Name" : "Nombre"}
                  </button>
                  <button
                    onClick={() => handleSearchFieldChange("email")}
                    className={`px-2 py-0.5 text-xs rounded transition font-medium border ${
                      searchField === "email"
                        ? "bg-blue-600 text-white border-blue-600"
                        : "bg-slate-50 dark:bg-slate-850 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800"
                    }`}
                  >
                    {lang === "en" ? "Email" : "Correo"}
                  </button>
                  <button
                    onClick={() => handleSearchFieldChange("skills")}
                    className={`px-2 py-0.5 text-xs rounded transition font-medium border ${
                      searchField === "skills"
                        ? "bg-blue-600 text-white border-blue-600"
                        : "bg-slate-50 dark:bg-slate-850 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800"
                    }`}
                  >
                    {lang === "en" ? "Skills" : "Habilidades"}
                  </button>
                </div>
              )}
            </div>

            {/* Alphabetical list of candidates */}
            <div className="flex flex-col gap-1.5 max-h-[500px] overflow-y-auto pr-1">
              {sortedCandidates.map((candidate) => (
                <button
                  key={candidate.id}
                  onClick={() => setSelectedCandidate(candidate)}
                  className={`w-full text-left p-3 rounded-md border text-sm transition duration-200 ${
                    selectedCandidate?.id === candidate.id
                      ? "border-blue-600 bg-slate-50 dark:bg-slate-800/50 dark:border-blue-500 font-semibold"
                      : "border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 bg-white dark:bg-slate-900"
                  }`}
                >
                  <div className="text-slate-900 dark:text-white font-medium truncate">
                    {candidate.name}
                  </div>
                  <div className="text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5">
                    {candidate.contact_info.email}
                  </div>
                </button>
              ))}
              {sortedCandidates.length === 0 && (
                <p className="text-xs text-slate-500 dark:text-slate-400 italic p-3 text-center">
                  {lang === "es" ? "No se encontraron candidatos" : "No candidates found"}
                </p>
              )}
            </div>
          </div>

          {/* RIGHT COLUMN: Detail Pane (2/3 width) */}
          <div className="md:col-span-2">
            {selectedCandidate ? (
              <div className="bg-white dark:bg-slate-900 p-6 rounded-lg shadow-sm border border-slate-200 dark:border-slate-800 flex flex-col gap-6">
                
                {/* Header Profile Details */}
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
                  <div>
                    <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                      {selectedCandidate.name}
                    </h2>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                      {t.createdDate}: {new Date(selectedCandidate.created_at).toLocaleDateString()}
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1 mt-3 text-xs">
                      <div>
                        <span className="text-slate-500 dark:text-slate-400">{t.email}: </span>
                        <span className="text-slate-600 dark:text-slate-300 font-medium">{selectedCandidate.contact_info.email}</span>
                      </div>
                      <div>
                        <span className="text-slate-500 dark:text-slate-400">{t.phone}: </span>
                        <span className="text-slate-600 dark:text-slate-300 font-medium">{selectedCandidate.contact_info.phone || "N/A"}</span>
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={() => setShowDeleteConfirm(true)}
                    className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white text-xs font-semibold rounded-md transition"
                  >
                    {t.deleteCandidate}
                  </button>
                </div>

                {/* Summary Extracted */}
                {selectedCandidate.contact_info.summary && (
                  <div>
                    <h3 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider block mb-2">
                      {t.professionalSummary}
                    </h3>
                    <p className="text-slate-600 dark:text-slate-300 text-sm leading-relaxed whitespace-pre-wrap">
                      {selectedCandidate.contact_info.summary}
                    </p>
                  </div>
                )}

                {/* Skills tag group */}
                {selectedCandidate.contact_info.skills && selectedCandidate.contact_info.skills.length > 0 && (
                  <div>
                    <h3 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider block mb-2">
                      {t.skillsAndTech}
                    </h3>
                    <div className="flex flex-wrap gap-1.5">
                      {selectedCandidate.contact_info.skills.map((skill) => (
                        <span
                          key={skill}
                          className="px-2 py-0.5 bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-xs rounded border border-slate-200 dark:border-slate-700 font-medium"
                        >
                          {skill}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Linked Vacancies Section */}
                <div>
                  <h3 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider block mb-3">
                    {t.linkedVacancies}
                  </h3>
                  {linkedVacancies.length > 0 ? (
                    <div className="border border-slate-200 dark:border-slate-800 rounded-md overflow-hidden bg-white dark:bg-slate-900">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="bg-slate-50 dark:bg-slate-800 text-slate-500 dark:text-slate-400 text-xs border-b border-slate-200 dark:border-slate-800 font-semibold">
                            <th className="p-3 font-semibold">{t.jobTitle}</th>
                            <th className="p-3 font-semibold">{t.aiScore}</th>
                            <th className="p-3 font-semibold">{t.classification}</th>
                            <th className="p-3 font-semibold">{t.stage}</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200 dark:divide-slate-800 text-sm">
                          {linkedVacancies.map((vacancy) => (
                            <tr key={vacancy.jobId} className="text-slate-600 dark:text-slate-300">
                              <td className="p-3 font-medium text-slate-900 dark:text-white">
                                {vacancy.jobTitle}
                              </td>
                              <td className="p-3 font-semibold text-blue-600 dark:text-blue-400">
                                {vacancy.aiScore !== null ? `${vacancy.aiScore} / 100` : "-"}
                              </td>
                              <td className="p-3">
                                {vacancy.classification ? (
                                  <span className={`px-2 py-0.5 text-xs rounded-md font-semibold border ${
                                    vacancy.classification === "Qualified"
                                      ? "bg-green-50 dark:bg-green-950/30 text-green-700 dark:text-green-400 border-green-200 dark:border-green-900/50"
                                      : vacancy.classification === "Review"
                                      ? "bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700"
                                      : "bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-400 border-red-200 dark:border-red-900/50"
                                  }`}>
                                    {translateClassification(vacancy.classification, lang)}
                                  </span>
                                ) : (
                                  "-"
                                )}
                              </td>
                              <td className="p-3">
                                {vacancy.stage ? (
                                  <span className="px-2 py-0.5 text-xs rounded-md bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-400 border border-blue-200 dark:border-blue-900/50 font-semibold">
                                    {translateStage(vacancy.stage, lang)}
                                  </span>
                                ) : (
                                  "-"
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <p className="text-xs text-slate-500 dark:text-slate-400 italic">
                      {t.noLinkedVacancies}
                    </p>
                  )}
                </div>

              </div>
            ) : (
              <div className="bg-white dark:bg-slate-900 p-12 rounded-lg shadow-sm border border-slate-200 dark:border-slate-800 flex flex-col items-center justify-center text-center">
                <p className="text-slate-600 dark:text-slate-300 font-semibold mb-2">
                  {t.noCandidateSelected}
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 dark:bg-slate-950/70 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 rounded-lg shadow-md border border-slate-200 dark:border-slate-800 max-w-md w-full p-6">
            <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">
              {t.confirmTitle}
            </h3>
            <p className="text-sm text-slate-600 dark:text-slate-300 mb-6">
              {t.deleteConfirmation}
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="px-4 py-2 border border-slate-200 dark:border-slate-700 rounded-md text-sm text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 transition"
              >
                {t.cancel}
              </button>
              <button
                onClick={handleDeleteCandidate}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-md text-sm font-semibold transition"
              >
                {t.confirmDelete}
              </button>
            </div>
          </div>
        </div>
      )}

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

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Existing Profile */}
              <div className="border border-slate-200 dark:border-slate-800 rounded-md p-3 bg-slate-50 dark:bg-slate-800/50 text-xs">
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
              <div className="border border-slate-200 dark:border-slate-800 rounded-md p-3 bg-slate-50 dark:bg-slate-800/50 text-xs">
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
                  {getBilingualText(duplicateData.comparison, lang)}
                </p>
              ) : (
                <p className="text-xs text-slate-500 dark:text-slate-400 italic">
                  {lang === "es" ? "Comparando perfiles con IA..." : "Comparing profiles with AI..."}
                </p>
              )}
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-2 pt-2 border-t border-slate-200 dark:border-slate-800">
              <button
                onClick={() => duplicateData.onResolve("cancel")}
                className="px-3 py-1.5 border border-slate-200 dark:border-slate-700 rounded-md text-xs text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 transition"
              >
                {lang === "es" ? "Cancelar" : "Cancel"}
              </button>
              <button
                onClick={() => duplicateData.onResolve("ignore")}
                className="px-3 py-1.5 bg-slate-600 hover:bg-slate-700 text-white rounded-md text-xs font-semibold transition"
              >
                {lang === "es" ? "Conservar ambos" : "Keep Both"}
              </button>
              <button
                onClick={() => duplicateData.onResolve("overwrite")}
                className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-md text-xs font-semibold transition"
              >
                {lang === "es" ? "Sobrescribir" : "Overwrite"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
