import { useRef, useState } from "react";
import { PHOTO_SLOTS, PhotoSlotKey } from "@/lib/cars";
import { cn } from "@/lib/utils";
import { X, Plus, Upload } from "lucide-react";

export interface PhotoFile { key: PhotoSlotKey; file: File; preview: string; }

interface Props {
  photos: PhotoFile[];
  onChange: (next: PhotoFile[]) => void;
}

export function PhotoUploader({ photos, onChange }: Props) {
  const bulkRef = useRef<HTMLInputElement>(null);
  const slotRef = useRef<HTMLInputElement>(null);
  const [targetSlot, setTargetSlot] = useState<PhotoSlotKey | null>(null);

  const usedKeys = new Set(photos.map(p => p.key));
  const nextEmptySlots = (count: number): PhotoSlotKey[] => {
    const out: PhotoSlotKey[] = [];
    for (const s of PHOTO_SLOTS) {
      if (!usedKeys.has(s.key) && !out.includes(s.key)) out.push(s.key);
      if (out.length >= count) break;
    }
    return out;
  };

  const handleBulk = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []).filter(f => f.type.startsWith("image/"));
    if (!files.length) return;
    const slots = nextEmptySlots(files.length);
    const additions: PhotoFile[] = files.slice(0, slots.length).map((file, i) => ({
      key: slots[i],
      file,
      preview: URL.createObjectURL(file),
    }));
    onChange([...photos, ...additions]);
    e.target.value = "";
  };

  const handleSlot = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !file.type.startsWith("image/") || !targetSlot) return;
    const next = photos.filter(p => p.key !== targetSlot);
    next.push({ key: targetSlot, file, preview: URL.createObjectURL(file) });
    onChange(next);
    setTargetSlot(null);
    e.target.value = "";
  };

  const remove = (key: PhotoSlotKey) => onChange(photos.filter(p => p.key !== key));

  return (
    <div className="space-y-8">
      <input ref={bulkRef} type="file" accept="image/*" multiple className="hidden" onChange={handleBulk} />
      <input ref={slotRef} type="file" accept="image/*" className="hidden" onChange={handleSlot} />

      {/* Header */}
      <div className="text-center">
        <h2 className="text-xl font-semibold tracking-tight">Upload Your Car Photos</h2>
        <p className="text-sm text-muted-foreground mt-1.5 max-w-md mx-auto">
          Six key shots for the most accurate valuation. You can select multiple photos at once.
        </p>
      </div>

      {/* Upload button */}
      <button
        type="button"
        onClick={() => bulkRef.current?.click()}
        className="w-full h-12 rounded-xl bg-primary text-primary-foreground font-medium inline-flex items-center justify-center gap-2 hover:bg-primary/90 transition-colors"
      >
        <Upload className="h-4 w-4" /> Upload Photos
      </button>

      {/* Photo grid */}
      <div className="grid grid-cols-3 gap-3">
        {PHOTO_SLOTS.map((slot) => {
          const photo = photos.find(p => p.key === slot.key);
          return (
            <div key={slot.key} className="flex flex-col items-center gap-1.5">
              <button
                type="button"
                onClick={() => { setTargetSlot(slot.key); setTimeout(() => slotRef.current?.click(), 30); }}
                className={cn(
                  "relative w-full aspect-[4/3] rounded-xl overflow-hidden transition-all",
                  photo
                    ? "border border-border/40"
                    : "border border-dashed border-border/60 bg-muted/[0.03] hover:border-primary/20 hover:bg-muted/[0.06]",
                )}
              >
                {photo ? (
                  <>
                    <img src={photo.preview} alt={slot.label} className="absolute inset-0 w-full h-full object-cover" />
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); remove(slot.key); }}
                      className="absolute top-1.5 right-1.5 h-5 w-5 rounded-full bg-black/40 backdrop-blur-sm grid place-items-center text-white hover:bg-destructive transition-colors"
                      aria-label="Remove photo"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </>
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <Plus className="h-5 w-5 text-muted-foreground/30" strokeWidth={1.5} />
                  </div>
                )}
              </button>
              <span className="text-[10px] text-muted-foreground text-center leading-tight max-w-[95%]">
                {slot.label}
              </span>
            </div>
          );
        })}
      </div>

      {/* Counter */}
      <div className="flex items-center justify-center gap-2">
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-muted/30 border border-border/40">
          <span className={cn(
            "h-2 w-2 rounded-full",
            photos.length === PHOTO_SLOTS.length ? "bg-emerald-500" : "bg-primary"
          )} />
          <span className="text-xs text-muted-foreground">
            <span className="font-medium text-foreground">{photos.length}</span> / {PHOTO_SLOTS.length} photos
          </span>
        </div>
      </div>
    </div>
  );
}
