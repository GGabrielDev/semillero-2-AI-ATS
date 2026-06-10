"use client";

import React, { useState } from "react";
import { useApp } from "@/components/AppContext";

const translations = {
  en: {
    workflowsTitle: "Workflows",
    workflowsSubtitle: "Monitor active n8n webhooks and background integration pipelines.",
    n8nWebhookIntegration: "n8n Webhook Integration",
    webhookDesc: "This webhook coordinates CV processing and automatic screening candidates scores updates.",
    statusLabel: "Status:",
    activeStatus: "Active",
    inactiveStatus: "Inactive / Missing Env",
    webhookUrlLabel: "Active Webhook Target URL",
    noUrlConfigured: "No webhook URL configured. Set NEXT_PUBLIC_N8N_WEBHOOK_URL in environment.",
    copied: "Copied!",
    copy: "Copy",
    automatedPipeline: "Automated Recruitment Pipeline Execution",
    step1Title: "CV Ingestion:",
    step1Desc: " CVs uploaded on the Jobs screen are parsed, and candidate records are stored in Supabase with candidate vector embeddings.",
    step2Title: "Webhook Trigger:",
    step2Desc: " The backend route calls the n8n webhook URL with candidate meta-information and parsed CV text.",
    step3Title: "AI Review & Evaluation:",
    step3Desc: " n8n runs the screening workflow, generates scores, sets classification fields, and populates the database suggestions."
  },
  es: {
    workflowsTitle: "Flujos de Trabajo",
    workflowsSubtitle: "Monitoree los webhooks de n8n activos y los flujos de integración en segundo plano.",
    n8nWebhookIntegration: "Integración de Webhook de n8n",
    webhookDesc: "Este webhook coordina el procesamiento de CV y las actualizaciones automáticas de puntuación de candidatos preseleccionados.",
    statusLabel: "Estado:",
    activeStatus: "Activo",
    inactiveStatus: "Inactivo / Falta Env",
    webhookUrlLabel: "URL de Destino del Webhook Activo",
    noUrlConfigured: "No se configuró la URL del webhook. Establezca NEXT_PUBLIC_N8N_WEBHOOK_URL en el entorno.",
    copied: "¡Copiado!",
    copy: "Copiar",
    automatedPipeline: "Ejecución del Pipeline de Reclutamiento Automatizado",
    step1Title: "Ingesta de CV:",
    step1Desc: " Los CV cargados en la pantalla de Vacantes se analizan y los registros de los candidatos se almacenan en Supabase con sus embeddings vectoriales.",
    step2Title: "Activación de Webhook:",
    step2Desc: " La ruta del backend llama a la URL del webhook de n8n con la metainformación del candidato y el texto analizado del CV.",
    step3Title: "Revisión y Evaluación con IA:",
    step3Desc: " n8n ejecuta el flujo de trabajo de preselección, genera puntuaciones, establece campos de clasificación y llena las sugerencias en la base de datos."
  }
};

export default function WorkflowsPage() {
  const { lang } = useApp();
  const t = translations[lang];
  const webhookUrl = process.env.NEXT_PUBLIC_N8N_WEBHOOK_URL || "";
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    if (webhookUrl) {
      navigator.clipboard.writeText(webhookUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="flex flex-col gap-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">{t.workflowsTitle}</h1>
        <p className="text-slate-600 dark:text-slate-300 text-sm">
          {t.workflowsSubtitle}
        </p>
      </div>

      <div className="bg-white dark:bg-slate-900 p-6 rounded-lg shadow-sm border border-slate-200 dark:border-slate-800 flex flex-col gap-6">
        <div>
          <h2 className="text-base font-bold text-slate-900 dark:text-white">{t.n8nWebhookIntegration}</h2>
          <p className="text-slate-500 dark:text-slate-400 text-xs mt-1">
            {t.webhookDesc}
          </p>
        </div>

        {/* Integration Status Badge */}
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
            {t.statusLabel}
          </span>
          <span
            className={`px-2 py-0.5 text-xs font-semibold rounded-md border ${
              webhookUrl
                ? "bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-350 border-slate-200 dark:border-slate-700"
                : "bg-slate-50 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-700"
            }`}
          >
            {webhookUrl ? t.activeStatus : t.inactiveStatus}
          </span>
        </div>

        {/* Webhook Input/Copy Panel */}
        <div className="flex flex-col gap-2">
          <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
            {t.webhookUrlLabel}
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              readOnly
              value={webhookUrl || t.noUrlConfigured}
              className="flex-1 px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-md text-slate-900 dark:text-white bg-slate-50 dark:bg-slate-800 text-sm focus:outline-none"
            />
            {webhookUrl && (
              <button
                onClick={handleCopy}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-md transition duration-200"
              >
                {copied ? t.copied : t.copy}
              </button>
            )}
          </div>
        </div>

        {/* Informational Pipeline Flow */}
        <div className="pt-4 border-t border-slate-200 dark:border-slate-800 flex flex-col gap-3">
          <h3 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
            {t.automatedPipeline}
          </h3>
          <div className="flex flex-col gap-3 text-sm text-slate-600 dark:text-slate-300">
            <div className="flex gap-3 items-start">
              <span className="font-bold text-blue-600 dark:text-blue-400">1.</span>
              <p>
                <strong className="text-slate-900 dark:text-white">{t.step1Title}</strong>{t.step1Desc}
              </p>
            </div>
            <div className="flex gap-3 items-start">
              <span className="font-bold text-blue-600 dark:text-blue-400">2.</span>
              <p>
                <strong className="text-slate-900 dark:text-white">{t.step2Title}</strong>{t.step2Desc}
              </p>
            </div>
            <div className="flex gap-3 items-start">
              <span className="font-bold text-blue-600 dark:text-blue-400">3.</span>
              <p>
                <strong className="text-slate-900 dark:text-white">{t.step3Title}</strong>{t.step3Desc}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
