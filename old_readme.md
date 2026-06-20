# RBXL Channel Sync MVP

Roblox Studio plugin + local file agent + central channel server.

이 MVP는 Roblox 공식 공동 편집 기능이나 나이 인증을 우회하지 않습니다. 대신 별도 중앙 서버에 `.rbxl/.rbxlx` 파일 사본을 두고, 버튼을 누르면 채널 handshake, gzip 전송, MD5 비교, 서버 사본 다운로드/로컬 덮어쓰기를 수행합니다.

## 구성

- `central-server.js`: 채널 생성, 서버 사본 저장, MD5 비교, gzip/base64 파일 응답.
- `local-agent.js`: 내 PC의 `.rbxl/.rbxlx` 파일을 읽고 쓰는 로컬 HTTP 에이전트.
- `roblox-plugin.lua`: Roblox Studio 툴바 버튼과 설정 UI. 파일은 직접 건드리지 않고 `local-agent.js`에 요청합니다.

Roblox Studio 플러그인은 보안상 임의 로컬 파일을 조용히 읽거나 덮어쓸 수 없습니다. 그래서 실제 파일 수정은 로컬 에이전트가 담당합니다.

## 빠른 실행

터미널 1:

```powershell
node .\central-server.js
```

터미널 2:

```powershell
node .\local-agent.js serve
```

CLI로 먼저 테스트:

```powershell
node .\local-agent.js sync --central http://127.0.0.1:7070 --channel main --file .\main.rbxlx
```

첫 동기화 동작:

- 채널이 없고 로컬 파일이 있으면 서버에 로컬 파일을 gzip/base64로 업로드합니다.
- 채널이 없고 로컬 파일도 없으면 서버가 기본 파일을 만들고 로컬 파일로 내려받습니다.
- 채널이 있으면 로컬 MD5와 서버 MD5를 비교합니다.
- MD5가 같으면 아무것도 바꾸지 않습니다.
- MD5가 다르면 서버 사본을 내려받아 로컬 파일을 교체하고, 기존 로컬 파일은 `.bak`로 백업합니다.

## Roblox Studio 플러그인 설치

1. Roblox Studio에서 새 Script를 만듭니다.
2. `roblox-plugin.lua` 내용을 붙여넣습니다.
3. Explorer에서 Script 우클릭 후 **Save as Local Plugin**을 선택합니다.
4. Studio의 HTTP 요청이 꺼져 있으면 켭니다.
5. `RBXL Channel Sync` 툴바 버튼을 누릅니다.
6. 값 입력:
   - Central server URL: `http://127.0.0.1:7070`
   - Local agent URL: `http://127.0.0.1:8787`
   - Channel: `main`
   - Local path: 예: `C:\Users\me\Desktop\main.rbxlx`
7. `Sync channel` 버튼을 누릅니다.

## 기본 파일 관련 주의

서버가 자동 생성하는 기본 파일은 fallback으로 최소 `.rbxlx` XML 템플릿을 사용합니다. 실제 바이너리 `.rbxl` 기본 템플릿이 필요하면 아래 중 하나를 배치하세요.

```text
central-data/default.rbxl
central-data/default.rbxlx
```

또는 실행 시:

```powershell
$env:DEFAULT_RBXL_TEMPLATE="C:\path\default.rbxl"
node .\central-server.js
```

## 선택 보안 토큰

로컬/중앙 서버를 다른 사람과 공유할 때는 토큰을 켜세요.

중앙 서버:

```powershell
$env:CENTRAL_TOKEN="change-me"
node .\central-server.js
```

로컬 에이전트:

```powershell
$env:LOCAL_AGENT_TOKEN="local-secret"
node .\local-agent.js serve
```

플러그인 UI에서 `Central token`, `Local agent token`에 같은 값을 입력하면 됩니다.

## API 요약

중앙 서버:

- `POST /v1/handshake` body `{ "channel": "main" }`
- `POST /v1/channels/main/file` body `{ "fileName": "main.rbxlx", "gzipBase64": "..." }`
- `POST /v1/channels/main/default` body `{ "fileName": "main.rbxlx" }`
- `POST /v1/channels/main/compare` body `{ "md5": "..." }`
- `GET /v1/channels/main/file`

로컬 에이전트:

- `POST /sync` body `{ "centralUrl": "http://127.0.0.1:7070", "channel": "main", "filePath": "C:\\path\\main.rbxlx" }`

## 아직 안 만든 것

- 실시간 공동 편집/충돌 병합.
- 서버보다 로컬 파일이 최신일 때 서버로 push하는 정책.
- Roblox 내부 DataModel을 자동 저장하는 기능. Studio 플러그인 API 제한 때문에 별도 저장/파일 경로 기반으로 다룹니다.
