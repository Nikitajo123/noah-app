import { IconClose, IconSearch } from "./Icons";

const norm = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

export function matchesQuery(query: string, ...fields: (string | null | undefined)[]) {
  const words = norm(query.trim()).split(/\s+/).filter(Boolean);
  return words.every((w) => fields.some((f) => f && norm(f).includes(w)));
}

export default function SearchBox({
  value,
  onChange,
  placeholder,
  label,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  label: string;
}) {
  return (
    <div className="search">
      <span className="search-ic">
        <IconSearch size={20} />
      </span>
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={label}
        autoComplete="off"
        enterKeyHint="search"
      />
      {value && (
        <button type="button" className="search-clear" aria-label="Počisti iskanje" onClick={() => onChange("")}>
          <IconClose size={16} />
        </button>
      )}
    </div>
  );
}
