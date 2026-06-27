"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";
import {
  Upload,
  Trash2,
  Link2,
  Share2,
  Check,
  Loader2,
  FileText,
  Music,
  Film,
  ImageIcon,
  File as FileIcon,
} from "lucide-react";
import {
  listMedia,
  uploadFile,
  shareMedia,
  api,
  type MediaAsset,
} from "@/lib/api";
import { Badge, Button, Card, ErrorText, Spinner } from "@/components/ui";
import { PageHeader } from "@/components/shell";

const FILTERS = [
  { id: "", label: "All" },
  { id: "image", label: "Images" },
  { id: "video", label: "Videos" },
  { id: "audio", label: "Audio" },
  { id: "pdf", label: "PDF" },
  { id: "file", label: "Files" },
] as const;

const typeIcon: Record<string, typeof FileIcon> = {
  image: ImageIcon,
  video: Film,
  audio: Music,
  pdf: FileText,
  file: FileIcon,
};

function prettySize(bytes: number): string {
  if (!bytes) return "—";
  const units = ["B", "KB", "MB", "GB"];
  let n = bytes;
  let i = 0;
  while (n >= 1024 && i < units.length - 1) {
    n /= 1024;
    i += 1;
  }
  return n.toFixed(n >= 10 || i === 0 ? 0 : 1) + " " + units[i];
}

export default function MediaLibraryPage() {
  const [items, setItems] = useState<MediaAsset[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>("");
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const load = useCallback(() => {
    setLoading(true);
    listMedia(filter || undefined)
      .then((d) => setItems(Array.isArray(d) ? d : []))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [filter]);

  useEffect(() => {
    load();
  }, [load]);

  async function onUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setUploading(true);
    setError(null);
    try {
      for (const f of Array.from(files)) {
        await uploadFile(f);
      }
      if (fileInput.current) fileInput.current.value = "";
      load();
    } catch (err: any) {
      setError(err.message || "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  async function copy(text: string, tag: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(tag);
      setTimeout(() => setCopied((c) => (c === tag ? null : c)), 1800);
    } catch {
      setError("Could not copy to clipboard");
    }
  }

  async function copyShare(m: MediaAsset) {
    try {
      const res = await shareMedia(m.id);
      await copy(res.url, "share-" + m.id);
    } catch (e: any) {
      setError(e.message || "Could not create share link");
    }
  }

  async function remove(m: MediaAsset) {
    if (!confirm("Delete “" + m.filename + "”? This cannot be undone.")) return;
    try {
      await api("/media/" + m.id, { method: "DELETE" });
      setItems((list) => list.filter((x) => x.id !== m.id));
    } catch (e: any) {
      setError(e.message || "Could not delete");
    }
  }

  return (
    <div>
      <PageHeader
        title="Media Library"
        subtitle="Upload, preview, share and reuse images, video, audio and documents"
        action={
          <Button
            onClick={() => fileInput.current?.click()}
            disabled={uploading}
          >
            {uploading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> Uploading…
              </>
            ) : (
              <>
                <Upload className="h-4 w-4" /> Upload
              </>
            )}
          </Button>
        }
      />
      <input
        ref={fileInput}
        type="file"
        multiple
        className="hidden"
        onChange={onUpload}
      />

      <div className="mb-5 flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            onClick={() => setFilter(f.id)}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
              filter === f.id
                ? "bg-brand text-white"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      <ErrorText message={error} />

      {loading ? (
        <Spinner />
      ) : items.length === 0 ? (
        <Card>
          <p className="py-6 text-center text-sm text-slate-500">
            No media yet. Click “Upload” to add your first file.
          </p>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((m) => {
            const Icon = typeIcon[m.type] ?? FileIcon;
            return (
              <Card key={m.id} className="flex flex-col">
                <div className="mb-3 flex h-40 items-center justify-center overflow-hidden rounded-lg bg-slate-100">
                  {m.type === "image" ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={m.url}
                      alt={m.filename}
                      className="h-full w-full object-cover"
                    />
                  ) : m.type === "video" ? (
                    <video
                      src={m.url}
                      controls
                      controlsList="nodownload"
                      disablePictureInPicture
                      onContextMenu={(e) => e.preventDefault()}
                      className="h-full w-full"
                    />
                  ) : m.type === "audio" ? (
                    <div className="flex w-full flex-col items-center gap-2 px-3">
                      <Music className="h-8 w-8 text-brand" />
                      <audio src={m.url} controls className="w-full" />
                    </div>
                  ) : (
                    <Icon className="h-12 w-12 text-slate-400" />
                  )}
                </div>

                <p
                  className="truncate text-sm font-medium text-slate-900"
                  title={m.filename}
                >
                  {m.filename}
                </p>
                <div className="mt-1 flex flex-wrap items-center gap-2">
                  <Badge color="blue">{m.type}</Badge>
                  <span className="text-xs text-slate-400">
                    {prettySize(m.size)}
                  </span>
                  {m.durationSec ? (
                    <span className="text-xs text-slate-400">
                      {Math.round(m.durationSec / 60)} min
                    </span>
                  ) : null}
                </div>

                <div className="mt-3 flex flex-wrap gap-2">
                  <Button
                    variant="outline"
                    onClick={() => copy(m.url, "url-" + m.id)}
                  >
                    {copied === "url-" + m.id ? (
                      <>
                        <Check className="h-4 w-4" /> Copied
                      </>
                    ) : (
                      <>
                        <Link2 className="h-4 w-4" /> Link
                      </>
                    )}
                  </Button>
                  <Button variant="outline" onClick={() => copyShare(m)}>
                    {copied === "share-" + m.id ? (
                      <>
                        <Check className="h-4 w-4" /> Copied
                      </>
                    ) : (
                      <>
                        <Share2 className="h-4 w-4" /> Share
                      </>
                    )}
                  </Button>
                  <Button variant="danger" onClick={() => remove(m)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
