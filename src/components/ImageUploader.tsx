import { useCallback, useRef, useState } from "react";
import Cropper from "react-easy-crop";
import type { Area } from "react-easy-crop";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Upload, Link2, Loader2, X } from "lucide-react";

const MAX_BYTES = 15 * 1024 * 1024; // 15 MB raw input
const OUTPUT_SIZE = 512; // final square dimension
const SIGNED_URL_TTL = 60 * 60 * 24 * 365 * 10; // ~10 years

const ACCEPTED = [
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/svg+xml",
  "image/heic",
  "image/heif",
];

type Props = {
  value: string;
  onChange: (url: string) => void;
  folder: "team-logos" | "player-photos";
  label?: string;
  shape?: "circle" | "square";
};

export function ImageUploader({ value, onChange, folder, label = "Image", shape = "circle" }: Props) {
  const [tab, setTab] = useState<"upload" | "url">("upload");
  const [previewSrc, setPreviewSrc] = useState<string | null>(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedArea, setCroppedArea] = useState<Area | null>(null);
  const [busy, setBusy] = useState(false);
  const [isSvg, setIsSvg] = useState(false);
  const [svgFile, setSvgFile] = useState<File | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const reset = () => {
    setPreviewSrc(null);
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    setCroppedArea(null);
    setIsSvg(false);
    setSvgFile(null);
    if (inputRef.current) inputRef.current.value = "";
  };

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    if (file.size > MAX_BYTES) {
      toast.error("Image file is too large (max 15 MB).");
      return;
    }
    const nameLower = file.name.toLowerCase();
    const isHeic =
      file.type === "image/heic" ||
      file.type === "image/heif" ||
      nameLower.endsWith(".heic") ||
      nameLower.endsWith(".heif");
    const isSvgInput = file.type === "image/svg+xml" || nameLower.endsWith(".svg");

    try {
      if (isSvgInput) {
        // SVGs are uploaded as-is (no rasterisation/cropping).
        setIsSvg(true);
        setSvgFile(file);
        setPreviewSrc(URL.createObjectURL(file));
        return;
      }
      let blobToRead: Blob = file;
      if (isHeic) {
        const heic2any = (await import("heic2any")).default as any;
        const converted = await heic2any({ blob: file, toType: "image/jpeg", quality: 0.9 });
        blobToRead = Array.isArray(converted) ? converted[0] : converted;
      }
      const dataUrl = await blobToDataUrl(blobToRead);
      setIsSvg(false);
      setSvgFile(null);
      setPreviewSrc(dataUrl);
      setCrop({ x: 0, y: 0 });
      setZoom(1);
    } catch (err: any) {
      console.error(err);
      toast.error("Unsupported image format or corrupted file.");
    }
  };

  const onCropComplete = useCallback((_: Area, areaPixels: Area) => {
    setCroppedArea(areaPixels);
  }, []);

  const save = async () => {
    const { data: u } = await supabase.auth.getUser();
    const userId = u.user?.id;
    if (!userId) {
      toast.error("You must be signed in to upload images.");
      return;
    }
    setBusy(true);
    try {
      let uploadBlob: Blob;
      let ext: string;
      let contentType: string;
      if (isSvg && svgFile) {
        uploadBlob = svgFile;
        ext = "svg";
        contentType = "image/svg+xml";
      } else {
        if (!previewSrc || !croppedArea) {
          toast.error("Please select and crop an image first.");
          setBusy(false);
          return;
        }
        uploadBlob = await renderCroppedImage(previewSrc, croppedArea);
        ext = "jpg";
        contentType = "image/jpeg";
      }
      const path = `${userId}/${folder}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("team-images")
        .upload(path, uploadBlob, { contentType, upsert: false });
      if (upErr) throw upErr;
      const { data: signed, error: sErr } = await supabase.storage
        .from("team-images")
        .createSignedUrl(path, SIGNED_URL_TTL);
      if (sErr || !signed?.signedUrl) throw sErr ?? new Error("Could not create signed URL");
      onChange(signed.signedUrl);
      toast.success("Image uploaded.");
      reset();
    } catch (err: any) {
      console.error(err);
      toast.error(err?.message || "Image upload failed. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  const radius = shape === "circle" ? "rounded-full" : "rounded-md";

  return (
    <div className="space-y-2">
      <Label className="text-xs">{label}</Label>
      {value && (
        <div className="flex items-center gap-3 rounded-md border bg-muted/30 p-2">
          <img src={value} alt="current" className={`h-12 w-12 object-cover ${radius}`} />
          <span className="text-xs text-muted-foreground flex-1 truncate">Current image</span>
          <button
            type="button"
            onClick={() => onChange("")}
            className="text-muted-foreground hover:text-destructive"
            aria-label="Remove image"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}
      <Tabs value={tab} onValueChange={(v) => setTab(v as any)}>
        <TabsList className="grid grid-cols-2 w-full">
          <TabsTrigger value="upload" className="text-xs">
            <Upload className="h-3 w-3 mr-1" /> Upload from device
          </TabsTrigger>
          <TabsTrigger value="url" className="text-xs">
            <Link2 className="h-3 w-3 mr-1" /> Use image URL
          </TabsTrigger>
        </TabsList>
        <TabsContent value="upload" className="space-y-2 pt-2">
          {!previewSrc && (
            <Input
              ref={inputRef}
              type="file"
              accept={ACCEPTED.join(",") + ",image/*"}
              onChange={(e) => onFile(e.target.files?.[0])}
              disabled={busy}
            />
          )}
          {previewSrc && !isSvg && (
            <>
              <div className={`relative w-full h-56 bg-muted overflow-hidden ${radius === "rounded-full" ? "rounded-md" : "rounded-md"}`}>
                <Cropper
                  image={previewSrc}
                  crop={crop}
                  zoom={zoom}
                  aspect={1}
                  cropShape={shape === "circle" ? "round" : "rect"}
                  showGrid={false}
                  onCropChange={setCrop}
                  onZoomChange={setZoom}
                  onCropComplete={onCropComplete}
                />
              </div>
              <div className="flex items-center gap-2">
                <Label className="text-[10px] text-muted-foreground">Zoom</Label>
                <input
                  type="range"
                  min={1}
                  max={4}
                  step={0.05}
                  value={zoom}
                  onChange={(e) => setZoom(Number(e.target.value))}
                  className="flex-1"
                />
              </div>
              <p className="text-[10px] text-muted-foreground">Drag the image to reposition and use the slider to zoom.</p>
            </>
          )}
          {previewSrc && isSvg && (
            <div className="flex items-center justify-center rounded-md border bg-muted/30 p-4">
              <img src={previewSrc} alt="SVG preview" className="max-h-40" />
            </div>
          )}
          {previewSrc && (
            <div className="flex justify-end gap-2">
              <Button type="button" size="sm" variant="ghost" onClick={reset} disabled={busy}>
                Cancel
              </Button>
              <Button type="button" size="sm" onClick={save} disabled={busy}>
                {busy ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : null}
                Save image
              </Button>
            </div>
          )}
        </TabsContent>
        <TabsContent value="url" className="space-y-2 pt-2">
          <Input
            placeholder="https://…"
            value={value}
            maxLength={2000}
            onChange={(e) => onChange(e.target.value)}
          />
          <p className="text-[10px] text-muted-foreground">Paste a direct link to an image hosted elsewhere.</p>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Could not load image"));
    img.src = src;
  });
}

async function renderCroppedImage(src: string, area: Area): Promise<Blob> {
  const img = await loadImage(src);
  const canvas = document.createElement("canvas");
  canvas.width = OUTPUT_SIZE;
  canvas.height = OUTPUT_SIZE;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas not supported");
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(
    img,
    Math.max(0, area.x),
    Math.max(0, area.y),
    Math.max(1, area.width),
    Math.max(1, area.height),
    0,
    0,
    OUTPUT_SIZE,
    OUTPUT_SIZE
  );
  return new Promise<Blob>((resolve, reject) =>
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("Could not encode image"))),
      "image/jpeg",
      0.88
    )
  );
}