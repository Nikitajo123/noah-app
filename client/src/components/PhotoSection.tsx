import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { api } from "../api";
import { formatTime } from "../format";
import { compressImage } from "../image";
import PhotoImg from "./PhotoImg";
import { IconCamera } from "./Icons";
import type { Photo, PhotoKind } from "../types";

const KIND_LABEL: Record<PhotoKind, string> = {
  PRED: "Pred",
  MED: "Med delom",
  KONCANO: "Končano",
  PROBLEM: "Problem",
};

const PARALLEL = 3;

type Item = {
  id: string;
  file: File;
  preview: string;
  state: "wait" | "up" | "done" | "err";
  error?: string;
};

// Photos upload as soon as they are picked. Each one has its own id, so a retry never duplicates it.
export default function PhotoSection({
  orderId,
  photos,
  kind,
}: {
  orderId: string;
  photos: Photo[];
  kind: PhotoKind;
}) {
  const qc = useQueryClient();
  const [items, setItems] = useState<Item[]>([]);
  const started = useRef(new Set<string>());
  const previews = useRef<string[]>([]);

  useEffect(
    () => () => {
      previews.current.forEach((u) => URL.revokeObjectURL(u));
    },
    []
  );

  const patch = (id: string, change: Partial<Item>) =>
    setItems((cur) => cur.map((i) => (i.id === id ? { ...i, ...change } : i)));

  async function upload(item: Item) {
    try {
      const small = await compressImage(item.file);
      const fd = new FormData();
      fd.append("id", item.id);
      fd.append("workOrderId", orderId);
      fd.append("kind", kind);
      fd.append("takenAt", new Date().toISOString());
      fd.append("photo", small);
      await api("/photos", { method: "POST", body: fd });
      patch(item.id, { state: "done" });
      qc.invalidateQueries({ queryKey: ["order", orderId] });
    } catch (e) {
      patch(item.id, { state: "err", error: e instanceof Error ? e.message : "Napaka" });
    }
  }

  useEffect(() => {
    const active = items.filter((i) => i.state === "up").length;
    const next = items
      .filter((i) => i.state === "wait" && !started.current.has(i.id))
      .slice(0, Math.max(0, PARALLEL - active));
    if (next.length === 0) return;
    next.forEach((n) => started.current.add(n.id));
    setItems((cur) => cur.map((i) => (next.some((n) => n.id === i.id) ? { ...i, state: "up" } : i)));
    next.forEach((n) => void upload(n));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items]);

  function add(files: FileList | null) {
    if (!files || files.length === 0) return;
    const fresh: Item[] = [...files].map((file) => {
      const preview = URL.createObjectURL(file);
      previews.current.push(preview);
      return { id: crypto.randomUUID(), file, preview, state: "wait" };
    });
    setItems((cur) => [...cur, ...fresh]);
  }

  function retry(item: Item) {
    started.current.delete(item.id);
    patch(item.id, { state: "wait", error: undefined });
  }

  const uploaded = new Set(items.filter((i) => i.state === "done").map((i) => i.id));
  const saved = photos.filter((p) => !items.some((i) => i.id === p.id));
  const doneCount = uploaded.size;
  const busy = items.some((i) => i.state === "wait" || i.state === "up");

  return (
    <div className="section panel">
      <h3 className="panel-title">
        <span className="pt-ic"><IconCamera size={18} /></span>
        Fotografije
      </h3>
      <div className="photo-btns">
        <label className="tile wide">
          <IconCamera size={24} />
          Izberi fotografije
          <input
            type="file"
            accept="image/jpeg,image/png"
            multiple
            onChange={(e) => {
              add(e.target.files);
              e.target.value = "";
            }}
          />
        </label>
        <label className="tile wide">
          <IconCamera size={24} />
          Slikaj
          <input
            type="file"
            accept="image/*"
            capture="environment"
            onChange={(e) => {
              add(e.target.files);
              e.target.value = "";
            }}
          />
        </label>
      </div>
      {items.length > 0 && (
        <p className="photo-count" role="status" aria-live="polite">
          {doneCount} od {items.length} naloženih
          {busy ? "..." : ""}
        </p>
      )}
      {(items.length > 0 || saved.length > 0) && (
        <div className="thumbs">
          {saved.map((p) => (
            <div key={p.id} className="thumb">
              <PhotoImg path={p.path} alt={KIND_LABEL[p.kind]} />
              <small>
                {KIND_LABEL[p.kind]}, {formatTime(p.takenAt)}
              </small>
            </div>
          ))}
          {items.map((i) => (
            <div key={i.id} className={`thumb up-${i.state}`}>
              <img src={i.preview} alt="Nova fotografija" />
              <small>
                {i.state === "done" && "Naloženo"}
                {(i.state === "wait" || i.state === "up") && "Nalaga se..."}
                {i.state === "err" && (
                  <>
                    <span className="error">Napaka</span>{" "}
                    <button type="button" className="btn-mini" onClick={() => retry(i)}>
                      Poskusi znova
                    </button>
                  </>
                )}
              </small>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
