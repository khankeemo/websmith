"use client";

import React from 'react';

interface BadgeProps {
  text: string;
  color?: string;
  backgroundColor?: string;
  style?: React.CSSProperties;
}

export default function Badge({ text, color = '#1C1C1E', backgroundColor, style }: BadgeProps) {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: '2px 10px',
        borderRadius: '12px',
        fontSize: '12px',
        fontWeight: '500',
        color: color,
        backgroundColor: backgroundColor || `${color}15`,
        textTransform: 'capitalize',
        ...style,
      }}
    >
      {text}
    </span>
  );
}