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
    boxShadow: "0 6px 18px rgba(0,0,0,0.06)",
    border: "1px solid var(--border-color)",
    transition: "all 0.2s ease",
  },
};