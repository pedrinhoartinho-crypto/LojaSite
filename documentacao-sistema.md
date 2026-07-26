# Documentação Completa - Loja Bela Vista Roleplay

## Arquitetura Geral

```
[Cliente Web] → (HTML/CSS/JS) → [Express Server (Node.js)]
                                        │
                          ┌─────────────┼──────────────┐
                          ▼             ▼              ▼
                     [SQLite DB]   [Open Cloud]   [Discord Webhook]
                     (loja.db)     (Roblox API)    (logs)
                          │
                          ▼
                   [KeyServer.lua] ← (poling HTTP) ─┘
                          │
                   [Roblox DataStore]
                   (SistemaChavesV3)
                          │
                   [KeyClient.lua]
                   (UI do jogador)
```

---

## 1. Store Web (Node.js + Express)

### 1.1 Server Entry - `server.js`

Inicia o Express, carrega rotas, checa se banco está vazio (auto-seed com `src/seed.js`), inicia limpeza de pedidos expirados a cada 60s.

- Porta: `process.env.PORT || 3000`
- Bind: `0.0.0.0`

### 1.2 Database - `src/database.js`

SQLite via `sql.js`. Tabelas:

| Tabela | Função |
|---|---|
| `produtos` | Catálogo de itens à venda (34 produtos) |
| `pedidos` | Compras realizadas (status: pendente, concluido, cancelado, expirado) |
| `keys_emitidas` | Keys geradas com dados do prêmio |

**Auto-seed:** No primeiro deploy (banco vazio), `server.js` chama `src/seed.js` para popular os 34 produtos.

### 1.3 Rotas

#### `GET /api/produtos` - Lista produtos ativos para a loja

#### `POST /api/pedidos` - Criar pedido (Opção B)
- Calcula valor final com incremento de centavos único (evita pedidos com Pix idêntico)
- Incremento: 1 a 90 centavos (baseado em pedidos pendentes com mesmo subtotal)
- Expira em: 1440 min (1 dia)
- Retorna dados do Pix (`chave`, `tipo`, `recebedor`)

#### `GET /api/pedidos/email/:email` - Pedidos por email (requer `?email=...` para autenticação)

#### `GET /api/pedidos/:numero` - Detalhe do pedido (requer `?email=...`)

#### Admin (Bearer Token: `TOKEN_ADMIN` do .env)

| Rota | Função |
|---|---|
| `GET /api/admin/pagamentos?page=1` | Lista todos pedidos (paginação) |
| `GET /api/admin/pagamentos/pendentes` | Apenas pendentes |
| `POST /api/admin/confirmar-pagamento` | Confirma pagamento → gera key |
| `POST /api/admin/cancelar-pedido` | Cancela + limpa key |
| `POST /api/admin/excluir-pedido` | Remove do banco permanentemente |
| `POST /api/admin/importar-chave` | Roblox KeyServer salva key gerada por ele |
| `POST /api/admin/usar-chave` | Resgata key (usado pelo jogo como fallback) |
| `GET /api/admin/produtos` | Lista todos (ativos/inativos) |
| `POST /api/admin/produtos` | Criar produto |
| `PATCH /api/admin/produtos/:id` | Editar produto |
| `PATCH /api/admin/produtos/:id/ativo` | Ativar/desativar |
| `POST /api/admin/produtos/:id/upload-imagem` | Upload de imagem |

### 1.4 Geração de Key - `src/services/opencloud.js`

```javascript
function openCloudConfigurado() {
  return API_KEY && ... && !API_KEY.startsWith('NVA9');
}
```

**IMPORTANTE:** A função desativa Open Cloud se a key começa com `NVA9`. A key real no `.env` começa com `NVA9`, então Open Cloud está **desabilitado**. Keys são salvas **apenas no SQLite** local (ou no servidor web).

`gerarEGravarKey(premio)`:
1. Gera chave aleatória de 10 caracteres (A-Z, 0-9)
2. Se Open Cloud configurado → tenta salvar no Roblox DataStore
3. Retorna a chave de qualquer forma

---

## 2. Roblox Scripts

### 2.1 KeyServer.lua (Server)

Executado no servidor Roblox. Funções:

#### Poling (a cada 30s)
```lua
GET /api/admin/pagamentos?page=1
```
Procura pedidos com `status == "pendente"` E `chave vazia`.
Quando encontra:
1. Gera chave aleatória de 10 caracteres (lado Roblox)
2. Salva no DataStore `SistemaChavesV3` via `SetAsync(chave, premio)`
3. Chama `POST /api/admin/importar-chave` para registrar no SQLite
4. Envia log no Discord

**Config atual:** `URL_LOJA = "http://localhost:3000"` → **PRECISA SER ALTERADO PARA URL DO RENDER**

#### Comando `/key` (admin apenas)
Syntax: `/key dinheiro [quantidade]`, `/key armas [qtd] [nome]`, `/key carros [nome]`
Gera chave manual e salva no DataStore Roblox.

#### Evento `EventoResgateKey` - Resgate do jogador
Quando jogador resgata:
1. Tenta buscar no DataStore Roblox (`BancoDadosChaves:GetAsync`)
2. Se achar → entrega prêmio e remove do DataStore
3. Se NÃO achar (fallback) → chama `POST /api/usar-chave` no servidor web
4. Se encontrar na web → entrega prêmio

### 2.2 KeyClient.lua (Client)

UI de resgate. Botão no celular do jogo → digita key → `EventoResgateKey:FireServer(key)`.

### 2.3 Fluxo de Resgate

```
Jogador digita key
    │
    ▼
KeyClient → FireServer → KeyServer
    │
    ├─ 1. Busca no DataStore Roblox (SetAsync original via polling)
    │     Se achar → entrega + RemoveAsync
    │
    └─ 2. Fallback: POST /api/usar-chave (servidor web)
          Se achar → entrega (key fica como "usada")
          Se não → "Chave invalida"
```

---

## 3. Fluxo Completo da Venda

```
1. Cliente compra no site
   → POST /api/pedidos → pedido "pendente" no SQLite
   → Vê tela do Pix com valor único (ex: R$ 8,03)

2. Cliente paga o Pix

3. Admin confirma no painel (/admin.html)
   → POST /api/admin/confirmar-pagamento
   → opencloud.gerarEGravarKey(premio)
   → Chave salva no SQLite (keys_emitidas)
   → Pedido vira "concluido"
   → Discord log enviado

4. Jogador usa a chave no jogo
   → KeyClient:FireServer(chave)
   → KeyServer busca no DataStore Roblox (não encontra — Open Cloud desligado)
   → KeyServer chama POST /api/usar-chave (fallback)
   → Servidor web consulta keys_emitidas no SQLite
   → Se key existe e não usada → marca como usada + retorna dados do prêmio
   → KeyServer entrega o prêmio no jogo
```

---

## 4. Problemas Identificados

### 4.1 URL do servidor no KeyServer.lua (LINHA 14)
```lua
local URL_LOJA = "http://localhost:3000"
```
**Problema:** Aponta para localhost. Depois do deploy no Render, precisa ser alterado para a URL real.
**Solução:** Trocar para `https://loja-belavista.onrender.com` (ou a URL que o Render gerar).

### 4.2 Open Cloud desligado
```javascript
!API_KEY.startsWith('NVA9')  // → false
```
**Problema:** A key real começa com `NVA9`, então a condição desliga o Open Cloud. Keys são salvas só no SQLite.
**Impacto:** O DataStore Roblox nunca recebe as keys do admin. O resgate funciona via fallback HTTP (`/api/usar-chave`), que depende do servidor web estar acessível DO Roblox.

### 4.3 Polling do KeyServer vs Admin Confirmation
**Problema:** O KeyServer polia por pedidos "pendentes" sem chave, mas o admin confirma o pagamento e o status muda para "concluído". Então o polling NUNCA encontra nada depois da confirmação admin.
**Realidade:** O polling serve para keys geradas pelo próprio Roblox (sem passar pelo admin), mas o fluxo atual exige confirmação admin.

### 4.4 Servidor web precisa ser acessível do Roblox
O `POST /api/usar-chave` precisa ser chamado de dentro do Roblox. Se o servidor estiver em localhost, não funciona. No Render, funciona normalmente (URL pública).

---

## 5. Resumo das Configs no .env

| Var | Valor | Uso |
|---|---|---|
| `TOKEN_ADMIN` | `BELA_VISTA_ROLEPLAY` | Auth do painel admin + Roblox |
| `PIX_KEY` | `37e74e1d-...` | Chave Pix aleatória |
| `PIX_KEY_TYPE` | `aleatoria` | Tipo da chave |
| `PIX_RECEIVER_NAME` | `Loja Bela Vista Roleplay` | Nome do recebedor |
| `ROBLOX_OPEN_CLOUD_API_KEY` | (key longa) | API Open Cloud (desligado) |
| `UNIVERSE_ID` | `10550048639` | ID do universo Roblox |
| `DISCORD_WEBHOOK_URL` | URL do webhook | Logs de venda |
| `ORDER_EXPIRATION_MINUTES` | `1440` | Expiração do pedido |

---

## 6. Estrutura de Arquivos

```
LojaBelaVista/
├── server.js                  # Entry point
├── .env                       # Config (NÃO vai pro git)
├── loja.db                    # SQLite (NÃO vai pro git)
├── render.yaml                # Config do Render
├── KeyServer.lua              # Roblox server (poling, resgate)
├── KeyClient.lua              # Roblox client (UI)
├── public/
│   ├── index.html             # Loja frontend
│   ├── pedido.html            # Página do pedido
│   ├── admin.html             # Painel admin
│   ├── css/estilo.css         # Estilos
│   ├── js/loja.js             # Lógica frontend
│   └── uploads/               # Imagens dos produtos
├── src/
│   ├── database.js            # SQLite schema + queries
│   ├── seed.js                # Catálogo inicial (34 produtos)
│   ├── routes/
│   │   ├── produtos.js        # GET /api/produtos
│   │   ├── pedidos.js         # POST /api/pedidos + GET /email/:numero
│   │   ├── admin.js           # CRUD admin + confirmação/cancelamento
│   │   └── webhook.js         # Vazio (rota removida)
│   ├── services/
│   │   └── opencloud.js       # Open Cloud API (desligado)
│   └── middleware/
│       └── auth.js            # Bearer token validation
```

---

## 7. Para Debug

- **Logs do servidor:** Rodar `node server.js` no terminal (local) ou ver logs no Render dashboard
- **Discord:** Webhook envia logs de venda confirmada
- **Roblox:** `print("[LOJA] ...")` aparece no Output do Roblox Studio
- **Polling:** KeyServer loga `"[LOJA] Chave importada:"` quando processa
