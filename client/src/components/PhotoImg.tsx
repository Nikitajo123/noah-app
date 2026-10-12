import { useQuery } from "@tanstack/react-query";
import { getToken } from "../api";

async function loadBlob(path: string) {
  const token = getToken();
  const res = await fetch(`/api${path}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) throw new Error("Fotografije ni mogoče naložiti");
  return URL.createObjectURL(await res.blob());
}

export default function PhotoImg({ path, alt }: { path: string; alt: string }) {
  const { data, isLoading, error } = useQuery({
    queryKey: ["photo", path],
    queryFn: () => loadBlob(path),
    staleTime: Infinity,
    gcTime: Infinity,
  });
  if (isLoading) return <div className="ph-placeholder" />;
  if (error || !data) return <div className="ph-placeholder">!</div>;
  return (
    <a href={data} target="_blank" rel="noreferrer">
      <img src={data} alt={alt} />
    </a>
  );
}