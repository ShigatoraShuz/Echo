import { CalendarClock, MapPin } from "lucide-react";
import type { Provider } from "@/types";
import type { EchoImageKey } from "@/lib/unsplash-images";
import { EchoImage } from "./image";

export function ProviderCard({ provider }: { provider: Provider }) {
  return (
    <article className="overflow-hidden rounded-2xl border border-border/70 bg-card shadow-card">
      <EchoImage imageKey={provider.imageKey as EchoImageKey} className="h-44 rounded-none" sizes="(min-width: 1024px) 33vw, 100vw" />
      <div className="p-5">
        <h2 className="text-base font-semibold text-foreground">{provider.name}</h2>
        <p className="mt-1 text-sm leading-6 text-muted-foreground">{provider.specialty}</p>
        <div className="mt-4 grid gap-2 text-sm text-muted-foreground">
          <span className="inline-flex items-center gap-2">
            <MapPin className="h-4 w-4 text-primary" aria-hidden="true" />
            {provider.distance}
          </span>
          <span className="inline-flex items-center gap-2">
            <CalendarClock className="h-4 w-4 text-primary" aria-hidden="true" />
            {provider.availability}
          </span>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          {provider.tags.map((tag) => (
            <span key={tag} className="rounded-full border border-border/70 bg-background px-3 py-1 text-xs font-medium text-muted-foreground">
              {tag}
            </span>
          ))}
        </div>
      </div>
    </article>
  );
}
