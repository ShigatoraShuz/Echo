import { HeartHandshake, Leaf, ShieldAlert, ShieldCheck } from "lucide-react";
import Link from "next/link";

const defaultFooterGroups = [
  {
    title: "Reflect",
    links: [
      { label: "Dashboard", href: "/dashboard" },
      { label: "Private journal", href: "/journal" },
      { label: "Reflective Buddy", href: "/buddy" },
      { label: "Grounding tools", href: "/tools/grounding" },
    ],
  },
  {
    title: "Understand",
    links: [
      { label: "Emotion patterns", href: "/insights/emotion" },
      { label: "Distress signals", href: "/insights/risk" },
      { label: "Facial trend privacy", href: "/insights/facial" },
      { label: "Find professional help", href: "/support/find-help" },
    ],
  },
  {
    title: "Trust",
    links: [
      { label: "About ECHO", href: "/about" },
      { label: "Privacy policy", href: "/privacy-policy" },
      { label: "Terms of use", href: "/terms" },
      { label: "Crisis resources", href: "/crisis-help" },
    ],
  },
];

const landingFooterGroups = [
  {
    title: "Reflect",
    links: [
      { label: "Private journal", href: "/journal" },
      { label: "Reflective Buddy", href: "/buddy" },
      { label: "Grounding tools", href: "/tools/grounding" },
    ],
  },
  {
    title: "Understand",
    links: [
      { label: "Mood check-ins", href: "/journal/new" },
      { label: "Emotion patterns", href: "/insights/emotion" },
    ],
  },
  {
    title: "Trust",
    links: [
      { label: "About ECHO", href: "/about" },
      { label: "Privacy policy", href: "/privacy-policy" },
      { label: "Terms of use", href: "/terms" },
    ],
  },
];
