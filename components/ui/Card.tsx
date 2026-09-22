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
      className={className ? `wsd-unified-card ${className}` : "wsd-unified-card"}
      onClick={onClick}
    >
      {children}
    </div>
  );
}

const styles: any = {
  card: {
    borderRadius: "14px",
    padding: "20px",
    color: "var(--text-primary)",
    position: "relative",
  },
};