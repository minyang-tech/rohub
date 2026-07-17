# Rohub 설정 가이드

Rohub는 Roblox Studio 플러그인, 로컬 에이전트, 중앙 서버를 나눠서 동작합니다.
Roblox Studio 플러그인은 직접 `.rbxl` 파일을 읽거나 쓰지 않고, 로컬 PC에서 실행 중인 `local-agent.js`에 요청만 보냅니다.

## MVP 실행

터미널 1:

```powershell
node .\central-server.js
```

터미널 2:

```powershell
node .\local-agent.js serve
```

데스크톱 프리뷰:

```powershell
npm run preview:desktop
```

Electron 앱:

```powershell
npm run desktop
```

Windows `.exe` 배포본:

```powershell
npm run dist:win
```

빌드가 완료되면 `release/Rohub-<version>-Windows.exe` 파일이 생성됩니다.

Roblox Studio 플러그인은 저장소 루트의 `roblox-plugin.luau`를 Local Plugin으로 등록해서 사용합니다.

## CLI 사용

상태 확인:

```powershell
node .\local-agent.js status --central http://127.0.0.1:7070 --channel main --file .\main.rbxlx
```

로컬 변경사항 보내기:

```powershell
node .\local-agent.js push --central http://127.0.0.1:7070 --channel main --file .\main.rbxlx
```

서버 변경사항 받기:

```powershell
node .\local-agent.js pull --central http://127.0.0.1:7070 --channel main --file .\main.rbxlx
```

안전 동기화:

```powershell
node .\local-agent.js sync --central http://127.0.0.1:7070 --channel main --file .\main.rbxlx
```

## HTTP API

local-agent:

- `POST /status`
- `POST /push`
- `POST /pull`
- `POST /sync`

central-server:

- `GET /v1/channels/:channel/status`
- `POST /v1/handshake`
- `POST /v1/channels/:channel/file`
- `GET /v1/channels/:channel/file`
- `POST /v1/channels/:channel/compare`
- `POST /v1/channels/:channel/default`

## 현재 데스크톱 프리뷰 흐름

1. `npm run start:central` 실행
2. `npm run start:agent` 실행
3. `npm run preview:desktop` 실행
4. 프로젝트 파일 경로와 채널 입력
5. `Status`로 상태 확인
6. 필요에 따라 `Push local`, `Pull remote`, `Safe sync` 실행

## 현재 Electron 앱 흐름

1. `npm run desktop` 또는 빌드된 `.exe` 실행
2. 앱이 내부에서 `local-agent`와 기본 `central-server`를 자동 시작
3. `File > Select Roblox File` 또는 `Browse` 버튼으로 프로젝트 파일 선택
4. `Sync > Status` 또는 화면의 `Status` 버튼으로 상태 확인
5. `Sync > Push Local`, `Sync > Pull Remote`, `Sync > Safe Sync` 또는 화면 버튼으로 동기화 실행

## 현재 Roblox Studio 플러그인 흐름

1. Roblox Studio에서 플러그인 열기
2. 중앙 서버 URL, 로컬 에이전트 URL, 채널, 로컬 파일 경로 입력
3. `Status`로 현재 상태 확인
4. `Push local`, `Pull remote`, `Safe sync` 중 필요한 작업만 명시적으로 실행

Push와 Pull은 의도적으로 분리되어 있습니다. 사용자가 명확히 선택하지 않은 상태에서 로컬 파일이나 서버 파일을 자동으로 덮어쓰지 않기 위함입니다.
