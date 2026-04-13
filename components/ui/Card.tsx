"use client";

import React from "react";

interface CardProps {
  children: React.ReactNode;
  style?: React.CSSProperties;
  className?: string;
  onClick?: () => void;
}

export default function Card({
  children,
  style,
  className,
  onClick,
}: CardProps) {
  return (
    <div 
      style={{ ...styles.card, ...style }} 
      className={className}
      onClick={onClick}
    >
      {children}
    </div>
  );
}

const styles: any = {
  card: {
    backgroundColor: "var(--bg-primary)",
    borderRadius: "14px",
    padding: "20px",
    boxShadow: "var(--card-shadow)",
    border: "1px solid var(--border-color)",
    transition: "background-color 0.2s ease, border-color 0.2s ease, box-shadow 0.2s ease",
    color: "var(--text-primary)",
  },
};