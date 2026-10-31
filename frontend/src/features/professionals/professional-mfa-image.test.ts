import { describe, expect, it } from "vitest";
import { getImageProps } from "next/image";
import { professionalMfaImage } from "./professional-mfa-image";

describe("professional authenticator image", () => {
  const svg = '<?xml version="1.0"?>\n<svg xmlns="http://www.w3.org/2000/svg">\n<rect width="100%" />\n</svg>\n';
  it("renders an actual provider-shaped multiline SVG through Next Image without URL errors", () => {
    const raw = `data:image/svg+xml;utf-8,${svg}`;
    const props = { src: raw, width: 200, height: 200, unoptimized: true, alt: "Authenticator enrollment QR code" };
    expect(() => getImageProps(props)).toThrow();
    const result = getImageProps({ ...props, src: professionalMfaImage(raw) });
    expect(result.props.src).not.toMatch(/[\r\n]/);
    expect(decodeURIComponent(result.props.src!.split(",")[1])).toBe(svg);
  });
  it("does not double-encode an already escaped SVG", () => {
    const encoded = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
    expect(professionalMfaImage(encoded)).toBe(encoded);
  });
  it("preserves base64 images", () => {
    expect(professionalMfaImage("data:image/svg+xml;base64,PHN2Zy8+")).toBe("data:image/svg+xml;base64,PHN2Zy8+");
  });
  it("rejects external URLs", () => {
    expect(() => professionalMfaImage("https://example.invalid/qr.svg")).toThrow();
  });
});
