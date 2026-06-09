import React from "react";

interface DataCardProps {
  title: string;
  description: string;
  children?: React.ReactNode;
}

export function DataCard({ title, description, children }: DataCardProps) {
  return (
    <div className="bg-white p-6 rounded-lg shadow-sm border border-slate-50">
      <h3 className="text-lg font-bold text-slate-900 mb-1">{title}</h3>
      <p className="text-slate-600 text-sm mb-4">{description}</p>
      {children}
    </div>
  );
}
