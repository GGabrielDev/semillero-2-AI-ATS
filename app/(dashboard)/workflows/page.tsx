"use client";

import React, { useState } from "react";

export default function WorkflowsPage() {
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
        <h1 className="text-2xl font-bold text-slate-900">Workflows</h1>
        <p className="text-slate-600 text-sm">
          Monitor active n8n webhooks and background integration pipelines.
        </p>
      </div>

      <div className="bg-white p-6 rounded-lg shadow-sm border border-slate-200 flex flex-col gap-6">
        <div>
          <h2 className="text-base font-bold text-slate-900">n8n Webhook Integration</h2>
          <p className="text-slate-500 text-xs mt-1">
            This webhook coordinates CV processing and automatic screening candidates scores updates.
          </p>
        </div>

        {/* Integration Status Badge */}
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
            Status:
          </span>
          <span
            className={`px-2 py-0.5 text-xs font-semibold rounded-md border ${
              webhookUrl
                ? "bg-slate-50 text-slate-600 border-slate-200"
                : "bg-slate-50 text-slate-500 border-slate-200"
            }`}
          >
            {webhookUrl ? "Active" : "Inactive / Missing Env"}
          </span>
        </div>

        {/* Webhook Input/Copy Panel */}
        <div className="flex flex-col gap-2">
          <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
            Active Webhook Target URL
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              readOnly
              value={webhookUrl || "No webhook URL configured. Set NEXT_PUBLIC_N8N_WEBHOOK_URL in environment."}
              className="flex-1 px-3 py-2 border border-slate-200 rounded-md text-slate-900 bg-slate-50 text-sm focus:outline-none"
            />
            {webhookUrl && (
              <button
                onClick={handleCopy}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-md transition duration-200"
              >
                {copied ? "Copied!" : "Copy"}
              </button>
            )}
          </div>
        </div>

        {/* Informational Pipeline Flow */}
        <div className="pt-4 border-t border-slate-200 flex flex-col gap-3">
          <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
            Automated Recruitment Pipeline Execution
          </h3>
          <div className="flex flex-col gap-3 text-sm text-slate-600">
            <div className="flex gap-3 items-start">
              <span className="font-bold text-blue-600">1.</span>
              <p>
                <strong>CV Ingestion:</strong> CVs uploaded on the Jobs screen are parsed, and candidate records are stored in Supabase with candidate vector embeddings.
              </p>
            </div>
            <div className="flex gap-3 items-start">
              <span className="font-bold text-blue-600">2.</span>
              <p>
                <strong>Webhook Trigger:</strong> The backend route calls the n8n webhook URL with candidate meta-information and parsed CV text.
              </p>
            </div>
            <div className="flex gap-3 items-start">
              <span className="font-bold text-blue-600">3.</span>
              <p>
                <strong>AI Review & Evaluation:</strong> n8n runs the screening workflow, generates scores, sets classification fields, and populates the database suggestions.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
