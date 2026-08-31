const h = require("./helpers");

beforeEach(() => { jest.useFakeTimers(); });
afterEach(() => { jest.useRealTimers(); jest.clearAllMocks(); });

test("자막/오디오가 있으면 '이어서 녹음' 라벨로 바뀐다", async () => {
  const { store } = h.boot();
  const key = "s/3-2/test-course/2026-01-05/09:00";
  store.set(key, { note: "", transcript: "이전 받아쓰기", summary: null, audios: [], reviewed: false, pending: [] });

  const modal = await h.openTestSession("test-course");
  const startBtn = h.findButton(modal, "녹음");
  expect(startBtn.textContent).toBe("● 이어서 녹음");
});

test("오디오 삭제 버튼을 누르면 AudioStore와 세션 목록에서 함께 지워진다", async () => {
  const { store, audioStore } = h.boot();
  const key = "s/3-2/test-course/2026-01-05/09:00";
  const id = key + "/rec-1";
  await audioStore.put(id, new Blob(["x"], { type: "audio/webm" }));
  store.set(key, { note: "", transcript: "", summary: null, audios: [{ id, label: "녹음 1", size: 1, at: "테스트" }], reviewed: false, pending: [] });

  const modal = await h.openTestSession("test-course");
  await h.flush();
  const delBtn = h.findButton(modal, "삭제");
  expect(delBtn).toBeTruthy();
  delBtn.click();

  expect(await audioStore.get(id)).toBeNull();
  expect(store.get(key, {}).audios).toEqual([]);
});

test("닫기 ✕ 버튼으로 모달을 닫으면 DOM에서 제거된다", async () => {
  h.boot();
  await h.openTestSession("test-course");
  expect(document.querySelector(".modal")).toBeTruthy();
  document.querySelector(".modal-head button").click();
  expect(document.querySelector(".modal")).toBeNull();
});

test("Escape 키로 모달을 닫을 수 있다", async () => {
  h.boot();
  await h.openTestSession("test-course");
  expect(document.querySelector(".modal")).toBeTruthy();
  document.dispatchEvent(new window.KeyboardEvent("keydown", { key: "Escape" }));
  expect(document.querySelector(".modal")).toBeNull();
});

test("스크림(바깥 영역) 클릭으로 모달을 닫을 수 있다", async () => {
  h.boot();
  await h.openTestSession("test-course");
  const scrim = document.querySelector(".scrim");
  expect(scrim).toBeTruthy();
  scrim.dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
  expect(document.querySelector(".modal")).toBeNull();
});

test("녹음 중 닫기를 누르면 확인 후 저장하고 닫는다", async () => {
  const { store } = h.boot();
  store.set("ai", { sttUrl: "https://fake.test/transcribe" });
  global.fetch = h.makeFetchQueue().fn;
  global.confirm = jest.fn(() => true);

  const modal = await h.openTestSession("test-course");
  h.findButton(modal, "녹음 시작").click();
  await h.flush();

  document.querySelector(".modal-head button").click(); // 닫기 ✕
  await h.flush();

  expect(global.confirm).toHaveBeenCalled();
  expect(document.querySelector(".modal")).toBeNull();
  const key = "s/3-2/test-course/2026-01-05/09:00";
  expect(store._raw[key]).toBeTruthy(); // 저장은 되어 있어야 함
});
