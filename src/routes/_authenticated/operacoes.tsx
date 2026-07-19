import { createFileRoute } from "@tanstack/react-router";
import { ClipboardList } from "lucide-react";

export const Route = createFileRoute("/_authenticated/operacoes")({
  component: () => (
    <div className="p-8 max-w-3xl mx-auto">
      <div className="rounded-xl border bg-card p-10 text-center">
        <div className="mx-auto h-12 w-12 rounded-lg bg-primary/20 text-primary flex items-center justify-center mb-4">
          <ClipboardList className="h-6 w-6" />
        </div>
        <h1 className="text-2xl font-bold">Operações</h1>
        <p className="text-muted-foreground mt-2">Kanban de tarefas estilo Trello com clientes, responsáveis e anexos — próxima fase.</p>
      </div>
    </div>
  ),
});
