export interface GroundingPractice {
  id: "box-breathing" | "sensory-5-4-3-2-1";
  title: string;
  description: string;
  category: "Breathing" | "Mindfulness";
  minutes: 2 | 3 | 5 | 10;
  art: "leaves" | "water";
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
];
