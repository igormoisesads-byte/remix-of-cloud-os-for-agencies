import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/termos")({
  head: () => ({
    meta: [
      { title: "Termos de Uso — CloudOS" },
      { name: "description", content: "Termos de uso da plataforma CloudOS." },
    ],
  }),
  component: TermosPage,
});

function TermosPage() {
  return (
    <div className="min-h-screen bg-background py-12 px-4">
      <div className="max-w-3xl mx-auto">
        <Link to="/auth" className="text-sm text-muted-foreground hover:text-foreground">← Voltar para o login</Link>
        <h1 className="text-3xl font-bold tracking-tight mt-4 mb-2">Termos de Uso</h1>
        <p className="text-sm text-muted-foreground mb-8">Última atualização: {new Date().toLocaleDateString("pt-BR")}</p>

        <div className="prose prose-sm max-w-none space-y-6 text-sm leading-relaxed">
          <section>
            <h2 className="text-lg font-semibold mb-2">1. Aceitação</h2>
            <p>Ao acessar e utilizar o CloudOS ("Plataforma"), você concorda integralmente com estes Termos de Uso. Caso não concorde, não utilize a Plataforma.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2">2. Descrição do serviço</h2>
            <p>O CloudOS é um sistema operacional para agências de tráfego pago, oferecendo gestão de clientes, tarefas, financeiro, chat interno, campanhas de mídia paga, relatórios e demais funcionalidades associadas.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2">3. Cadastro e conta</h2>
            <p>O acesso é restrito a usuários autorizados. Você é responsável por manter a confidencialidade das suas credenciais e por todas as atividades realizadas com sua conta. Notifique imediatamente o administrador em caso de uso não autorizado.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2">4. Uso adequado</h2>
            <p>Você concorda em não utilizar a Plataforma para: (a) atividades ilegais; (b) violar direitos de terceiros; (c) enviar conteúdo ofensivo, malicioso ou spam; (d) tentar acessar áreas restritas ou dados de outros usuários; (e) prejudicar o funcionamento do sistema.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2">5. Dados e integrações</h2>
            <p>A Plataforma pode integrar-se com serviços de terceiros (Meta Ads, Google Ads, entre outros). Ao conectar essas integrações, você autoriza o CloudOS a acessar e processar dados dessas contas conforme necessário para prestação do serviço.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2">6. Propriedade intelectual</h2>
            <p>Todo o conteúdo, código, marca e design da Plataforma são de propriedade exclusiva do CloudOS. É vedada a reprodução, distribuição ou modificação sem autorização prévia por escrito.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2">7. Limitação de responsabilidade</h2>
            <p>A Plataforma é fornecida "no estado em que se encontra". Não garantimos disponibilidade ininterrupta e não nos responsabilizamos por danos indiretos decorrentes do uso ou impossibilidade de uso do serviço.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2">8. Encerramento</h2>
            <p>Podemos suspender ou encerrar seu acesso, a qualquer tempo, caso identifiquemos violação destes Termos ou risco à segurança da Plataforma.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2">9. Alterações</h2>
            <p>Podemos atualizar estes Termos periodicamente. Alterações significativas serão comunicadas dentro da própria Plataforma.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2">10. Foro</h2>
            <p>Estes Termos são regidos pelas leis brasileiras. Fica eleito o foro do domicílio do administrador da Plataforma para dirimir eventuais controvérsias.</p>
          </section>
        </div>
      </div>
    </div>
  );
}
