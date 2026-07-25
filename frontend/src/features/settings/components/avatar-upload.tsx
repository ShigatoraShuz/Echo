"use client";
import { useState, useRef } from "react";
import { Camera, User } from "lucide-react";

interface AvatarUploadProps {
  currentAvatar?: string;
  displayName: string;
  onUpload: (file: File) => void;
  isUploading: boolean;
}

export function AvatarUpload({ currentAvatar, displayName, onUpload, isUploading }: AvatarUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setPreview(URL.createObjectURL(file));
    onUpload(file);
  }

  const initials = displayName.slice(0, 2).toUpperCase();

  return (
    <div className="flex items-center gap-4">
      <div className="relative h-20 w-20 shrink-0">
        {preview || currentAvatar ? (
          <img src={preview || currentAvatar} alt={displayName} className="h-20 w-20 rounded-full object-cover" />
        ) : (
          <div className="flex h-20 w-20 items-center justify-center rounded-full bg-primary/10 text-primary">
            <User className="h-8 w-8" />
          </div>
        )}
        <button type="button" onClick={() => inputRef.current?.click()} disabled={isUploading} className="absolute -bottom-1 -right-1 grid h-8 w-8 place-items-center rounded-full bg-primary text-primary-foreground shadow-subtle hover:bg-primary/90 disabled:opacity-50">
          <Camera className="h-4 w-4" />
        </button>
      </div>
      <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />
      <div>
        <p className="text-sm font-medium text-foreground">{displayName}</p>
        <p className="text-xs text-muted-foreground">Click the camera icon to change your photo</p>
      </div>
    </div>
  );
}
