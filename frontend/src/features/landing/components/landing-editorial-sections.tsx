import {
  ArrowUpRight,
  BookOpen,
  Brain,
  HeartHandshake,
  MessageCircle,
  ShieldCheck,
  Sparkles,
  Wind,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";

import { echoImages } from "@/lib/unsplash-images";
import { cn } from "@/lib/utils";
import { EchoReveal } from "@/shared/components/react-bits/echo-reveal";
import growthBackground from "../../../../assets/3bg.png";

const portraitImages = [
  {
    src: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=500&q=85",
    alt: "A person smiling in an everyday setting.",
  },
  {
    src: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=500&q=85",
    alt: "A person photographed in natural light.",
  },
  {
    src: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=500&q=85",
    alt: "A calm portrait in an everyday setting.",
  },
  {
    src: "https://images.unsplash.com/photo-1531123897727-8f129e1688ce?auto=format&fit=crop&w=500&q=85",
    alt: "A person smiling at the camera.",
  },
  {
    src: "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=500&q=85",
    alt: "A person photographed indoors.",
  },
  {
    src: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=500&q=85",
    alt: "A friendly portrait in soft light.",
  },
  {
    src: "https://images.unsplash.com/photo-1508214751196-bcfd4ca60f91?auto=format&fit=crop&w=500&q=85",
    alt: "A person smiling in a bright setting.",
  },
  {
    src: "https://images.unsplash.com/photo-1560250097-0b93528c311a?auto=format&fit=crop&w=500&q=85",
    alt: "A person in a calm indoor setting.",
  },
];

const portraitPositions = [
  "left-[2%] top-[15%] h-40 w-28",
  "left-[13%] top-[3%] h-44 w-32",
  "left-[24%] top-[16%] h-36 w-28",
  "left-[35%] top-[4%] h-40 w-28",
  "right-[35%] top-[5%] h-40 w-28",
  "right-[24%] top-[17%] h-36 w-28",
  "right-[13%] top-[3%] h-44 w-32",
  "right-[2%] top-[15%] h-40 w-28",
];

function revealDelay(index: number) {
