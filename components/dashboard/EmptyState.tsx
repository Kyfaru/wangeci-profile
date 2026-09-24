import { Card } from "@/components/ui";

export interface EmptyStateProps {
  message: string;
}

/** Shared "nothing here yet" placeholder for the dashboard sub-pages. */
export function EmptyState({ message }: EmptyStateProps) {
  return (
    <Card padding="lg" className="text-center text-sm text-gray">
      {message}
    </Card>
  );
}
