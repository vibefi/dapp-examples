declare module "react-dom/client" {
  export type Root = {
    render(children: unknown): void;
    unmount(): void;
  };

  export function createRoot(container: Element | DocumentFragment): Root;
}
