const h = require("./helpers");

beforeEach(() => { jest.useFakeTimers(); });
afterEach(() => { jest.useRealTimers(); jest.clearAllMocks(); delete window.API_DEFAULTS; });

function setSttUrl(store) {
  store.set("ai", { sttUrl: "https://fake.test/transcribe" });
}

test("12분 녹음 → 5/5/2분 3조각이 순서대로 transcript에 들어간다 (단일 흐름 큐)", async () => {
  const { store } = h.boot();
  setSttUrl(store);
  const fq = h.makeFetchQueue();
  global.fetch = fq.fn;

  const modal = await h.openTestSession("test-course");
  h.findButton(modal, "녹음 시작").click();
  await h.flush();

  // 5분 경과 → 1번째 조각(300초) 전송 시작
  await jest.advanceTimersByTimeAsync(5 * 60 * 1000);
  expect(fq.calls.length).toBe(1);
  expect(fq.calls[0].init.headers["x-duration-sec"]).toBe("300");

  // 추가로 5분 더 경과 → 2번째 조각은 "생성"되지만, 1번째 응답이 아직 없어 전송은 큐에서 대기
  await jest.advanceTimersByTimeAsync(5 * 60 * 1000);
  expect(fq.calls.length).toBe(1); // 단일 흐름 큐라 아직 안 나감

  // 1번째 조각 응답 도착 → 그제서야 2번째 조각이 전송된다
  fq.calls[0].resolve(h.okResponse({ text: "A" }));
  await h.flush();
  expect(fq.calls.length).toBe(2);

  // 남은 2분을 마저 채운 뒤 중지 → 마지막(2분) 조각이 큐에 더해지고, 모든 조각이
  // 끝날 때까지 저장을 미룬다
  await jest.advanceTimersByTimeAsync(2 * 60 * 1000);
  h.findButton(modal, "중지 후 요약").click();
  await h.flush();

  // 2번째 조각 응답(먼저 들어오는 것처럼 보이게 굳이 나중에 resolve해도 순서는 큐가 보장)
  fq.calls[1].resolve(h.okResponse({ text: "B" }));
  await h.flush();
  expect(fq.calls.length).toBe(3);
  fq.calls[2].resolve(h.okResponse({ text: "C" }));
  await jest.advanceTimersByTimeAsync(1000);

  const saved = Object.values(store._raw).find((v) => v && typeof v.transcript === "string" && v.transcript.includes("A"));
  expect(saved).toBeTruthy();
  const idxA = saved.transcript.indexOf("A");
  const idxB = saved.transcript.indexOf("B");
  const idxC = saved.transcript.indexOf("C");
  expect(idxA).toBeGreaterThanOrEqual(0);
  expect(idxB).toBeGreaterThan(idxA);
  expect(idxC).toBeGreaterThan(idxB);
  expect(saved.pending).toEqual([]);
});

test("조각 전송이 3번 실패하면 '대기 조각 지금 처리'로 재시도해 올바른 자리에 들어간다", async () => {
  const { store } = h.boot();
  setSttUrl(store);
  const fq = h.makeFetchQueue();
  global.fetch = fq.fn;

  const modal = await h.openTestSession("test-course");
  h.findButton(modal, "녹음 시작").click();
  await h.flush();

  await jest.advanceTimersByTimeAsync(5 * 60 * 1000); // 1번째 조각 전송
  expect(fq.calls.length).toBe(1);

  // 3회 모두 실패 (재시도 사이 800ms/1600ms/2400ms 대기)
  fq.calls[0].reject(new Error("network"));
  await jest.advanceTimersByTimeAsync(1000);
  expect(fq.calls.length).toBe(2);
  fq.calls[1].reject(new Error("network"));
  await jest.advanceTimersByTimeAsync(2000);
  expect(fq.calls.length).toBe(3);
  fq.calls[2].reject(new Error("network"));
  await jest.advanceTimersByTimeAsync(3000);

  // 재시도 대기(800+1600+2400ms)가 흐르는 동안에도 회전 녹음은 계속되고 있었으니,
  // 중지하면 그 사이 쌓인 짧은 마지막 조각이 하나 더 나가 성공으로 마무리된다.
  h.findButton(modal, "중지 후 요약").click();
  await h.flush();
  expect(fq.calls.length).toBe(4);
  fq.calls[3].resolve(h.okResponse({ text: "마지막 조각" }));
  await jest.advanceTimersByTimeAsync(500);

  var key = Object.keys(store._raw).find((k) => store._raw[k] && (store._raw[k].pending || []).length);
  expect(key).toBeTruthy();
  var before = store._raw[key];
  expect(before.pending[0].status).toBe("failed");
  expect(before.transcript).toContain("[1번째 조각 실패]");

  // "대기 조각 지금 처리" 버튼으로 재시도 — 이번엔 성공
  const retryBtn = h.findButton(modal, "대기 조각 지금 처리");
  expect(retryBtn).toBeTruthy();
  retryBtn.click();
  await h.flush();
  const retryCall = fq.calls[fq.calls.length - 1];
  retryCall.resolve(h.okResponse({ text: "복구된 텍스트" }));
  await jest.advanceTimersByTimeAsync(500);

  const after = store._raw[key];
  expect(after.pending).toEqual([]);
  expect(after.transcript).toContain("복구된 텍스트");
  expect(after.transcript).not.toContain("[1번째 조각 실패]");
});

test("예산 초과(429)는 즉시 이월 대기로 남고 재시도하지 않는다", async () => {
  const { store } = h.boot();
  setSttUrl(store);
  const fq = h.makeFetchQueue();
  global.fetch = fq.fn;

  const modal = await h.openTestSession("test-course");
  h.findButton(modal, "녹음 시작").click();
  await h.flush();
  await jest.advanceTimersByTimeAsync(5 * 60 * 1000);
  expect(fq.calls.length).toBe(1);

  fq.calls[0].resolve(h.budgetResponse("2026-09-01T00:00:00.000Z"));
  await h.flush();
  expect(fq.calls.length).toBe(1); // 예산 초과는 재시도하지 않음

  h.findButton(modal, "중지 후 요약").click();
  await jest.advanceTimersByTimeAsync(2000);

  var key = Object.keys(store._raw).find((k) => (store._raw[k].pending || []).length);
  var d = store._raw[key];
  expect(d.pending[0].status).toBe("carryover");
  expect(d.transcript).toContain("이월 대기");
});

test("취소하면 baseTranscript로 되돌아가고, 늦게 도착하는 조각 응답은 무시된다", async () => {
  const { store } = h.boot();
  setSttUrl(store);
  const fq = h.makeFetchQueue();
  global.fetch = fq.fn;

  const modal = await h.openTestSession("test-course");
  h.findButton(modal, "녹음 시작").click();
  await h.flush();
  await jest.advanceTimersByTimeAsync(5 * 60 * 1000);
  expect(fq.calls.length).toBe(1);

  h.findButton(modal, "✕ 취소").click();
  await h.flush();

  // 취소 이후 응답이 도착해도 결과는 버려진다
  fq.calls[0].resolve(h.okResponse({ text: "너무 늦음" }));
  await jest.advanceTimersByTimeAsync(500);

  var key = "s/3-2/test-course/2026-01-05/09:00";
  var d = store._raw[key];
  expect(d ? (d.transcript || "") : "").not.toContain("너무 늦음");
});

test("transcribe:false 과목은 조각을 아예 만들지 않는다 (/transcribe 호출 0회)", async () => {
  h.boot();
  const fq = h.makeFetchQueue();
  global.fetch = fq.fn;

  const modal = await h.openTestSession("piano-course");
  expect(modal.textContent).toContain("이 과목은 받아쓰기 안 함");
  h.findButton(modal, "녹음 시작").click();
  await h.flush();
  await jest.advanceTimersByTimeAsync(20 * 60 * 1000);

  expect(fq.calls.length).toBe(0);
});

test("업로드한 오디오에 받아쓰기 버튼을 누르면 구분선과 함께 transcript에 덧붙는다", async () => {
  const { store, audioStore } = h.boot();
  setSttUrl(store);
  const fq = h.makeFetchQueue();
  global.fetch = fq.fn;
  global.Audio = class {
    set src(v) { this._src = v; setTimeout(() => { this.duration = 42; if (this.onloadedmetadata) this.onloadedmetadata(); }, 0); }
    get src() { return this._src; }
  };

  const modal = await h.openTestSession("test-course");
  const key = "s/3-2/test-course/2026-01-05/09:00";
  const uploadId = key + "/upload/1";
  const blob = new Blob(["fake audio"], { type: "audio/mp4" });
  await audioStore.put(uploadId, blob);
  store.set(key, Object.assign(store.get(key, {}), {
    audios: [{ id: uploadId, label: "휴대폰", size: blob.size, at: "테스트" }]
  }));

  // 오디오 목록을 다시 그리도록 세션을 새로 연다
  document.querySelector(".modal-head button").click(); // 닫기
  const modal2 = await h.openTestSession("test-course");
  await h.flush();

  const transcribeBtn = h.findButton(modal2, "받아쓰기");
  expect(transcribeBtn).toBeTruthy();
  transcribeBtn.click();
  await jest.advanceTimersByTimeAsync(10);
  expect(fq.calls.length).toBe(1);
  fq.calls[0].resolve(h.okResponse({ text: "업로드에서 받아쓴 내용" }));
  await jest.advanceTimersByTimeAsync(10);

  const saved = store._raw[key];
  expect(saved.transcript).toContain("[업로드: 휴대폰]");
  expect(saved.transcript).toContain("업로드에서 받아쓴 내용");
});

test("설정을 아무것도 안 넣어도 data.js의 API_DEFAULTS로 받아쓰기가 동작한다 (alert 없음)", async () => {
  const { store, audioStore } = h.boot(); // "ai" 설정은 전혀 저장하지 않음
  window.API_DEFAULTS = { summarize: "https://default.test/", transcribe: "https://default.test/transcribe" };
  const fq = h.makeFetchQueue();
  global.fetch = fq.fn;
  global.alert = jest.fn();
  global.Audio = class {
    set src(v) { this._src = v; setTimeout(() => { this.duration = 10; if (this.onloadedmetadata) this.onloadedmetadata(); }, 0); }
    get src() { return this._src; }
  };

  const key = "s/3-2/test-course/2026-01-05/09:00";
  const uploadId = key + "/upload/1";
  const blob = new Blob(["fake audio"], { type: "audio/mp4" });
  await audioStore.put(uploadId, blob);
  store.set(key, { note: "", transcript: "", summary: null, reviewed: false, pending: [], audios: [{ id: uploadId, label: "휴대폰", size: blob.size, at: "테스트" }] });

  const modal = await h.openTestSession("test-course");
  await h.flush();
  const transcribeBtn = h.findButton(modal, "받아쓰기");
  transcribeBtn.click();
  await jest.advanceTimersByTimeAsync(10);

  expect(global.alert).not.toHaveBeenCalled();
  expect(fq.calls.length).toBe(1);
  expect(fq.calls[0].url).toBe("https://default.test/transcribe");
});
