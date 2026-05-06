import { useCallback, useRef, useState } from "react";
import { PHOTO_SLOTS, PhotoSlotKey } from "@/lib/cars";
import { cn } from "@/lib/utils";
import { Camera, X, Check, ImagePlus, RefreshCw } from "lucide-react";

export interface PhotoFile { key: PhotoSlotKey; file: File; preview: string; }

interface Props {
  photos: PhotoFile[];
  onChange: (next: PhotoFile[]) => void;
}

type PickMode = "camera" | "gallery";

export function PhotoUploader({ photos, onChange }: Props) {
  const [pending, setPending] = useState<{ key: PhotoSlotKey; mode: PickMode } | null>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);

  const trigger = (key: PhotoSlotKey, mode: PickMode) => {
    setPending({ key, mode });
    // Defer click so the "capture" attr (set via ref change) is honoured by the OS
    setTimeout(() => {
      (mode === "camera" ? cameraRef : galleryRef).current?.click();
    }, 0);
  };

  const handleFile = (file: File, key: PhotoSlotKey) => {
    if (!file.type.startsWith("image/")) return;
    const preview = URL.createObjectURL(file);
    const next = photos.filter(p => p.key !== key);
    next.push({ key, file, preview });
    onChange(next);
  };

  const onDrop = useCallback((key: PhotoSlotKey, e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file, key);
  }, [photos]);

  const remove = (key: PhotoSlotKey) => onChange(photos.filter(p => p.key !== key));

  return (
    <div>
      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f && pending) handleFile(f, pending.key);
          e.target.value = "";
          setPending(null);
        }}
      />
      <input
        ref={galleryRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f && pending) handleFile(f, pending.key);
          e.target.value = "";
          setPending(null);
        }}
      />

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {PHOTO_SLOTS.map((slot, i) => {
          const photo = photos.find(p => p.key === slot.key);
          return (
            <div
              key={slot.key}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => onDrop(slot.key, e)}
              className={cn(
                "group relative aspect-[4/3] rounded-xl border border-dashed border-border bg-muted/30 overflow-hidden transition-all",
                photo ? "border-primary/40 border-solid" : "hover:border-primary/40 hover:bg-muted/50",
              )}
            >
              {photo ? (
                <>
                  <img src={photo.preview} alt={slot.label} className="absolute inset-0 w-full h-full object-cover" />
                  <button
                    type="button"
                    onClick={() => remove(slot.key)}
                    className="absolute top-2 right-2 h-7 w-7 rounded-full bg-background/90 backdrop-blur grid place-items-center text-foreground hover:bg-destructive hover:text-destructive-foreground transition-colors z-10"
                    aria-label="Remove photo"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => trigger(slot.key, "gallery")}
                    className="absolute top-2 left-2 h-7 px-2 rounded-full bg-background/90 backdrop-blur grid place-items-center text-[10px] font-medium text-foreground hover:bg-primary hover:text-primary-foreground transition-colors z-10 inline-flex gap-1"
                    aria-label="Replace photo"
                  >
                    <RefreshCw className="h-3 w-3" /> Replace
                  </button>
                  <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/85 to-transparent p-2.5">
                    <div className="flex items-center gap-1.5 text-[11px] font-medium text-white">
                      <Check className="h-3 w-3 text-primary" />
                      {slot.label}
                    </div>
                  </div>
                </>
              ) : (
                <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-3 gap-2">
                  <div className="text-xs font-medium text-foreground/90 leading-tight">{i + 1}. {slot.label}</div>
                  <div className="text-[10px] text-muted-foreground leading-snug px-1">{slot.hint}</div>
                  <div className="flex items-center gap-1.5 mt-1">
                    <button
                      type="button"
                      onClick={() => trigger(slot.key, "camera")}
                      className="h-8 px-2.5 rounded-full bg-primary/10 border border-primary/30 text-primary text-[11px] font-medium inline-flex items-center gap-1 hover:bg-primary hover:text-primary-foreground transition-colors"
                    >
                      <Camera className="h-3 w-3" /> Camera
                    </button>
                    <button
                      type="button"
                      onClick={() => trigger(slot.key, "gallery")}
                      className="h-8 px-2.5 rounded-full bg-background border border-border text-foreground text-[11px] font-medium inline-flex items-center gap-1 hover:border-primary/40 hover:text-primary transition-colors"
                    >
                      <ImagePlus className="h-3 w-3" /> Upload
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="mt-4 flex items-center justify-between text-xs text-muted-foreground">
        <span>
          <span className="font-semibold text-foreground">{photos.length}</span> / {PHOTO_SLOTS.length} photos added
        </span>
        <span className="hidden sm:inline">Tap a slot to take a photo or upload from your device.</span>
      </div>
    </div>
  );
}
