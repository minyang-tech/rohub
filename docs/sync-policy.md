# Rohub 동기화 정책

## 원칙

- 로컬 파일은 자동으로 삭제하지 않습니다.
- 서버 파일로 로컬 파일을 교체해야 할 때는 항상 백업을 먼저 만듭니다.
- Push와 Pull은 명확히 분리합니다.
- 충돌 상태에서는 자동 덮어쓰기를 하지 않습니다.
- Push/Pull이 성공하면 `.rohub-state.json`에 마지막 동기화 기준 해시를 저장합니다.
- Roblox Studio 플러그인과 데스크톱 프리뷰는 기본적으로 강제 덮어쓰기를 권장하지 않습니다.

## 상태

| 상태 | 의미 | 기본 액션 |
|---|---|---|
| `clean` | 로컬과 서버가 같음 | 없음 |
| `local-ahead` | 로컬만 변경됨 | Push |
| `remote-ahead` | 서버만 변경됨 | Pull |
| `diverged` | 양쪽 모두 변경됨 | 충돌 확인 |
| `missing-local` | 로컬 파일 없음 | Pull |
| `missing-remote` | 서버 채널 없음 | Push |
| `no-base` | 로컬과 서버 기준 데이터가 없음 | 초기화 |

## Push 차단 조건

`remote-ahead` 또는 `diverged` 상태에서는 기본 Push를 차단합니다.
서버 변경사항을 잃을 수 있기 때문입니다.
정말 강제로 바꿔야 할 때만 CLI 또는 데스크톱 프리뷰에서 force 옵션을 사용합니다.

## Pull 차단 조건

`local-ahead` 또는 `diverged` 상태에서는 기본 Pull을 차단합니다.
로컬 변경사항을 잃을 수 있기 때문입니다.
정말 강제로 받아야 할 때만 CLI 또는 데스크톱 프리뷰에서 force 옵션을 사용합니다.

## Safe sync 정책

`sync`는 먼저 상태를 계산하고 안전한 경우에만 자동 처리합니다.

- `local-ahead` 또는 `missing-remote`: Push
- `remote-ahead` 또는 `missing-local`: Pull
- `clean`: 작업 없음
- `diverged`: 차단
- 로컬과 서버가 모두 있고 기준 해시가 없으면 차단

이 정책은 기존 MVP처럼 MD5가 다르다는 이유만으로 서버 파일을 로컬에 덮어쓰지 않기 위한 안전장치입니다.

## 다음 단계

- 데스크톱 앱에서 프로젝트 선택 UI를 붙입니다.
- Roblox Studio 플러그인에서 Status, Push, Pull, Safe sync 버튼을 유지합니다.
- 중앙 서버 저장소를 파일 기반에서 실제 저장 백엔드로 분리합니다.
- 팀 권한, 채널 권한, 작업 로그를 추가합니다.
