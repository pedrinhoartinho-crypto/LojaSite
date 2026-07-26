local rs = game:GetService("ReplicatedStorage")

local gui = script.Parent
gui.ResetOnSpawn = false

local bg = gui:WaitForChild("Fundo")
local ev = rs:WaitForChild("EventoResgateKey")
local Icon = require(rs:WaitForChild("Icon"))

local old = Icon.getIcon and Icon.getIcon("ResgatarKey")
if old then
	old:destroy()
end

local icon = Icon.new()

icon:setName("ResgatarKey")
icon:setLabel("")
icon:setImage(8488815688)

icon.selected:Connect(function()
	bg.Visible = true
end)

icon.deselected:Connect(function()
	bg.Visible = false
end)

bg:WaitForChild("BotaoResgatar").MouseButton1Click:Connect(function()
	local key = bg.Key.Text
	key = string.upper(string.gsub(key, "%s+", ""))

	if key == "" then return end

	ev:FireServer(key)
	bg.Key.Text = ""
	icon:deselect()
end)