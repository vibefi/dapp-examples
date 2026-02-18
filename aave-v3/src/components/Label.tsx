import type { ReactNode } from "react";

export function Label(props: { children?: ReactNode; className?: string }) {
  return <div className={"small muted" + (props.className ? ` ${props.className}` : "")}>{props.children}</div>;
}
