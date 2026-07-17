# Rohub

Rohub는 GitHub Desktop처럼 Roblox 프로젝트 파일의 변경 상태를 확인하고, 팀 채널로 Push/Pull/Sync할 수 있게 만드는 데스크톱 동기화 도구입니다.

현재 단계는 MVP 뼈대입니다. Roblox 공식 공동 편집 기능이나 계정 인증을 대체하지 않고, 별도 중앙 서버에 `.rbxl/.rbxlx` 파일 사본을 저장해 명시적인 버튼 동작으로 동기화합니다.

## 실행 구조

- `central-server.js`: 팀 채널 파일을 저장하는 임시 중앙 서버
- `local-agent.js`: 로컬 `.rbxl/.rbxlx` 파일을 읽고 쓰는 로컬 에이전트
- `apps/desktop`: Electron/브라우저 프리뷰 UI
- `roblox-plugin.luau`: Roblox Studio Local Plugin

## 실행

중앙 서버:

```powershell
npm run start:central
```

로컬 에이전트:

```powershell
npm run start:agent
```

브라우저 프리뷰:

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

## 현재 지원 동작

- 상태 확인
- 로컬 파일 Push
- 서버 파일 Pull
- 안전 Sync
- 충돌 상태 자동 덮어쓰기 차단
- Pull 전 로컬 파일 백업
- Electron 파일 선택 다이얼로그
- Electron 상단 메뉴에서 Status/Push/Pull/Sync 실행
- Electron 실행 시 로컬 에이전트와 기본 중앙 서버 자동 시작
- Windows portable `.exe` 패키징

## 로드맵

자세한 계획은 [ROADMAP.md](./ROADMAP.md)를 참고하세요.
