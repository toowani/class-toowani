# class.toowani.com

학부 수업 기록 사이트. 정적 파일만 있으면 돌아갑니다(빌드 없음).

```
index.html          학기 허브
3-2/                진행 중인 학기 — 오늘 수업 · 녹음 · 요약 · 메모 · 할 일
1-1/ … 3-summer/    지난 학기 — 과목 · 성적 · 프로젝트 링크 · 회고 (틀만)
assets/data.js      ★ 시간표·실라버스 데이터. 수정은 여기서만
assets/style.css
assets/store.js     localStorage + IndexedDB
assets/app.js       화면·녹음·요약 로직
worker/summarize.js 받아쓰기(/transcribe, /usage) — Cloudflare Worker (요약은 API 호출 없음)
tests/              assets/app.js 녹음·받아쓰기 로직 jest 테스트 (npm install && npm test)
```

## 배포

GitHub Pages든 Cloudflare Pages든 이 폴더를 그대로 올리면 `class.toowani.com/3-2/` 로 접근됩니다.
폴더마다 `index.html`이 있어서 별도 리라이트 규칙이 필요 없습니다.

마이크(`getUserMedia`)와 받아쓰기는 **HTTPS에서만** 동작합니다. 로컬 테스트는
`python3 -m http.server` 후 `http://localhost:8000` (localhost는 예외로 허용).

## 데이터 고치기

`assets/data.js` 하나만 봅니다.

- 시간·강의실: 각 과목 `meetings` (`day`: 1=월 … 5=금)
- 주차 주제: `weekTopics` (16개, 실라버스 그대로 넣어둠)
- 시험·제출 주: `weekMarks` — 16주 레일에 점으로 표시됨
- 개강일: `startMonday` (현재 `2026-08-31`). 이 날짜 기준으로 1~16주차 날짜가 자동 계산됩니다.
- 휴강·보강으로 날짜가 밀리면 `startMonday`는 그대로 두고 해당 주차 `weekTopics`만 바꾸는 게 편합니다.

피아노(GS0201-02)는 목요일 `17:30–19:30`입니다. 실제 시간이 바뀌면 `meetings`를 고치세요.

## 녹음 → 요약이 도는 방식

1. `녹음 시작` → `MediaRecorder` 두 개가 같은 마이크를 나눠 씀: 하나는 지금처럼 오디오 전체를
   연속 녹음(재생·다운로드용), 다른 하나는 mono 32kbps로 **5분마다 회전**하며 조각을 만들어
   Cloudflare Workers AI(`whisper-large-v3-turbo`)로 순서대로 보내 받아씁니다.
2. 조각은 단일 흐름 큐로 하나씩 처리되어 응답 순서와 무관하게 자막에 순서대로 쌓입니다. 실패는
   3회 재시도 후 "n번째 조각 실패"로 표시하고, 서버의 일일 예산(기본 200분)을 넘기면 그 조각은
   "이월 대기"로 남았다가 다음 날 초기화(매일 09:00 KST) 이후 대시보드를 열면 자동으로 처리됩니다.
3. `중지 후 요약` → 남은 조각까지 모두 끝난 뒤 오디오는 IndexedDB에, 자막은 localStorage에
   저장되고 **간이 요약**(키워드 빈도 기반, 서버 호출 없음)이 자동으로 하나 생성됩니다.

요약은 API를 호출하지 않습니다 — Anthropic API는 Max 구독과 별도 과금이라 쓰지 않기로 하고,
수동으로 claude.ai에 붙여넣는 방식으로 바꿨습니다. 세션 모달의 버튼 3개:

- **Claude용 프롬프트 복사**: 지침(Whisper 오인식 보정·운영공지 항목화·타임스탬프 근거·6섹션
  형식) + 과목/주차/실라버스 주제 + 전사문 + 메모를 한 번에 클립보드로 복사합니다. claude.ai에
  붙여넣고 나온 마크다운을 그대로 가져와 "요약 붙여넣기"에 저장하세요.
- **전사문만 복사**: 지침 없이 전사문+메모만 복사합니다. 아래 "Project 지침 생성기"로 과목별
  Claude Project를 미리 만들어뒀다면 매번 이것만 붙여넣으면 됩니다.
- **요약 붙여넣기**: Claude 응답(마크다운)을 붙여넣고 저장하면 기존 요약 카드처럼 렌더됩니다.
  다시 누르면 편집 가능. 하단에 "수동 요약(Claude) · 저장 시각"으로 표시됩니다.

**간이 요약 만들기**는 보조 버튼으로 남아 있습니다 — 붙여넣기 전 임시로 보거나, 처음부터 서버
요약이 필요 없을 때 씁니다. 한번 수동 요약을 저장해두면, 이후 그 세션에서 이어서 녹음해도
자동으로 덮어쓰지 않습니다.

과목 페이지 헤더의 **Project 지침 복사** 버튼은 그 과목 전용 시스템 지침(과목 정보, 16주
실라버스 전체, 평가 비중, 키워드, 요약 형식, Whisper 보정 지침)을 복사합니다. claude.ai에서
과목별 Project를 만들고 지침에 붙여넣으면, 이후엔 "전사문만 복사"만 매번 넣으면 Project가
전사문 첫 줄의 `[과목명 W03 9/14 · 실라버스: ...]` 태그로 주차를 판단합니다.

받아쓰기는 오디오를 서버로 보내야 해서 **받아쓰기 API 주소**(설정 → 비워두면 `assets/data.js`의
기본값을 씀)가 있어야 자막이 쌓입니다. 주소가 없거나 해당 과목이 `transcribe:false`(피아노처럼
말이 거의 없는 수업)면 녹음은 되지만 자막은 쌓이지 않습니다 — 오류가 아니라 정상 동작입니다.

과목별 받아쓰기 언어는 모달에서 바꿀 수 있고, 과목마다 기억됩니다.
영어 강의(컴퓨터 구조, 기초시각화, 컴퓨터 네트워킹)는 `en-US`가 기본입니다.

업로드한 오디오(휴대폰 녹음 등)도 항목별 "받아쓰기" 버튼으로 같은 서버에 보낼 수 있습니다.
90초 넘게 용량이 크면 브라우저에서 16kHz mono WAV 조각으로 나눠 순서대로 보내는데, 90분짜리
파일은 디코딩 메모리 부담이 있어 노트북에서 실행하는 걸 권장합니다.

## 저장 위치

메모·자막·요약·할 일은 **그 브라우저에만** 저장됩니다(서버 없음). 오디오는 IndexedDB.
노트북과 폰이 따로 논다는 뜻이니, 설정 화면의 `전체 백업(JSON)`을 가끔 받아두세요.

## 녹음 전에

강의 녹음은 개인 학습용으로만. 교수님 방침이나 LMS 공지에 녹음 관련 안내가 있는지 먼저 확인하고,
녹음 파일을 외부에 공유하지 않는 편이 안전합니다.

## 배포 방법 (Cloudflare Pages)

이 저장소는 GitHub `toowani/class-toowani` (private)에 올라가 있고, Cloudflare Pages 프로젝트
`class-toowani`로 배포합니다. 빌드 단계가 없으므로 저장소 루트를 그대로 업로드하면 됩니다.

```
npx wrangler login                               # 최초 1회, 브라우저 인증
npx wrangler pages project create class-toowani  # 최초 1회, 프로젝트 생성
npx wrangler pages deploy . --project-name=class-toowani
```

배포할 때마다 임시 미리보기 주소(`https://<hash>.class-toowani.pages.dev`)가 생기고,
`main` 브랜치 배포는 `https://class-toowani.pages.dev`로도 접근됩니다.

### 커스텀 도메인(class.toowani.com) 연결

1. [Cloudflare 대시보드](https://dash.cloudflare.com) → 계정 선택 → **Workers & Pages**
2. `class-toowani` 프로젝트 클릭
3. 상단 탭에서 **Custom domains** 클릭
4. **Set up a custom domain** 버튼 클릭 → `class.toowani.com` 입력 → **Continue**
5. `toowani.com` 도메인이 같은 Cloudflare 계정에 있으면 DNS 레코드가 자동으로 추가됨(Activate 클릭으로 완료).
   다른 계정/등록기관이면 안내되는 CNAME 레코드(`class` → `class-toowani.pages.dev`)를 해당 DNS에서 직접 추가
6. DNS가 전파되면 (보통 몇 분) `https://class.toowani.com`으로 접속 가능. 인증서는 Cloudflare가 자동 발급

### 받아쓰기 서버(Worker) 배포

`wrangler.toml`에 Workers AI 바인딩(`[ai]`)과 예산 추적용 KV 네임스페이스(`BUDGET_KV`)가
이미 설정돼 있습니다. 처음 배포할 때만:

```
npx wrangler kv namespace create BUDGET_KV   # 최초 1회 — id를 wrangler.toml에 반영
npx wrangler deploy                          # worker/summarize.js 배포
```

`DAILY_BUDGET_SECONDS`(기본 12000초=200분)는 Workers 요금제가 Free인지 확인 못 해 보수적으로
잡은 값입니다. Cloudflare 대시보드(Manage Account → Billing → Subscriptions)에서 Workers Paid가
아님을 확인했다면 Workers AI 무료 한도(하루 1만 뉴런)에 맞춰 12600(210분)까지 올려도 됩니다.

### GitHub 자동 배포로 전환하려면

현재는 `wrangler pages deploy`로 수동 배포합니다. 커밋마다 자동 배포하고 싶으면 Cloudflare 대시보드의
Pages 프로젝트 설정에서 **Git 연결(Connect to Git)**을 통해 `toowani/class-toowani` 저장소를 연결하면 됩니다.
