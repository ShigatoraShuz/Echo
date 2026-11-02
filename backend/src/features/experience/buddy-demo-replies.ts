const demoLabel = "Demo reply (not AI-generated): ";

/** Fixed examples for exercising Buddy while no CBT response model is installed. */
export function buddyDemoReply(message: string, urgent: boolean): string {
  if (urgent) {
    return "Thank you for telling me. Your immediate safety matters most. Please open Find help or Crisis support now and contact a trusted person who can stay with you.";
  }

  const text = message.normalize("NFKC").toLowerCase();
  if (text.includes("two-minute grounding") || /\bgrounding\b/.test(text)) {
    return `${demoLabel}Let's pause together. Notice five things you can see and feel your feet on the floor. What do you notice right now?`;
  }
  if (text.includes("untangle a thought") || /\b(thought|worry|worried)\b/.test(text)) {
    return `${demoLabel}What happened, and what thought came up first? We can look at what supports that thought and what might point to a more balanced view.`;
  }
  if (text.includes("reflect on today")) {
    return `${demoLabel}Choose one moment from today. What happened, how did you feel, and what did you tell yourself about it?`;
  }
  if (text.includes("gentle next step") || /\b(plan|next step)\b/.test(text)) {
    return `${demoLabel}What is one small action you could take in the next ten minutes? It can be as simple as a short pause or writing one sentence.`;
  }
  if (/\b(anxious|anxiety|overwhelmed?|tense|stressed?)\b/.test(text)) {
    return `${demoLabel}That sounds stressful. What thought is making this moment feel harder, and is there another possible way to see it?`;
  }
  if (/\b(sad|alone|lonely|down)\b/.test(text)) {
    return `${demoLabel}That sounds difficult. What thought has been strongest today? Is there a kinder, realistic way to describe what happened?`;
  }
  if (/\b(angry|frustrated?|frustration)\b/.test(text)) {
    return `${demoLabel}It makes sense to pause before responding. What happened, what thought followed, and what response would support your goal?`;
  }
  return `${demoLabel}What happened, what thought did you notice, and how did it affect how you felt? We can start with just one part.`;
}
