import { describe, expect, it } from "vitest";

import { HERO_GALLERY_IMAGES } from "@/features/landing/components/landing-hero";
import { getGalleryDimensions } from "./arc-gallery-hero-component";

const galleryOptions = {
  radiusLg: 510,
  radiusMd: 350,
  radiusSm: 170,
  cardSizeLg: 88,
  cardSizeMd: 74,
  cardSizeSm: 52,
};

describe("ArcGalleryHero", () => {
  it("uses a readable number of cards at each responsive breakpoint", () => {
    expect(getGalleryDimensions(1280, galleryOptions)).toMatchObject({
      radius: 510,
      cardSize: 88,
      imageLimit: Number.POSITIVE_INFINITY,
    });
    expect(getGalleryDimensions(800, galleryOptions)).toMatchObject({
      radius: 350,
      cardSize: 74,
      imageLimit: 10,
    });
    expect(getGalleryDimensions(390, galleryOptions)).toMatchObject({
      radius: 170,
      cardSize: 52,
      imageLimit: 8,
    });
  });

  it("keeps all supplied hero photos local and distinct", () => {
    expect(HERO_GALLERY_IMAGES).toHaveLength(15);
    expect(new Set(HERO_GALLERY_IMAGES)).toHaveLength(15);
    expect(HERO_GALLERY_IMAGES.every((src) => !src.startsWith("http"))).toBe(true);
  });
});
