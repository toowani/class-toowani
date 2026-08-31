/* 테스트 공용 도구 — 실제 브라우저 API 대신 최소한의 가짜 구현을 붙여
 * assets/app.js를 있는 그대로(수정 없이) jsdom에서 구동한다. */

function makeSem() {
  return {
    id: "3-2", term: "3학년 2학기", label: "테스트 학기", weeks: 2, startMonday: "2026-01-05",
    courses: [
      {
        id: "test-course", name: "테스트 과목", en: "Test", code: "T101", prof: "김교수", credits: "3/3/0",
        color: "#000000", sttLang: "ko-KR",
        book: "-", grading: [["출석", 100]], keywords: [],
        meetings: [{ day: 1, start: "09:00", end: "10:15", room: "1호관" }],
        weekTopics: ["1주차 주제", "2주차 주제"]
      },
      {
        id: "piano-course", name: "피아노", en: "Piano", code: "GS0201-02", prof: "박상희", credits: "2/0/0",
        color: "#111111", sttLang: "ko-KR", transcribe: false,
        book: "-", grading: [["출석", 100]], keywords: [],
        meetings: [{ day: 1, start: "11:00", end: "12:00", room: "2호관" }],
        weekTopics: ["1주차 주제", "2주차 주제"]
      }
    ]
  };
}

function makeFakeStore() {
  var data = {};
  return {
    persistent: true,
    get: function (k, fallback) { return (k in data) ? JSON.parse(JSON.stringify(data[k])) : fallback; },
    set: function (k, v) { data[k] = JSON.parse(JSON.stringify(v)); },
    remove: function (k) { delete data[k]; },
    keys: function () { return Object.keys(data); },
    dump: function () { return JSON.parse(JSON.stringify(data)); },
    load: function (o) { Object.keys(o).forEach(function (k) { data[k] = o[k]; }); },
    _raw: data
  };
}

function makeFakeAudioStore() {
  var blobs = {};
  return {
    put: function (id, blob) { blobs[id] = blob; return Promise.resolve(true); },
    get: function (id) { return Promise.resolve(Object.prototype.hasOwnProperty.call(blobs, id) ? blobs[id] : null); },
    del: function (id) { delete blobs[id]; return Promise.resolve(true); },
    _raw: blobs
  };
}

class FakeMediaRecorder {
  constructor(stream, opts) {
    this.stream = stream;
    this.mimeType = (opts && opts.mimeType) || "audio/webm";
    this.state = "recording";
    this.ondataavailable = null;
    this.onstop = null;
  }
  start() { this.state = "recording"; }
  stop() {
    if (this.state === "inactive") return;
    this.state = "inactive";
    if (this.ondataavailable) this.ondataavailable({ data: new Blob(["x"], { type: this.mimeType }) });
    if (this.onstop) this.onstop();
  }
}
FakeMediaRecorder.isTypeSupported = function () { return true; };

class FakeAudioContext {
  createMediaStreamSource() { return { connect: function () {} }; }
  createMediaStreamDestination() { return { channelCount: 2, channelCountMode: "max", stream: { getTracks: function () { return []; } } }; }
  close() { return Promise.resolve(); }
}

function fakeMicStream() {
  return { getTracks: function () { return [{ stop: function () {} }]; } };
}

// fetch를 큐로 통제 — 언제, 어떤 응답으로 각 호출을 마무리할지 테스트가 직접 결정한다.
function makeFetchQueue() {
  var calls = [];
  var fn = jest.fn(function (url, init) {
    var entry = { url: url, init: init };
    var p = new Promise(function (res, rej) { entry.resolve = res; entry.reject = rej; });
    entry.promise = p;
    calls.push(entry);
    return p;
  });
  return { fn: fn, calls: calls };
}
function okResponse(obj) { return { ok: true, status: 200, json: function () { return Promise.resolve(obj); } }; }
function budgetResponse(resetAt) { return { ok: false, status: 429, json: function () { return Promise.resolve({ reason: "daily_budget", resetAt: resetAt || null }); } }; }

function setupGlobals() {
  global.MediaRecorder = FakeMediaRecorder;
  global.AudioContext = FakeAudioContext;
  delete global.webkitAudioContext;
  Object.defineProperty(global.navigator, "mediaDevices", {
    value: { getUserMedia: jest.fn(function () { return Promise.resolve(fakeMicStream()); }) },
    configurable: true
  });
  global.URL.createObjectURL = jest.fn(function () { return "blob:mock"; });
  global.URL.revokeObjectURL = jest.fn();
  global.confirm = jest.fn(function () { return true; });
  global.alert = jest.fn();
  global.scrollTo = jest.fn(); // jsdom엔 없음 — 그대로 두면 매 렌더마다 "not implemented" 콘솔 스팸
}

function boot(sem) {
  jest.resetModules();
  setupGlobals();
  document.body.innerHTML = '<header class="top"><div class="top-in"></div></header><main id="app"></main>';
  window.location.hash = "";
  window.SEMESTER_ID = "3-2";
  window.SEM_3_2 = sem || makeSem();
  var store = makeFakeStore();
  var audioStore = makeFakeAudioStore();
  window.Store = store;
  window.AudioStore = audioStore;
  require("../assets/app.js");
  document.dispatchEvent(new window.Event("DOMContentLoaded", { bubbles: true, cancelable: true }));
  return { store: store, audioStore: audioStore };
}

// jsdom은 <a href="#..."> 클릭만으로 hashchange를 안정적으로 쏘지 않아서 직접 갱신한다.
// location.hash 대입 자체가 jsdom 내부적으로 (가짜) 타이머를 거쳐 hashchange를 예약하므로,
// 여기서 그 타이머를 바로 흘려보내 "나중에 아무 때나" 발화하는 일이 없게 한다.
async function goHash(hash) {
  window.location.hash = hash;
  await jest.advanceTimersByTimeAsync(0);
}

async function openTestSession(courseId, rowIndex) {
  await goHash("#/c/" + courseId);
  var rows = document.querySelectorAll(".session-row");
  rows[rowIndex || 0].click();
  return document.querySelector(".modal");
}

function findButton(root, text) {
  return Array.from(root.querySelectorAll("button")).find(function (b) { return b.textContent.indexOf(text) >= 0; });
}

async function flush() {
  await jest.advanceTimersByTimeAsync(0);
}

module.exports = {
  makeSem, makeFakeStore, makeFakeAudioStore, FakeMediaRecorder, FakeAudioContext,
  fakeMicStream, makeFetchQueue, okResponse, budgetResponse, setupGlobals, boot,
  goHash, openTestSession, findButton, flush
};
