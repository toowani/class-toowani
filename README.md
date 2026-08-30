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
worker/summarize.js 요약용 프록시 예제 (Cloudflare Worker)
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

**확인 필요**: 피아노(GS0201-02)는 시간표 이미지에서 목요일 오후 블록만 보여 `17:00–19:00`으로 넣었습니다. 실제 시간이 다르면 `meetings`를 고치세요.

## 녹음 → 요약이 도는 방식

1. `녹음 시작` → `MediaRecorder`가 오디오를, Web Speech API가 실시간 받아쓰기를 동시에 기록
2. `중지 후 요약` → 오디오는 IndexedDB에, 자막은 localStorage에 저장되고 요약이 자동 생성
3. 요약은 두 갈래
   - **기기 내 요약(기본)**: 서버 없이 동작. 키워드 빈도 기반으로 핵심 문장을 뽑고, 과목 키워드 매칭 + `과제/제출/시험/next week` 같은 표현을 따로 걸러냅니다.
   - **AI 요약**: 설정에서 요약 API 주소를 넣으면 그쪽으로 보냅니다. `worker/summarize.js`를 배포해 그 주소를 넣는 걸 권장 — API 키가 브라우저에 남지 않습니다.

받아쓰기는 Chrome·Edge에서만 동작합니다(Safari/Firefox는 녹음만 됨). 브라우저 탭이 백그라운드로 가면
받아쓰기가 끊길 수 있으니 수업 중에는 탭을 열어두세요.

과목별 받아쓰기 언어는 모달에서 바꿀 수 있고, 과목마다 기억됩니다.
영어 강의(컴퓨터 구조, 기초시각화, 컴퓨터 네트워킹)는 `en-US`가 기본입니다.

## 저장 위치

메모·자막·요약·할 일은 **그 브라우저에만** 저장됩니다(서버 없음). 오디오는 IndexedDB.
노트북과 폰이 따로 논다는 뜻이니, 설정 화면의 `전체 백업(JSON)`을 가끔 받아두세요.

## 녹음 전에

강의 녹음은 개인 학습용으로만. 교수님 방침이나 LMS 공지에 녹음 관련 안내가 있는지 먼저 확인하고,
녹음 파일을 외부에 공유하지 않는 편이 안전합니다.
