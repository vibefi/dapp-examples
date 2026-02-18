import type { ReactNode } from "react";

export function Card(props: { title?: string; right?: ReactNode; children?: ReactNode }) {
  return (
    <div className="card">
      {(props.title || props.right) && (
        <div className="cardHeader">
          <div className="cardTitle">{props.title}</div>
          <div>{props.right}</div>
        </div>
      )}
      {props.title && <div className="hr" />}
      {props.children}
    </div>
  );
}
