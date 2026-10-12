import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../api";
import { formatTime } from "../format";
import { compressImage } from "../image";
import PhotoImg from "./PhotoImg";
import { IconCamera } from "./Icons";
import type { Photo, PhotoKind } from "../types";

const KINDS: { kind: PhotoKind; label: string }[] = [
  { kind: "PRED", label: "Pred" },
  { kind: "MED", label: "Med delom" },
  { kind: "KONCANO", label: "Končano" },
  { kind: "PROBLEM", label: "Problem" },
];

export default function PhotoSection({
  orderId,
  photos,
  allowed,
}: {
  orderId: string;
  photos: Photo[];
  allowed: Record<PhotoKind, boolean>;
}) {
  const qc = useQueryClient();
  const upload = useMutation({
    mutationFn: async ({ kind, file }: { kind: PhotoKind; file: File }) => {
      const small = await compressImage(file);
      const fd = new FormData();
      fd.append("workOrderId", orderId);
      fd.append("kind", kind);
      fd.append("takenAt", new Date().toISOString());
      fd.append("photo", small);
      return api("/photos", { method: "POST", body: fd });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["order", orderId] }),
  });

  const label = (k: PhotoKind) => KINDS.find((x) => x.kind === k)!.label;
  const anyAllowed = KINDS.some((k) => allowed[k.kind]);

  return (
    <div className="section panel">
      <h3 className="panel-title">
        <span className="pt-ic"><IconCamera size={18} /></span>
        Fotografije
      </h3>
      {anyAllowed && (
        <>
          <div className="tiles">
            {KINDS.map(({ kind, label }) => (
              <label key={kind} className={allowed[kind] ? "tile" : "tile off"}>
                <IconCamera size={26} />
                {label}
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  disabled={!allowed[kind]}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) upload.mutate({ kind, file });
                    e.target.value = "";
                  }}
                />
              </label>
            ))}
          </div>
          <p className="hint">
            Fotografija Končano se odpre, ko končaš delo. Fotografijo problema dodaš pri prijavi težave.
          </p>
        </>
      )}
      {upload.isPending && (
        <p className="muted uploading" role="status">
          <span className="spinner sm" aria-hidden="true" />
          Nalagam fotografijo...
        </p>
      )}
      {upload.error && <p className="error">{upload.error.message}</p>}
      {photos.length > 0 && (
        <div className="thumbs">
          {photos.map((p) => (
            <div key={p.id} className="thumb">
              <PhotoImg path={p.path} alt={label(p.kind)} />
              <small>
                {label(p.kind)}, {formatTime(p.takenAt)}
              </small>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}