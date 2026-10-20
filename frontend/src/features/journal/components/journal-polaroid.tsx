import Image, { type StaticImageData } from "next/image";
import { X } from "lucide-react";

interface JournalPolaroidProps {
  src: string | StaticImageData;
  alt: string;
  caption: string;
  index?: number;
  onRemove?: () => void;
  removeLabel?: string;
}

export function JournalPolaroid({ src, alt, caption, index = 0, onRemove, removeLabel }: JournalPolaroidProps) {
  return (
    <figure className="journal-polaroid group relative" style={{ animationDelay: `${Math.min(index, 4) * 65}ms` }}>
      <div className="journal-polaroid__window">
        <Image
          src={src}
          alt={alt}
          fill
          sizes="(max-width: 640px) 36vw, 208px"
          unoptimized={typeof src === "string"}
          referrerPolicy="no-referrer"
          className="journal-polaroid__image object-cover object-center"
        />
      </div>
      <figcaption className="journal-polaroid__caption truncate">{caption}</figcaption>
      {onRemove && <button type="button" onClick={onRemove} aria-label={removeLabel ?? `Remove ${caption}`} className="absolute right-3 top-3 grid h-9 w-9 place-items-center rounded-full bg-white/95 text-foreground shadow-sm outline-none transition-colors hover:bg-white focus-visible:ring-4 focus-visible:ring-primary/25"><X className="h-4 w-4" aria-hidden="true" /></button>}
    </figure>
  );
}
