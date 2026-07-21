import Image from "next/image";
import { cn } from "@/lib/utils";
import { getEchoImage, type EchoImageKey } from "@/lib/unsplash-images";

export function EchoImage({
  imageKey,
  className,
  priority = false,
  sizes = "(min-width: 1024px) 50vw, 100vw",
}: {
  imageKey: EchoImageKey;
  className?: string;
  priority?: boolean;
  sizes?: string;
}) {
  const image = getEchoImage(imageKey);

  return (
    <figure className={cn("relative overflow-hidden rounded-2xl bg-secondary", className)}>
      <Image src={image.src} alt={image.alt} fill priority={priority} sizes={sizes} className="object-cover" />
      <figcaption className="sr-only">{image.category}</figcaption>
    </figure>
  );
}
