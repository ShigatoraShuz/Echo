import type { CSSProperties } from "react";
export default function Image({ src, alt, fill, style, className, width, height }: { src: string | { src: string }; alt: string; fill?: boolean; style?: CSSProperties; className?: string; width?: number; height?: number }) {
  // Test-only Next image boundary. The production component and font loader are unchanged.
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={typeof src === "string" ? src : src.src} alt={alt} className={className} width={width} height={height} style={{ ...(fill ? { position: "absolute", width: "100%", height: "100%" } as CSSProperties : {}), ...style }} />;
}
