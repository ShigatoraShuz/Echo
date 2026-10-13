import Image from "next/image";

export function JournalPhotoStack({ images }: { images: Array<{ id: string; url: string }> }) {
  if (images.length === 0) return null;

  const angles = ["-rotate-2", "rotate-1", "-rotate-1", "rotate-2", "-rotate-2"];

  return (
    <div className="grid grid-cols-6 gap-2 px-1 py-2 sm:gap-3" aria-label="Reflection photos">
      {images.slice(0, 5).map((photo, index) => (
        <figure
          key={photo.id}
          className={`min-w-0 rounded-xl border border-border/70 bg-card p-1.5 shadow-[0_8px_24px_rgba(25,49,34,.13)] ${images.length === 1 ? "col-span-4 col-start-2" : images.length === 2 ? "col-span-3" : "col-span-2"} ${index === 3 ? images.length === 4 ? "col-start-3" : "col-start-2" : ""} ${angles[index]}`}
        >
          <Image
            src={photo.url}
            alt={`Photo ${index + 1} from this reflection`}
            width={480}
            height={360}
            sizes="(min-width: 1024px) 16vw, (min-width: 640px) 25vw, 28vw"
            unoptimized
            referrerPolicy="no-referrer"
            className="aspect-[4/3] w-full rounded-md object-cover"
          />
          <figcaption className="pt-1 text-center text-[10px] font-medium text-muted-foreground">Memory {index + 1}</figcaption>
        </figure>
      ))}
    </div>
  );
}
