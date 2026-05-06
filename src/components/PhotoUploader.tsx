import { useRef, useState } from "react";
import { PHOTO_SLOTS, PhotoSlotKey } from "@/lib/cars";
import { cn } from "@/lib/utils";
import { Camera, X, Check, Plus, Image as ImageIcon, FolderOpen } from "lucide-react";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";

export interface PhotoFile { key: PhotoSlotKey; file: File; preview: string; }

interface Props {
  photos: PhotoFile[];
  onChange: (next: PhotoFile[]) => void;
}

type PickMode = "camera" | "gallery" | "files";

export function PhotoUploader({ photos, onChange }: Props) {
  const [openSlot, setOpenSlot] = useState<PhotoSlotKey | null>(null);
  const [pendingMode, setPendingMode] = useState<PickMode | null>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);
  const filesRef = useRef<HTMLInputElement>(null);

  const pick = (mode: PickMode) => {
    setPendingMode(mode);
    setTimeout(() => {
      const ref = mode === "camera" ? cameraRef : mode === "gallery" ? galleryRef : filesRef;
      ref.current?.click();
    }, 50);
  };

  const handleFile = (file: File, key: PhotoSlotKey) => {
    if (!file.type.startsWith("image/")) return;
    const preview = URL.createObjectURL(file);
    const next = photos.filter(p => p.key !== key);
    next.push({ key, file, preview });
    onChange(next);
    setOpenSlot(null);
    setPendingMode(null);
  };

  const remove = (key: PhotoSlotKey) => onChange(photos.filter(p => p.key !== key));

  const onInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f && openSlot) handleFile(f, openSlot);
    e.target.value = "";
  };

  return (
    <div>
      <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={onInputChange} />
      <input ref={galleryRef} type="file" accept="image/*" className="hidden" onChange={onInputChange} />
      <input ref={filesRef} type="file" className="hidden" onChange={onInputChange} />

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
                  <button
                    type="button"
                    onClick={() => setOpenSlot(slot.key)}
                    className="absolute inset-0 z-0"
                    aria-label="Replace photo"
                  />
                  <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/85 to-transparent p-2.5 pointer-events-none">
                    <div className="flex items-center gap-1.5 text-[11px] font-medium text-white">
                      <Check className="h-3 w-3 text-primary" />
                      {slot.label}
                    </div>
                  </div>
                </>
              ) : (
                <button
                  type="button"
                  onClick={() => setOpenSlot(slot.key)}
                  className="absolute inset-0 flex flex-col items-center justify-center text-center p-3 gap-2 group/btn"
                >
                  <div className="h-9 w-9 rounded-full bg-primary/10 border border-primary/30 grid place-items-center text-primary group-hover/btn:bg-primary group-hover/btn:text-primary-foreground transition-colors">
                    <Plus className="h-4 w-4" />
                  </div>
                  <div className="text-[11px] font-semibold text-foreground/90">Add Photo</div>
                  <div className="text-[10px] text-muted-foreground leading-tight px-1">{i + 1}. {slot.label}</div>
                </button>
              )}
            </div>
          );
        })}
      </div>

      <div className="mt-4 text-xs text-muted-foreground">
        <span className="font-semibold text-foreground">{photos.length}</span> / {PHOTO_SLOTS.length} photos added
      </div>

      <Drawer open={!!openSlot} onOpenChange={(o) => !o && setOpenSlot(null)}>
        <DrawerContent className="bg-background border-border">
          <DrawerHeader>
            <DrawerTitle className="text-center">
              {openSlot ? PHOTO_SLOTS.find(s => s.key === openSlot)?.label : "Add Photo"}
            </DrawerTitle>
          </DrawerHeader>
          <div className="p-4 pb-8 space-y-2">
            <SheetAction icon={<Camera className="h-5 w-5" />} label="Take Photo" sub="Use your camera" onClick={() => pick("camera")} />
            <SheetAction icon={<ImageIcon className="h-5 w-5" />} label="Choose from Gallery" sub="Pick from your photos" onClick={() => pick("gallery")} />
            <SheetAction icon={<FolderOpen className="h-5 w-5" />} label="Browse Files" sub="Select any image file" onClick={() => pick("files")} />
            <button
              type="button"
              onClick={() => setOpenSlot(null)}
              className="w-full mt-3 h-12 rounded-xl bg-muted/40 hover:bg-muted text-sm font-medium text-muted-foreground transition-colors"
            >
              Cancel
            </button>
          </div>
        </DrawerContent>
      </Drawer>
    </div>
  );
}

function SheetAction({ icon, label, sub, onClick }: { icon: React.ReactNode; label: string; sub: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full flex items-center gap-3 p-4 rounded-xl bg-muted/30 hover:bg-primary/10 hover:border-primary/40 border border-transparent transition-all text-left group"
    >
      <span className="h-11 w-11 rounded-full bg-primary/15 text-primary grid place-items-center group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
        {icon}
      </span>
      <span className="flex-1">
        <span className="block text-sm font-semibold text-foreground">{label}</span>
        <span className="block text-xs text-muted-foreground">{sub}</span>
      </span>
    </button>
  );
}
