"use client";

import React from "react";

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

export default function Input({
  label,
  error,
  leftIcon,
  rightIcon,
  style,
  ...props
}: InputProps) {
  return (
    <div style={{ width: "100%", marginBottom: "16px" }}>
      {label && (
        <label
          style={{
            display: "block",
            fontSize: "13px",
            fontWeight: 500,
            color: "#1C1C1E",
            marginBottom: "8px",
          }}
        >
          {label}
        </label>
      )}
      <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
        {leftIcon && (
          <div
            style={{
              position: "absolute",
              left: "12px",
              color: "#8E8E93",
              display: "flex",
              alignItems: "center",
            }}
          >
            {leftIcon}
          </div>
        )}
        <input
          style={{
            width: "100%",
            padding: `12px 16px 12px ${leftIcon ? "40px" : "16px"}`,
            paddingRight: rightIcon ? "40px" : "16px",
            fontSize: "14px",
            background: "#FFFFFF",
            border: `1px solid ${error ? "#FF3B30" : "#E5E5EA"}`,
            borderRadius: "12px",
            outline: "none",
            transition: "all 0.2s ease",
            ...style,
          }}
          className="wsd-input"
          {...props}
        />
        {rightIcon && (
          <div
            style={{
              position: "absolute",
              right: "12px",
              color: "#8E8E93",
              display: "flex",
              alignItems: "center",
            }}
          >
            {rightIcon}
          </div>
        )}
      </div>
      {error && (
        <p style={{ fontSize: "12px", color: "#FF3B30", marginTop: "6px", marginBottom: 0 }}>
          {error}
        </p>
      )}
      <style>{`
        .wsd-input:focus {
          border-color: #007AFF !important;
          box-shadow: 0 0 0 4px rgba(0, 122, 255, 0.1);
        }
      `}</style>
    </div>
  );
}