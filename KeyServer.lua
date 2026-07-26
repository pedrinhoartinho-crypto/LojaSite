local ServicoJogadores = game:GetService("Players")
local ServicoHttp = game:GetService("HttpService")
local ServicoArmazenamentoReplicado = game:GetService("ReplicatedStorage")
local ServicoArmazenamentoDados = game:GetService("DataStoreService")
local ServicoArmazenamentoServidor = game:GetService("ServerStorage")

local BancoDadosCarros = ServicoArmazenamentoDados:GetDataStore("Temporada2")
local BancoDadosChaves = ServicoArmazenamentoDados:GetDataStore("SistemaChavesV3")
local ModuloInventario = require(ServicoArmazenamentoServidor:WaitForChild("Modules"):WaitForChild("InvModule"))
local Concessionaria = ServicoArmazenamentoReplicado:WaitForChild("Concessionaria")
local VeiculosJogo = Concessionaria:WaitForChild("Veiculos")
local FerramentasJogo = ServicoArmazenamentoServidor:WaitForChild("Tools")

local URL_LOJA = "http://localhost:3000"
local TOKEN_ADMIN = "BELA_VISTA_ROLEPLAY"
local INTERVALO_POLLING = 30
local WebhookDiscord = "https://discord.com/api/webhooks/1514653819357888642/bFYylJvpPKo1Hp4_P2sPpxyhG1pDbyeLaIJT7tvzCGQy2Y7cDcCmHOTLf-Hh1MwchwsR"

local EventoResgate = ServicoArmazenamentoReplicado:FindFirstChild("EventoResgateKey") or Instance.new("RemoteEvent")
EventoResgate.Name = "EventoResgateKey"
EventoResgate.Parent = ServicoArmazenamentoReplicado
local EventoNotificacao = ServicoArmazenamentoReplicado:FindFirstChild("Notify") or Instance.new("RemoteEvent")
EventoNotificacao.Name = "Notify"
EventoNotificacao.Parent = ServicoArmazenamentoReplicado

local ProcessandoChave = {}
local Administradores = { ["menddssz"] = true, ["Arturarruda29"] = true, ["dAntinum"] = true }

local function EnviarNotificacao(Jogador, Texto)
	if Jogador then EventoNotificacao:FireClient(Jogador, Texto) end
end

local function EnviarLogDiscord(Titulo, Campos, Cor)
	if not WebhookDiscord or WebhookDiscord == "" then return end
	pcall(function()
		ServicoHttp:PostAsync(WebhookDiscord, ServicoHttp:JSONEncode({
			embeds = {{ title = Titulo, color = Cor or 15105570, fields = Campos, footer = { text = "Loja Bela Vista Roleplay" }, timestamp = DateTime.now():ToIsoDate() }}
		}), Enum.HttpContentType.ApplicationJson)
	end)
end

local function GerarChaveAleatoria()
	local Caracteres = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
	local Chave = ""
	for i = 1, 10 do
		local Pos = math.random(1, #Caracteres)
		Chave = Chave .. string.sub(Caracteres, Pos, Pos)
	end
	return Chave
end

local function CarregarPastaVeiculos(Jogador)
	local Pasta = Jogador:FindFirstChild("Veiculos")
	if not Pasta then Pasta = Instance.new("Folder"); Pasta.Name = "Veiculos"; Pasta.Parent = Jogador end
	for _, Carro in ipairs(VeiculosJogo:GetChildren()) do
		if Carro:IsA("Model") and Carro:FindFirstChild("Config") and not Pasta:FindFirstChild(Carro.Name) then
			local V = Instance.new("BoolValue"); V.Name = Carro.Name; V.Value = false; V.Parent = Pasta
		end
	end
	return Pasta
end

local function SalvarVeiculos(Jogador)
	local Pasta = Jogador:FindFirstChild("Veiculos")
	if not Pasta then return false, "Pasta nao encontrada" end
	local Dados = {}
	for _, Item in ipairs(Pasta:GetChildren()) do
		if Item:IsA("BoolValue") then Dados[Item.Name] = Item.Value end
	end
	local OK, Err = pcall(function() BancoDadosCarros:SetAsync(tostring(Jogador.UserId), { carros = Dados }) end)
	if not OK then return false, tostring(Err) end
	return true
end

local function EntregarDinheiro(Jogador, Quantidade)
	Quantidade = tonumber(Quantidade)
	if not Quantidade or Quantidade <= 0 then return false, "Quantidade invalida" end
	local Atributos = Jogador:FindFirstChild("leaderstats")
	local Dinheiro = Atributos and Atributos:FindFirstChild("Dinheiro")
	if not Dinheiro then return false, "Sistema de dinheiro nao encontrado" end
	Dinheiro.Value += Quantidade
	return true
end

local function EntregarArma(Jogador, NomeItem, Quantidade)
	Quantidade = tonumber(Quantidade) or 1
	if Quantidade < 1 then Quantidade = 1 end
	if not NomeItem or NomeItem == "" then return false, "Nome da arma invalido." end
	if not FerramentasJogo:FindFirstChild(NomeItem) then return false, "A arma " .. NomeItem .. " nao existe no ServerStorage." end
	local Sucesso, Erro = pcall(function()
		ModuloInventario:AddItem(Jogador, NomeItem, Quantidade)
	end)
	if not Sucesso then return false, "Falha ao colocar a arma no inventario." end
	return true
end

local function EntregarCarro(Jogador, NomeCarro, Quantidade)
	Quantidade = tonumber(Quantidade) or 1
	if Quantidade < 1 then Quantidade = 1 end
	if not NomeCarro or NomeCarro == "" then return false, "Nome invalido" end
	if not VeiculosJogo:FindFirstChild(NomeCarro) then return false, "Veiculo " .. NomeCarro .. " nao existe" end
	for i = 1, Quantidade do
		local Pasta = CarregarPastaVeiculos(Jogador)
		local V = Pasta:FindFirstChild(NomeCarro)
		if not V then V = Instance.new("BoolValue"); V.Name = NomeCarro; V.Parent = Pasta end
		if not V.Value then V.Value = true; local OK, Err = SalvarVeiculos(Jogador); if not OK then return false, Err end end
	end
	return true
end

local function ObterDescricaoPremio(Premio)
	if Premio.tipo == "dinheiro" then return "R$ " .. tostring(Premio.amount) end
	if Premio.tipo == "armas" then
		local qtd = tonumber(Premio.quantidade) or 1
		if qtd > 1 then return tostring(Premio.item) .. " x" .. qtd end
		return tostring(Premio.item)
	end
	if Premio.tipo == "carros" then return tostring(Premio.car) end
	return "Desconhecido"
end

local function FazerRequisicaoLoja(Metodo, Rota, DadosEnvio)
	local Cabecalhos = { ["Content-Type"] = "application/json" }
	if TOKEN_ADMIN and TOKEN_ADMIN ~= "SEU_TOKEN_ADMIN_AQUI" then Cabecalhos["Authorization"] = "Bearer " .. TOKEN_ADMIN end
	local OK, Res = pcall(function()
		return ServicoHttp:RequestAsync({ Url = URL_LOJA .. Rota, Method = Metodo, Headers = Cabecalhos, Body = DadosEnvio and ServicoHttp:JSONEncode(DadosEnvio) or nil })
	end)
	if not OK then return nil end
	if Res.Success and Res.StatusCode == 200 then
		local Dec, Dados = pcall(function() return ServicoHttp:JSONDecode(Res.Body) end)
		if Dec then return Dados end
	end
	return nil
end

local function SincronizarLoja()
	local OK, Dados = FazerRequisicaoLoja("GET", "/api/admin/pagamentos?page=1")
	if not OK or not Dados or not Dados.dados then return end
	for _, Pag in ipairs(Dados.dados) do
		if Pag.status == "pendente" and (not Pag.chave or Pag.chave == "") then
			local Premio = {}
			if Pag.produto_tipo == "dinheiro" then Premio = { tipo = "dinheiro", amount = Pag.item_quantidade or 0 }
			elseif Pag.produto_tipo == "armas" then Premio = { tipo = "armas", item = Pag.item_nome or Pag.produto_nome, quantidade = Pag.item_quantidade or 1 }
			elseif Pag.produto_tipo == "carros" then Premio = { tipo = "carros", car = Pag.item_nome or Pag.produto_nome, quantidade = Pag.item_quantidade or 1 }
			else Premio = { tipo = "dinheiro", amount = 0 } end
			local Chave = GerarChaveAleatoria()
			local Salvo = pcall(function() BancoDadosChaves:SetAsync(Chave, Premio) end)
			if Salvo then
				local Conf = FazerRequisicaoLoja("POST", "/api/admin/importar-chave", { pagamento_id = Pag.id, chave = Chave })
				if Conf and Conf.success then
					print("[LOJA] Chave importada: " .. Chave .. " - " .. (Pag.produto_nome or "?"))
					EnviarLogDiscord("VENDA CONCLUIDA", {
						{ name = "Comprador", value = Pag.comprador_nome, inline = false },
						{ name = "Produto", value = tostring(Pag.produto_nome), inline = true },
						{ name = "Chave", value = Chave, inline = true },
						{ name = "Pedido #", value = tostring(Pag.pedido_numero or Pag.id), inline = true }
					}, 16091611)
				end
			end
		end
	end
end

coroutine.wrap(function()
	while true do task.wait(INTERVALO_POLLING); pcall(SincronizarLoja) end
end)()

ServicoJogadores.PlayerAdded:Connect(function(Jogador)
	CarregarPastaVeiculos(Jogador)
	Jogador.Chatted:Connect(function(Msg)
		local Parts = string.split(Msg, " ")
		if Parts[1] == "/key" and Administradores[Jogador.Name] then
			local Tipo = string.lower(Parts[2] or "")
			local Premio = {}
			if Tipo == "dinheiro" then
				local V = tonumber(Parts[3])
				if not V then EnviarNotificacao(Jogador, "Uso: /key dinheiro [quantidade]"); return end
				Premio = { tipo = "dinheiro", amount = V }
			elseif Tipo == "armas" or Tipo == "carros" then
				local Quantidade = 1
				local IndiceInicioNome = 3
				if Tipo == "armas" and tonumber(Parts[3]) then
					Quantidade = tonumber(Parts[3])
					IndiceInicioNome = 4
				end
				local PartesNome = {}
				for Indice = IndiceInicioNome, #Parts do
					table.insert(PartesNome, Parts[Indice])
				end
				local NomeFinal = table.concat(PartesNome, " ")
				if NomeFinal == "" then
					EnviarNotificacao(Jogador, "Uso: /key " .. Tipo .. " [quantidade opcional] [nome]")
					return
				end
				Premio.tipo = Tipo
				Premio.item = NomeFinal
				Premio.car = NomeFinal
				if Tipo == "armas" then
					Premio.quantidade = Quantidade
				end
			else
				EnviarNotificacao(Jogador, "Categorias: dinheiro, armas, carros"); return
			end
			local Chave = GerarChaveAleatoria()
			if pcall(function() BancoDadosChaves:SetAsync(Chave, Premio) end) then
				EnviarNotificacao(Jogador, "Chave: " .. Chave)
				EnviarLogDiscord("CHAVE GERADA (ADM)", {
					{ name = "Admin", value = Jogador.Name, inline = false },
					{ name = "Chave", value = Chave, inline = false },
					{ name = "Premio", value = ObterDescricaoPremio(Premio), inline = false }
				}, 14196363)
			else
				EnviarNotificacao(Jogador, "Erro ao salvar chave")
			end
		end
	end)
end)

EventoResgate.OnServerEvent:Connect(function(Jogador, ChaveDigitada)
	if typeof(ChaveDigitada) ~= "string" then return end
	ChaveDigitada = string.upper(string.gsub(ChaveDigitada, "[^%w]", ""))
	if #ChaveDigitada ~= 10 or ProcessandoChave[ChaveDigitada] then return end
	ProcessandoChave[ChaveDigitada] = true
	EnviarNotificacao(Jogador, "Processando...")

	local OK, Dados = pcall(function() return BancoDadosChaves:GetAsync(ChaveDigitada) end)
	local Entregue = false

	if OK and Dados then
		if Dados.tipo == "dinheiro" then Entregue, _ = EntregarDinheiro(Jogador, Dados.amount)
		elseif Dados.tipo == "armas" then Entregue, _ = EntregarArma(Jogador, Dados.item, Dados.quantidade or 1)
		elseif Dados.tipo == "carros" then Entregue, _ = EntregarCarro(Jogador, Dados.car, Dados.quantidade or 1) end
		if Entregue then
			pcall(function() BancoDadosChaves:RemoveAsync(ChaveDigitada) end)
			EnviarNotificacao(Jogador, "Premio entregue!")
			EnviarLogDiscord("RESGATE OK", { { name = "Jogador", value = Jogador.Name, inline = false }, { name = "Chave", value = ChaveDigitada, inline = false } }, 16753920)
		else
			EnviarNotificacao(Jogador, "Falha ao entregar premio")
		end
		ProcessandoChave[ChaveDigitada] = nil
		return
	end

	local DadosLoja = FazerRequisicaoLoja("POST", "/api/usar-chave", { chave = ChaveDigitada })
	if DadosLoja and DadosLoja.success then
		if DadosLoja.tipo == "dinheiro" then Entregue, _ = EntregarDinheiro(Jogador, DadosLoja.quantidade)
		elseif DadosLoja.tipo == "armas" then Entregue, _ = EntregarArma(Jogador, DadosLoja.item_nome, DadosLoja.quantidade or 1)
		elseif DadosLoja.tipo == "carros" then Entregue, _ = EntregarCarro(Jogador, DadosLoja.item_nome, DadosLoja.quantidade or 1) end
		if Entregue then EnviarNotificacao(Jogador, "Premio entregue!") else EnviarNotificacao(Jogador, "Falha na entrega") end
	else
		EnviarNotificacao(Jogador, "Chave invalida ou ja usada")
	end
	ProcessandoChave[ChaveDigitada] = nil
end)

print("==========================================")
print("  BELA VISTA ROLEPLAY - SISTEMA DE CHAVES")
print("  Loja: " .. URL_LOJA)
print("  Polling: " .. tostring(INTERVALO_POLLING) .. "s")
print("==========================================")
