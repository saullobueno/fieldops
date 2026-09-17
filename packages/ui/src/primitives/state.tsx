import type { ReactNode } from "react";

import { Button } from "./button";

export function LoadingState({ message }: { message: string }): ReactNode {
  return <div className="rounded-md border border-border bg-muted p-4 text-sm text-muted-foreground">{message}</div>;
}

export function EmptyState({ message }: { message: string }): ReactNode {
  return <div className="rounded-md border border-border bg-muted p-4 text-sm text-muted-foreground">{message}</div>;
}

export function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }): ReactNode {
  return (
    <div className="rounded-md border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
      {message}
      <div className="mt-3">
        <Button onClick={onRetry} variant="secondary">Tentar novamente</Button>
      </div>
    </div>
  );
}
