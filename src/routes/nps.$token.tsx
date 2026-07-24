import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useState } from "react";
import { toast } from "sonner";
import { Star } from "lucide-react";

export const Route = createFileRoute("/nps/$token")({
  component: PublicNpsPage,
  head: () => ({ meta: [{ title: "Sua opinião importa" }, { name: "description", content: "Deixe seu feedback." }] }),
});

type Q = { id: string; label: string; type: "nps" | "text" | "rating" | "choice"; options?: string[]; required?: boolean };

function PublicNpsPage() {
  const { token } = Route.useParams();
  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [score, setScore] = useState<number | null>(null);
  const [comment, setComment] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [sending, setSending] = useState(false);

  const { data: survey, isLoading } = useQuery({
    queryKey: ["public-survey", token],
    queryFn: async () => {
      const { data } = await supabase.from("nps_surveys").select("id,title,description,questions,active,client_id").eq("public_token", token).maybeSingle();
      return data;
    },
  });

  if (isLoading) return <div className="min-h-screen grid place-items-center text-muted-foreground">Carregando…</div>;
  if (!survey || !survey.active) return <div className="min-h-screen grid place-items-center text-muted-foreground">Formulário indisponível.</div>;

  const questions: Q[] = (survey.questions as any) ?? [];

  async function submit() {
    const npsQ = questions.find((q) => q.type === "nps");
    const finalScore = npsQ ? Number(answers[npsQ.id] ?? score) : score;
    setSending(true);
    const { error } = await supabase.from("nps_survey_responses").insert({
      survey_id: survey!.id,
      client_id: (survey as any).client_id ?? null,
      score: finalScore != null && !Number.isNaN(finalScore) ? finalScore : null,
      answers,
      comment: comment || null,
      respondent_name: name || null,
      respondent_email: email || null,
    });
    setSending(false);
    if (error) { toast.error(error.message); return; }
    setSent(true);
  }


  if (sent) {
    return (
      <div className="min-h-screen grid place-items-center bg-muted/30 p-6">
        <Card className="max-w-md w-full">
          <CardContent className="py-10 text-center space-y-2">
            <div className="text-4xl">🙌</div>
            <h1 className="text-xl font-semibold">Obrigado pelo feedback!</h1>
            <p className="text-sm text-muted-foreground">Sua resposta foi registrada.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted/30 p-6">
      <div className="max-w-2xl mx-auto space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-2xl">{survey.title}</CardTitle>
            {survey.description && <p className="text-sm text-muted-foreground">{survey.description}</p>}
          </CardHeader>
          <CardContent className="space-y-6">
            {questions.map((q) => (
              <div key={q.id} className="space-y-2">
                <label className="text-sm font-medium">{q.label}</label>
                {q.type === "nps" && (
                  <div className="flex flex-wrap gap-1">
                    {Array.from({ length: 11 }).map((_, i) => (
                      <button
                        key={i}
                        onClick={() => { setAnswers({ ...answers, [q.id]: i }); setScore(i); }}
                        className={`h-10 w-10 rounded-md border text-sm font-semibold transition ${answers[q.id] === i ? "bg-primary text-primary-foreground border-primary" : "hover:bg-accent"}`}
                      >{i}</button>
                    ))}
                  </div>
                )}
                {q.type === "rating" && (
                  <div className="flex gap-1">
                    {Array.from({ length: 5 }).map((_, i) => {
                      const v = i + 1;
                      const active = (answers[q.id] ?? 0) >= v;
                      return (
                        <button key={i} onClick={() => setAnswers({ ...answers, [q.id]: v })}>
                          <Star className={`h-8 w-8 ${active ? "fill-amber-400 text-amber-400" : "text-muted-foreground"}`} />
                        </button>
                      );
                    })}
                  </div>
                )}
                {q.type === "text" && (
                  <Textarea value={answers[q.id] ?? ""} onChange={(e) => setAnswers({ ...answers, [q.id]: e.target.value })} />
                )}
                {q.type === "choice" && (
                  <div className="flex flex-wrap gap-2">
                    {(q.options ?? []).map((opt) => (
                      <button
                        key={opt}
                        onClick={() => setAnswers({ ...answers, [q.id]: opt })}
                        className={`px-3 py-1.5 rounded-md border text-sm ${answers[q.id] === opt ? "bg-primary text-primary-foreground border-primary" : "hover:bg-accent"}`}
                      >{opt}</button>
                    ))}
                  </div>
                )}
              </div>
            ))}



            <Button onClick={submit} disabled={sending} className="w-full" size="lg">
              {sending ? "Enviando..." : "Enviar resposta"}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
