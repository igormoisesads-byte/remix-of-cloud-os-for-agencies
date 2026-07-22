# Criativos — Meta Ads com métricas completas + Hook/Body/CTA

## 1. Banco de dados (migração)

Expandir `public.ad_creatives` com colunas para todas as métricas solicitadas:

- Alcance / Freq / CPM / CPP (já parciais)
- `frequency`, `cpp` (custo por mil alcançadas)
- Cliques no link únicos: `unique_link_clicks`, `unique_link_ctr`, `unique_link_cpc`
- Cliques de saída únicos: `unique_outbound_clicks`, `unique_outbound_ctr`, `unique_outbound_cpc`
- Landing page: `landing_page_views`, `cost_per_landing_page_view`
- Checkout: `initiate_checkout`, `cost_per_initiate_checkout`, `initiate_checkout_value`
- Compras: `purchases`, `cost_per_purchase`, `purchase_value`, `roas`
- Vídeo: `video_plays`, `video_p3s`, `video_p75`
- WhatsApp (para local): `messaging_conversations_started`

Índice por `ad_account_id, status`.

## 2. Sync Meta (`src/lib/ads.functions.ts`)

Atualizar a query de `/ads` incluindo `insights` com fields:
`spend,impressions,reach,frequency,cpm,cpp,actions,action_values,unique_actions,cost_per_unique_action_type,unique_ctr,cost_per_unique_click,outbound_clicks,unique_outbound_clicks,cost_per_unique_outbound_click,outbound_clicks_ctr,video_play_actions,video_p75_watched_actions,video_p25_watched_actions`

Mapear cada action_type Meta → coluna. Salvar `purchase_value` a partir de `action_values`. Calcular `roas = purchase_value / spend`.

## 3. Cálculo Hook / Body / CTA (client-side)

Utilitário `src/lib/creative-metrics.ts` que recebe criativo + `clientType` ("local" | "perpetuo") e devolve:

- **playrate_hook** = `p3s / impressions * 100`
- **retencao_hook** = `p75 / p3s * 100`
- **conversao_body**:
  - perpetuo → `landing_page_views / p3s * 100`
  - local → `unique_link_clicks / p3s * 100`
- **retencao_75_body**:
  - perpetuo → `initiate_checkout / landing_page_views * 100`
  - local → `unique_outbound_clicks / unique_link_clicks * 100`
- **medidor_cta**:
  - perpetuo → `purchases / initiate_checkout * 100`
  - local → `messaging_conversations_started / unique_outbound_clicks * 100`

Cada métrica com faixa de saúde (verde ≥ X, amarelo, vermelho) para pintar o card.

## 4. Componente `CreativesGrid` (`src/components/creatives-view.tsx`)

- Filtros: período, conta, campanha, status (ATIVO/PAUSADO), busca por nome
- Ordenação: gasto, ROAS, playrate, CTR
- Grid de cards com thumbnail/preview do criativo, nome, campanha
- Cada card mostra: gasto, impressões, ROAS/CPA, e 5 barras (Hook Playrate, Hook Retenção, Body Conversão, Body 75%, CTA) coloridas conforme faixa
- Modal ao clicar: todas as métricas cruas em tabela + explicação das 5 métricas Hook/Body/CTA para o tipo do cliente
- Cabeçalho mostra somatórios agregados das 5 métricas Hook/Body/CTA (soma dos numeradores/denominadores, não média das taxas)

## 5. Onde aparece

**a) Subpágina no cliente:** aba "Criativos" em `src/routes/_authenticated/clientes.$id.tsx` — usa `clientType` do próprio cliente para escolher fórmulas local vs perpetuo.

**b) Página global:** nova rota `src/routes/_authenticated/criativos.tsx` no menu lateral (Operações), com seletor de cliente no topo. Item de sidebar em `src/components/app-sidebar.tsx`.

**c) Em Performance:** adicionar as 5 barras Hook/Body/CTA agregadas no topo do `performance-view.tsx` do cliente.

## 6. Sem mocks

Zero dados inventados. Se conta não tiver sync recente, mostrar estado vazio com botão "Sincronizar agora".

---

Detalhes técnicos: sem quebrar sync existente (colunas novas nullable, defaults 0). Sem tocar em código de chat, financeiro, PDA, NPS.
