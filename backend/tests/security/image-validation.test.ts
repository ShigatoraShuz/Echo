import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { sanitizeImage } from "../../src/infrastructure/security/image-validation.js";
import { SettingsService } from "../../src/features/settings/settings.service.js";
import { JournalImagesService } from "../../src/features/journals/journal-images.service.js";

const sample = () => sharp({ create: { width: 12, height: 8, channels: 3, background: "blue" } });

describe("decoded image uploads", () => {
  it.each(["png", "jpeg", "webp", "gif"] as const)("decodes and re-encodes %s", async (format) => {
    const bytes = await sample().toFormat(format).toBuffer();
    const clean = await sanitizeImage(bytes, "image/" + format, true);
    const metadata = await sharp(clean).metadata();
    expect(metadata).toMatchObject({ format, width: 12, height: 8 });
  });
  it("removes private EXIF metadata and appended content", async () => {
    const bytes = await sample()
      .withExif({ IFD0: { Artist: "PRIVATE PERSON" } })
      .jpeg()
      .toBuffer();
    expect((await sharp(bytes).metadata()).exif).toBeDefined();
    const clean = await sanitizeImage(Buffer.concat([bytes, Buffer.from("PRIVATE TRAILING PAYLOAD")]), "image/jpeg");
    expect((await sharp(clean).metadata()).exif).toBeUndefined();
    expect(clean.includes(Buffer.from("PRIVATE"))).toBe(false);
  });
  it("rejects forged signatures, truncated pixel data and MIME mismatch", async () => {
    const png = await sample().png().toBuffer();
    await expect(sanitizeImage(png, "image/jpeg")).rejects.toMatchObject({ statusCode: 400 });
    await expect(sanitizeImage(png.subarray(0, 45), "image/png")).rejects.toMatchObject({ statusCode: 400 });
    const fake = Buffer.alloc(100);
    png.subarray(0, 8).copy(fake);
    await expect(sanitizeImage(fake, "image/png")).rejects.toMatchObject({ statusCode: 400 });
  });
  it("rejects excessive dimensions and frame counts", async () => {
    const wide = await sharp({ create: { width: 8193, height: 1, channels: 3, background: "red" } })
      .png()
      .toBuffer();
    await expect(sanitizeImage(wide, "image/png")).rejects.toMatchObject({ statusCode: 400 });
    const frames = await sharp(Buffer.from(Array.from({ length: 51 * 3 }, (_, i) => Math.floor(i / 3) * 5)), {
      raw: { width: 1, height: 51, channels: 3, pageHeight: 1 },
    })
      .gif()
      .toBuffer();
    expect((await sharp(frames).metadata()).pages).toBe(51);
    await expect(sanitizeImage(frames, "image/gif", true)).rejects.toMatchObject({ statusCode: 400 });
  });
  it("preserves bounded animation", async () => {
    const frames = await sharp(Buffer.from([255, 0, 0, 0, 255, 0]), {
      raw: { width: 1, height: 2, channels: 3, pageHeight: 1 },
    })
      .gif()
      .toBuffer();
    const clean = await sanitizeImage(frames, "image/gif", true);
    expect((await sharp(clean).metadata()).pages).toBe(2);
  });
  it("rejects bad uploads before any database or storage work", async () => {
    const database = {} as never;
    await expect(
      new SettingsService(database).uploadAvatar("user-a", {
        contents: Buffer.from("spoof"),
        mimeType: "image/png",
        sizeBytes: 5,
      }),
    ).rejects.toMatchObject({ statusCode: 400 });
    await expect(
      new JournalImagesService(database).upload("user-a", "journal-b", "image-a", Buffer.from("spoof"), "image/png"),
    ).rejects.toMatchObject({ statusCode: 400 });
  });
});
