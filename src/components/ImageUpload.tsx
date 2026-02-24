import { useState, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ImagePlus, X, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface ImageUploadProps {
  /** Current image URL (if any) */
  currentUrl?: string | null;
  /** Called with the new public URL after upload, or null on remove */
  onImageChange: (url: string | null) => void;
  /** User ID for storage path */
  userId: string;
  /** Folder prefix inside the user's directory */
  folder: string;
  /** Optional className for the wrapper */
  className?: string;
  /** Compact mode for inline quote images */
  compact?: boolean;
}

const ImageUpload = ({
  currentUrl,
  onImageChange,
  userId,
  folder,
  className = "",
  compact = false,
}: ImageUploadProps) => {
  const { toast } = useToast();
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState<string | null>(currentUrl ?? null);
  const fileRef = useRef<HTMLInputElement>(null);

  const upload = useCallback(
    async (file: File) => {
      if (!file.type.startsWith("image/")) {
        toast({ title: "Invalid file", description: "Please select an image file.", variant: "destructive" });
        return;
      }
      if (file.size > 5 * 1024 * 1024) {
        toast({ title: "File too large", description: "Max 5 MB.", variant: "destructive" });
        return;
      }

      setUploading(true);
      const ext = file.name.split(".").pop() || "png";
      const path = `${userId}/${folder}/${crypto.randomUUID()}.${ext}`;

      const { error } = await supabase.storage.from("user-images").upload(path, file, { upsert: true });
      if (error) {
        toast({ title: "Upload failed", description: error.message, variant: "destructive" });
        setUploading(false);
        return;
      }

      const { data: urlData } = supabase.storage.from("user-images").getPublicUrl(path);
      const publicUrl = urlData.publicUrl;
      setPreview(publicUrl);
      onImageChange(publicUrl);
      setUploading(false);
    },
    [userId, folder, onImageChange, toast],
  );

  const handlePaste = useCallback(
    (e: React.ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      for (const item of Array.from(items)) {
        if (item.type.startsWith("image/")) {
          e.preventDefault();
          const file = item.getAsFile();
          if (file) upload(file);
          return;
        }
      }
    },
    [upload],
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const file = e.dataTransfer.files?.[0];
      if (file && file.type.startsWith("image/")) upload(file);
    },
    [upload],
  );

  const remove = () => {
    setPreview(null);
    onImageChange(null);
  };

  if (preview) {
    return (
      <div className={`relative group/img ${className}`}>
        <img
          src={preview}
          alt=""
          className={`rounded-md object-cover w-full ${compact ? "max-h-[120px]" : "max-h-[200px]"}`}
        />
        <button
          onClick={remove}
          className="absolute top-1.5 right-1.5 bg-background/80 backdrop-blur-sm text-muted-foreground hover:text-destructive p-1 rounded-md opacity-0 group-hover/img:opacity-100 transition-opacity"
          aria-label="Remove image"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    );
  }

  return (
    <div
      className={`border border-dashed border-border rounded-md flex items-center justify-center cursor-pointer hover:border-accent transition-colors ${compact ? "h-16" : "h-24"} ${className}`}
      onPaste={handlePaste}
      onDrop={handleDrop}
      onDragOver={(e) => e.preventDefault()}
      onClick={() => fileRef.current?.click()}
      tabIndex={0}
      role="button"
      aria-label="Upload or paste image"
    >
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) upload(f);
          e.target.value = "";
        }}
      />
      {uploading ? (
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      ) : (
        <div className="flex items-center gap-2 text-muted-foreground text-xs">
          <ImagePlus className="h-4 w-4" />
          <span>{compact ? "Paste or add image" : "Click, drop, or paste an image"}</span>
        </div>
      )}
    </div>
  );
};

export default ImageUpload;
