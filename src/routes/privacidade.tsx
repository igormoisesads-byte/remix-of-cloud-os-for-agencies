import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/privacidade")({
  head: () => ({
    meta: [
      { title: "Política de Privacidade — CloudOS" },
      { name: "description", content: "Política de privacidade e tratamento de dados do CloudOS." },
    ],
  }),
  component: PrivacidadePage,
});

function PrivacidadePage() {
  return (
    <div className="min-h-screen bg-background py-12 px-4">
      <div className="max-w-3xl mx-auto">
        <Link to="/auth" className="text-sm text-muted-foreground hover:text-foreground">← Voltar para o login</Link>
        <h1 className="text-3xl font-bold tracking-tight mt-4 mb-2">Política de Privacidade</h1>
        <p className="text-sm text-muted-foreground mb-8">Última atualização: {new Date().toLocaleDateString("pt-BR")}</p>

        <div className="space-y-6 text-sm leading-relaxed">
          <section>
            <h2 className="text-lg font-semibold mb-2">1. Dados que coletamos</h2>
            <p>Coletamos dados de cadastro (nome, e-mail, cargo), dados operacionais (clientes, tarefas, mensagens, arquivos), dados de integrações autorizadas (contas de anúncios) e dados técnicos de uso (logs, IP, dispositivo).</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2">2. Finalidade</h2>
            <p>Utilizamos os dados para: (a) autenticação e controle de acesso; (b) operação das funcionalidades contratadas; (c) melhoria contínua da Plataforma; (d) suporte técnico; (e) cumprimento de obrigações legais.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2">3. Base legal (LGPD)</h2>
            <p>Tratamos dados com base na execução de contrato, cumprimento de obrigação legal, legítimo interesse e, quando aplicável, no consentimento do titular.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2">4. Compartilhamento</h2>
            <p>Não vendemos dados pessoais. Compartilhamos apenas com prestadores essenciais à operação (hospedagem, banco de dados, provedores de e-mail e integrações autorizadas por você), sempre sob obrigações de confidencialidade.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2">5. Armazenamento e segurança</h2>
            <p>Os dados são armazenados em infraestrutura protegida, com criptografia em trânsito e em repouso, controle de acesso por perfil (RLS) e monitoramento contínuo.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2">6. Direitos do titular</h2>
            <p>Você pode solicitar acesso, correção, portabilidade, anonimização ou exclusão dos seus dados, bem como revogar consentimentos, entrando em contato com o administrador da conta.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2">7. Retenção</h2>
            <p>Mantemos os dados enquanto durar a relação com a agência e pelo prazo necessário ao cumprimento de obrigações legais. Após esse período, os dados são anonimizados ou excluídos.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2">8. Cookies</h2>
            <p>Utilizamos cookies e tecnologias similares estritamente necessários ao funcionamento da Plataforma (sessão, preferências, segurança).</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2">9. Alterações</h2>
            <p>Esta política pode ser atualizada. Alterações relevantes serão comunicadas dentro da Plataforma.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2">10. Contato</h2>
            <p>Dúvidas sobre privacidade devem ser encaminhadas ao administrador da conta CloudOS da sua agência.</p>
          </section>
        </div>
      </div>
    </div>
  );
}
