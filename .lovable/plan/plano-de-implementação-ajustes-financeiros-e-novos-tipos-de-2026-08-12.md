# Plano de Implementação - Ajustes Financeiros e Novos Tipos de Pagamento

Este plano detalha as alterações para permitir a exclusão de mensalidades/despesas, cadastro manual de mensalidades e suporte ao novo modelo de pagamento para "Desenvolvimento" (50% entrada / 50% após período).

## Alterações Funcionais

### 1. Financeiro (Mensalidades e Despesas)
- Adicionar opção de excluir mensalidades no diálogo de detalhes em `src/routes/_authenticated/financeiro.tsx`.
- Criar formulário para cadastro manual de mensalidades (avulsas).
- Garantir que a lógica de exclusão já existente para despesas esteja clara e funcional.

### 2. Cadastro de Clientes (Novo Tipo "Desenvolvimento")
- Atualizar o `NewClientWizard` para incluir o tipo "Desenvolvimento".
- Implementar lógica condicional no wizard: quando "Desenvolvimento" for selecionado, permitir configurar o pagamento em duas parcelas de 50%.
- A primeira parcela (50%) será gerada para o início do contrato ou data de fechamento.
- A segunda parcela (50%) será gerada para uma data específica informada pelo usuário.

### 3. Banco de Dados
- Nenhuma alteração de schema é estritamente necessária, pois a tabela `monthly_fees` já suporta registros arbitrários atrelados a um cliente.

## Detalhes Técnicos

### Financeiro
- Modificar `FeeDetailDialog` em `src/routes/_authenticated/financeiro.tsx` para incluir um botão de "Excluir".
- Adicionar um botão "Nova Mensalidade" na aba de Mensalidades, abrindo um diálogo para selecionar cliente, mês de referência, valor e vencimento.

### Wizard de Novo Cliente
- Adicionar a opção `desenvolvimento` ao `Select` de tipos em `src/components/new-client-wizard.tsx`.
- No passo financeiro, se o tipo for `desenvolvimento`, mostrar campos para:
  - Valor Total do Projeto.
  - Data da 2ª parcela (o valor será 50% do total).
- Ajustar a função `submit` para gerar apenas esses dois registros na tabela `monthly_fees` em vez do loop de mensalidades padrão.

## Verificação e Testes
- Validar a exclusão de uma mensalidade e verificar se o total do dashboard financeiro é atualizado.
- Criar um cliente do tipo "Desenvolvimento" e confirmar se as duas parcelas de 50% foram geradas corretamente no financeiro.
- Testar o cadastro manual de uma mensalidade avulsa para um cliente existente.
