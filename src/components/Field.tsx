import { type ReactNode } from "react";

export function Field(props: { label: string; children: ReactNode; hint?: string; error?: string | null }) {
  return (
    <div style={{ display: "grid", gap: 6 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <label style={{ fontWeight: 600 }}>{props.label}</label>
        {props.hint ? <span style={{ opacity: 0.75, fontSize: 12 }}>{props.hint}</span> : null}
      </div>
      {props.children}
      {props.error ? <div style={{ color: "#ff6b6b", fontSize: 12 }}>{props.error}</div> : null}
    </div>
  );
}
