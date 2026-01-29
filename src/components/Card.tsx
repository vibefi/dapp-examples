import { type ReactNode } from "react";

export function Card(props: { title?: string; children: ReactNode; right?: ReactNode }) {
  return (
    <div
      style={{
        border: "1px solid rgba(255,255,255,0.12)",
        borderRadius: 16,
        padding: 16,
        background: "rgba(255,255,255,0.03)",
        display: "grid",
        gap: 12,
      }}
    >
      {props.title ? (
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ fontWeight: 700 }}>{props.title}</div>
          {props.right}
        </div>
      ) : null}
      {props.children}
    </div>
  );
}
