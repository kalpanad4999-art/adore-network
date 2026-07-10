import { useEffect, useRef, useState } from "react";
import { MessageCircle, X, Minus, Send, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Msg = { role: "user" | "assistant"; content: string };

interface Props {
  ownerId?: string;
  batchToken?: string;
}

const WELCOME: Msg = {
  role: "assistant",
  content:
    "🙏 Welcome to Trinetra Yoga.\n\nI can help you with:\n• Membership Status\n• Renewal Information\n• Class Schedules\n• Payment Details\n• General Support\n\nPlease enter your registered phone number to continue.",
};

const QUICK_ACTIONS = [
  "My Membership",
  "Renewal Date",
  "Payment Status",
  "Class Schedule",
  "Contact Support",
];

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const ANON_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;

const SupportChatWidget = ({ ownerId, batchToken }: Props) => {
  const [open, setOpen] = useState(false);
  const [minimized, setMinimized] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([WELCOME]);
  const [input, setInput] = useState("");
  const [phone, setPhone] = useState<string>("");
  const [sending, setSending] = useState(false);
  const [unread, setUnread] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, open]);

  useEffect(() => {
    if (open && !minimized) {
      setUnread(0);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [open, minimized]);

  const send = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || sending) return;

    const next = [...messages, { role: "user" as const, content: trimmed }];
    setMessages(next);
    setInput("");

    // Detect phone if not set
    let activePhone = phone;
    if (!activePhone) {
      const digits = trimmed.replace(/[^\d]/g, "");
      if (digits.length >= 7) {
        activePhone = digits;
        setPhone(digits);
      }
    }

    setSending(true);
    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/support-chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${ANON_KEY}`,
          apikey: ANON_KEY,
        },
        body: JSON.stringify({
          messages: next.map((m) => ({ role: m.role, content: m.content })),
          phone: activePhone || undefined,
          ownerId,
          batchToken,
        }),
      });
      const data = await res.json();
      const reply: string =
        data.reply ||
        data.error ||
        "Information is currently unavailable. Please try again later.";
      setMessages((m) => [...m, { role: "assistant", content: reply }]);
      if (!open || minimized) setUnread((u) => u + 1);
    } catch {
      setMessages((m) => [
        ...m,
        { role: "assistant", content: "Network error. Please try again." },
      ]);
    } finally {
      setSending(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    send(input);
  };

  if (!open) {
    return (
      <button
        onClick={() => { setOpen(true); setMinimized(false); }}
        aria-label="Open support chat"
        className="fixed bottom-5 right-5 z-50 h-14 w-14 rounded-full bg-primary text-primary-foreground shadow-lg shadow-primary/30 flex items-center justify-center hover:scale-105 transition-transform"
      >
        <MessageCircle className="h-6 w-6" />
        {unread > 0 && (
          <span className="absolute -top-1 -right-1 bg-destructive text-destructive-foreground text-[10px] font-bold rounded-full h-5 min-w-5 px-1 flex items-center justify-center">
            {unread}
          </span>
        )}
      </button>
    );
  }

  return (
    <div
      className={`fixed bottom-5 right-5 z-50 w-[calc(100vw-2.5rem)] sm:w-96 bg-card border border-border rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-200 ${
        minimized ? "h-14" : "h-[min(600px,80vh)]"
      }`}
    >
      <header className="flex items-center justify-between px-4 py-3 bg-primary text-primary-foreground shrink-0">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-full bg-primary-foreground/15 flex items-center justify-center">
            <MessageCircle className="h-4 w-4" />
          </div>
          <div>
            <p className="font-display text-sm leading-tight">Trinetra Yoga Support</p>
            <p className="text-[10px] opacity-80">{phone ? "Verified" : "Live assistant"}</p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={() => setMinimized((v) => !v)} aria-label="Minimize" className="p-1.5 rounded hover:bg-primary-foreground/15">
            <Minus className="h-4 w-4" />
          </button>
          <button onClick={() => setOpen(false)} aria-label="Close" className="p-1.5 rounded hover:bg-primary-foreground/15">
            <X className="h-4 w-4" />
          </button>
        </div>
      </header>

      {!minimized && (
        <>
          <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 space-y-3 bg-background">
            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[85%] rounded-2xl px-3.5 py-2 text-sm whitespace-pre-wrap leading-relaxed ${
                    m.role === "user"
                      ? "bg-primary text-primary-foreground rounded-br-sm"
                      : "bg-muted text-foreground rounded-bl-sm"
                  }`}
                >
                  {m.content}
                </div>
              </div>
            ))}
            {sending && (
              <div className="flex justify-start">
                <div className="bg-muted rounded-2xl rounded-bl-sm px-3.5 py-2 text-sm text-muted-foreground flex items-center gap-2">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" /> Thinking…
                </div>
              </div>
            )}
          </div>

          {phone && (
            <div className="px-3 pb-2 flex gap-1.5 overflow-x-auto shrink-0 bg-background">
              {QUICK_ACTIONS.map((q) => (
                <button
                  key={q}
                  onClick={() => send(q)}
                  disabled={sending}
                  className="text-xs whitespace-nowrap px-2.5 py-1 rounded-full border border-border hover:bg-accent disabled:opacity-50"
                >
                  {q}
                </button>
              ))}
            </div>
          )}

          <form onSubmit={handleSubmit} className="p-2 border-t border-border bg-card flex gap-2 shrink-0">
            <Input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={phone ? "Ask anything…" : "Enter your phone number"}
              disabled={sending}
              className="flex-1"
              maxLength={500}
            />
            <Button type="submit" size="icon" disabled={sending || !input.trim()}>
              <Send className="h-4 w-4" />
            </Button>
          </form>
        </>
      )}
    </div>
  );
};

export default SupportChatWidget;
