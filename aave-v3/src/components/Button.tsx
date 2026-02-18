import type { ButtonHTMLAttributes } from "react";

export function Button(
  props: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "default" | "primary" | "danger" }
) {
  const v = props.variant ?? "default";
  const cls = ["btn", v === "primary" ? "primary" : "", v === "danger" ? "danger" : ""]
    .filter(Boolean)
    .join(" ");
  return <button {...props} className={cls + (props.className ? ` ${props.className}` : "")} />;
}
