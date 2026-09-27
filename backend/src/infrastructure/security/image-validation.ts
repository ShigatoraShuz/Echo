import sharp from "sharp";
import { ExternalServiceError, ValidationError } from "../../shared/errors/app-error.js";

const MAX_BYTES = 5 * 1024 * 1024;
const MAX_PIXELS = 20_000_000;
const MAX_DIMENSION = 8192;
const MAX_FRAMES = 50;
// Bound native decoding work per process; rejected callers can retry later.
let activeDecoders = 0;

function invalidImage(): ValidationError {
  return new ValidationError({
    image: ["Choose a valid supported image up to 5 MB, 8192 pixels per side and 20 megapixels in total."],
  });
}

export function validateImageSignature(bytes: Buffer, mime: string, allowGif = false): void {
  const matches =
    mime === "image/png"
      ? bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
      : mime === "image/jpeg"
        ? bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255
        : mime === "image/webp"
          ? bytes.toString("ascii", 0, 4) === "RIFF" && bytes.toString("ascii", 8, 12) === "WEBP"
          : allowGif && mime === "image/gif" && ["GIF87a", "GIF89a"].includes(bytes.toString("ascii", 0, 6));
  if (!matches || bytes.length < 12 || bytes.length > MAX_BYTES) throw invalidImage();
}

/** Decode every frame and re-encode pixels. EXIF/GPS, comments and trailing payloads are not copied. */
export async function sanitizeImage(bytes: Buffer, mime: string, allowGif = false): Promise<Buffer> {
  validateImageSignature(bytes, mime, allowGif);
  if (activeDecoders >= 2)
    throw new ExternalServiceError("IMAGE_PROCESSING_BUSY", "Image processing is busy. Please retry shortly.");
  activeDecoders += 1;
  let decoder: ReturnType<typeof sharp> | undefined;
  try {
    decoder = sharp(bytes, {
      animated: true,
      failOn: "warning",
      limitInputPixels: MAX_PIXELS,
      limitInputChannels: 4,
    }).timeout({ seconds: 10 });
    const metadata = await decoder.metadata();
    const frames = metadata.pages ?? 1;
    const width = metadata.width ?? 0;
    const height = metadata.pageHeight ?? metadata.height ?? 0;
    if (
      metadata.format !== mime.slice(6).replace("jpg", "jpeg") ||
      width < 1 ||
      height < 1 ||
      width > MAX_DIMENSION ||
      height > MAX_DIMENSION ||
      frames > MAX_FRAMES ||
      width * height * frames > MAX_PIXELS
    )
      throw invalidImage();
    const clean = await decoder.rotate().toFormat(metadata.format).toBuffer();
    if (clean.length > MAX_BYTES) throw invalidImage();
    return clean;
  } catch {
    // Decoder messages may include private metadata. Never surface or log them.
    throw invalidImage();
  } finally {
    decoder?.destroy();
    activeDecoders -= 1;
  }
}
