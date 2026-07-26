# Catálogo de Produtos + Fluxo de Confirmação Manual (Opção B) + Quantidade em Armas

## 0. Instrução pro agente (resumo do que fazer)

O site/app já está pronto. **Não mude a estrutura do projeto, não recrie nada.**
As mudanças pedidas são:

1. Trocar o sistema de pagamento de **gateway automático** para **Pix manual com confirmação
   em painel admin**, usando o algoritmo de "valor único por pedido pendente" (seção 3).
2. Popular o catálogo de produtos com a lista da seção 1.
3. Adicionar suporte a **quantidade** na compra de armas (seção 4) — carros e dinheiro
   continuam sendo compra única (sem seletor de quantidade).
4. Atualizar **apenas as variáveis relacionadas ao Pix no `.env`** (seção 6) — todo o
   resto do `.env` (banco de dados, DataStore, Open Cloud, `ADMIN_TOKEN`, etc.) já está
   preenchido e não deve ser tocado.

---

## 1. Catálogo de produtos

### 1.1 Armas

IA2 no mesmo patamar dos fuzis normais (AK47/AR15/M4A1).

| Item (nome no jogo) | Preço unitário (R$) |
|---|---|
| Glock | 4,00 |
| Uzi | 5,00 |
| MT40 | 6,00 |
| PistolaJapan | 6,00 |
| PistolaSilenciada | 7,00 |
| AK47 | 8,00 |
| AR15 | 8,00 |
| M4A1 | 8,00 |
| IA2 | 8,00 |
| FuzilHey | 10,00 |
| FuzilPinkGlitch | 12,00 |
| FuzilRedPhantom | 12,00 |

### 1.2 Veículos

Removidos da loja: **160, Type e Fusc** — são carros iniciais/de largada, não fazem parte
do catálogo de venda.

Ordenado pela lógica de valor real (referências assumidas com base no nome — avise se
algum não bater com o que o item realmente é no jogo).

| Item (nome no jogo) | Referência real (assumida) | Preço (R$) |
|---|---|---|
| novus | carro popular/econômico | 5,00 |
| Twin | carro compacto de entrada | 6,00 |
| MK4 | Toyota Supra Mk4 | 12,00 |
| Mecedes | Mercedes sedã (linha comum) | 12,00 |
| Mecha GT | esportivo genérico | 13,00 |
| MT x7 | SUV médio | 14,00 |
| BWX N4 | BMW linha esportiva (M4) | 15,00 |
| X7 | BMW X7 (SUV de luxo) | 18,00 |
| R40 | esportivo/turbo japonês | 20,00 |
| Cybertruck | Tesla Cybertruck | 22,00 |
| G63 | Mercedes-AMG G63 | 24,00 |
| porch 911 | Porsche 911 | 28,00 |
| Nison GTX | Nissan GT-R | 30,00 |
| 458 | Ferrari 458 | 32,00 |
| Aston | Aston Martin | 34,00 |
| mac | McLaren | 35,00 |
| Purosangue | Ferrari Purosangue (hiper-SUV) | 40,00 |

### 1.3 Dinheiro in-game

| Pacote | Valor entregue | Preço (R$) |
|---|---|---|
| Pacote P | R$ 10.000 | 4,00 |
| Pacote M | R$ 25.000 | 8,00 |
| Pacote G | R$ 60.000 | 15,00 |
| Pacote GG | R$ 175.000 | 35,00 |
| Pacote Máximo | R$ 400.000 | 70,00 |

### 1.4 JSON pronto pro agente popular o banco/catálogo

```json
[
  { "tipo": "armas", "item": "Glock", "preco": 4.00 },
  { "tipo": "armas", "item": "Uzi", "preco": 5.00 },
  { "tipo": "armas", "item": "MT40", "preco": 6.00 },
  { "tipo": "armas", "item": "PistolaJapan", "preco": 6.00 },
  { "tipo": "armas", "item": "PistolaSilenciada", "preco": 7.00 },
  { "tipo": "armas", "item": "AK47", "preco": 8.00 },
  { "tipo": "armas", "item": "AR15", "preco": 8.00 },
  { "tipo": "armas", "item": "M4A1", "preco": 8.00 },
  { "tipo": "armas", "item": "IA2", "preco": 8.00 },
  { "tipo": "armas", "item": "FuzilHey", "preco": 10.00 },
  { "tipo": "armas", "item": "FuzilPinkGlitch", "preco": 12.00 },
  { "tipo": "armas", "item": "FuzilRedPhantom", "preco": 12.00 },

  { "tipo": "carros", "car": "novus", "preco": 5.00 },
  { "tipo": "carros", "car": "Twin", "preco": 6.00 },
  { "tipo": "carros", "car": "MK4", "preco": 12.00 },
  { "tipo": "carros", "car": "Mecedes", "preco": 12.00 },
  { "tipo": "carros", "car": "Mecha GT", "preco": 13.00 },
  { "tipo": "carros", "car": "MT x7", "preco": 14.00 },
  { "tipo": "carros", "car": "BWX N4", "preco": 15.00 },
  { "tipo": "carros", "car": "X7", "preco": 18.00 },
  { "tipo": "carros", "car": "R40", "preco": 20.00 },
  { "tipo": "carros", "car": "Cybertruck", "preco": 22.00 },
  { "tipo": "carros", "car": "G63", "preco": 24.00 },
  { "tipo": "carros", "car": "porch 911", "preco": 28.00 },
  { "tipo": "carros", "car": "Nison GTX", "preco": 30.00 },
  { "tipo": "carros", "car": "458", "preco": 32.00 },
  { "tipo": "carros", "car": "Aston", "preco": 34.00 },
  { "tipo": "carros", "car": "mac", "preco": 35.00 },
  { "tipo": "carros", "car": "Purosangue", "preco": 40.00 },

  { "tipo": "dinheiro", "amount": 10000, "preco": 4.00 },
  { "tipo": "dinheiro", "amount": 25000, "preco": 8.00 },
  { "tipo": "dinheiro", "amount": 60000, "preco": 15.00 },
  { "tipo": "dinheiro", "amount": 175000, "preco": 35.00 },
  { "tipo": "dinheiro", "amount": 400000, "preco": 70.00 }
]
```

---

## 2. Fluxo geral (substituindo o gateway automático)

```
Jogador escolhe produto no site (arma: escolhe quantidade também)
  → Backend calcula o subtotal (preço_unitário × quantidade, ou preço fixo pra carro/dinheiro)
  → Backend cria o pedido "pendente" e soma o incremento de centavos único (seção 3)
  → Site mostra: "Pague exatamente R$ X,XX no Pix [chave]"
  → Admin recebe o Pix na conta pessoal (fora do sistema)
  → Admin abre o painel, bate o valor do extrato com o pedido da lista e clica "Confirmar"
  → Backend, automaticamente:
      - marca pedido como "pago"
      - gera a key (10 caracteres A-Z0-9, igual ao script Lua)
      - grava no DataStore SistemaChavesV3 via Open Cloud (incluindo "quantidade" se for arma)
      - exibe/libera a key pro jogador
```

## 3. Algoritmo da "Opção B" (valor único por pedido pendente)

O incremento é calculado **sobre o subtotal já com quantidade aplicada** — o algoritmo não
precisa saber o que é o produto, só agrupa por valor.

```javascript
// subtotal já deve vir calculado como preco_unitario * quantidade (armas)
// ou preco fixo (carros/dinheiro) antes de chamar esta função
async function calcularValorFinal(subtotal) {
  const centavosBase = Math.round(subtotal * 100);

  const pendentesMesmoValor = await db.pedidos.findAll({
    where: { subtotalCentavos: centavosBase, status: "pendente" }
  });

  const incrementosUsados = new Set(
    pendentesMesmoValor.map(p => p.incrementoCentavos)
  );

  let incremento = 1;
  while (incrementosUsados.has(incremento)) {
    incremento++;
  }
  if (incremento > 90) {
    throw new Error("Excesso de pedidos pendentes com mesmo valor base");
  }

  const valorFinalCentavos = centavosBase + incremento;
  return {
    valorFinal: valorFinalCentavos / 100,
    incrementoCentavos: incremento
  };
}
```

Pontos importantes pro agente:
- O incremento só precisa ser único entre pedidos **pendentes** (não pagos/cancelados/expirados).
- Definir expiração do pedido pendente (ex: 30 minutos) — libera o incremento automaticamente.
- Mostrar o valor final com os centavos em destaque (ex: "R$ 80,03") na tela de pagamento.
- Dois produtos diferentes que coincidentemente derem o mesmo subtotal (ex: 10x Glock = 1x
  algum carro de mesmo valor) são tratados normalmente como concorrentes pelo mesmo valor-base
  — cada um recebe um incremento de centavos diferente, sem conflito.

## 4. Quantidade nas armas

- Carrinho/checkout: seletor de quantidade **só aparece pra armas**. Carros e dinheiro
  continuam com botão simples de "comprar" (sem quantidade).
- `subtotal = preço_unitário × quantidade` antes de aplicar o incremento da seção 3.
- O registro salvo no DataStore da key passa a incluir `"quantidade": N` pra armas:
  ```json
  { "tipo": "armas", "item": "AK47", "quantidade": 10 }
  ```

### 4.1 Mudanças no script Lua do servidor (Roblox)

**`EntregarArma`** passa a receber e usar a quantidade:

```lua
local function EntregarArma(Jogador, NomeItem, Quantidade)
	Quantidade = tonumber(Quantidade) or 1
	if Quantidade < 1 then Quantidade = 1 end

	if not NomeItem or NomeItem == "" then
		return false, "Nome da arma invalido."
	end

	if not FerramentasJogo:FindFirstChild(NomeItem) then
		return false, "A arma " .. NomeItem .. " nao existe no ServerStorage."
	end

	local Sucesso, Erro = pcall(function()
		ModuloInventario:AddItem(Jogador, NomeItem, Quantidade)
	end)

	if not Sucesso then
		return false, "Falha ao colocar a arma no inventario."
	end

	return true
end
```

**`ResgatarChave`** passa a quantidade adiante:

```lua
elseif DadosPremio.tipo == "armas" then
    OperacaoConcluida, MensagemErro = EntregarArma(Jogador, DadosPremio.item, DadosPremio.quantidade)
```

**`ObterDescricaoPremio`** mostra a quantidade no log do Discord quando maior que 1:

```lua
local function ObterDescricaoPremio(Premio)
	if Premio.tipo == "dinheiro" then
		return "R$ " .. tostring(Premio.amount)
	elseif Premio.tipo == "armas" then
		local qtd = tonumber(Premio.quantidade) or 1
		if qtd > 1 then
			return tostring(Premio.item) .. " x" .. qtd
		end
		return tostring(Premio.item)
	elseif Premio.tipo == "carros" then
		return tostring(Premio.car)
	end
	return "Desconhecido"
end
```

**Comando `/key` manual** (admin, pro caso de gerar key na mão) aceita quantidade opcional
logo depois do tipo, só pra armas: `/key armas 10 AK47`.

```lua
elseif TipoPremio == "armas" or TipoPremio == "carros" then
    local Quantidade = 1
    local IndiceInicioNome = 3

    if TipoPremio == "armas" and tonumber(PartesMensagem[3]) then
        Quantidade = tonumber(PartesMensagem[3])
        IndiceInicioNome = 4
    end

    local PartesNome = {}
    for Indice = IndiceInicioNome, #PartesMensagem do
        table.insert(PartesNome, PartesMensagem[Indice])
    end
    local NomeFinal = table.concat(PartesNome, " ")

    if NomeFinal == "" then
        EnviarNotificacao(Jogador, "Uso: /key " .. TipoPremio .. " [quantidade opcional] [nome do item]")
        return
    end

    TabelaPremio.tipo = TipoPremio
    TabelaPremio.item = NomeFinal
    TabelaPremio.car = NomeFinal
    if TipoPremio == "armas" then
        TabelaPremio.quantidade = Quantidade
    end
```

## 5. Painel admin — o que precisa ter

Lista de pedidos pendentes com:
- Valor exato a conferir (ex: R$ 80,03)
- Usuário Roblox de destino
- Produto (tipo + item/car/amount + quantidade, se for arma)
- Horário de criação
- Botão **Confirmar pagamento** (dispara a geração automática da key)
- Botão **Cancelar/Expirar** (libera o incremento manualmente se precisar)

Protegido pelo `ADMIN_TOKEN` que já está no `.env`.

---

## 6. Variáveis de `.env` que o agente deve mexer (só estas)

```
# Chave Pix onde os pagamentos são recebidos
PIX_KEY=sua-chave-pix-aqui
PIX_KEY_TYPE=email   # ou cpf, telefone, aleatoria
PIX_RECEIVER_NAME=Nome do recebedor

# Configuração do algoritmo de valor único (Opção B)
ORDER_VALUE_INCREMENT_MAX_CENTS=90
ORDER_EXPIRATION_MINUTES=30
```

Tudo o que já existe no `.env` relacionado a banco de dados, Open Cloud (Roblox), e
`ADMIN_TOKEN` **deve ser mantido como está** — o agente não precisa e não deve mexer nisso.
