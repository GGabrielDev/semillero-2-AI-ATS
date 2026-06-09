import React from "react";

interface StatusBadgeProps {
  label: string;
  variant?: "primary" | "secondary";
}

export function StatusBadge({ label, variant = "primary" }: StatusBadgeProps) {
  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
        variant === "primary"
          ? "bg-blue-600 text-white"
          : "bg-slate-50 text-slate-600"
      }`}
    >
      {label}
    </span>
  );
}
