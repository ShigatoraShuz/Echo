import { EchoProductShowcase, LandingEditorialSections, LandingFinalCta, LandingHero, LandingScrollExpansionSection } from "../components";
import { LANDING_HERO_CONTENT } from "../model";

export function LandingView() {
  return (
    <div className="landing-page-canvas">
      <LandingHero content={LANDING_HERO_CONTENT} />
      <EchoProductShowcase />
      <LandingEditorialSections />
      <LandingScrollExpansionSection />
      <LandingFinalCta />
    </div>
  );
}
