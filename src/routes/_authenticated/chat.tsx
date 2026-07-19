import { createFileRoute } from "@tanstack/react-router";
import { MessageSquare } from "lucide-react";

export const Route = createFileRoute("/_authenticated/chat")({
  component: () => (
    <div className="p-8 max-w-3xl mx-auto">
      <div className="rounded-xl border bg-card p-10 text-center">
        <div className="mx-auto h-12 w-12 rounded-lg bg-primary/20 text-primary flex items-center justify-center mb-4">
          <MessageSquare className="h-6 w-6" />
        </div>
        <h1 className="text-2xl font-bold">Chat da equipe</h1>
        <p className="text-muted-foreground mt-2">Canais, DMs, grupos e anexos — em construção na próxima fase.</p>
      </div>
    </div>
  ),
});
