# Especificação: Loja Web + Gateway de Pagamento + Geração de Keys para Roblox

## 1. Objetivo

Permitir que um jogador compre um item/produto (dinheiro in-game, arma, carro) em um site,
pague via gateway de pagamento, e receba automaticamente uma **key** que pode resgatar
dentro do jogo Roblox usando o sistema de resgate já existente (RemoteEvent `EventoResgateKey`
→ `BancoDadosChaves` no DataStore).

Hoje a geração de key é manual (comando `/key` de admin). O objetivo é automatizar isso:
compra confirmada → key criada e salva no mesmo DataStore que o jogo já lê.

---

## 2. Visão geral do fluxo

```
[Jogador no site] 
   → escolhe produto (ex: "R$ 50.000 in-game", "Arma X", "Carro Y")
   → checkout no Gateway de Pagamento (Mercado Pago / Stripe / PagBank)
   → Gateway confirma pagamento via Webhook
   → Backend recebe o webhook, valida assinatura
   → Backend gera uma key única (mesmo formato do script: 10 chars A-Z0-9)
   → Backend grava a key no DataStore "SistemaChavesV3" via Roblox Open Cloud API
       (chave = a key gerada; valor = { tipo, amount/item/car } — igual ao que o
        comando /key já grava hoje)
   → Backend salva o pedido no banco próprio (histórico, suporte, antifraude)
   → Site mostra a key pro jogador (e opcionalmente manda por e-mail/Discord)
   → Jogador entra no jogo, cola a key na UI existente → RemoteEvent → 
     script do servidor lê do DataStore normalmente, sem saber que a key
     veio do site em vez do comando /key
```

**Ponto-chave:** o script do servidor no Roblox não muda em nada. Ele já sabe ler
qualquer key que exista em `SistemaChavesV3`. O site só precisa escrever nesse
mesmo DataStore usando a **Roblox Open Cloud API** (não precisa reimplementar
nada dentro do jogo).

---

## 3. Componentes

### 3.1 Frontend (Loja)
- Catálogo de produtos (nome, descrição, preço, imagem, `tipo` + `amount`/`item`/`car`
  — os mesmos campos que o script Lua espera).
- Checkout que redireciona/embute o gateway escolhido.
- Página de "pedido confirmado" que exibe a key após o backend confirmar.
- Login simples (e-mail ou Discord OAuth) para vincular pedido → key → histórico.

### 3.2 Backend / API
- Endpoint para criar pedido (`POST /orders`): salva produto, valor, status = `pendente`.
- Endpoint de webhook do gateway (`POST /webhooks/pagamento`): 
  - valida assinatura/segredo do gateway (obrigatório, ver seção 4).
  - idempotência: se o webhook chegar duplicado, não gerar key duas vezes.
  - ao confirmar pagamento → gera key → chama Open Cloud API → marca pedido como `concluído`.
- Endpoint para o site consultar status do pedido/key.

### 3.3 Gateway de pagamento
- Qualquer um com suporte a Webhooks server-to-server: Mercado Pago, Stripe, PagBank, PayPal.
- Nunca confiar em "retorno do navegador" (redirect de sucesso) para liberar a key —
  isso é falsificável pelo usuário. **Só o webhook assinado libera a key.**

### 3.4 Integração com Roblox — Open Cloud API
Em vez de precisar de um bot/jogador admin logado pra rodar `/key`, o backend escreve
direto no DataStore usando a API oficial:

```
POST https://apis.roblox.com/datastores/v1/universes/{universeId}/standard-datastores/datastore/entries/entry
  ?datastoreName=SistemaChavesV3
  &entryKey=ABC123XYZ0
Headers:
  x-api-key: <chave gerada no Creator Dashboard>
Body:
  { "tipo": "dinheiro", "amount": 50000 }
```

- É preciso criar essa API Key no Creator Dashboard do jogo, com permissão de
  **write** no DataStore `SistemaChavesV3`, escopo restrito ao `universeId` do jogo.
- Essa API key fica só no servidor (nunca no frontend).

### 3.5 Banco de dados próprio (fora do Roblox)
Tabelas sugeridas:
- `produtos` (id, nome, tipo, amount/item/car, preço, ativo)
- `pedidos` (id, usuario, produto_id, status, gateway_transaction_id, key_gerada, criado_em)
- `keys_emitidas` (key, produto_id, pedido_id, usada — espelho local pra auditoria/suporte,
  já que a key "real" some do DataStore assim que é resgatada no jogo)

---

## 4. Segurança (essencial, não opcional)

1. **Validar assinatura do webhook** do gateway (todo gateway sério fornece isso) —
   sem isso, qualquer um pode forjar uma "confirmação de pagamento" e gerar key de graça.
2. **Idempotência**: usar o ID da transação do gateway como chave única, pra não gerar
   2 keys se o webhook for reenviado.
3. **Rate limit** nos endpoints públicos (criação de pedido, consulta de status).
4. **Nunca expor a API key do Roblox Open Cloud** no frontend — só no backend.
5. **Log de auditoria** (você já tem isso parcialmente com o Discord webhook do script Lua —
   pode manter e adicionar uma entrada equivalente do lado do site, ex: "Key X gerada
   pela loja, pedido #123, pago via Mercado Pago").
6. **Evitar colisão de key**: antes de gravar, checar (com Open Cloud `GetAsync` ou
   controle local) se aquela key já existe; se existir, gerar outra.
7. **HTTPS obrigatório** em tudo, inclusive nos webhooks.

---

## 5. Stack sugerida (qualquer uma serve, é só uma sugestão)

- Backend: Node.js (Express/Fastify) ou Python (FastAPI) — ambos têm boas libs
  pra webhooks de gateway e chamadas HTTP pro Open Cloud.
- Banco: PostgreSQL (pedidos/produtos) — simples e confiável pra esse volume.
- Fila (opcional, se o volume crescer): pra desacoplar "webhook recebido" de
  "gravar no Open Cloud", evitando timeout no gateway se a API do Roblox demorar.
- Frontend: qualquer framework (Next.js é uma escolha comum e simples de hospedar).

---

## 6. O que passar pro agente de IA implementar

Ao entregar isso pra uma IA agent, vale anexar também:
- O script Lua do servidor (geração/resgate de key) — já mostra o formato exato
  de key e da tabela salva no DataStore (`{ tipo, amount/item/car }`).
- O script Lua do cliente (UI de resgate) — mostra que não precisa mudar nada
  no jogo, só o backend do site.
- Este documento como a especificação de arquitetura/fluxo/segurança.

Peça pra IA agent gerar primeiro: modelo de dados (produtos/pedidos), depois o
endpoint de webhook com idempotência e validação de assinatura, depois a
integração com Open Cloud, e só por último o frontend da loja.
