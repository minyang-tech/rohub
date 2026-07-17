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
	560,
	360,
	340
)

local widget = plugin:CreateDockWidgetPluginGuiAsync("RbxlChannelSyncWidget", widgetInfo)
widget.Title = "RBXL Channel Sync"

local root = Instance.new("Frame")
root.BackgroundColor3 = Color3.fromRGB(244, 247, 250)
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
	label.TextColor3 = Color3.fromRGB(31, 41, 55)
	label.TextSize = 15
	label.TextXAlignment = Enum.TextXAlignment.Left
	label.Size = UDim2.new(1, 0, 0, 20)
	label.LayoutOrder = order
	label.Parent = scroll
	return label
end

local function makeTextBox(name, text, placeholder, order)
	makeLabel(name, order)

	local box = Instance.new("TextBox")
	box.BackgroundColor3 = Color3.fromRGB(255, 255, 255)
	box.BorderColor3 = Color3.fromRGB(190, 200, 214)
	box.BorderSizePixel = 1
	box.ClearTextOnFocus = false
	box.Font = Enum.Font.Code
	box.PlaceholderText = placeholder
	box.Text = text
	box.TextColor3 = Color3.fromRGB(26, 29, 34)
	box.PlaceholderColor3 = Color3.fromRGB(120, 127, 140)
	box.TextSize = 14
	box.TextXAlignment = Enum.TextXAlignment.Left
	box.Size = UDim2.new(1, 0, 0, 32)
	box.LayoutOrder = order + 1
	box.Parent = scroll

	local boxPadding = Instance.new("UIPadding")
	boxPadding.PaddingLeft = UDim.new(0, 8)
	boxPadding.PaddingRight = UDim.new(0, 8)
	boxPadding.Parent = box

	return box
end

local function makeInfo(text, order)
	local label = Instance.new("TextLabel")
	label.BackgroundTransparency = 1
	label.Font = Enum.Font.SourceSans
	label.Text = text
	label.TextColor3 = Color3.fromRGB(91, 103, 120)
	label.TextSize = 14
	label.TextWrapped = true
	label.TextXAlignment = Enum.TextXAlignment.Left
	label.TextYAlignment = Enum.TextYAlignment.Top
	label.Size = UDim2.new(1, 0, 0, 42)
	label.LayoutOrder = order
	label.Parent = scroll
	return label
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
local agentTokenBox = makeTextBox("Local agent token (optional)", setting("agentToken", ""), "", 9)
local centralTokenBox = makeTextBox("Central token (optional)", setting("centralToken", ""), "", 11)

makeInfo("Use Status first. Push and Pull are intentionally separate so the plugin does not overwrite files without a clear user action.", 13)

local actionButtons = {}

local function makeActionButton(text, order, color)
	local button = Instance.new("TextButton")
	button.BackgroundColor3 = color
	button.BorderSizePixel = 0
	button.Font = Enum.Font.SourceSansSemibold
	button.Text = text
	button.TextColor3 = Color3.fromRGB(255, 255, 255)
	button.TextSize = 16
	button.Size = UDim2.new(1, 0, 0, 34)
	button.LayoutOrder = order
	button.Parent = scroll
	table.insert(actionButtons, button)
	return button
end

local statusButton = makeActionButton("Status", 14, Color3.fromRGB(37, 99, 235))
local pushButton = makeActionButton("Push local", 15, Color3.fromRGB(21, 128, 61))
local pullButton = makeActionButton("Pull remote", 16, Color3.fromRGB(75, 85, 99))
local syncButton = makeActionButton("Safe sync", 17, Color3.fromRGB(180, 83, 9))

local statusLabel = Instance.new("TextLabel")
statusLabel.BackgroundColor3 = Color3.fromRGB(255, 255, 255)
statusLabel.BorderColor3 = Color3.fromRGB(216, 222, 232)
statusLabel.BorderSizePixel = 1
statusLabel.Font = Enum.Font.SourceSans
statusLabel.Text = "Ready."
statusLabel.TextColor3 = Color3.fromRGB(31, 41, 55)
statusLabel.TextSize = 14
statusLabel.TextWrapped = true
statusLabel.TextXAlignment = Enum.TextXAlignment.Left
statusLabel.TextYAlignment = Enum.TextYAlignment.Top
statusLabel.Size = UDim2.new(1, 0, 0, 130)
statusLabel.LayoutOrder = 18
statusLabel.Parent = scroll

local statusPadding = Instance.new("UIPadding")
statusPadding.PaddingTop = UDim.new(0, 8)
statusPadding.PaddingBottom = UDim.new(0, 8)
statusPadding.PaddingLeft = UDim.new(0, 8)
statusPadding.PaddingRight = UDim.new(0, 8)
statusPadding.Parent = statusLabel

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

local function setButtonsEnabled(enabled)
	for _, button in ipairs(actionButtons) do
		button.Active = enabled
		button.AutoButtonColor = enabled
		button.BackgroundTransparency = enabled and 0 or 0.3
	end
end

local function buildBody()
	return {
		centralUrl = centralUrlBox.Text,
		centralToken = centralTokenBox.Text,
		channel = channelBox.Text,
		filePath = filePathBox.Text,
		force = false,
	}
end

local function describeResponse(decoded)
	local state = decoded.stateAfter or decoded.state or "unknown"
	local action = decoded.action or decoded.recommendedAction or "-"
	local hash = decoded.serverMd5 or decoded.md5 or decoded.localMd5 or ""
	local backup = decoded.backupPath and ("\nBackup: " .. tostring(decoded.backupPath)) or ""
	local recommended = decoded.recommendedAction and ("\nRecommended: " .. tostring(decoded.recommendedAction)) or ""

	return "State: "
		.. tostring(state)
		.. "\nAction: "
		.. tostring(action)
		.. recommended
		.. "\nChannel: "
		.. tostring(decoded.channel)
		.. "\nMD5: "
		.. tostring(hash)
		.. backup
end

local busy = false

local function runAction(endpoint, button)
	if busy then
		return
	end

	busy = true
	local originalText = button.Text
	button.Text = originalText .. "..."
	setButtonsEnabled(false)
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
			Url = trimSlash(localAgentUrlBox.Text) .. "/" .. endpoint,
			Method = "POST",
			Headers = headers,
			Body = HttpService:JSONEncode(buildBody()),
		})
	end)

	if not ok then
		status("Request failed. Check that HTTP requests are enabled and local-agent.js is running.\n" .. tostring(response))
	elseif not response.Success then
		status("Local agent error: HTTP " .. tostring(response.StatusCode) .. "\n" .. tostring(response.Body))
	else
		local decodedOk, decoded = pcall(function()
			return HttpService:JSONDecode(response.Body)
		end)
		if decodedOk and decoded then
			status(describeResponse(decoded))
		else
			status("Done, but response was not JSON:\n" .. tostring(response.Body))
		end
	end

	button.Text = originalText
	setButtonsEnabled(true)
	busy = false
end

openButton.Click:Connect(function()
	widget.Enabled = not widget.Enabled
end)

statusButton.MouseButton1Click:Connect(function()
	runAction("status", statusButton)
end)

pushButton.MouseButton1Click:Connect(function()
	runAction("push", pushButton)
end)

pullButton.MouseButton1Click:Connect(function()
	runAction("pull", pullButton)
end)

syncButton.MouseButton1Click:Connect(function()
	runAction("sync", syncButton)
end)
