"use client";

import Image from "next/image";
import { useState, useRef, useCallback, useEffect } from "react";
import { Camera, User, Loader2, CheckCircle, AlertCircle } from "lucide-react";

interface AvatarUploadProps {
  currentAvatar?: string | null;
  displayName: string;
  onUpload: (file: File) => Promise<void>;
  isUploading: boolean;
}

const MAX_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB
const ACCEPTED = ["image/jpeg", "image/png", "image/webp", "image/gif"];

export function AvatarUpload({
  currentAvatar,
  displayName,
  onUpload,
  isUploading,
}: AvatarUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadDone, setUploadDone] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);

  useEffect(() => {
    return () => {
      if (preview?.startsWith("blob:")) URL.revokeObjectURL(preview);
    };
  }, [preview]);

  const initials = displayName
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const processFile = useCallback(
    async (file: File) => {
      setUploadError(null);
      setUploadDone(false);

      if (!ACCEPTED.includes(file.type)) {
        setUploadError("Please choose a JPEG, PNG, WebP, or GIF image.");
        return;
      }
      if (file.size > MAX_SIZE_BYTES) {
        setUploadError("Image must be smaller than 5 MB.");
        return;
      }

      // Show instant local preview
      const objectUrl = URL.createObjectURL(file);
      setPreview(objectUrl);

      try {
        await onUpload(file);
        setUploadDone(true);
        setTimeout(() => setUploadDone(false), 4000);
      } catch {
        setUploadError("Upload failed. Please try again.");
        setPreview(null);
      }
    },
    [onUpload],
  );

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) void processFile(file);
    // Reset so the same file triggers onChange again if needed
    e.target.value = "";
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) void processFile(file);
  }

  const avatarSrc = preview ?? currentAvatar ?? null;

  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:gap-6">
      {/* ── Avatar circle + camera button ────────────────────────────────── */}
      <div
        className={`relative h-24 w-24 shrink-0 rounded-full transition-all duration-200 ${isDragOver ? "ring-4 ring-primary ring-offset-2 scale-105" : ""}`}
        onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
        onDragLeave={() => setIsDragOver(false)}
        onDrop={handleDrop}
      >
        {avatarSrc ? (
          <Image
            src={avatarSrc}
            alt={displayName}
            width={96}
            height={96}
            unoptimized
            className="h-24 w-24 rounded-full object-cover shadow-md"
          />
        ) : (
          <div className="flex h-24 w-24 items-center justify-center rounded-full bg-primary/10 text-primary shadow-inner">
            {initials ? (
              <span className="text-2xl font-bold tracking-tight">{initials}</span>
            ) : (
              <User className="h-10 w-10" />
            )}
          </div>
        )}

        {/* Camera overlay button */}
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={isUploading}
          aria-label="Change profile photo"
          className="absolute -bottom-1 -right-1 grid h-9 w-9 place-items-center rounded-full bg-primary text-primary-foreground shadow-md transition-all hover:scale-105 hover:bg-primary/90 active:scale-95 disabled:opacity-60"
        >
          {isUploading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Camera className="h-4 w-4" />
          )}
        </button>

        {/* Invisible file input */}
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPTED.join(",")}
          className="sr-only"
          onChange={handleInputChange}
          aria-hidden="true"
        />
      </div>

      {/* ── Labels + status feedback ─────────────────────────────────────── */}
      <div className="flex-1 space-y-1.5">
        <p className="text-sm font-semibold text-foreground">{displayName || "Your name"}</p>
        <p className="text-xs text-muted-foreground">
          Click the camera icon or drag &amp; drop a photo (max 5 MB — JPEG, PNG, WebP, GIF).
        </p>

        {uploadError && (
          <div className="flex items-center gap-1.5 text-xs text-destructive">
            <AlertCircle className="h-3.5 w-3.5 shrink-0" />
            {uploadError}
          </div>
        )}

        {uploadDone && !uploadError && (
          <div className="flex items-center gap-1.5 text-xs text-primary">
            <CheckCircle className="h-3.5 w-3.5 shrink-0" />
            Profile photo updated!
          </div>
        )}
      </div>
    </div>
  );
}
