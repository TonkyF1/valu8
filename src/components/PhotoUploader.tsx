import { useRef, useState } from "react";
import { PHOTO_SLOTS, PhotoSlotKey } from "@/lib/cars";
import { cn } from "@/lib/utils";
import { X, Check, Plus, Upload, Camera } from "lucide-react";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

export interface PhotoFile { key: PhotoSlotKey; file: File; preview: string; }

interface Props {
  photos: PhotoFile[];
  onChange: (next: PhotoFile[]) => void;
}

export function PhotoUploader({ photos, onChange }: Props) {
  const bulkRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
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

  const reassign = (from: PhotoSlotKey, to: PhotoSlotKey) => {
    if (from === to) return;
    const moving = photos.find(p => p.key === from);
    if (!moving) return;
    const next = photos.filter(p => p.key !== from && p.key !== to);
    next.push({ ...moving, key: to });
    onChange(next);
  };

  return (
    <div>
      <input ref={bulkRef} type="file" accept="image/*" multiple className="hidden" onChange={handleBulk} />
      <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handleBulk} />
      <input ref={slotRef} type="file" accept="image/*" className="hidden" onChange={handleSlot} />

      {/* Headline + bulk upload CTA */}
      <div className="text-center mb-6">
        <h2 className="text-2xl sm:text-3xl font-bold tracking-tight">Upload Your Car Photos</h2>
        <p className="text-sm text-muted-foreground mt-2 max-w-md mx-auto">
          Upload 6 key shots for the most accurate valuation. You can select multiple photos at once.
        </p>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <button
          type="button"
          onClick={() => bulkRef.current?.click()}
          className="flex-1 h-14 rounded-2xl bg-gradient-to-r from-primary to-primary/80 text-primary-foreground font-semibold inline-flex items-center justify-center gap-2 shadow-lg shadow-primary/20 hover:shadow-primary/40 transition-all hover:scale-[1.01]"
        >
          <Upload className="h-5 w-5" /> Upload Multiple Photos
        </button>
        <button
          type="button"
          onClick={() => cameraRef.current?.click()}
          className="sm:w-auto h-14 px-5 rounded-2xl border border-border bg-muted/30 hover:bg-muted/60 hover:border-primary/40 font-medium text-foreground inline-flex items-center justify-center gap-2 transition-colors"
        >
          <Camera className="h-5 w-5" /> Camera
        </button>
      </div>

      {/* 6 slot grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {PHOTO_SLOTS.map((slot, i) => {
          const photo = photos.find(p => p.key === slot.key);
          return (
            <div
              key={slot.key}
              className={cn(
                "group relative aspect-[4/3] rounded-2xl overflow-hidden transition-all",
                photo
                  ? "border border-primary/40 bg-muted/30"
                  : "border border-dashed border-border bg-muted/20 hover:border-primary/40 hover:bg-muted/40",
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
                  <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/85 to-transparent p-2 z-10">
                    <div className="flex items-center gap-1.5 text-[11px] font-medium text-white mb-1">
                      <Check className="h-3 w-3 text-primary" />
                      {i + 1}. {slot.label}
                    </div>
                    <Select value={slot.key} onValueChange={(v) => reassign(slot.key, v as PhotoSlotKey)}>
                      <SelectTrigger className="h-6 text-[10px] bg-black/40 border-white/20 text-white px-2">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {PHOTO_SLOTS.map((s, idx) => (
                          <SelectItem key={s.key} value={s.key} className="text-xs">
                            {idx + 1}. {s.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </>
              ) : (
                <button
                  type="button"
                  onClick={() => { setTargetSlot(slot.key); setTimeout(() => slotRef.current?.click(), 30); }}
                  className="absolute inset-0 flex flex-col items-center justify-center text-center p-3 gap-2 group/btn"
                >
                  <div className="h-9 w-9 rounded-full bg-primary/10 border border-primary/30 grid place-items-center text-primary group-hover/btn:bg-primary group-hover/btn:text-primary-foreground transition-colors">
                    <Plus className="h-4 w-4" />
                  </div>
                  <div className="text-[11px] font-semibold text-foreground/90">{i + 1}. {slot.label}</div>
                </button>
              )}
            </div>
          );
        })}
      </div>

      <div className="mt-4 text-center text-xs text-muted-foreground">
        <span className="font-semibold text-foreground">{photos.length}</span> / {PHOTO_SLOTS.length} photos added
      </div>
    </div>
  );
}
