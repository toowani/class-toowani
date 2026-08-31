const h = require("./helpers");

beforeEach(() => { jest.useFakeTimers(); });
afterEach(() => { jest.useRealTimers(); jest.clearAllMocks(); delete window.API_DEFAULTS; });

function setSttUrl(store) {
  store.set("ai", { sttUrl: "https://fake.test/transcribe" });
}

test("segments 응답은 [mm:ss] 줄 단위로 저장되고, 2번째 조각(5분 뒤)은 05:00부터 시작한다", async () => {
  const { store } = h.boot();
  setSttUrl(store);
  const fq = h.makeFetchQueue();
  global.fetch = fq.fn;

  const modal = await h.openTestSession("test-course");
  h.findButton(modal, "녹음 시작").click();
  await h.flush();

  await jest.advanceTimersByTimeAsync(5 * 60 * 1000); // 1번째 조각
  expect(fq.calls.length).toBe(1);
  fq.calls[0].resolve(h.okResponse({
    segments: [{ start: 1.2, text: "첫 문장입니다" }, { start: 3.9, text: "둘째 문장입니다" }]
  }));
  await h.flush();

  await jest.advanceTimersByTimeAsync(1 * 60 * 1000); // 2번째 조각(5분 시점부터) 1분만 더 녹음하고 중지
  h.findButton(modal, "중지 후 요약").click();
  await h.flush();
  expect(fq.calls.length).toBe(2);
  fq.calls[1].resolve(h.okResponse({ segments: [{ start: 0, text: "여섯째 문장부터" }] }));
  await jest.advanceTimersByTimeAsync(500);

  const key = "s/3-2/test-course/2026-01-05/09:00";
  const transcript = store._raw[key].transcript;
  expect(transcript).toContain("[00:01] 첫 문장입니다");
  expect(transcript).toContain("[00:03] 둘째 문장입니다");
  expect(transcript).toContain("[05:00] 여섯째 문장부터");
});

test("문장부호 없는 5,000단어 영어 전사문 → 간이 요약: 불릿 200자 초과 없음, 중복 없음", async () => {
  const { store } = h.boot();
  const key = "s/3-2/test-course/2026-01-05/09:00";
  const words = [];
  for (let i = 0; i < 5000; i++) words.push("lecture");
  words[100] = "midterm"; words[101] = "exam"; words[102] = "will"; words[103] = "be"; words[104] = "on"; words[105] = "friday";
  words[2500] = "assignment"; words[2501] = "due"; words[2502] = "next"; words[2503] = "week";
  const flatText = words.join(" ");
  store.set(key, { note: "", transcript: flatText, summary: null, audios: [], reviewed: false, pending: [] });

  const modal = await h.openTestSession("test-course");
  const makeBtn = h.findButton(modal, "간이 요약 만들기");
  expect(makeBtn).toBeTruthy();
  makeBtn.click();
  await jest.advanceTimersByTimeAsync(200);

  const summary = store._raw[key].summary;
  expect(summary).toBeTruthy();
  expect(summary.mode).toBe("local");
  const bullets = summary.text.split("\n").filter((l) => l.startsWith("- "));
  bullets.forEach((b) => expect(b.length).toBeLessThanOrEqual(203)); // "- " + 200자 + "…" 여유
  const seen = new Set();
  bullets.forEach((b) => {
    const key2 = b.replace(/\s+/g, "").slice(0, 40);
    expect(seen.has(key2)).toBe(false);
    seen.add(key2);
  });
});

test("'Claude용 프롬프트 복사'는 전사문·메모·주차 정보를 모두 담아 클립보드에 복사한다", async () => {
  const { store } = h.boot();
  const key = "s/3-2/test-course/2026-01-05/09:00";
  store.set(key, { note: "손글씨 과제 금지라고 함", transcript: "이것은 전사문 내용입니다", summary: null, audios: [], reviewed: false, pending: [] });

  const modal = await h.openTestSession("test-course");
  const btn = h.findButton(modal, "Claude용 프롬프트 복사");
  expect(btn).toBeTruthy();
  btn.click();
  await h.flush();

  expect(navigator.clipboard.writeText).toHaveBeenCalledTimes(1);
  const copied = navigator.clipboard.writeText.mock.calls[0][0];
  expect(copied).toContain("이것은 전사문 내용입니다");
  expect(copied).toContain("손글씨 과제 금지라고 함");
  expect(copied).toContain("테스트 과목");
  expect(copied).toContain("1주차");
  expect(copied).toContain("1주차 주제"); // 이번 주 실라버스 주제
  expect(btn.textContent).toBe("복사됨 ✓");
  await jest.advanceTimersByTimeAsync(2000);
  expect(btn.textContent).toBe("Claude용 프롬프트 복사");
});

test("'전사문만 복사'는 주차 태그로 시작하고 전사문·메모를 담는다", async () => {
  const { store } = h.boot();
  const key = "s/3-2/test-course/2026-01-05/09:00";
  store.set(key, { note: "메모입니다", transcript: "전사문입니다", summary: null, audios: [], reviewed: false, pending: [] });

  const modal = await h.openTestSession("test-course");
  const btn = h.findButton(modal, "전사문만 복사");
  btn.click();
  await h.flush();

  const copied = navigator.clipboard.writeText.mock.calls[0][0];
  expect(copied.indexOf("[테스트 과목 W01")).toBe(0); // 맨 첫 줄에 주차 태그
  expect(copied).toContain("전사문입니다");
  expect(copied).toContain("메모입니다");
});

test("'요약 붙여넣기'로 저장한 마크다운이 기존 요약 카드처럼 렌더되고, 다시 열어도 유지된다", async () => {
  const { store } = h.boot();
  const key = "s/3-2/test-course/2026-01-05/09:00";
  store.set(key, { note: "", transcript: "전사문", summary: null, audios: [], reviewed: false, pending: [] });

  const modal = await h.openTestSession("test-course");
  h.findButton(modal, "요약 붙여넣기").click();
  const textarea = modal.querySelector('textarea[placeholder^="Claude 응답"]');
  expect(textarea).toBeTruthy();
  textarea.value = "## 한 줄 요약\n엔트로피 소개\n\n## 핵심 내용\n- 첫 번째 요점";
  h.findButton(modal, "저장").click();

  expect(store._raw[key].summary.mode).toBe("manual");
  expect(modal.querySelector(".card.summary")).toBeTruthy();
  expect(modal.querySelector(".card.summary").innerHTML).toContain("엔트로피 소개");
  expect(modal.textContent).toContain("수동 요약(Claude)");

  // "새로고침" 시뮬레이션: 모달을 닫고 세션을 다시 연다 — localStorage(=fake Store)에서 다시 읽힘
  document.querySelector(".modal-head button").click();
  const modal2 = await h.openTestSession("test-course");
  expect(modal2.querySelector(".card.summary").innerHTML).toContain("엔트로피 소개");
  expect(modal2.textContent).toContain("수동 요약(Claude)");

  // 다시 열면 편집 가능(기존 텍스트가 textarea에 미리 채워짐)
  h.findButton(modal2, "요약 붙여넣기").click();
  expect(modal2.querySelector('textarea[placeholder^="Claude 응답"]').value).toContain("엔트로피 소개");
});

test("과목 페이지의 'Project 지침 복사'는 16주 실라버스·평가비중·주차 태그 설명을 담는다", async () => {
  h.boot();
  await h.goHash("#/c/test-course");
  const btn = h.findButton(document, "Project 지침 복사");
  expect(btn).toBeTruthy();
  btn.click();
  await h.flush();

  const copied = navigator.clipboard.writeText.mock.calls[0][0];
  expect(copied).toContain("테스트 과목");
  expect(copied).toContain("W01: 1주차 주제");
  expect(copied).toContain("W02: 2주차 주제");
  expect(copied).toContain("출석 100%");
  expect(copied).toContain("전사문 첫 줄");
});
