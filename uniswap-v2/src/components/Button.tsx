import { type ButtonHTMLAttributes } from "react";

export function Button(props: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "ghost" | "cta" }) {
  const { variant = "primary", style, ...rest } = props;

  const base: React.CSSProperties = {
    padding: variant === "cta" ? "16px 20px" : "10px 12px",
    borderRadius: variant === "cta" ? 18 : 10,
    border: variant === "cta" ? "none" : "1px solid rgba(255,255,255,0.12)",
    cursor: props.disabled ? "not-allowed" : "pointer",
    fontWeight: variant === "cta" ? 700 : 600,
    fontSize: variant === "cta" ? 16 : "inherit",
    width: variant === "cta" ? "100%" : undefined,
    background:
      variant === "cta"
        ? props.disabled
          ? "rgba(255,255,255,0.08)"
          : "#FF007A"
        : variant === "primary"
          ? "rgba(255,0,122,0.14)"
          : "transparent",
    color:
      variant === "cta" && props.disabled
        ? "rgba(255,255,255,0.35)"
        : "white",
    opacity: variant !== "cta" && props.disabled ? 0.5 : 1,
    transition: "background 0.15s, opacity 0.15s",
  };

  return <button {...rest} style={{ ...base, ...(style || {}) }} />;
}
