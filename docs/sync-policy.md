# Rohub 동기화 정책 초안

## 원칙

- 로컬 파일은 자동 삭제하지 않습니다.
- 서버 파일로 로컬 파일을 교체하기 전 항상 백업합니다.
- Push와 Pull을 명확히 분리합니다.
- 충돌 상태에서는 자동 덮어쓰기를 하지 않습니다.

## 상태

| 상태 | 의미 | 기본 액션 |
|---|---|---|
| `clean` | 로컬과 서버가 같음 | 없음 |
| `local-ahead` | 로컬만 변경됨 | Push |
| `remote-ahead` | 서버만 변경됨 | Pull |
| `diverged` | 양쪽 모두 변경됨 | 충돌 확인 |
| `missing-local` | 로컬 파일 없음 | Pull |
| `missing-remote` | 서버 채널 없음 | Push |