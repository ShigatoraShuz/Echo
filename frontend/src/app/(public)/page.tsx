import {
  BarChart3,
  BookOpen,
  Bot,
  HeartHandshake,
  Lock,
  ShieldCheck,
  Sparkles,
  Wind,
} from "lucide-react";

import { FeatureCard, PrivacyNotice } from "@/components/echo/shared";
import HeroSection from "@/components/ui/hero-section-9";
import { AnimatedMarqueeHero } from "@/components/ui/hero-3";
import InteractiveBentoGallery, { type BentoMediaItem } from "@/components/ui/interactive-bento-gallery";
import { echoImages } from "@/lib/unsplash-images";
import { EchoReveal } from "@/shared/components/react-bits/echo-reveal";

const features = [
  {
    title: "Private journaling",
    description: "Write honest reflections, choose a mood, organize entries with tags, and keep personal context in one calm space.",
    icon: BookOpen,
  },
  {
    title: "Reflective Buddy",
    description: "Use warm, non-clinical prompts to name what feels present and find one gentle next step.",
    icon: Bot,
  },
  {
    title: "Emotion patterns",
    description: "Notice recurring moods and emotional themes through plain-language summaries and easy-to-read trends.",
    icon: BarChart3,
  },
  {
    title: "Grounding tools",
    description: "Return to the present with breathing, sensory check-ins, and short calming exercises.",
    icon: Wind,
  },
  {
    title: "Privacy controls",
    description: "Keep analysis optional, make exports explicit, and put user choice at the center of sensitive features.",
    icon: Lock,
  },
  {
    title: "Visible support",
    description: "Reach crisis resources and professional-help information without digging through the interface.",
    icon: HeartHandshake,
  },
];

export default function HomePage() {
  const heroImages = [
    echoImages.cozyChairWindow,
    echoImages.meditationRoomPlant,
    echoImages.plantDeskWarmLight,
  ];

  const marqueeImages = [
    echoImages.calmChairPlant.src,
    echoImages.cozyChairWindow.src,
    echoImages.plantDeskWarmLight.src,
    echoImages.wellnessInteriorPlantsChair.src,
    echoImages.meditationRoomPlant.src,
    echoImages.therapyOfficePlants.src,
    echoImages.counselingRoomWarm.src,
    echoImages.therapistPortrait.src,
  ];

  const galleryItems: BentoMediaItem[] = [
    {
      id: 1,
      title: "Private journaling",
      description: "Capture honest reflections, moods, and personal tags in a space designed to keep your context clear and private.",
      url: echoImages.plantDeskWarmLight.src,
      alt: echoImages.plantDeskWarmLight.alt,
      width: echoImages.plantDeskWarmLight.width,
      height: echoImages.plantDeskWarmLight.height,
      href: "/journal",
      span: "sm:col-span-1 sm:row-span-5 md:col-span-1 md:row-span-5",
    },
    {
      id: 2,
      title: "Reflective Buddy",
      description: "Slow down with warm prompts that help name what feels present and identify one gentle next step.",
      url: echoImages.counselingRoomWarm.src,
      alt: echoImages.counselingRoomWarm.alt,
      width: echoImages.counselingRoomWarm.width,
      height: echoImages.counselingRoomWarm.height,
      href: "/buddy",
      span: "sm:col-span-1 sm:row-span-4 md:col-span-2 md:row-span-4",
    },
    {
      id: 3,
      title: "Emotion patterns",
      description: "See recurring moods and emotional themes through gentle, plain-language summaries—not clinical labels.",
      url: echoImages.cozyChairWindow.src,
      alt: echoImages.cozyChairWindow.alt,
      width: echoImages.cozyChairWindow.width,
      height: echoImages.cozyChairWindow.height,
      href: "/insights/emotion",
      span: "sm:col-span-1 sm:row-span-4 md:col-span-1 md:row-span-5",
      priority: true,
    },
    {
      id: 4,
      title: "Grounding tools",
      description: "Return to the present with guided breathing, sensory check-ins, and short calming exercises.",
      url: echoImages.meditationRoomPlant.src,
      alt: echoImages.meditationRoomPlant.alt,
      width: echoImages.meditationRoomPlant.width,
      height: echoImages.meditationRoomPlant.height,
      href: "/tools/grounding",
      span: "sm:col-span-1 sm:row-span-4 md:col-span-2 md:row-span-4",
    },
    {
      id: 5,
      title: "Distress insights",
      description: "Review explainable support signals with uncertainty made clear and urgent resources kept close.",
      url: echoImages.wellnessInteriorPlantsChair.src,
      alt: echoImages.wellnessInteriorPlantsChair.alt,
      width: echoImages.wellnessInteriorPlantsChair.width,
      height: echoImages.wellnessInteriorPlantsChair.height,
      href: "/insights/risk",
      span: "sm:col-span-1 sm:row-span-4 md:col-span-1 md:row-span-4",
    },
    {
      id: 6,
      title: "Find professional help",
      description: "Explore provider, clinic, and hotline information when reflective tools are not enough.",
      url: echoImages.therapistPortrait.src,
      alt: echoImages.therapistPortrait.alt,
      width: echoImages.therapistPortrait.width,
      height: echoImages.therapistPortrait.height,
      href: "/support/find-help",
      span: "sm:col-span-1 sm:row-span-4 md:col-span-1 md:row-span-4",
    },
    {
      id: 7,
      title: "Visible crisis support",
      description: "Reach immediate-help guidance and crisis resources without searching through layers of navigation.",
      url: echoImages.therapyOfficePlants.src,
      alt: echoImages.therapyOfficePlants.alt,
      width: echoImages.therapyOfficePlants.width,
      height: echoImages.therapyOfficePlants.height,
      href: "/crisis-help",
      span: "sm:col-span-2 sm:row-span-4 md:col-span-2 md:row-span-4",
    },
  ];

  return (
    <>
      <HeroSection
        eyebrow="Your private wellness companion"
        title={
          <>
            A private place to <span className="text-primary">reflect</span>, understand, and reset.
          </>
        }
        subtitle="ECHO brings private journaling, reflective Buddy support, emotional patterns, and grounding tools together in one calm, safety-aware space."
        actions={[
          { text: "Start privately", href: "/signup", variant: "default" },
          { text: "Explore features", href: "#features", variant: "outline" },
        ]}
        stats={[
          {
            value: "Private",
            label: "by default",
            icon: <ShieldCheck className="h-5 w-5" aria-hidden="true" />,
          },
          {
            value: "6 moods",
            label: "for gentle check-ins",
            icon: <Sparkles className="h-5 w-5" aria-hidden="true" />,
          },
          {
            value: "Always visible",
            label: "crisis resources",
            icon: <HeartHandshake className="h-5 w-5" aria-hidden="true" />,
          },
        ]}
        images={heroImages}
      />

      <InteractiveBentoGallery
        sectionId="features"
        eyebrow="Explore ECHO"
        title="Carefully designed for the moments between check-ins"
        description="Open each feature to see how ECHO brings reflection, emotional context, grounding, privacy, and visible support into one calm experience."
        mediaItems={galleryItems}
      />

      <section className="border-y border-border/70 bg-secondary/20">
        <div className="mx-auto max-w-[1440px] px-4 py-16 sm:px-6 sm:py-20 lg:px-8 xl:px-10">
          <EchoReveal direction="up" className="mx-auto max-w-2xl text-center">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">Designed for everyday reflection</p>
            <h2 className="mt-4 font-serif text-3xl font-semibold tracking-tight text-foreground sm:text-5xl">
              Support that meets you where you are
            </h2>
            <p className="mt-4 text-base leading-7 text-muted-foreground">
              Move from a private thought to a clearer pattern or calming next step without turning your experience into a diagnosis.
            </p>
          </EchoReveal>

          <div className="mt-10 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {features.map((feature, index) => {
              const Icon = feature.icon;
              return (
                <EchoReveal key={feature.title} direction="up" delay={index * 50} duration={400}>
                  <FeatureCard
                    icon={<Icon className="h-5 w-5" aria-hidden="true" />}
                    title={feature.title}
                    description={feature.description}
                  />
                </EchoReveal>
              );
            })}
          </div>

          <div className="mx-auto mt-10 max-w-3xl">
            <PrivacyNotice />
          </div>
        </div>
      </section>

      <AnimatedMarqueeHero
        tagline="A calmer way to check in"
        title={
          <>
            Notice what you feel.
            <br />
            Choose what helps next.
          </>
        }
        description="Move from a private reflection to a clearer emotional pattern, a grounding exercise, or visible support—always with choice and non-diagnostic language at the center."
        ctaText="Start your first reflection"
        ctaHref="/signup"
        images={marqueeImages}
      />
    </>
  );
}
