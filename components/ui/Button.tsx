"use client";

import React from "react";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "outline" | "danger" | "ghost";
  size?: "sm" | "md" | "lg";
  isLoading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

export default function Button({
  children,
  variant = "primary",
  size = "md",
  isLoading = false,
  leftIcon,
  rightIcon,
  style,
  disabled,
  ...props
}: ButtonProps) {
  const getVariantStyles = () => {
    switch (variant) {
      case "primary":
        return { backgroundColor: "#007AFF", color: "#FFFFFF", border: "none" };
      case "secondary":
        return { backgroundColor: "#F2F2F7", color: "#1C1C1E", border: "none" };
      case "outline":
        return { backgroundColor: "transparent", color: "#007AFF", border: "1px solid #007AFF" };
      case "danger":
        return { backgroundColor: "#FF3B30", color: "#FFFFFF", border: "none" };
      case "ghost":
        return { backgroundColor: "transparent", color: "#8E8E93", border: "none" };
      default:
        return {};
    }
  };

  const getSizeStyles = () => {
    switch (size) {
      case "sm":
        return { padding: "6px 12px", fontSize: "12px" };
      case "md":
        return { padding: "10px 18px", fontSize: "14px" };
      case "lg":
        return { padding: "14px 24px", fontSize: "16px" };
      default:
        return {};
    }
  };

  return (
    <button
      disabled={disabled || isLoading}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        gap: "8px",
        borderRadius: "12px",
        fontWeight: 500,
        cursor: disabled || isLoading ? "not-allowed" : "pointer",
        opacity: disabled || isLoading ? 0.6 : 1,
        transition: "all 0.2s ease",
        fontFamily: "inherit",
        ...getVariantStyles(),
        ...getSizeStyles(),
        ...style,
      }}
      {...props}
    >
      {isLoading ? (
        <div style={{ width: "16px", height: "16px", border: "2px solid rgba(255,255,255,0.3)", borderTopColor: "#FFF", borderRadius: "50%", animation: "spin 0.6s linear infinite" }} />
      ) : (
        <>
          {leftIcon}
          {children}
          {rightIcon}
        </>
      )}
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </button>
  );
}