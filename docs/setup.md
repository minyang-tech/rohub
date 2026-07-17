# Rohub 설정 가이드 초안

## 현재 MVP 실행

```powershell
node .\central-server.js
node .\local-agent.js serve
```

Roblox Studio 플러그인은 루트의 `roblox-plugin.luau`를 Local Plugin으로 저장해서 사용합니다.

## 향후 Desktop 앱 흐름

1. Rohub Desktop 실행
2. 프로젝트 파일 또는 Rojo 폴더 선택
3. 중앙 서버 URL과 채널 입력
4. 상태 확인
5. Push / Pull / Sync 실행