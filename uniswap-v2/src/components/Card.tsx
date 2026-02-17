import { type ReactNode } from "react";

export function Card(props: {
  title?: string;
  children: ReactNode;
  right?: ReactNode;
  compact?: boolean;
  noBorder?: boolean;
}) {
  return (
    <div
      style={{
        border: props.noBorder ? "none" : "1px solid rgba(255,255,255,0.08)",
        borderRadius: props.noBorder ? 0 : 16,
        padding: props.compact ? 12 : props.noBorder ? "8px 0" : 20,
        background: props.noBorder ? "transparent" : "rgba(255,255,255,0.05)",
        boxShadow: props.noBorder ? "none" : "0 4px 24px rgba(0,0,0,0.25), 0 0 60px rgba(255,0,122,0.04)",
        display: "grid",
        gap: props.compact ? 8 : 12,
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
