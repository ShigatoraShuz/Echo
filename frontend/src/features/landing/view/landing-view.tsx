import { LandingEditorialSections, LandingHero } from "../components";
import { LANDING_HERO_CONTENT } from "../model";

export function LandingView() {
  return (
    <>
      <LandingHero content={LANDING_HERO_CONTENT} />
      <LandingEditorialSections />
    </>
  );
}
