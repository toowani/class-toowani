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

test("문장부호 없는 5,000단어 영어 전사문 → 기기 내 요약: 불릿 200자 초과 없음, 중복 없음", async () => {
  const { store } = h.boot();
  // API_DEFAULTS도 cfg.url도 없어 로컬 요약 경로를 탄다
  const key = "s/3-2/test-course/2026-01-05/09:00";
  const words = [];
  for (let i = 0; i < 5000; i++) words.push("lecture");
  words[100] = "midterm"; words[101] = "exam"; words[102] = "will"; words[103] = "be"; words[104] = "on"; words[105] = "friday";
  words[2500] = "assignment"; words[2501] = "due"; words[2502] = "next"; words[2503] = "week";
  const flatText = words.join(" ");
  store.set(key, { note: "", transcript: flatText, summary: null, audios: [], reviewed: false, pending: [] });

  const modal = await h.openTestSession("test-course");
  const makeBtn = h.findButton(modal, "지금 만들기");
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

test("AI 요약 호출이 실패(500)하면 로컬로 폴백하고 실패 사유 표시 + 재시도 버튼을 보여준다", async () => {
  const { store } = h.boot();
  window.API_DEFAULTS = { summarize: "https://default.test/", transcribe: "https://default.test/transcribe" };
  const fq = h.makeFetchQueue();
  global.fetch = jest.fn((url, init) => {
    if (init && init.method === "POST" && url === "https://default.test/") {
      return Promise.resolve({ ok: false, status: 500, json: () => Promise.resolve({}) });
    }
    return fq.fn(url, init);
  });

  const key = "s/3-2/test-course/2026-01-05/09:00";
  store.set(key, { note: "", transcript: "some transcript text here that is long enough", summary: null, audios: [], reviewed: false, pending: [] });

  const modal = await h.openTestSession("test-course");
  h.findButton(modal, "지금 만들기").click();
  await jest.advanceTimersByTimeAsync(200);

  const summary = store._raw[key].summary;
  expect(summary.mode).toBe("local");
  expect(summary.aiError).toContain("HTTP 500");
  expect(modal.textContent).toContain("AI 요약 실패");
  expect(modal.textContent).toContain("HTTP 500");
  expect(h.findButton(modal, "AI로 다시 시도")).toBeTruthy();
});
