"use client";

import { LayoutGrid, List } from "lucide-react";

export type GridListView = "grid" | "list";

type Props = {
  value: GridListView;
  onChange: (v: GridListView) => void;
  className?: string;
  style?: React.CSSProperties;
};

const baseToggle: React.CSSProperties = {
  display: "flex",
  gap: "6px",
  backgroundColor: "var(--bg-secondary)",
  padding: "4px",
  borderRadius: "12px",
  border: "1px solid var(--border-color)",
};

const btn = (active: boolean): React.CSSProperties => ({
  padding: "8px 12px",
  border: "none",
  borderRadius: "8px",
  cursor: "pointer",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  backgroundColor: active ? "#007AFF" : "transparent",
  color: active ? "#fff" : "var(--text-secondary)",
  transition: "background-color 0.15s ease, color 0.15s ease",
});

export function ViewModeToggle({ value, onChange, style, className }: Props) {
  return (
    <div className={className} style={{ ...baseToggle, ...style }} role="group" aria-label="View mode">
      <button
        type="button"
        aria-pressed={value === "list"}
        onClick={() => onChange("list")}
        style={btn(value === "list")}
      >
        <List size={16} aria-hidden />
      </button>
      <button
        type="button"
        aria-pressed={value === "grid"}
        onClick={() => onChange("grid")}
        style={btn(value === "grid")}
      >
        <LayoutGrid size={16} aria-hidden />
      </button>
    </div>
  );
}
