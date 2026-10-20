import type { ExerciseType } from "./grounding.model";

export const groundingCategories = [
  "All", "Breathing", "Mindfulness", "Body relaxation", "Focus", "Mood boost", "Sleep",
] as const;

export type GroundingCategory = (typeof groundingCategories)[number];

export interface GroundingPractice {
  id: Exclude<ExerciseType, "breathing-circle">;
  title: string;
  description: string;
  category: Exclude<GroundingCategory, "All">;
  minutes: 2 | 3 | 5 | 10;
  art: "leaves" | "water" | "sunlight" | "horizon";
  cues: readonly string[];
}

export const groundingPractices: GroundingPractice[] = [
  {
    id: "box-breathing", title: "Box breathing", description: "Find a steady, even rhythm.", category: "Breathing", minutes: 3, art: "leaves",
    cues: ["Breathe in gently", "Hold only if comfortable", "Breathe out slowly", "Rest for a moment"],
  },
  {
    id: "sensory-5-4-3-2-1", title: "5-4-3-2-1 grounding", description: "Come back to the present through your senses.", category: "Mindfulness", minutes: 5, art: "water",
    cues: ["Name five things you can see", "Notice four things you can feel", "Listen for three sounds", "Notice two scents, or recall two you like", "Notice one taste, or take a sip of water"],
  },
  {
    id: "progressive-muscle-relaxation", title: "Progressive muscle relaxation", description: "Notice and release tension in your body.", category: "Body relaxation", minutes: 10, art: "sunlight",
    cues: ["Soften your face and jaw", "Gently tense and release your shoulders", "Relax your hands and arms", "Notice your legs and feet", "Take one comfortable breath"],
  },
  {
    id: "positive-self-talk", title: "Positive self-talk", description: "Practice a kinder inner voice.", category: "Mood boost", minutes: 5, art: "horizon",
    cues: ["Notice one thought that feels heavy", "Speak to yourself as you would a friend", "Name something you have handled before", "Choose one kind sentence to keep"],
  },
  {
    id: "window-reset", title: "Window reset", description: "Rest your eyes on light, color, and movement.", category: "Focus", minutes: 2, art: "horizon",
    cues: ["Look toward a window or a calm point", "Notice one color", "Notice one shape", "Let your gaze rest without judging"],
  },
  {
    id: "body-scan", title: "Body scan", description: "Check in with your body, from head to toe.", category: "Mindfulness", minutes: 5, art: "sunlight",
    cues: ["Notice your head and face", "Let your shoulders settle", "Feel your hands and belly", "Notice your legs and feet", "Take in the whole body"],
  },
  {
    id: "guided-visualization", title: "Guided visualization", description: "Imagine a place that feels steady.", category: "Focus", minutes: 5, art: "horizon",
    cues: ["Picture a place where you feel at ease", "Notice its light and colors", "Imagine the sounds there", "Return to one detail whenever you drift"],
  },
  {
    id: "gratitude-reflection", title: "Gratitude reflection", description: "Notice one small good moment.", category: "Mood boost", minutes: 3, art: "leaves",
    cues: ["Think of one moment that felt okay", "Notice what made it possible", "Let yourself appreciate that moment", "Carry one detail into the rest of today"],
  },
  {
    id: "4-7-8-breathing", title: "4-7-8 breathing", description: "Slow your breathing before rest.", category: "Sleep", minutes: 2, art: "water",
    cues: ["Breathe in for four counts", "Pause only if comfortable", "Breathe out slowly for eight counts"],
  },
];
