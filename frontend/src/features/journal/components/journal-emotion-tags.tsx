"use client";
import { useState, useRef, useEffect } from "react";
import { X } from "lucide-react";

const SUGGESTED_EMOTIONS = [
  "Grateful", "Hopeful", "Content", "Peaceful", "Loved",
  "Tired", "Overwhelmed", "Frustrated", "Lonely", "Worried",
  "Confused", "Guilty", "Ashamed", "Numb", "Empty",
];

interface EmotionTagsProps {
  tags: string[];
  onChange: (tags: string[]) => void;
}

export function JournalEmotionTags({ tags, onChange }: EmotionTagsProps) {
  const [input, setInput] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const filtered = SUGGESTED_EMOTIONS.filter(
    (e) => e.toLowerCase().includes(input.toLowerCase()) && !tags.includes(e)
  );

  function addEmotion(emotion: string) {
    if (!tags.includes(emotion)) onChange([...tags, emotion]);
    setInput("");
    setShowSuggestions(false);
  }

  function removeEmotion(emotion: string) {
    onChange(tags.filter((t) => t !== emotion));
  }

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setShowSuggestions(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  return (
    <div ref={ref} className="relative space-y-2">
      <div className="flex flex-wrap gap-1.5">
        {tags.map((tag) => (
          <span key={tag} className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
            {tag}
            <button type="button" onClick={() => removeEmotion(tag)} className="rounded-full p-0.5 hover:bg-primary/20"><X className="h-3 w-3" /></button>
          </span>
        ))}
      </div>
      <input value={input} onChange={(e) => { setInput(e.target.value); setShowSuggestions(true); }} onFocus={() => setShowSuggestions(true)} className="w-full rounded-xl border border-border bg-background px-4 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20" placeholder="Add emotions..." />
      {showSuggestions && input && filtered.length > 0 && (
        <div className="absolute left-0 top-full z-10 mt-1 w-full rounded-xl border border-border bg-card p-2 shadow-card">
          {filtered.slice(0, 5).map((emotion) => (
            <button key={emotion} type="button" onClick={() => addEmotion(emotion)} className="w-full rounded-lg px-3 py-2 text-left text-sm text-foreground hover:bg-secondary/50">{emotion}</button>
          ))}
        </div>
      )}
    </div>
  );
}
