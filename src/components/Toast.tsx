import { useEffect } from "react";

export function Toast(props: { message: string; onClose: () => void }) {
  useEffect(() => {
    const id = setTimeout(props.onClose, 6000);
    return () => clearTimeout(id);
  }, [props]);

  return (
    <div
      role="status"
      style={{
        position: "fixed",
        right: 16,
        bottom: 16,
        maxWidth: 560,
        padding: "12px 14px",
        borderRadius: 14,
        border: "1px solid rgba(255,255,255,0.14)",
        background: "rgba(20,20,26,0.9)",
        backdropFilter: "blur(8px)",
      }}
    >
      <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
        <div style={{ flex: 1, whiteSpace: "pre-wrap" }}>{props.message}</div>
        <button
          onClick={props.onClose}
          style={{
            background: "transparent",
            border: "none",
            color: "white",
            cursor: "pointer",
            fontSize: 16,
            lineHeight: 1,
            opacity: 0.8,
          }}
          aria-label="Close"
        >
          ✕
        </button>
      </div>
    </div>
  );
}
