import { type ButtonHTMLAttributes } from "react";

export function Button(props: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "ghost" }) {
  const { variant = "primary", style, ...rest } = props;
  const base: React.CSSProperties = {
    padding: "10px 12px",
    borderRadius: 10,
    border: "1px solid rgba(255,255,255,0.12)",
    cursor: "pointer",
    fontWeight: 600,
    background: variant === "primary" ? "rgba(255,105,180,0.14)" : "transparent",
    color: "white",
  };
  return <button {...rest} style={{ ...base, ...(style || {}) }} />;
}
