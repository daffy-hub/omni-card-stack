import { useEffect, useState } from "react";
import { Copy, X, KeyRound } from "lucide-react";

interface Props {
  label: string;
  username: string;
  password: string;
  onClose: () => void;
  notify: (msg: string) => void;
}

export function PopoutCredentialWidget({ label, username, password, onClose, notify }: Props) {
  const [reveal, setReveal] = useState(false);
  const [pos, setPos] = useState({ x: 24, y: 24 });
  const [drag, setDrag] = useState<{ dx: number; dy: number } | null>(null);

  useEffect(() => {
    if (!drag) return;
    const move = (e: MouseEvent) => setPos({ x: e.clientX - drag.dx, y: e.clientY - drag.dy });
    const up = () => setDrag(null);
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", up);
    return () => {
      window.removeEventListener("mousemove", move);
      window.removeEventListener("mouseup", up);
    };
  }, [drag]);

  const copy = async (val: string, kind: string) => {
    try {
      await navigator.clipboard.writeText(val);
      notify(`${kind} copied`);
    } catch {
      notify("Copy failed");
    }
  };

  return (
    <div
      className="fixed z-40 w-72 rounded-lg bg-card border border-primary shadow-2xl"
      style={{ left: pos.x, top: pos.y, boxShadow: "0 0 30px -8px var(--color-primary)" }}
    >
      <div
        onMouseDown={(e) => setDrag({ dx: e.clientX - pos.x, dy: e.clientY - pos.y })}
        className="flex items-center gap-1.5 px-2.5 py-1.5 border-b border-border cursor-grab active:cursor-grabbing select-none"
      >
        <KeyRound className="h-3.5 w-3.5 text-primary" />
        <span className="text-[11px] font-semibold flex-1 truncate font-mono">{label}</span>
        <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
      <div className="p-2.5 space-y-2">
        <Row label="USERNAME" value={username} onCopy={() => copy(username, "Username")} mono />
        <Row
          label="PASSWORD"
          value={reveal ? password : "•".repeat(Math.min(password.length, 12))}
          onCopy={() => copy(password, "Password")}
          mono
          right={
            <button
              onClick={() => setReveal((r) => !r)}
              className="text-[9px] uppercase tracking-wider text-muted-foreground hover:text-foreground"
            >
              {reveal ? "hide" : "show"}
            </button>
          }
        />
        <div className="text-[9px] text-muted-foreground font-mono pt-1 border-t border-border">
          Pop-out window opened. Paste credentials there to authenticate.
        </div>
      </div>
    </div>
  );
}

function Row({
  label, value, onCopy, mono, right,
}: { label: string; value: string; onCopy: () => void; mono?: boolean; right?: React.ReactNode }) {
  return (
    <div>
      <div className="flex items-center justify-between text-[9px] uppercase tracking-wider text-muted-foreground mb-0.5">
        <span>{label}</span>
        {right}
      </div>
      <div className="flex items-center gap-1 bg-input rounded px-2 py-1.5">
        <span className={`flex-1 truncate text-xs ${mono ? "font-mono" : ""}`}>{value}</span>
        <button onClick={onCopy} className="text-muted-foreground hover:text-primary" title="Copy">
          <Copy className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
