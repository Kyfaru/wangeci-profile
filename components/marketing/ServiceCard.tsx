import type { ReactNode } from "react";
import { Card } from "@/components/ui";
import { cn } from "@/lib/cn";

export interface ServiceCardProps {
  icon: ReactNode;
  title: string;
  description: string;
  /** Short bullet list of what's included, e.g. "60–90 min keynote". */
  features?: string[];
  className?: string;
}

/**
 * One offering on `/services` — icon badge, title, description, and an
 * optional feature list. Built on the shared `Card` primitive; no Preline
 * equivalent exists for this content shape, so it stays custom per the
 * component library policy.
 */
export function ServiceCard({
  icon,
  title,
  description,
  features,
  className,
}: ServiceCardProps) {
  return (
    <Card padding="lg" className={cn("flex flex-col gap-5", className)}>
      <span className="inline-flex size-12 shrink-0 items-center justify-center rounded-full bg-navy text-gold-bright [&>svg]:size-6">
        {icon}
      </span>
      <div className="flex flex-col gap-2">
        <h3 className="font-display text-xl text-navy">{title}</h3>
        <p className="text-sm leading-relaxed text-gray">{description}</p>
      </div>
      {features && features.length > 0 && (
        <ul className="mt-auto flex flex-col gap-2 border-t border-navy/10 pt-4">
          {features.map((feature) => (
            <li
              key={feature}
              className="flex items-start gap-2 text-sm text-navy/80"
            >
              <span
                aria-hidden="true"
                className="mt-2 size-1.5 shrink-0 rounded-full bg-gold-bright"
              />
              {feature}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
