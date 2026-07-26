"use client";
import { Users } from "lucide-react";

export function TrustedContactsEmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <span className="grid h-14 w-14 place-items-center rounded-full bg-secondary/50 text-muted-foreground">
        <Users className="h-6 w-6" />
      </span>
      <h3 className="mt-4 font-semibold text-foreground">No trusted contacts</h3>
      <p className="mt-2 max-w-sm text-sm text-muted-foreground">Add people you trust to reach out to when you need support. They will only be contacted with your permission.</p>
    </div>
  );
}
