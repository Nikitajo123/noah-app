import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../api";
import type { Material } from "../types";
import { IconBox } from "./Icons";

export default function MaterialsUsed({
  materials,
  orderId,
}: {
  materials: Material[];
  orderId: string;
}) {
  const qc = useQueryClient();
  const save = useMutation({
    mutationFn: ({ id, value }: { id: string; value: number }) =>
      api(`/materials/${id}`, { method: "PATCH", body: JSON.stringify({ usedQty: value }) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["order", orderId] }),
  });

  if (materials.length === 0) return null;

  return (
    <div className="section panel">
      <h3 className="panel-title">
        <span className="pt-ic"><IconBox size={18} /></span>
        Porabljen material
      </h3>
      {materials.map((m) => (
        <div key={m.id} className="mat-row">
          <span>{m.name}</span>
          <input
            type="number"
            inputMode="decimal"
            step="any"
            min="0"
            defaultValue={m.usedQty ?? ""}
            placeholder="0"
            onBlur={(e) => {
              const v = e.target.value;
              if (v !== "" && Number(v) !== m.usedQty) {
                save.mutate({ id: m.id, value: Number(v) });
              }
            }}
          />
        </div>
      ))}
      {save.error && <p className="error">{save.error.message}</p>}
    </div>
  );
}