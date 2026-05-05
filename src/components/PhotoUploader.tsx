import { useCallback, useRef, useState } from "react";
import { PHOTO_SLOTS, PhotoSlotKey } from "@/lib/cars";
import { cn } from "@/lib/utils";
import { Camera, X, Check, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";

export interface PhotoFile { key: PhotoSlotKey; file: File; preview: string; }

interface Props {
  photos: PhotoFile[];
  onChange: (next: PhotoFile[]) => void;
}

export function PhotoUploader({ photos, onChange }: Props) {
  const [activeKey, setActiveKey] = useState<PhotoSlotKey | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const trigger = (key: PhotoSlotKey) => {
    setActiveKey(key);
    inputRef.current?.click();
  };

  const handleFile = (file: File) => {
    if (!activeKey) return;
    if (!file.type.startsWith("image/")) return;
    const preview = URL.createObjectURL(file);
    const next = photos.filter(p => p.key !== activeKey);
    next.push({ key: activeKey, file, preview });
    onChange(next);
  };

  const onDrop = useCallback((key: PhotoSlotKey, e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (!file) return;
    setActiveKey(key);
    setTimeout(() => handleFile(file), 0);
  }, [photos, activeKey]);

  const remove = (key: PhotoSlotKey) => {
    onChange(photos.filter(p => p.key !== key));
  };

  return (
    <div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ""; }}
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
                    className="absolute top-2 right-2 h-7 w-7 rounded-full bg-background/90 backdrop-blur grid place-items-center text-foreground hover:bg-destructive hover:text-destructive-foreground transition-colors"
                    aria-label="Remove photo"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                  <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/80 to-transparent p-2.5">
                    <div className="flex items-center gap-1.5 text-[11px] font-medium text-white">
                      <Check className="h-3 w-3 text-primary" />
                      {slot.label}
                    </div>
                  </div>
                </>
              ) : (
                <button
                  type="button"
                  onClick={() => trigger(slot.key)}
                  className="absolute inset-0 flex flex-col items-center justify-center text-center p-3 gap-2"
                >
                  <div className="h-9 w-9 rounded-full bg-background border border-border grid place-items-center text-muted-foreground group-hover:text-primary group-hover:border-primary/40 transition-colors">
                    <Camera className="h-4 w-4" />
                  </div>
                  <div>
                    <div className="text-xs font-medium text-foreground/90 leading-tight">{i + 1}. {slot.label}</div>
                    <div className="text-[10px] text-muted-foreground mt-1 leading-snug">{slot.hint}</div>
                  </div>
                </button>
              )}
            </div>
          );
        })}
      </div>

      <div className="mt-4 flex items-center justify-between text-xs text-muted-foreground">
        <span>
          <span className="font-semibold text-foreground">{photos.length}</span> / {PHOTO_SLOTS.length} photos added
        </span>
        <Button type="button" variant="ghost" size="sm" onClick={() => inputRef.current?.click()} className="text-xs">
          <Upload className="h-3 w-3" /> or drag &amp; drop into a slot
        </Button>
      </div>
    </div>
  );
}
