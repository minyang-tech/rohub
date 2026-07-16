# Rohub 개발 로드맵

## 1. 프로젝트 방향

Rohub은 Roblox 프로젝트를 GitHub Desktop처럼 쉽게 보내고 받아올 수 있게 만드는 데스크톱 동기화 도구입니다.
현재 MVP는 Roblox Studio 플러그인, 로컬 파일 에이전트, 중앙 채널 서버를 통해 `.rbxl` / `.rbxlx` 파일을 채널 단위로 업로드하거나 내려받는 구조입니다.

최종 목표는 Rojo처럼 Roblox 개발 파일을 로컬과 Studio 사이에서 다루되, Git 명령어나 복잡한 CLI 없이 버튼 중심 UI로 수정사항 전송, 가져오기, 비교, 백업, 충돌 확인을 처리하는 것입니다.

## 2. 현재 MVP 기준

### 현재 구성

| 구성 요소 | 역할 |
|---|---|
| `central-server.js` | 채널 생성, 서버 사본 저장, MD5 비교, gzip/base64 파일 응답, 선택적 토큰 인증 |
| `local-agent.js` | 로컬 `.rbxl` / `.rbxlx` 파일 읽기/쓰기, 서버와 비교, 백업 후 교체, 로컬 HTTP API 제공 |
| `roblox-plugin.luau` | Roblox Studio 안에서 설정 UI와 Sync 버튼 제공, 직접 파일을 만지지 않고 local-agent에 요청 |
| `README.md` | MVP 설명과 Electron 앱 방향 간단 메모 |
| `old_readme.md` | MVP API, 설치, 실행, 보안 토큰, 현재 한계 설명 |

### 현재 동작

- 채널이 없고 로컬 파일이 있으면 서버에 로컬 파일을 업로드합니다.
- 채널이 없고 로컬 파일도 없으면 서버 기본 템플릿을 생성하고 로컬로 내려받습니다.
- 채널이 있으면 로컬 MD5와 서버 MD5를 비교합니다.
- MD5가 같으면 아무 작업도 하지 않습니다.
- MD5가 다르면 현재 구현은 서버 사본을 내려받아 로컬 파일을 백업 후 교체합니다.

### 현재 한계

- GitHub Desktop처럼 `내 변경사항`과 `상대 변경사항`을 시각적으로 보여주지 않습니다.
- 로컬 변경사항을 명시적으로 `Push`하는 정책이 부족합니다.
- 서버 변경사항을 명시적으로 `Pull`하는 정책이 부족합니다.
- 충돌 상황을 사용자가 판단하는 UI가 없습니다.
- `.rbxlx` 내부 구조 비교, Rojo 프로젝트 구조 비교, 파일별 변경 추적이 없습니다.
- 인증, 권한, 팀 관리, 변경 이력, 롤백 기능이 초기 수준입니다.
- Electron 데스크톱 앱 UI가 아직 본격 구현되지 않았습니다.

## 3. 제품 목표

## 핵심 사용자 경험

1. 사용자가 Rohub 앱을 실행합니다.
2. Roblox 프로젝트 파일 또는 폴더를 선택합니다.
3. 채널 또는 프로젝트를 선택합니다.
4. 앱이 로컬 변경사항과 서버 변경사항을 보여줍니다.
5. 사용자는 `보내기(Push)`, `받기(Pull)`, `동기화(Sync)` 버튼으로 작업합니다.
6. 충돌이 있으면 앱이 충돌 파일과 원인을 보여주고 선택지를 제공합니다.
7. 모든 위험 작업 전 자동 백업이 생성됩니다.

## GitHub Desktop과 유사한 기능

| GitHub Desktop 개념 | Rohub 대응 개념 |
|---|---|
| Repository | Roblox Project / Channel |
| Commit | Snapshot / Save Point |
| Push | 내 Roblox 수정사항 서버로 보내기 |
| Pull / Fetch | 팀원의 수정사항 받아오기 |
| History | 프로젝트 변경 이력 |
| Branch | Channel / Workspace |
| Diff | `.rbxlx` XML 또는 Rojo 파일 변경 비교 |
| Conflict | 로컬과 서버가 동시에 바뀐 상태 |

## Rojo와 유사한 기능

- Studio와 로컬 파일 사이의 개발 흐름을 단순화합니다.
- 장기적으로 `.rbxlx` 단일 파일뿐 아니라 Rojo 프로젝트 폴더 구조도 지원합니다.
- `default.project.json`, `src/`, `ReplicatedStorage`, `ServerScriptService` 같은 구조를 인식하는 방향으로 확장합니다.
- Roblox Studio 플러그인은 Studio 내부 조작을 담당하고, 파일 시스템 접근은 local-agent가 담당합니다.

## 4. 비목표

초기 버전에서는 아래 기능을 바로 목표로 삼지 않습니다.

- Roblox 공식 공동 편집 기능 대체
- 실시간 멀티 커서 편집
- Roblox 계정 인증 우회
- 모든 DataModel 객체의 완전한 의미 기반 병합
- Git 전체 기능 복제
- 클라우드 서버 필수화

Rohub은 우선 `간단한 팀 동기화`, `안전한 백업`, `명확한 보내기/받기`, `Roblox 작업 흐름 단순화`에 집중합니다.

## 5. 권장 아키텍처

## 데스크톱 앱

Electron 기반 앱을 권장합니다.

주요 책임:

- 프로젝트 목록 관리
- 로컬 파일/폴더 선택
- 중앙 서버 URL 및 토큰 관리
- Push / Pull / Sync UI 제공
- 변경 상태 표시
- 히스토리와 백업 관리
- local-agent 실행/상태 확인
- Roblox Studio 플러그인 설치 안내

## 로컬 에이전트

`local-agent.js`는 유지하되 API를 확장합니다.

주요 책임:

- 파일 시스템 접근
- `.rbxl` / `.rbxlx` 읽기/쓰기
- Rojo 폴더 구조 스캔
- 해시 계산
- 자동 백업
- 서버와 통신
- 데스크톱 앱과 Roblox 플러그인에 로컬 HTTP API 제공

## 중앙 서버

`central-server.js`는 MVP 서버에서 팀 동기화 서버로 확장합니다.

주요 책임:

- 프로젝트/채널 저장
- 최신 스냅샷 관리
- 변경 이력 관리
- 토큰 기반 인증
- 팀 권한 관리
- 서버 파일 다운로드/업로드
- 충돌 판단용 메타데이터 제공

## Roblox Studio 플러그인

`roblox-plugin.luau`는 최소 UI와 Studio 내부 연결 역할에 집중합니다.

주요 책임:

- 현재 프로젝트 연결 상태 표시
- Sync / Push / Pull 버튼 제공
- local-agent 상태 확인
- Studio에서 사용자에게 위험 작업 경고
- 장기적으로 Studio 선택 객체를 내보내거나 가져오는 기능 검토

## 6. 데이터 모델 초안

## Project

```json
{
  "id": "project-id",
  "name": "My Roblox Game",
  "localPath": "C:/path/main.rbxlx",
  "type": "rbxlx-file",
  "centralUrl": "http://127.0.0.1:7070",
  "channel": "main",
  "createdAt": "2026-07-17T00:00:00+09:00",
  "updatedAt": "2026-07-17T00:00:00+09:00"
}
```

## Snapshot

```json
{
  "id": "snapshot-id",
  "projectId": "project-id",
  "channel": "main",
  "fileName": "main.rbxlx",
  "hash": "md5-or-sha256",
  "size": 123456,
  "message": "Update lobby UI",
  "author": "whoasked",
  "createdAt": "2026-07-17T00:00:00+09:00"
}
```

## Sync Status

```json
{
  "projectId": "project-id",
  "localHash": "...",
  "remoteHash": "...",
  "baseHash": "...",
  "state": "clean | local-ahead | remote-ahead | diverged | conflict"
}
```

## 7. 기능 로드맵

## Phase 0. MVP 안정화

목표: 현재 CLI/플러그인 기반 MVP를 안전하게 사용할 수 있는 수준으로 고정합니다.

작업:

- README 인코딩 깨짐 수정
- `README.md`와 `old_readme.md` 내용 통합
- `central-server.js` API 오류 메시지 정리
- `local-agent.js` 동기화 정책 문서화
- 현재 `sync`가 서버 사본으로 로컬을 덮는 동작임을 명확히 표시
- `.bak` 백업 파일 생성 정책 확인
- `.rbxl` / `.rbxlx` 확장자 검증 강화
- MD5 외에 SHA-256 해시 추가 검토
- 로컬 파일 경로 유효성 검사 강화

완료 기준:

- 사용자가 README만 보고 서버, 에이전트, 플러그인을 실행할 수 있어야 합니다.
- 위험 동작이 문서와 실제 동작에서 일치해야 합니다.

## Phase 1. 명시적 Push / Pull 분리

목표: `Sync` 하나로 처리하던 동작을 GitHub Desktop처럼 명확히 분리합니다.

작업:

- `local-agent.js`에 `/status` API 추가
- `local-agent.js`에 `/push` API 추가
- `local-agent.js`에 `/pull` API 추가
- `local-agent.js`에 `/sync`는 안전 정책 기반 자동 판단으로 유지
- `central-server.js`에 스냅샷 메타데이터 저장
- 서버 최신 해시, 로컬 해시, 마지막 동기화 해시를 비교하는 구조 추가
- 로컬이 앞선 상태, 서버가 앞선 상태, 양쪽 모두 변경된 상태를 구분

상태 예시:

| 상태 | 의미 | 기본 추천 액션 |
|---|---|---|
| `clean` | 로컬과 서버가 같음 | 작업 없음 |
| `local-ahead` | 로컬만 바뀜 | Push |
| `remote-ahead` | 서버만 바뀜 | Pull |
| `diverged` | 양쪽 모두 바뀜 | 충돌 확인 |
| `missing-local` | 로컬 파일 없음 | Pull |
| `missing-remote` | 서버 채널 없음 | Push 또는 기본 생성 |

완료 기준:

- 사용자는 보내기와 받기를 명확히 선택할 수 있어야 합니다.
- 앱이 무조건 서버 파일로 로컬을 덮어쓰지 않아야 합니다.

## Phase 2. Electron 데스크톱 앱

목표: GitHub Desktop처럼 프로젝트를 선택하고 변경 상태를 볼 수 있는 앱을 만듭니다.

작업:

- Electron 앱 기본 구조 생성
- 프로젝트 추가 화면
- 최근 프로젝트 목록
- 중앙 서버 설정 화면
- 로컬 에이전트 상태 표시
- Push / Pull / Sync 버튼
- 작업 로그 패널
- 백업 위치 열기 버튼
- 오류 상세 보기
- Roblox Studio 플러그인 설치 안내 화면

화면 구성 초안:

- 왼쪽: 프로젝트 목록
- 상단: 현재 프로젝트, 채널, 서버 상태
- 중앙: 변경 상태 카드
- 오른쪽: 액션 버튼과 위험 경고
- 하단: 작업 로그와 백업 기록

완료 기준:

- CLI 없이 앱에서 프로젝트를 등록하고 Push/Pull할 수 있어야 합니다.
- 실행 중인 local-agent를 앱이 감지하거나 직접 실행할 수 있어야 합니다.

## Phase 3. 변경 이력과 스냅샷

목표: 사용자가 언제 누가 어떤 버전을 올렸는지 확인할 수 있게 합니다.

작업:

- Push 시 메시지 입력 추가
- 서버에 스냅샷 기록 저장
- 스냅샷 목록 API 추가
- 특정 스냅샷 다운로드
- 특정 스냅샷으로 로컬 복원
- 복원 전 자동 백업
- 앱에서 History 탭 제공

완료 기준:

- 최근 변경 이력을 앱에서 확인할 수 있어야 합니다.
- 이전 버전으로 안전하게 되돌릴 수 있어야 합니다.

## Phase 4. 충돌 감지와 안전 병합

목표: 양쪽 변경이 동시에 발생했을 때 무작정 덮어쓰지 않고 사용자가 선택하게 합니다.

작업:

- 마지막 동기화 기준 해시 저장
- 로컬/서버/base 3개 상태 비교
- `diverged` 상태 표시
- 선택지 제공
- `내 파일 유지`
- `서버 파일로 교체`
- `백업 후 서버 파일 적용`
- `다른 이름으로 내려받기`
- `.rbxlx` XML 텍스트 diff 실험
- Rojo 폴더 구조에서는 파일별 diff 제공

완료 기준:

- 충돌 상태에서 자동 덮어쓰기를 하지 않아야 합니다.
- 사용자는 어떤 선택이 어떤 결과를 만드는지 알 수 있어야 합니다.

## Phase 5. Rojo 프로젝트 지원

목표: 단일 `.rbxlx` 파일뿐 아니라 Rojo처럼 폴더 기반 Roblox 프로젝트를 다룹니다.

작업:

- `default.project.json` 탐지
- Rojo 프로젝트 루트 선택
- 파일별 해시 계산
- 폴더 단위 압축 업로드/다운로드
- 변경 파일 목록 표시
- `.server.lua`, `.client.lua`, `.module.lua`, `.json` 등 주요 파일 표시
- 무시 파일 설정 추가
- `rojo serve` 사용 여부 감지

완료 기준:

- Rojo 프로젝트 폴더를 등록하고 변경 파일 목록을 볼 수 있어야 합니다.
- 폴더 프로젝트도 Push/Pull할 수 있어야 합니다.

## Phase 6. Roblox Studio 플러그인 개선

목표: Studio 안에서도 앱과 연결된 상태를 쉽게 확인하고 동기화할 수 있게 합니다.

작업:

- Push / Pull / Status 버튼 분리
- 현재 상태 표시 개선
- local-agent 연결 실패 원인 안내
- HTTP 요청 활성화 안내 개선
- 토큰 저장 보안 안내
- 최근 채널 선택
- 데스크톱 앱 열기 버튼 검토

완료 기준:

- Studio 플러그인에서 현재 상태와 위험 작업을 명확히 알 수 있어야 합니다.

## Phase 7. 보안과 팀 기능

목표: 로컬 개발용을 넘어 팀 사용에 필요한 최소 보안을 확보합니다.

작업:

- 중앙 서버 토큰 필수 옵션
- 프로젝트별 토큰
- 읽기 전용 토큰 / 쓰기 가능 토큰 분리
- 서버 API 요청 크기 제한
- 업로드 파일 확장자 제한
- 경로 조작 방지
- 로컬 에이전트는 기본적으로 `127.0.0.1`에만 바인딩
- 위험 작업 전 확인 모달
- 작업 로그에 토큰 마스킹
- 서버 데이터 백업 정책

완료 기준:

- 실수로 외부에서 local-agent에 접근하기 어렵게 해야 합니다.
- 팀 단위 서버 운용 시 최소한의 권한 분리가 가능해야 합니다.

## Phase 8. 배포와 자동 업데이트

목표: 사용자가 Node 명령어 없이 설치해서 사용할 수 있게 합니다.

작업:

- Windows 설치 파일 생성
- 포터블 ZIP 배포 검토
- local-agent 내장 실행
- central-server 별도 배포 패키지
- Roblox 플러그인 설치 파일/가이드 제공
- 앱 내 업데이트 확인
- 릴리즈 노트 작성

완료 기준:

- 일반 사용자가 설치 후 프로젝트 등록까지 5분 안에 도달할 수 있어야 합니다.

## 8. UI 로드맵

## 메인 화면

- 프로젝트 리스트
- 현재 프로젝트 상태
- `Push`, `Pull`, `Sync`, `Backup`, `History` 버튼
- 서버 연결 상태
- local-agent 상태
- Roblox Studio 연결 안내

## 프로젝트 추가 화면

- `.rbxl` / `.rbxlx` 선택
- Rojo 폴더 선택
- 채널 이름 입력
- 중앙 서버 URL 입력
- 토큰 입력
- 프로젝트 별칭 입력

## 변경 상태 화면

- 로컬 해시
- 서버 해시
- 마지막 동기화 해시
- 변경 방향
- 추천 액션
- 위험 경고

## 충돌 화면

- 충돌 원인
- 로컬 파일 정보
- 서버 파일 정보
- 마지막 동기화 정보
- 선택지
- 백업 후 진행 기본값

## 9. API 확장 계획

## local-agent API

| Method | Path | 역할 |
|---|---|---|
| `GET` | `/health` | 에이전트 상태 확인 |
| `POST` | `/projects/add` | 로컬 프로젝트 등록 |
| `GET` | `/projects` | 등록 프로젝트 목록 |
| `POST` | `/status` | 로컬/서버 상태 비교 |
| `POST` | `/push` | 로컬 변경사항 서버로 업로드 |
| `POST` | `/pull` | 서버 변경사항 로컬로 다운로드 |
| `POST` | `/sync` | 안전 정책에 따라 자동 동기화 |
| `POST` | `/backup` | 로컬 파일 즉시 백업 |
| `GET` | `/logs` | 최근 작업 로그 조회 |

## central-server API

| Method | Path | 역할 |
|---|---|---|
| `POST` | `/v1/handshake` | 채널 존재 확인 |
| `GET` | `/v1/channels/:channel/status` | 서버 파일 상태 조회 |
| `POST` | `/v1/channels/:channel/file` | 서버 파일 업로드 |
| `GET` | `/v1/channels/:channel/file` | 서버 파일 다운로드 |
| `POST` | `/v1/channels/:channel/compare` | 해시 비교 |
| `GET` | `/v1/channels/:channel/history` | 스냅샷 이력 조회 |
| `GET` | `/v1/channels/:channel/snapshots/:id` | 특정 스냅샷 다운로드 |

## 10. 파일 구조 제안

```text
rohub/
  apps/
    desktop/              # Electron UI
  packages/
    core/                 # 해시, 상태 계산, 공통 타입
    local-agent/          # 로컬 파일 에이전트
    central-server/       # 중앙 서버
    roblox-plugin/        # Roblox Studio 플러그인 소스
  docs/
    setup.md
    sync-policy.md
    security.md
  README.md
  ROADMAP.md
```

초기에는 현재 파일 구조를 유지해도 되지만, Electron 앱이 들어가는 시점부터는 위 구조처럼 분리하는 것이 유지보수에 유리합니다.

## 11. 동기화 정책 초안

## 기본 원칙

- 사용자의 로컬 파일을 자동으로 삭제하지 않습니다.
- 서버 파일로 로컬 파일을 교체할 때는 항상 백업을 만듭니다.
- Push는 서버의 최신 상태를 확인한 뒤 수행합니다.
- Pull은 로컬 변경사항 여부를 확인한 뒤 수행합니다.
- 충돌 상태에서는 자동 병합하지 않고 사용자 선택을 요구합니다.

## 추천 기본 정책

| 상황 | 기본 동작 |
|---|---|
| 로컬만 변경됨 | Push 추천 |
| 서버만 변경됨 | Pull 추천 |
| 둘 다 변경됨 | 충돌 화면 표시 |
| 로컬 파일 없음 | Pull 추천 |
| 서버 채널 없음 | Push 또는 기본 템플릿 생성 |
| 해시 같음 | 작업 없음 |

## 12. 테스트 계획

## 단위 테스트

- 채널 이름 검증
- 파일 경로 검증
- 해시 계산
- gzip 압축/해제
- 백업 파일명 생성
- 상태 계산 로직

## 통합 테스트

- 서버 실행 후 채널 생성
- 로컬 파일 Push
- 서버 파일 Pull
- 해시 동일 상태 확인
- 로컬/서버 변경 충돌 확인
- 토큰 인증 성공/실패 확인

## 수동 테스트

- Roblox Studio 플러그인에서 Sync 실행
- local-agent가 꺼진 상태에서 오류 메시지 확인
- HTTP 요청 비활성화 상태 안내 확인
- `.rbxlx` 파일 백업 생성 확인
- Electron 앱에서 프로젝트 등록부터 Push/Pull까지 확인

## 13. 릴리즈 계획

## V0.1 MVP 정리

- 현재 기능 문서화
- README 인코딩 수정
- Sync 동작 안정화
- 안전 백업 확인

## V0.2 Push/Pull 분리

- Status API
- Push API
- Pull API
- 상태 계산 로직
- 플러그인 버튼 분리

## V0.3 Desktop Preview

- Electron 앱 첫 버전
- 프로젝트 등록
- 서버/에이전트 상태 표시
- Push/Pull 버튼

## V0.4 History & Backup

- 스냅샷 이력
- 복원 기능
- 백업 관리 UI

## V0.5 Conflict Safety

- 충돌 감지
- 충돌 해결 선택지
- 다른 이름으로 내려받기

## V0.6 Rojo Folder Support

- Rojo 프로젝트 탐지
- 폴더 기반 Push/Pull
- 파일별 변경 목록

## V1.0 Team Ready

- 설치형 앱
- 팀 토큰/권한
- 안정화된 서버 배포
- 문서 정리
- 실제 Roblox 팀 프로젝트 기준 QA 완료

## 14. 우선순위

가장 먼저 해야 할 일은 `Sync`의 의미를 분리하는 것입니다.
현재 구조는 서버 사본으로 로컬을 교체하는 흐름이 강하기 때문에, GitHub Desktop 같은 경험을 만들려면 아래 순서가 안전합니다.

1. `status` API 만들기
2. `push` / `pull` API 분리
3. 마지막 동기화 해시 저장
4. 충돌 상태 감지
5. Electron 앱 UI 제작
6. History와 백업 UI 추가
7. Rojo 폴더 지원 확장

## 15. 제품 한 줄 정의

Rohub은 Roblox 개발자를 위한 GitHub Desktop식 동기화 앱입니다.
복잡한 Git/Rojo 설정 없이도 Roblox 프로젝트 수정사항을 안전하게 보내고, 받고, 되돌릴 수 있게 만드는 것을 목표로 합니다.
