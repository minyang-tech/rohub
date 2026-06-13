-- Save this Script as a local Roblox Studio plugin.
-- It talks to local-agent.js; the plugin itself does not read or write .rbxl files.

local HttpService = game:GetService("HttpService")

assert(plugin, "This script must be run as a Roblox Studio plugin")

local SETTINGS_PREFIX = "RbxlChannelSync."

local function setting(name, fallback)
	local value = plugin:GetSetting(SETTINGS_PREFIX .. name)
	if value == nil or value == "" then
		return fallback
	end
	return value
end

local function setSetting(name, value)
	plugin:SetSetting(SETTINGS_PREFIX .. name, value)
end

local toolbar = plugin:CreateToolbar("RBXL Channel Sync")
local openButton = toolbar:CreateButton(
	"RBXL Channel Sync",
	"Open RBXL channel sync",
	"rbxasset://textures/StudioSharedUI/Save.png"
)

local widgetInfo = DockWidgetPluginGuiInfo.new(
	Enum.InitialDockState.Float,
	false,
	false,
	460,
	520,
	360,
	320
)

local widget = plugin:CreateDockWidgetPluginGuiAsync("RbxlChannelSyncWidget", widgetInfo)
widget.Title = "RBXL Channel Sync"

local root = Instance.new("Frame")
root.BackgroundColor3 = Color3.fromRGB(34, 37, 43)
root.BorderSizePixel = 0
root.Size = UDim2.fromScale(1, 1)
root.Parent = widget

local scroll = Instance.new("ScrollingFrame")
scroll.BackgroundTransparency = 1
scroll.BorderSizePixel = 0
scroll.Size = UDim2.fromScale(1, 1)
scroll.CanvasSize = UDim2.fromOffset(0, 0)
scroll.AutomaticCanvasSize = Enum.AutomaticSize.Y
scroll.ScrollBarThickness = 6
scroll.Parent = root

local padding = Instance.new("UIPadding")
padding.PaddingTop = UDim.new(0, 12)
padding.PaddingBottom = UDim.new(0, 12)
padding.PaddingLeft = UDim.new(0, 12)
padding.PaddingRight = UDim.new(0, 12)
padding.Parent = scroll

local layout = Instance.new("UIListLayout")
layout.FillDirection = Enum.FillDirection.Vertical
layout.Padding = UDim.new(0, 8)
layout.SortOrder = Enum.SortOrder.LayoutOrder
layout.Parent = scroll

local function makeLabel(text, order)
	local label = Instance.new("TextLabel")
	label.BackgroundTransparency = 1
	label.Font = Enum.Font.SourceSansSemibold
	label.Text = text
	label.TextColor3 = Color3.fromRGB(230, 234, 241)
	label.TextSize = 15
	label.TextXAlignment = Enum.TextXAlignment.Left
	label.Size = UDim2.new(1, 0, 0, 20)
	label.LayoutOrder = order
	label.Parent = scroll
	return label
end

local function makeTextBox(name, text, placeholder, order, secret)
	makeLabel(name, order)

	local box = Instance.new("TextBox")
	box.BackgroundColor3 = Color3.fromRGB(246, 248, 252)
	box.BorderSizePixel = 0
	box.ClearTextOnFocus = false
	box.Font = Enum.Font.Code
	box.PlaceholderText = placeholder
	box.Text = text
	box.TextColor3 = Color3.fromRGB(26, 29, 34)
	box.PlaceholderColor3 = Color3.fromRGB(120, 127, 140)
	box.TextSize = 14
	box.TextXAlignment = Enum.TextXAlignment.Left
	box.Size = UDim2.new(1, 0, 0, 30)
	box.LayoutOrder = order + 1
	box.Parent = scroll

	local boxPadding = Instance.new("UIPadding")
	boxPadding.PaddingLeft = UDim.new(0, 8)
	boxPadding.PaddingRight = UDim.new(0, 8)
	boxPadding.Parent = box

	if secret then
		box.Text = text
	end

	return box
end

local centralUrlBox = makeTextBox(
	"Central server URL",
	setting("centralUrl", "http://127.0.0.1:7070"),
	"http://127.0.0.1:7070",
	1
)

local localAgentUrlBox = makeTextBox(
	"Local agent URL",
	setting("localAgentUrl", "http://127.0.0.1:8787"),
	"http://127.0.0.1:8787",
	3
)

local channelBox = makeTextBox("Channel", setting("channel", "main"), "main", 5)
local filePathBox = makeTextBox("Local .rbxl/.rbxlx path", setting("filePath", ""), "C:\\path\\main.rbxlx", 7)
local agentTokenBox = makeTextBox("Local agent token (optional)", setting("agentToken", ""), "", 9, true)
local centralTokenBox = makeTextBox("Central token (optional)", setting("centralToken", ""), "", 11, true)

local syncButton = Instance.new("TextButton")
syncButton.BackgroundColor3 = Color3.fromRGB(0, 125, 255)
syncButton.BorderSizePixel = 0
syncButton.Font = Enum.Font.SourceSansSemibold
syncButton.Text = "Sync channel"
syncButton.TextColor3 = Color3.fromRGB(255, 255, 255)
syncButton.TextSize = 16
syncButton.Size = UDim2.new(1, 0, 0, 34)
syncButton.LayoutOrder = 13
syncButton.Parent = scroll

local statusLabel = Instance.new("TextLabel")
statusLabel.BackgroundTransparency = 1
statusLabel.Font = Enum.Font.SourceSans
statusLabel.Text = "Ready."
statusLabel.TextColor3 = Color3.fromRGB(213, 218, 226)
statusLabel.TextSize = 14
statusLabel.TextWrapped = true
statusLabel.TextXAlignment = Enum.TextXAlignment.Left
statusLabel.TextYAlignment = Enum.TextYAlignment.Top
statusLabel.Size = UDim2.new(1, 0, 0, 90)
statusLabel.LayoutOrder = 14
statusLabel.Parent = scroll

local function trimSlash(value)
	return string.gsub(value, "/+$", "")
end

local function status(text)
	statusLabel.Text = text
end

local function saveSettings()
	setSetting("centralUrl", centralUrlBox.Text)
	setSetting("localAgentUrl", localAgentUrlBox.Text)
	setSetting("channel", channelBox.Text)
	setSetting("filePath", filePathBox.Text)
	setSetting("agentToken", agentTokenBox.Text)
	setSetting("centralToken", centralTokenBox.Text)
end

local busy = false

local function syncChannel()
	if busy then
		return
	end

	busy = true
	syncButton.Text = "Syncing..."
	status("Talking to local agent...")

	saveSettings()

	local headers = {
		["Content-Type"] = "application/json",
	}

	if agentTokenBox.Text ~= "" then
		headers["Authorization"] = "Bearer " .. agentTokenBox.Text
	end

	local ok, response = pcall(function()
		return HttpService:RequestAsync({
			Url = trimSlash(localAgentUrlBox.Text) .. "/sync",
			Method = "POST",
			Headers = headers,
			Body = HttpService:JSONEncode({
				centralUrl = centralUrlBox.Text,
				centralToken = centralTokenBox.Text,
				channel = channelBox.Text,
				filePath = filePathBox.Text,
			}),
		})
	end)

	if not ok then
		status("Request failed. Check that HTTP requests are enabled and local-agent.js is running. " .. tostring(response))
	elseif not response.Success then
		status("Local agent error: HTTP " .. tostring(response.StatusCode) .. " " .. tostring(response.Body))
	else
		local decodedOk, decoded = pcall(function()
			return HttpService:JSONDecode(response.Body)
		end)
		if decodedOk and decoded then
			local backup = decoded.backupPath and ("\nBackup: " .. decoded.backupPath) or ""
			local hash = decoded.serverMd5 or decoded.md5 or decoded.localMd5 or ""
			status("Done: " .. tostring(decoded.action) .. "\nChannel: " .. tostring(decoded.channel) .. "\nMD5: " .. tostring(hash) .. backup)
		else
			status("Done, but response was not JSON: " .. tostring(response.Body))
		end
	end

	busy = false
	syncButton.Text = "Sync channel"
end

openButton.Click:Connect(function()
	widget.Enabled = not widget.Enabled
end)

syncButton.MouseButton1Click:Connect(syncChannel)
