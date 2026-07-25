import { useState, useRef, useEffect } from "react";
import { useServerFn } from "@tanstack/react-start";
import { chatWithClientData } from "@/lib/data-chat.functions";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Sparkles, Send, Loader2, MessageSquare, X } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { cn } from "@/lib/utils";

type Msg = { role: "user" | "assistant"; content: string };

const SUGGESTIONS = [
  "Qual criativo está performando melhor?",
  "Onde estou gastando mais e trazendo menos resultado?",
  "Compare os últimos 7 dias com a semana anterior",
  "Recomende ajustes para reduzir o CPA",
];

export function AiDataChat({ clientId, period }: { clientId: string; period: { start?: string; end?: string } }) {
  const ask = useServerFn(chatWithClientData);
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, loading, open]);

  async function send(text?: string) {
    const content = (text ?? input).trim();
    if (!content || loading) return;
    const next = [...messages, { role: "user" as const, content }];
    setMessages(next);
    setInput("");
    setLoading(true);
    try {
      const res: any = await ask({
        data: {
          clientId,
          messages: next,
          period_start: period.start ?? null,
          period_end: period.end ?? null,
        },
      });
      setMessages([...next, { role: "assistant", content: res.content }]);
    } catch (e: any) {
      setMessages([...next, { role: "assistant", content: `⚠️ ${e.message ?? "Erro na IA"}` }]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      {/* Floating action button */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="fixed bottom-24 right-4 md:bottom-6 md:right-6 z-50 h-14 w-14 rounded-full bg-gradient-to-br from-primary to-violet-500 text-white shadow-lg shadow-primary/30 hover:scale-105 transition flex items-center justify-center"
          aria-label="Abrir CloudOS AI"
        >
          <Sparkles className="h-6 w-6" />
        </button>
      )}

      {/* Floating panel */}
      <div
        className={cn(
          "fixed z-50 bg-background border shadow-2xl rounded-xl flex flex-col transition-all",
          "bottom-4 right-4 md:bottom-6 md:right-6",
          "w-[calc(100vw-2rem)] md:w-[400px] h-[70vh] md:h-[600px] max-h-[calc(100vh-6rem)]",
          open ? "opacity-100 translate-y-0 pointer-events-auto" : "opacity-0 translate-y-4 pointer-events-none"
        )}
      >
        <div className="p-3 border-b flex items-center gap-2">
          <div className="h-7 w-7 rounded-md bg-gradient-to-br from-primary to-violet-500 flex items-center justify-center">
            <Sparkles className="h-4 w-4 text-white" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="font-semibold text-sm">CloudOS AI</div>
            <div className="text-[10px] text-muted-foreground">Pergunte o que quiser sobre este cliente</div>
          </div>
          <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setOpen(false)}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 space-y-3">
          {messages.length === 0 && !loading && (
            <div className="space-y-2 text-center py-6">
              <MessageSquare className="h-8 w-8 mx-auto text-muted-foreground/60" />
              <div className="text-xs text-muted-foreground">Pergunte algo sobre os dados de mídia e vendas.</div>
              <div className="flex flex-col gap-1.5 pt-2">
                {SUGGESTIONS.map((s) => (
                  <button key={s} onClick={() => send(s)}
                    className="text-xs text-left px-2.5 py-2 rounded-md border hover:bg-accent transition">
                    💡 {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((m, i) => (
            <div key={i} className={`text-sm ${m.role === "user" ? "text-right" : ""}`}>
              <div className={`inline-block max-w-[92%] rounded-lg px-3 py-2 ${
                m.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted"
              }`}>
                {m.role === "assistant" ? (
                  <div className="prose prose-sm max-w-none dark:prose-invert prose-p:my-1 prose-ul:my-1 prose-li:my-0 prose-headings:my-1">
                    <ReactMarkdown>{m.content}</ReactMarkdown>
                  </div>
                ) : (
                  <div className="whitespace-pre-wrap">{m.content}</div>
                )}
              </div>
            </div>
          ))}

          {loading && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Pensando…
            </div>
          )}
        </div>

        <div className="p-2 border-t">
          <div className="flex gap-1.5">
            <Textarea
              rows={1}
              placeholder="Pergunte algo…"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
              className="min-h-[40px] max-h-32 resize-none text-sm"
            />
            <Button size="icon" onClick={() => send()} disabled={loading || !input.trim()} className="shrink-0 h-10 w-10">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}
