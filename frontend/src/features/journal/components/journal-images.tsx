"use client";
import Image from "next/image";
import type { JournalAttachment } from "@/services/journal/journal-media";
export function JournalImages({
  items,
  onRemove,
  disabled = false,
}: {
  items: JournalAttachment[];
  onRemove?: (id: string) => void;
  disabled?: boolean;
}) {
  return (
    <div className="grid grid-cols-2 gap-3">
      {items.map((item, index) => (
        <figure key={item.id} className="relative overflow-hidden rounded-2xl bg-secondary">
          <Image
            src={item.url}
            width={640}
            height={480}
            unoptimized
            alt={"Journal attachment " + (index + 1)}
            className="h-auto w-full object-cover"
          />
          {onRemove && (
            <button
              type="button"
              disabled={disabled}
              onClick={() => onRemove(item.id)}
              className="m-2 rounded-full bg-card px-3 py-2 text-sm"
              aria-label={"Remove image " + (index + 1)}
            >
              Remove
            </button>
          )}
        </figure>
      ))}
    </div>
  );
}
