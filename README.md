# Paseo FileDrop

> 이 플러그인은 바이브 코딩으로 제작한 실험적 프로젝트입니다.

Paseo FileDrop은 브라우저에서 고른 로컬 파일을 현재 Paseo 프로젝트에
안전하게 업로드하는 Paseo 플러그인입니다. 별도 업로드 서버 없이 기존
Paseo 인증 및 플러그인 RPC 연결을 사용합니다.

## 현재 기능

- 웹 클라이언트에서 파일 1개 선택 및 업로드
- 프로젝트 내부의 원하는 폴더에 저장, 기본값은 `uploads`
- 256 KiB 청크 전송 및 청크별·전체 SHA-256 무결성 검사
- 같은 이름의 파일이 있으면 덮어쓰지 않고 업로드 중단
- 임시 파일을 사용한 뒤 원자적으로 저장
- 경로 조작과 심볼릭 링크를 통한 프로젝트 외부 쓰기 방지

초기 업로드 한도는 파일당 10 MiB입니다. 다중 파일, 드래그 앤 드롭,
진행률 표시, 재시도, 대용량 파일 조정은 이후 버전에서 추가할 예정입니다.

## 설치

Paseo 0.15.4 이상과 Node.js 20 이상이 필요합니다.

```sh
paseo plugin install github:graypawn/Paseo-FileDrop
```

설치 후 대상 데몬의 **Settings → Plugins**에서 플러그인을 활성화하세요.
플러그인 서버 코드는 데몬 사용자의 권한으로 실행되므로, 신뢰하는 호스트에서만
설치·활성화해야 합니다.

## 개발

```sh
npm install
npm run typecheck
paseo plugin install /absolute/path/to/paseo-filedrop
```
