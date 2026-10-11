import { useEffect, useRef, useState } from "react";

type Rec = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
};
type RecCtor = new () => Rec;

function getCtor(): RecCtor | null {
  const w = window as unknown as {
    SpeechRecognition?: RecCtor;
    webkitSpeechRecognition?: RecCtor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

const ERRORS: Record<string, string> = {
  "not-allowed": "Dostop do mikrofona je zavrnjen. Dovoli ga v nastavitvah brskalnika.",
  "service-not-allowed": "Dostop do mikrofona je zavrnjen. Dovoli ga v nastavitvah brskalnika.",
  "no-speech": "Nisem slišal govora. Poskusi znova.",
  "audio-capture": "Mikrofon ni najden.",
  network: "Za prepoznavo govora je potrebna internetna povezava.",
};

export default function VoiceButton({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  const [listening, setListening] = useState(false);
  const [error, setError] = useState("");
  const recRef = useRef<Rec | null>(null);
  const baseRef = useRef("");

  useEffect(() => () => recRef.current?.stop(), []);

  if (!getCtor()) {
    return <p className="hint">Glasovni vnos deluje v brskalniku Chrome.</p>;
  }

  function toggle() {
    if (listening) {
      recRef.current?.stop();
      return;
    }
    const Ctor = getCtor()!;
    const rec = new Ctor();
    rec.lang = "sl-SI";
    rec.continuous = false;
    rec.interimResults = true;
    baseRef.current = value.trim();

    rec.onresult = (e) => {
      let t = "";
      for (let i = 0; i < e.results.length; i++) t += e.results[i][0].transcript;
      t = t.trim();
      if (!baseRef.current) t = t.charAt(0).toUpperCase() + t.slice(1);
      onChange(baseRef.current ? `${baseRef.current} ${t}` : t);
    };
    rec.onerror = (e) => setError(ERRORS[e.error] ?? "Napaka pri prepoznavi govora.");
    rec.onend = () => setListening(false);

    setError("");
    recRef.current = rec;
    rec.start();
    setListening(true);
  }

  return (
    <div className="voice-row">
      <button type="button" className={listening ? "voice-btn on" : "voice-btn"} onClick={toggle}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
          <rect x="9" y="2" width="6" height="12" rx="3" />
          <path d="M5 11a7 7 0 0 0 14 0M12 18v4" />
        </svg>
        {listening ? "Poslušam, pritisni za konec" : "Govori"}
      </button>
      {error && <span className="error">{error}</span>}
    </div>
  );
}