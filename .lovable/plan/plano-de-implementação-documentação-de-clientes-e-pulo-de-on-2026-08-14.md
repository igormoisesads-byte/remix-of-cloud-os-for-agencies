# Plano de Implementação - Documentação de Clientes e Pulo de Onboarding

Adição de uma funcionalidade para gerenciar documentos de clientes (contratos, propostas, etc.) integrando com Cloudflare R2 e a possibilidade de marcar o onboarding de um cliente como concluído/pular.

## Alterações no Banco de Dados

### Nova Tabela: `client_documents`
```sql
CREATE TABLE public.client_documents (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id uuid REFERENCES public.clients(id) ON DELETE CASCADE NOT NULL,
    title text NOT NULL,
    type text NOT NULL, -- 'contrato', 'proposta', 'documento', 'outro'
    url text NOT NULL, -- Link público do R2
    file_name text,
    file_size integer,
    created_by uuid REFERENCES auth.users(id),
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

GRANT ALL ON public.client_documents TO authenticated;
GRANT ALL ON public.client_documents TO service_role;
ALTER TABLE public.client_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage documents of their clients" ON public.client_documents
    FOR ALL TO authenticated USING (true);
```

### Alteração na Tabela: `clients`
```sql
ALTER TABLE public.clients ADD COLUMN onboarding_skipped boolean DEFAULT false;
```

## Componentes e Funcionalidades

### 1. Gestão de Documentos (R2)
- Criar a aba "Documentos" em `src/routes/_authenticated/clientes.$id.tsx`.
- Implementar upload de arquivos para o R2 usando `uploadToR2`.
- Listar documentos com metadados (tipo, data, tamanho).
- Opção para baixar ou excluir documentos.

### 2. Pular Onboarding
- Adicionar um campo "Onboarding Concluído" no diálogo de edição do cliente (`EditClientDialog`).
- Ao marcar como concluído, o status do cliente deve ser atualizado para `ativo` (se estiver em `onboarding`) e a flag `onboarding_skipped` setada como `true`.
- Mostrar um indicador visual na sidebar ou cabeçalho do cliente se o onboarding foi pulado/concluído.

## Detalhes Técnicos
- **R2 Storage**: Utilizar a infraestrutura já existente (`src/lib/upload-r2.ts`) para salvar documentos na pasta `documents/{client_id}/`.
- **UI**: Utilizar componentes Shadcn (Table, Dialog, Button, Badge) para a interface de documentos.
- **Server Functions**: Se necessário, criar funções em `src/lib/clients.functions.ts` para lógica complexa de transição de status.

## Próximos Passos
1. Executar as migrações SQL no banco de dados via console Lovable.
2. Criar a interface de Documentos em `clientes.$id.tsx`.
3. Adicionar o controle de onboarding no diálogo de edição.
