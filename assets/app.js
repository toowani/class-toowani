/* class.toowani.com — app */
(function () {
  "use strict";

  var SEM_ID = window.SEMESTER_ID || "3-2";
  var SEM = (SEM_ID === "3-2") ? window.SEM_3_2 : null;
  var DAYS = ["일", "월", "화", "수", "목", "금", "토"];
  var root, todayISO = iso(new Date());

  /* ── 유틸 ─────────────────────────────── */
  function $(s, p) { return (p || document).querySelector(s); }
  function el(tag, attrs, kids) {
    var n = document.createElement(tag);
    if (attrs) Object.keys(attrs).forEach(function (k) {
      if (k === "class") n.className = attrs[k];
      else if (k === "html") n.innerHTML = attrs[k];
      else if (k === "text") n.textContent = attrs[k];
      else if (k === "style") n.setAttribute("style", attrs[k]);
      else if (k.indexOf("on") === 0) n.addEventListener(k.slice(2), attrs[k]);
      else if (attrs[k] != null) n.setAttribute(k, attrs[k]);
    });
    (kids || []).forEach(function (c) { if (c) n.appendChild(typeof c === "string" ? document.createTextNode(c) : c); });
    return n;
  }
  function iso(d) {
    return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
  }
  function parse(s) { var p = s.split("-"); return new Date(+p[0], +p[1] - 1, +p[2]); }
  function addDays(s, n) { var d = parse(s); d.setDate(d.getDate() + n); return iso(d); }
  function diffDays(a, b) { return Math.round((parse(b) - parse(a)) / 864e5); }
  function pretty(s) { var d = parse(s); return (d.getMonth() + 1) + "월 " + d.getDate() + "일 (" + DAYS[d.getDay()] + ")"; }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }

  function weekOf(dateISO) {
    var n = Math.floor(diffDays(SEM.startMonday, dateISO) / 7) + 1;
    return n;
  }
  function weekStart(w) { return addDays(SEM.startMonday, (w - 1) * 7); }
  function course(id) { return SEM.courses.filter(function (c) { return c.id === id; })[0]; }

  // 과목의 전체 수업 회차
  function sessionsOf(c) {
    var out = [];
    for (var w = 1; w <= SEM.weeks; w++) {
      c.meetings.forEach(function (m) {
        out.push({ course: c, week: w, date: addDays(weekStart(w), m.day - 1), m: m, topic: c.weekTopics[w - 1] || "", mark: c.weekMarks && c.weekMarks[w] });
      });
    }
    return out.sort(function (a, b) { return a.date < b.date ? -1 : a.date > b.date ? 1 : (a.m.start < b.m.start ? -1 : 1); });
  }
  function sessionsOn(dateISO) {
    var out = [];
    var w = weekOf(dateISO), dow = parse(dateISO).getDay();
    if (w < 1 || w > SEM.weeks) return out;
    SEM.courses.forEach(function (c) {
      c.meetings.forEach(function (m) {
        if (m.day === dow) out.push({ course: c, week: w, date: dateISO, m: m, topic: c.weekTopics[w - 1] || "", mark: c.weekMarks && c.weekMarks[w] });
      });
    });
    return out.sort(function (a, b) { return a.m.start < b.m.start ? -1 : 1; });
  }
  function skey(s) { return "s/" + SEM_ID + "/" + s.course.id + "/" + s.date + "/" + s.m.start; }
  function normalizeSession(d) {
    if (!Array.isArray(d.audios)) {
      d.audios = d.audio ? [{ id: d.audio, label: "녹음", size: null, at: null }] : [];
    }
    if (typeof d.reviewed !== "boolean") d.reviewed = false;
    if (!Array.isArray(d.pending)) d.pending = [];
    return d;
  }
  function sdata(s) { return normalizeSession(Store.get(skey(s), { note: "", transcript: "", summary: null, audio: null, audios: [], reviewed: false, pending: [] })); }
  function ssave(s, patch) {
    var d = sdata(s); Object.keys(patch).forEach(function (k) { d[k] = patch[k]; });
    Store.set(skey(s), d); return d;
  }
  function hasContent(d) { return !!(d && ((d.note && d.note.trim()) || (d.transcript && d.transcript.trim()) || d.summary || (d.audios && d.audios.length))); }
  function fmtBytes(n) {
    if (n == null) return "";
    if (n < 1024) return n + "B";
    if (n < 1024 * 1024) return (n / 1024).toFixed(0) + "KB";
    return (n / 1024 / 1024).toFixed(1) + "MB";
  }

  /* ── 라우터 ───────────────────────────── */
  function syncNav() {
    var links = document.querySelectorAll("header.top nav a");
    var isTT = location.hash.indexOf("tt") > 0;
    if (links[0]) links[0].className = isTT ? "" : "on";
    if (links[1]) links[1].className = isTT ? "on" : "";
  }

  var openModal = null;
  function closeOpenModal() {
    if (!openModal) return;
    var m = openModal; openModal = null;
    m.forceClose();
  }

  function route() {
    var h = location.hash.replace(/^#\/?/, "").split("/");
    syncNav();
    closeOpenModal();
    if (!SEM) return renderArchive();
    if (h[0] === "c" && h[1]) return renderCourse(h[1], h[2] === "w" ? +h[3] : null);
    if (h[0] === "tt") return renderTimetable();
    return renderToday();
  }
  window.addEventListener("hashchange", route);
  window.addEventListener("beforeunload", function (e) {
    if (rec && rec.active) { e.preventDefault(); e.returnValue = ""; }
  });

  /* ── 공통 셸 ──────────────────────────── */
  function shell(nodes) {
    root.innerHTML = "";
    nodes.forEach(function (n) { if (n) root.appendChild(n); });
    root.appendChild(el("footer", {}, [
      el("span", { text: "class.toowani.com" }),
      el("a", { href: "../", text: "← 전체 학기" }),
      el("button", { class: "ghost", onclick: openSettings, text: "설정 · 백업" }),
      el("span", { class: "dim", text: Store.persistent ? "이 브라우저에 저장됨" : "임시 저장 (브라우저 저장소 사용 불가)" })
    ]));
    window.scrollTo(0, 0);
  }

  function nav(active) {
    return el("nav", {}, [
      el("a", { href: "#/", class: active === "today" ? "on" : "", text: "오늘" }),
      el("a", { href: "#/tt", class: active === "tt" ? "on" : "", text: "시간표" }),
      el("a", { href: "../", text: "학기" })
    ]);
  }

  /* ── 16주 레일 ────────────────────────── */
  function rail(opts) {
    var cur = opts.current, c = opts.course;
    var g = el("div", { class: "rail" });
    for (var w = 1; w <= SEM.weeks; w++) (function (w) {
      var mark = c ? (c.weekMarks && c.weekMarks[w]) : marksAt(w);
      var cls = "rail-cell" + (w < cur ? " past" : "") + (w === cur ? " now" : "") + (mark ? " mark" : "");
      var title = (c ? (c.weekTopics[w - 1] || "") : (marksAt(w) || "")) + (mark ? " · " + mark : "");
      g.appendChild(el("button", {
        class: cls, title: "Week " + w + " (" + pretty(weekStart(w)) + " 주) " + title,
        style: c ? "color:" + c.color : "",
        onclick: function () {
          if (c) location.hash = "#/c/" + c.id + "/w/" + w;
          else location.hash = "#/tt";
        }
      }, [el("span", { text: String(w).padStart(2, "0") }), el("span", { class: "dot" })]));
    })(w);
    return g;
  }
  function marksAt(w) {
    var out = [];
    SEM.courses.forEach(function (c) { if (c.weekMarks && c.weekMarks[w]) out.push(c.name + " " + c.weekMarks[w]); });
    return out.join(" · ");
  }
  function mmdd(dateISO) { var d = parse(dateISO); return (d.getMonth() + 1) + "/" + d.getDate(); }
  function ddayLabel(dateISO) {
    var n = diffDays(todayISO, dateISO);
    if (n > 0) return "D-" + n;
    if (n === 0) return "D-day";
    return "D+" + (-n);
  }

  /* ── D-day 스트립 ─────────────────────── */
  var DDAY_RE = /시험|고사|중간|기말|Midterm|Final|발표|마감/i;
  function upcomingMarks() {
    var out = [];
    SEM.courses.forEach(function (c) {
      if (!c.weekMarks) return;
      var minDay = Math.min.apply(null, c.meetings.map(function (m) { return m.day; }));
      Object.keys(c.weekMarks).forEach(function (wk) {
        var label = c.weekMarks[wk];
        if (!DDAY_RE.test(label)) return;
        var date = addDays(weekStart(+wk), minDay - 1);
        if (date < todayISO) return;
        out.push({ course: c, week: +wk, label: label, date: date });
      });
    });
    return out.sort(function (a, b) { return a.date < b.date ? -1 : a.date > b.date ? 1 : 0; }).slice(0, 4);
  }
  function ddayStrip() {
    var items = upcomingMarks();
    if (!items.length) return null;
    var row = el("div", { class: "dday-strip" });
    items.forEach(function (m) {
      row.appendChild(el("a", {
        class: "dday-chip", href: "#/c/" + m.course.id + "/w/" + m.week,
        style: "color:" + m.course.color + ";border-color:" + m.course.color + ";background:" + m.course.color + "1A"
      }, [
        el("b", { text: "D-" + diffDays(todayISO, m.date) }),
        document.createTextNode(" · " + m.course.name + " " + m.label + " (" + mmdd(m.date) + ")")
      ]));
    });
    return row;
  }

  /* ── 이월된 받아쓰기(예산 초과분) ─────── */
  function allSessionKeys() {
    var prefix = "s/" + SEM_ID + "/";
    return Store.keys().filter(function (k) { return k.indexOf(prefix) === 0; });
  }
  function keyToSessionInfo(k) {
    var parts = k.split("/"); // s / SEM_ID / courseId / date / start
    var c = course(parts[2]);
    if (!c) return null;
    var date = parts[3], start = parts[4];
    var m = c.meetings.filter(function (mm) { return mm.start === start; })[0] || c.meetings[0];
    return { course: c, date: date, m: m, week: weekOf(date) };
  }
  function findDueCarryover() {
    var now = new Date();
    var out = [];
    allSessionKeys().forEach(function (k) {
      var d = Store.get(k, null);
      if (!d || !d.pending || !d.pending.length) return;
      var due = d.pending.some(function (p) { return p.status === "carryover" && (!p.resetAt || new Date(p.resetAt) <= now); });
      if (due) { var info = keyToSessionInfo(k); if (info) out.push(info); }
    });
    return out;
  }
  var carryoverInFlight = false;
  function carryoverBanner() {
    var due = findDueCarryover();
    if (!due.length && !carryoverInFlight) return null;
    var box = el("div", { class: "card" });
    if (carryoverInFlight) {
      box.appendChild(el("div", { class: "rec-bar" }, [el("span", { class: "small", text: "이월된 받아쓰기 처리 중…" })]));
      return el("section", { class: "block" }, [el("div", { class: "block-head" }, [el("h2", { text: "이월된 받아쓰기" })]), box]);
    }
    carryoverInFlight = true;
    box.appendChild(el("div", { class: "rec-bar" }, [el("span", { class: "small", text: "이월된 받아쓰기 처리 중… (" + due.length + "개 수업)" })]));
    var chain = Promise.resolve();
    var done = [];
    due.forEach(function (info) {
      var s = { course: info.course, date: info.date, m: info.m, week: info.week };
      chain = chain.then(function () {
        return resolvePendingForSession(s).then(function (r) { if (r.resolved > 0) done.push(info); });
      });
    });
    chain.then(function () {
      carryoverInFlight = false;
      box.innerHTML = "";
      if (!done.length) { box.appendChild(el("div", { class: "small dim", text: "지금은 처리할 수 있는 이월 조각이 없었습니다." })); return; }
      box.appendChild(el("div", { class: "rec-bar" }, [el("b", { text: "이월된 받아쓰기 " + done.length + "개 완료" })]));
      done.forEach(function (info) {
        box.appendChild(el("a", { class: "todo", href: "#/c/" + info.course.id + "/w/" + info.week }, [
          el("span", { class: "tiny mono", style: "color:" + info.course.color + ";width:96px;flex:none", text: info.course.name }),
          el("label", { text: "W" + String(info.week).padStart(2, "0") + " · 요약 다시 만들기 →" })
        ]));
      });
    });
    return el("section", { class: "block" }, [
      el("div", { class: "block-head" }, [el("h2", { text: "이월된 받아쓰기" })]),
      box
    ]);
  }

  /* ── 오늘 ─────────────────────────────── */
  function renderToday() {
    var w = weekOf(todayISO);
    var before = diffDays(todayISO, SEM.startMonday);
    var list = sessionsOn(todayISO);
    var lookahead = todayISO, guard = 0;
    while (!list.length && guard++ < 14) { lookahead = addDays(lookahead, 1); list = sessionsOn(lookahead); }
    var isToday = lookahead === todayISO;

    var hero = el("section", { class: "hero" }, [
      el("div", {}, [
        el("p", { class: "eyebrow", text: SEM.term + " · " + SEM.label }),
        el("h1", { text: pretty(todayISO) }),
        el("p", { class: "mute", style: "margin:10px 0 0",
          text: before > 0 ? ("개강까지 D-" + before + " · 첫 수업은 " + pretty(SEM.startMonday))
              : (w >= 1 && w <= SEM.weeks ? (isToday ? "오늘 수업 " + list.length + "개" : "오늘은 수업 없음 · 다음 수업 " + pretty(lookahead)) : "학기 종료") })
      ]),
      el("div", { class: "hero-week" }, [
        el("i", { text: "week" }),
        el("b", { text: (w >= 1 && w <= SEM.weeks) ? String(w).padStart(2, "0") : "--" })
      ])
    ]);

    var railBlock = el("section", { class: "block" }, [
      el("div", { class: "block-head" }, [el("h2", { text: "16주" }), el("span", { class: "eyebrow", text: "점 = 시험/제출 주" })]),
      rail({ current: w }),
      el("p", { class: "tiny dim", style: "margin-top:10px", text: (w >= 1 && w <= SEM.weeks && marksAt(w)) ? ("이번 주: " + marksAt(w)) : "칸에 마우스를 올리면 그 주 일정이 보입니다." })
    ]);

    var spine = el("div", { class: "spine" });
    list.forEach(function (s) {
      var d = sdata(s);
      var past = isToday && nowMinutes() > toMin(s.m.end);
      spine.appendChild(el("div", { class: "slot" + (past ? " done" : ""), style: "color:" + s.course.color }, [
        el("div", { class: "clock" }, [el("span", { text: s.m.start }), el("em", { text: s.m.end })]),
        el("a", { class: "slot-card", href: "#/c/" + s.course.id + "/w/" + s.week }, [
          el("div", { class: "body" }, [
            el("h3", { text: s.course.name }),
            el("div", { class: "topic", text: (s.mark ? "[" + s.mark + "] " : "") + (s.topic || "—") }),
            el("div", { class: "tiny dim mono", style: "margin-top:4px", text: s.m.room })
          ]),
          el("span", { class: "go", text: hasContent(d) ? "기록 있음 →" : "녹음 · 메모 →" })
        ])
      ]));
    });

    var todayBlock = el("section", { class: "block" }, [
      el("div", { class: "block-head" }, [
        el("h2", { text: isToday ? "오늘 수업" : pretty(lookahead) + " 수업" }),
        el("span", { class: "eyebrow", text: "수업을 누르면 녹음 화면" })
      ]),
      list.length ? spine : el("div", { class: "empty", text: "예정된 수업이 없습니다." })
    ]);

    var cg = el("div", { class: "grid g3" });
    SEM.courses.forEach(function (c) { cg.appendChild(courseCard(c, w)); });
    var courseBlock = el("section", { class: "block" }, [
      el("div", { class: "block-head" }, [el("h2", { text: "과목 " + SEM.courses.length }), el("span", { class: "eyebrow", text: "막대 = 평가 비중" })]),
      cg
    ]);

    shell([hero, ddayStrip(), carryoverBanner(), railBlock, todayBlock, reviewBlock(), courseBlock, todoDigest()]);
  }

  function nowMinutes() { var d = new Date(); return d.getHours() * 60 + d.getMinutes(); }
  function toMin(t) { var p = t.split(":"); return +p[0] * 60 + +p[1]; }

  function courseCard(c, w) {
    var total = c.grading.reduce(function (a, g) { return a + g[1]; }, 0);
    var bars = el("div", { class: "bars" });
    var key = el("div", { class: "bar-key" });
    c.grading.forEach(function (g, i) {
      bars.appendChild(el("i", { style: "width:" + (g[1] / total * 100) + "%;background:" + c.color + ";opacity:" + (1 - i * 0.19) }));
      key.appendChild(el("span", {}, [el("b", { text: g[0] }), document.createTextNode(" " + g[1] + "%")]));
    });
    return el("a", { class: "card course-card", href: "#/c/" + c.id, style: "color:" + c.color }, [
      el("div", { class: "tiny mono dim", text: c.code + " · " + c.prof }),
      el("h3", { style: "color:var(--fg);margin-top:6px;font-size:17px", text: c.name }),
      el("div", { class: "tiny dim mono", style: "margin-top:4px", text: c.meetings.map(function (m) { return DAYS[m.day] + " " + m.start; }).join("  ") }),
      el("div", { class: "small mute", style: "margin-top:10px;min-height:38px", text: (w >= 1 && w <= SEM.weeks) ? (c.weekTopics[w - 1] || "") : c.en }),
      bars, key
    ]);
  }

  /* ── 복습 큐 ──────────────────────────── */
  function reviewQueue() {
    var out = [];
    SEM.courses.forEach(function (c) {
      sessionsOf(c).forEach(function (s) {
        if (s.date >= todayISO) return;
        var d = sdata(s);
        if (hasContent(d) && !d.reviewed) out.push(s);
      });
    });
    return out.sort(function (a, b) { return a.date < b.date ? -1 : a.date > b.date ? 1 : 0; }).slice(0, 5);
  }
  function reviewBlock() {
    var items = reviewQueue();
    var box = el("div", { class: "card" });
    if (!items.length) {
      box.appendChild(el("div", { class: "small dim", text: "복습할 게 없습니다." }));
    } else {
      items.forEach(function (s) {
        box.appendChild(el("a", { class: "todo", href: "#/c/" + s.course.id + "/w/" + s.week }, [
          el("span", { class: "tiny mono", style: "color:" + s.course.color + ";width:96px;flex:none", text: s.course.name }),
          el("label", { text: pretty(s.date) + " 수업 · D+" + diffDays(s.date, todayISO) + "일 전" })
        ]));
      });
    }
    return el("section", { class: "block" }, [
      el("div", { class: "block-head" }, [el("h2", { text: "복습할 것" }), el("span", { class: "eyebrow", text: "기록 있는데 아직 복습 안 한 것" })]),
      box
    ]);
  }

  /* ── 할 일 모음 ───────────────────────── */
  function todos(cid) { return Store.get("todo/" + SEM_ID + "/" + cid, []); }
  function saveTodos(cid, arr) { Store.set("todo/" + SEM_ID + "/" + cid, arr); }
  function sortByDue(items, getDue) {
    return items.slice().sort(function (a, b) {
      var da = getDue(a), db = getDue(b);
      if (da && db) return da < db ? -1 : da > db ? 1 : 0;
      if (da) return -1;
      if (db) return 1;
      return 0;
    });
  }

  function todoDigest() {
    var rows = [];
    SEM.courses.forEach(function (c) {
      todos(c.id).filter(function (t) { return !t.done; }).forEach(function (t) { rows.push({ c: c, t: t }); });
    });
    rows = sortByDue(rows, function (r) { return r.t.due; });
    var box = el("div", { class: "card" });
    if (!rows.length) box.appendChild(el("div", { class: "small dim", text: "아직 없습니다. 과목 페이지에서 과제·준비물을 적어두면 여기 모입니다." }));
    rows.slice(0, 12).forEach(function (r) {
      box.appendChild(el("div", { class: "todo" }, [
        el("span", { class: "tiny mono", style: "color:" + r.c.color + ";width:96px;flex:none", text: r.c.name }),
        el("label", { text: r.t.text + (r.t.due ? "  · " + ddayLabel(r.t.due) + " (" + mmdd(r.t.due) + ")" : "") })
      ]));
    });
    return el("section", { class: "block" }, [
      el("div", { class: "block-head" }, [el("h2", { text: "할 일" }), el("span", { class: "eyebrow", text: "과목별로 추가" })]),
      box
    ]);
  }

  /* ── 시간표 ───────────────────────────── */
  function renderTimetable() {
    var slots = [];
    SEM.courses.forEach(function (c) { c.meetings.forEach(function (m) { if (slots.indexOf(m.start) < 0) slots.push(m.start); }); });
    slots.sort();
    var table = el("table", { class: "tt" });
    var thead = el("thead"), tr = el("tr");
    tr.appendChild(el("th", { text: "" }));
    [1, 2, 3, 4, 5].forEach(function (d) { tr.appendChild(el("th", { text: DAYS[d] })); });
    thead.appendChild(tr); table.appendChild(thead);
    var tb = el("tbody");
    slots.forEach(function (st) {
      var r = el("tr");
      r.appendChild(el("td", { class: "time", text: st }));
      [1, 2, 3, 4, 5].forEach(function (d) {
        var td = el("td");
        SEM.courses.forEach(function (c) {
          c.meetings.forEach(function (m) {
            if (m.day === d && m.start === st) {
              td.appendChild(el("a", { class: "ev", href: "#/c/" + c.id, style: "color:" + c.color + ";background:" + c.color + "1A" }, [
                el("b", { text: c.name }), el("em", { text: m.start + "–" + m.end + " · " + m.room })
              ]));
            }
          });
        });
        r.appendChild(td);
      });
      tb.appendChild(r);
    });
    table.appendChild(tb);
    shell([
      el("section", { class: "hero" }, [el("div", {}, [
        el("p", { class: "eyebrow", text: SEM.term }), el("h1", { text: "시간표" })
      ])]),
      el("section", { class: "block" }, [table,
        el("p", { class: "tiny dim", style: "margin-top:14px", text: "시간·강의실을 고치려면 assets/data.js 의 meetings 를 수정하세요." })])
    ]);
  }

  /* ── 과목 상세 ────────────────────────── */
  function renderCourse(cid, openWeek) {
    var c = course(cid);
    if (!c) { location.hash = "#/"; return; }
    if (openWeek) history.replaceState(null, "", "#/c/" + cid);
    var w = weekOf(todayISO);
    var total = c.grading.reduce(function (a, g) { return a + g[1]; }, 0);
    var bars = el("div", { class: "bars" }), key = el("div", { class: "bar-key" });
    c.grading.forEach(function (g, i) {
      bars.appendChild(el("i", { style: "width:" + (g[1] / total * 100) + "%;background:" + c.color + ";opacity:" + (1 - i * 0.19) }));
      key.appendChild(el("span", {}, [el("b", { text: g[0] }), document.createTextNode(" " + g[1] + "%")]));
    });

    var hero = el("section", { class: "course-hero", style: "color:" + c.color }, [
      el("p", { class: "eyebrow", text: c.code + " · " + c.credits + " · " + c.en }),
      el("h1", { style: "color:var(--fg)", text: c.name }),
      el("div", { class: "meta" }, [
        el("div", {}, [el("span", { class: "k", text: "교수" }), document.createTextNode(c.prof)]),
        el("div", {}, [el("span", { class: "k", text: "시간" }), document.createTextNode(c.meetings.map(function (m) { return DAYS[m.day] + " " + m.start + "–" + m.end; }).join(", "))]),
        el("div", {}, [el("span", { class: "k", text: "강의실" }), document.createTextNode(c.meetings[0].room)]),
        el("div", {}, [el("span", { class: "k", text: "교재" }), document.createTextNode(c.book)])
      ]),
      el("div", { style: "margin-top:18px;max-width:420px" }, [bars, key]),
      c.note ? el("p", { class: "small mute", style: "margin-top:14px", text: "※ " + c.note }) : null
    ]);

    var railBlock = el("section", { class: "block" }, [
      el("div", { class: "block-head" }, [el("h2", { text: "진도" }), el("span", { class: "eyebrow", text: "주차를 누르면 그 주 수업" })]),
      rail({ current: w, course: c })
    ]);

    var list = el("div", { class: "session-list" });
    function drawList() {
      list.innerHTML = "";
      sessionsOf(c).forEach(function (s) {
        var d = sdata(s);
        list.appendChild(el("button", {
          class: "session-row", style: "color:" + c.color,
          onclick: function () { openSession(s, { onClose: drawList }); }
        }, [
          el("span", { class: "w", text: "W" + String(s.week).padStart(2, "0") + " " + (parse(s.date).getMonth() + 1) + "/" + parse(s.date).getDate() }),
          el("span", { class: "t", style: s.date < todayISO ? "" : "color:var(--fg)", text: (s.mark ? "[" + s.mark + "] " : "") + (s.topic || "—") }),
          el("span", { class: "flags" }, [
            (d.audios && d.audios.length) ? el("span", { class: "flag on", text: "REC" }) : null,
            d.summary ? el("span", { class: "flag on", text: "요약" }) : null,
            (d.note && d.note.trim()) ? el("span", { class: "flag on", text: "메모" }) : null,
            s.date === todayISO ? el("span", { class: "flag", text: "오늘" }) : null
          ])
        ]));
      });
    }
    drawList();

    shell([
      el("div", {}, [el("a", { class: "ghost", href: "#/", text: "← 오늘" })]),
      hero, railBlock,
      el("section", { class: "block" }, [
        el("div", { class: "block-head" }, [el("h2", { text: "수업 기록" }), el("span", { class: "eyebrow", text: "REC / 요약 / 메모" })]),
        list
      ]),
      todoBlock(c)
    ]);

    if (openWeek) {
      var target = sessionsOf(c).filter(function (s) { return s.week === openWeek; });
      var pick = target.filter(function (s) { return s.date >= todayISO; })[0] || target[0];
      if (pick) openSession(pick, { onClose: drawList });
    }
  }

  function todoBlock(c) {
    var box = el("div", { class: "card" });
    function draw() {
      box.innerHTML = "";
      var arr = todos(c.id);
      if (!arr.length) box.appendChild(el("div", { class: "small dim", text: "과제·준비물·읽을 것을 적어두세요." }));
      var order = arr.map(function (t, i) { return i; });
      order = sortByDue(order, function (i) { return arr[i].due; });
      order.forEach(function (i) {
        var t = arr[i];
        box.appendChild(el("div", { class: "todo" + (t.done ? " done" : "") }, [
          el("input", { type: "checkbox", checked: t.done ? "checked" : null, onchange: function () { arr[i].done = !arr[i].done; saveTodos(c.id, arr); draw(); } }),
          el("label", { text: t.text + (t.due ? "  · " + ddayLabel(t.due) + " (" + mmdd(t.due) + ")" : "") }),
          el("button", { class: "x", title: "삭제", text: "✕", onclick: function () { arr.splice(i, 1); saveTodos(c.id, arr); draw(); } })
        ]));
      });
      var input = el("input", { placeholder: "예: 3주차 과제 제출", onkeydown: function (e) { if (e.key === "Enter") add(); } });
      var dueInput = el("input", { type: "date", style: "flex:0 0 150px" });
      function add() {
        var v = input.value.trim(); if (!v) return;
        var arr2 = todos(c.id); arr2.push({ text: v, done: false, due: dueInput.value || null }); saveTodos(c.id, arr2); draw();
      }
      box.appendChild(el("div", { class: "add-row" }, [input, dueInput, el("button", { class: "btn", text: "추가", onclick: add })]));
    }
    draw();
    return el("section", { class: "block" }, [
      el("div", { class: "block-head" }, [el("h2", { text: "할 일" })]),
      box
    ]);
  }

  /* ── 세션(수업 한 회차) ───────────────── */
  var rec = null;

  function openSession(s, opts) {
    opts = opts || {};
    var d = sdata(s), c = s.course;
    var scrim = el("div", { class: "scrim", onclick: function (e) { if (e.target === scrim) close(); } });
    var modal = el("div", { class: "modal", style: "color:" + c.color });
    scrim.appendChild(modal); document.body.appendChild(scrim);
    document.body.style.overflow = "hidden";
    function teardown() {
      if (document.body.contains(scrim)) document.body.removeChild(scrim);
      document.body.style.overflow = "";
      document.removeEventListener("keydown", onKeydown);
      if (elsewhereTimer) clearInterval(elsewhereTimer);
    }
    function forceClose() {
      if (rec && rec.active && rec.key === skey(s)) stopRec();
      teardown();
    }
    function close() {
      if (rec && rec.active) { if (!confirm("녹음 중입니다. 지금까지 녹음을 저장하고 닫을까요?")) return; stopRec(); }
      teardown();
      openModal = null;
      if (opts.onClose) opts.onClose();
    }
    function onKeydown(e) { if (e.key === "Escape" && document.body.contains(scrim)) close(); }
    document.addEventListener("keydown", onKeydown);
    openModal = { forceClose: forceClose, key: skey(s), redraw: function () { drawTranscript(); } };

    modal.appendChild(el("div", { class: "modal-head" }, [
      el("div", {}, [
        el("p", { class: "eyebrow", text: "Week " + String(s.week).padStart(2, "0") + " · " + pretty(s.date) + " · " + s.m.start + "–" + s.m.end }),
        el("h2", { style: "color:var(--fg);margin-top:4px", text: c.name }),
        el("p", { class: "small mute", style: "margin:6px 0 0", text: (s.mark ? "[" + s.mark + "] " : "") + (s.topic || "") })
      ]),
      el("button", { class: "ghost", text: "닫기 ✕", onclick: close })
    ]));

    var reviewedBtn = el("button", { class: "btn" + (d.reviewed ? " primary" : ""), text: d.reviewed ? "복습 완료 ✓" : "복습 완료로 표시", onclick: toggleReviewed });
    function toggleReviewed() {
      var next = !sdata(s).reviewed;
      ssave(s, { reviewed: next });
      reviewedBtn.textContent = next ? "복습 완료 ✓" : "복습 완료로 표시";
      reviewedBtn.className = "btn" + (next ? " primary" : "");
    }
    modal.appendChild(el("div", { class: "rec-bar", style: "margin:-6px 0 16px" }, [reviewedBtn]));

    /* 녹음 */
    function recordingElsewhere() { return !!(rec && rec.key !== skey(s)); }
    function startLabel() {
      var dd = sdata(s);
      return (dd.audios.length || (dd.transcript && dd.transcript.trim())) ? "● 이어서 녹음" : "● 녹음 시작";
    }

    var statusEl = el("span", { class: "mono tiny dim", text: "" });
    var timerEl = el("span", { class: "mono", style: "font-size:20px", text: "00:00" });
    var segmentEl = el("span", { class: "mono tiny dim", style: "display:none" });
    var chunkEl = el("span", { class: "mono tiny dim", style: "display:none" });
    var live = el("span", { class: "pulse", style: "display:none" });
    var startBtn = el("button", { class: "btn danger", text: startLabel(), onclick: start, disabled: recordingElsewhere() ? "disabled" : null });
    var stopBtn = el("button", { class: "btn", text: "■ 중지 후 요약", disabled: "disabled", onclick: stop });
    var cancelBtn = el("button", { class: "ghost", style: "display:none", text: "✕ 취소", onclick: cancelRec });
    var starBtn = el("button", { class: "btn", style: "display:none", text: "★ 중요", onclick: markStar });
    var langSel = el("select", { class: "btn", style: "padding:8px 10px" }, [
      el("option", { value: "ko-KR", text: "받아쓰기 한국어" }),
      el("option", { value: "en-US", text: "받아쓰기 English" })
    ]);
    var noTranscribeLabel = el("span", { class: "tiny dim", style: "display:none", text: "이 과목은 받아쓰기 안 함" });
    var pendingBtn = el("button", { class: "ghost", style: "display:none", onclick: processPendingNow });
    if (c.transcribe === false) {
      langSel.style.display = "none";
      noTranscribeLabel.style.display = "";
    } else {
      langSel.value = Store.get("lang/" + c.id, c.sttLang);
      langSel.addEventListener("change", function () { Store.set("lang/" + c.id, langSel.value); });
    }

    function refreshPendingUI() {
      var n = (sdata(s).pending || []).length;
      pendingBtn.style.display = n ? "" : "none";
      pendingBtn.disabled = false;
      pendingBtn.title = "";
      pendingBtn.textContent = "대기 조각 지금 처리 (" + n + ")";
      if (!n) return;
      var ue = usageEndpoint();
      if (!ue) return;
      fetch(ue).then(function (r) { return r.json(); }).then(function (u) {
        if (u && typeof u.remainingSeconds === "number" && u.remainingSeconds <= 0) {
          pendingBtn.disabled = true;
          pendingBtn.title = "오늘 예산 소진 — " + fmtResetKST(u.resetAt) + " 이후 다시 시도";
        }
      }).catch(function () {});
    }
    function processPendingNow() {
      pendingBtn.disabled = true; pendingBtn.textContent = "처리 중…";
      resolvePendingForSession(s).then(function () {
        drawTranscript();
        refreshPendingUI();
      });
    }

    var elsewhereTimer = null;
    if (recordingElsewhere()) {
      statusEl.textContent = "다른 수업 녹음 중";
      elsewhereTimer = setInterval(function () {
        if (recordingElsewhere()) return;
        startBtn.disabled = false;
        statusEl.textContent = "";
        clearInterval(elsewhereTimer); elsewhereTimer = null;
      }, 400);
    }

    var transcriptBox = el("div", { class: "transcript" });
    var clearTranscriptBtn = el("button", { class: "ghost", text: "자막 지우기", onclick: clearTranscript });
    var transcriptHead = el("div", { class: "rec-bar", style: "margin-top:12px" }, [
      el("span", { class: "eyebrow", text: "받아쓰기 자막" }),
      el("span", { style: "margin-left:auto" }, [clearTranscriptBtn])
    ]);
    var audioSlot = el("div", { style: "margin-top:12px" });
    var summarySlot = el("div", { style: "margin-top:16px" });

    modal.appendChild(el("div", { class: "card", style: "margin-bottom:16px" }, [
      el("div", { class: "rec-bar" }, [live, timerEl, segmentEl, chunkEl, startBtn, stopBtn, cancelBtn, starBtn, langSel, noTranscribeLabel, pendingBtn, statusEl]),
      transcriptHead, transcriptBox, audioSlot, summarySlot
    ]));

    function markStar() {
      if (!(rec && rec.active && rec.key === skey(s))) return;
      rec.final += "\n[★ " + fmtSec(rec.sec) + "] ";
      drawTranscript();
    }

    function clearTranscript() {
      if (rec && rec.active && rec.key === skey(s)) return;
      if (!sdata(s).transcript) return;
      if (!confirm("이 세션의 자막을 전부 지울까요? 오디오·요약·메모는 남습니다.")) return;
      ssave(s, { transcript: "" });
      drawTranscript();
    }

    function cancelRec() {
      if (!(rec && rec.active && rec.key === skey(s))) return;
      if (!confirm("이 녹음을 버릴까요? 저장되지 않습니다.")) return;
      discardRec().then(function () {
        live.style.display = "none"; startBtn.disabled = false; startBtn.textContent = startLabel();
        stopBtn.disabled = true; cancelBtn.style.display = "none"; starBtn.style.display = "none"; segmentEl.style.display = "none";
        chunkEl.style.display = "none";
        clearTranscriptBtn.style.display = "";
        drawTranscript();
      });
    }

    /* 메모 */
    var note = el("textarea", { class: "note", placeholder: "수업 중 메모. 자동 저장됩니다.\n\n· 이해 안 된 것\n· 교수님이 강조한 것\n· 시험에 나올 것 같은 것" });
    note.value = d.note || "";
    var noteState = el("span", { class: "eyebrow", text: "자동 저장" });
    var t0;
    note.addEventListener("input", function () {
      clearTimeout(t0); noteState.textContent = "입력 중…";
      t0 = setTimeout(function () { ssave(s, { note: note.value }); noteState.textContent = "저장됨 " + new Date().toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" }); }, 400);
    });
    modal.appendChild(el("div", { class: "block-head", style: "margin-top:8px" }, [el("h2", { text: "메모" }), noteState]));
    modal.appendChild(note);

    drawTranscript(); drawAudio(); drawSummary(); refreshPendingUI();

    function drawTranscript() {
      transcriptBox.innerHTML = "";
      if (rec && rec.active && rec.key === skey(s)) {
        transcriptBox.appendChild(el("span", { text: rec.final }));
        transcriptBox.appendChild(el("span", { class: "interim", text: rec.interim }));
      } else {
        var ta = el("textarea", { class: "note", style: "min-height:120px;margin:0", placeholder: "받아쓰기 결과가 여기에 쌓입니다. 직접 붙여넣거나 고쳐도 됩니다." });
        ta.value = sdata(s).transcript || "";
        var t1;
        ta.addEventListener("input", function () { clearTimeout(t1); t1 = setTimeout(function () { ssave(s, { transcript: ta.value }); }, 400); });
        transcriptBox.style.padding = "0"; transcriptBox.style.border = "none"; transcriptBox.style.maxHeight = "none";
        transcriptBox.appendChild(ta);
      }
    }

    function drawAudio() {
      audioSlot.innerHTML = "";
      var dd = sdata(s);
      var listEl = el("div", { class: "audio-list" });
      dd.audios.forEach(function (a) {
        var row = el("div", { class: "audio-item" }, [
          el("div", { class: "tiny dim mono", text: (a.label || "오디오") + (a.size != null ? " · " + fmtBytes(a.size) : "") + (a.at ? " · " + a.at : "") })
        ]);
        AudioStore.get(a.id).then(function (blob) {
          if (!blob) return;
          var url = URL.createObjectURL(blob);
          row.appendChild(el("audio", { controls: "controls", src: url, style: "width:100%;margin-top:6px" }));
          var actions = [
            el("a", { class: "btn", href: url, download: c.id + "-" + s.date + "-" + (a.label || "audio") + ".webm", text: "↓ 저장" }),
            el("button", { class: "ghost", text: "삭제", onclick: function () {
              if (!confirm("이 오디오를 지울까요?")) return;
              AudioStore.del(a.id);
              var dd2 = sdata(s);
              ssave(s, { audios: dd2.audios.filter(function (x) { return x.id !== a.id; }) });
              drawAudio();
            } })
          ];
          if (a.id.indexOf("/upload/") >= 0) {
            actions.push(el("button", { class: "ghost", text: "받아쓰기", onclick: function () { transcribeUploadedAudio(s, a, row); } }));
          }
          row.appendChild(el("div", { class: "rec-bar", style: "margin-top:8px" }, actions));
        });
        listEl.appendChild(row);
      });
      audioSlot.appendChild(listEl);

      var uploadInput = el("input", {
        type: "file", accept: "audio/*", style: "display:none",
        onchange: function (e) {
          var f = e.target.files[0]; if (!f) return;
          if (f.size > 50 * 1024 * 1024) alert("50MB가 넘는 파일입니다 (" + fmtBytes(f.size) + "). 저장 공간에 따라 실패할 수 있지만 계속 진행합니다.");
          var id = skey(s) + "/upload/" + Date.now();
          AudioStore.put(id, f).then(function () {
            var dd3 = sdata(s);
            ssave(s, { audios: dd3.audios.concat([{ id: id, label: "휴대폰", size: f.size, at: new Date().toLocaleString("ko-KR") }]) });
            drawAudio();
          });
        }
      });
      audioSlot.appendChild(el("div", { class: "rec-bar", style: "margin-top:10px" }, [
        el("label", { class: "btn", style: "cursor:pointer" }, [document.createTextNode("↑ 오디오 업로드"), uploadInput])
      ]));
    }

    function drawSummary() {
      summarySlot.innerHTML = "";
      var dd = sdata(s);
      summarySlot.appendChild(el("div", { class: "block-head" }, [
        el("h2", { text: "오늘 수업 요약" }),
        el("button", { class: "ghost", text: dd.summary ? "다시 만들기" : "지금 만들기", onclick: function () { makeSummary(s, summarySlot, drawSummary); } })
      ]));
      if (!dd.summary) {
        summarySlot.appendChild(el("div", { class: "empty", text: "녹음을 중지하면 자동으로 만들어집니다. 자막을 직접 붙여넣고 만들어도 됩니다." }));
      } else {
        summarySlot.appendChild(el("div", { class: "card summary", html: mdToHtml(dd.summary.text) }));
        summarySlot.appendChild(el("p", { class: "tiny dim", style: "margin-top:8px", text: dd.summary.mode === "ai" ? "AI 요약 · " + dd.summary.at : "기기 내 요약(키워드 기반) · " + dd.summary.at }));
      }
    }

    function start() {
      if (recordingElsewhere()) { statusEl.textContent = "다른 수업 녹음 중"; return; }
      var segNum = countRecSegments(sdata(s).audios) + 1;
      startRec(s, langSel.value, {
        onTick: function (sec) { timerEl.textContent = fmtSec(sec); },
        onText: drawTranscript,
        onStatus: function (t) { statusEl.textContent = t; },
        onChunkProgress: function (doneN, total) {
          if (!total) { chunkEl.style.display = "none"; return; }
          chunkEl.style.display = "";
          chunkEl.textContent = "받아쓰기 " + doneN + "/" + total + " 조각 완료";
        }
      }).then(function () {
        live.style.display = ""; startBtn.disabled = true; stopBtn.disabled = false; cancelBtn.style.display = ""; starBtn.style.display = "";
        segmentEl.style.display = ""; segmentEl.textContent = "누적 " + segNum + "번째 녹음"; clearTranscriptBtn.style.display = "none";
        transcriptBox.style.padding = "14px"; transcriptBox.style.border = "1px solid var(--line)"; transcriptBox.style.maxHeight = "260px";
        drawTranscript();
      }).catch(function (e) {
        statusEl.textContent = "마이크를 사용할 수 없습니다: " + (e && e.message ? e.message : e);
      });
    }
    function stop() {
      stopRec().then(function () {
        live.style.display = "none"; startBtn.disabled = false; startBtn.textContent = startLabel();
        stopBtn.disabled = true; cancelBtn.style.display = "none"; starBtn.style.display = "none"; segmentEl.style.display = "none";
        chunkEl.style.display = "none";
        clearTranscriptBtn.style.display = "";
        drawTranscript(); drawAudio(); refreshPendingUI();
        makeSummary(s, summarySlot, drawSummary);
      });
    }
  }

  function fmtSec(t) { return String(Math.floor(t / 60)).padStart(2, "0") + ":" + String(t % 60).padStart(2, "0"); }

  /* ── 녹음 + 받아쓰기 ──────────────────── */
  function countRecSegments(audios) {
    return audios.filter(function (a) { return /^녹음 \d+$/.test(a.label); }).length;
  }

  var ROTATE_MS = 5 * 60 * 1000; // 조각 회전 주기(5분) — 배포 후 실측(5분·32kbps opus 1.84MB 성공)으로 확정
  var B_BITRATE = 32000;         // mono 32kbps

  function pickMime() {
    var cands = ["audio/webm;codecs=opus", "audio/webm"];
    for (var i = 0; i < cands.length; i++) {
      if (window.MediaRecorder && MediaRecorder.isTypeSupported && MediaRecorder.isTypeSupported(cands[i])) return cands[i];
    }
    return "";
  }

  function startRec(s, lang, cb) {
    var transcribeAllowed = s.course.transcribe !== false;
    return navigator.mediaDevices.getUserMedia({ audio: true }).then(function (stream) {
      var chunksA = [];
      var mrA = new MediaRecorder(stream);
      mrA.ondataavailable = function (e) { if (e.data.size) chunksA.push(e.data); };
      mrA.start(1000);

      var baseTranscript = sdata(s).transcript || "";
      rec = {
        active: true, cancelled: false, key: skey(s), s: s,
        mrA: mrA, chunksA: chunksA, stream: stream,
        final: baseTranscript, baseTranscript: baseTranscript, interim: "",
        sec: 0, cb: cb, lang: lang,
        seq: 0, chunksTotal: 0, chunksDone: 0, queue: Promise.resolve(),
        mrB: null, chunksB: [], chunkStart: 0, monoStream: null, audioCtx: null, rotateTimer: null,
        transcribeEnabled: transcribeAllowed && !!sttEndpoint()
      };
      if (rec.final && !/\n$/.test(rec.final)) rec.final += "\n";
      rec.timer = setInterval(function () { rec.sec++; cb.onTick(rec.sec); }, 1000);

      if (rec.transcribeEnabled) {
        try {
          var AC = window.AudioContext || window.webkitAudioContext;
          var actx = new AC();
          var src = actx.createMediaStreamSource(stream);
          var dest = actx.createMediaStreamDestination();
          dest.channelCount = 1; dest.channelCountMode = "explicit";
          src.connect(dest);
          rec.audioCtx = actx; rec.monoStream = dest.stream;
          startNewB(rec);
          rec.rotateTimer = setInterval(function () { rotateB(rec); }, ROTATE_MS);
          cb.onStatus("녹음 + 받아쓰기 중 (" + Math.round(ROTATE_MS / 1000) + "초 조각)");
        } catch (x) {
          rec.transcribeEnabled = false;
          cb.onStatus("녹음 중 (받아쓰기 초기화 실패: " + (x && x.message ? x.message : x) + ")");
        }
      } else if (!transcribeAllowed) {
        cb.onStatus("녹음 중 · 이 과목은 받아쓰기 안 함");
      } else {
        cb.onStatus("녹음 중 · 받아쓰기 API 주소가 없어 자막은 쌓이지 않습니다");
      }
    });
  }

  function startNewB(r) {
    var mime = pickMime();
    var mr = mime ? new MediaRecorder(r.monoStream, { mimeType: mime, audioBitsPerSecond: B_BITRATE })
                  : new MediaRecorder(r.monoStream, { audioBitsPerSecond: B_BITRATE });
    r.chunksB = [];
    mr.ondataavailable = function (e) { if (e.data.size) r.chunksB.push(e.data); };
    mr.start(1000);
    r.mrB = mr;
    r.chunkStart = Date.now();
  }

  // 회전: 지금 조각을 마감해 큐에 올리고, 이어서 새 인스턴스로 계속 녹음(타임슬라이스만으로는
  // WebM 헤더가 첫 조각에만 있어 독립 재생이 안 되므로 반드시 인스턴스를 교체한다).
  function rotateB(r) {
    if (!r.mrB || !r.active) return;
    var oldMr = r.mrB, oldChunks = r.chunksB;
    var dur = (Date.now() - r.chunkStart) / 1000;
    oldMr.onstop = function () {
      enqueueChunk(r, new Blob(oldChunks, { type: oldMr.mimeType || "audio/webm" }), dur);
      if (r.active) startNewB(r);
    };
    try { oldMr.stop(); } catch (x) { if (r.active) startNewB(r); }
  }

  // 중지 시 현재 진행 중인 마지막 조각을 마감(회전과 동일하지만 재시작은 하지 않음)
  function finishCurrentChunk(r) {
    return new Promise(function (resolve) {
      if (!r.mrB) return resolve();
      var mrB = r.mrB, chunks = r.chunksB;
      var dur = (Date.now() - r.chunkStart) / 1000;
      mrB.onstop = function () { enqueueChunk(r, new Blob(chunks, { type: mrB.mimeType || "audio/webm" }), dur); resolve(); };
      try { mrB.stop(); } catch (x) { resolve(); }
    });
  }

  // 조각을 큐에 순서대로(단일 흐름) 태워 보낸다 — 응답이 어떤 순서로 와도 처리 자체가
  // 순차적이라 transcript에 삽입되는 순서는 항상 조각 생성 순서와 같다.
  function enqueueChunk(r, blob, duration) {
    if (r.cancelled || !(duration > 1)) return;
    r.seq++;
    var seq = r.seq;
    r.chunksTotal++;
    r.cb.onChunkProgress(r.chunksDone, r.chunksTotal);
    var placeholder = "…(" + seq + "번째 조각 처리 중)";
    r.final = (r.final.replace(/\s+$/, "")) + " " + placeholder + " ";
    r.cb.onText();
    var offset = (seq - 1) * (ROTATE_MS / 1000);
    r.queue = r.queue.then(function () {
      if (r.cancelled) return;
      return sendChunkWithRetry({ blob: blob, duration: duration, lang: (r.lang || "").slice(0, 2), hint: buildTranscribeHint(r.s) })
        .then(function (data) {
          if (r.cancelled) return;
          var lines = segmentsToLines(data, offset);
          r.final = replacePlaceholder(r.final, placeholder, lines.length ? lines.join("\n") : "(무음)");
        })
        .catch(function (e) {
          if (r.cancelled) return;
          var text;
          if (e && e.budget) {
            text = "[이월 대기: " + seq + "번째 조각, " + fmtResetKST(e.resetAt) + " 이후 처리]";
            persistPending(r.s, { seq: seq, status: "carryover", placeholder: text, blob: blob, duration: duration, lang: (r.lang || "").slice(0, 2), resetAt: e.resetAt });
          } else {
            text = "[" + seq + "번째 조각 실패]";
            persistPending(r.s, { seq: seq, status: "failed", placeholder: text, blob: blob, duration: duration, lang: (r.lang || "").slice(0, 2), resetAt: null });
          }
          r.final = replacePlaceholder(r.final, placeholder, text);
        })
        .then(function () {
          if (r.cancelled) return;
          r.chunksDone++;
          r.cb.onChunkProgress(r.chunksDone, r.chunksTotal);
          r.cb.onText();
        });
    });
  }

  function stopRec() {
    return new Promise(function (res) {
      if (!rec) return res();
      var r = rec; rec.active = false;
      clearInterval(r.timer);
      if (r.rotateTimer) clearInterval(r.rotateTimer);

      var pFinishB = finishCurrentChunk(r);
      var pFinishA = new Promise(function (resA) {
        r.mrA.onstop = function () {
          var blob = new Blob(r.chunksA, { type: r.mrA.mimeType || "audio/webm" });
          var id = r.key + "/rec-" + Date.now();
          AudioStore.put(id, blob).then(function () { resA({ id: id, size: blob.size }); }).catch(function () { resA(null); });
        };
        try { r.mrA.stop(); } catch (x) { resA(null); }
      });

      Promise.all([pFinishB, pFinishA]).then(function (results) {
        return r.queue.then(function () { return results[1]; });
      }).then(function (audioResult) {
        var d = sdata(r.s);
        var patch = { transcript: r.final.trim() };
        if (audioResult) {
          var label = "녹음 " + (countRecSegments(d.audios) + 1);
          patch.audios = d.audios.concat([{ id: audioResult.id, label: label, size: audioResult.size, at: new Date().toLocaleString("ko-KR") }]);
        }
        ssave(r.s, patch);
        r.stream.getTracks().forEach(function (t) { t.stop(); });
        if (r.audioCtx) { try { r.audioCtx.close(); } catch (x) {} }
        rec = null; res();
      });
    });
  }

  // 취소: MediaRecorder/스트림/타이머만 정리하고 아무것도 저장하지 않음. 이미 전송 중인
  // 조각 요청은 r.cancelled 플래그로 결과만 무시한다(네트워크 요청 자체를 끊지는 않음).
  // 녹음 시작 전 transcript 스냅샷(baseTranscript)으로 되돌려 이번 세그먼트의 자막만 버린다.
  function discardRec() {
    return new Promise(function (res) {
      if (!rec) return res();
      var r = rec; rec.active = false; r.cancelled = true;
      clearInterval(r.timer);
      if (r.rotateTimer) clearInterval(r.rotateTimer);
      r.mrA.ondataavailable = null; r.mrA.onstop = null;
      try { r.mrA.stop(); } catch (x) {}
      if (r.mrB) { r.mrB.ondataavailable = null; r.mrB.onstop = null; try { r.mrB.stop(); } catch (x) {} }
      r.stream.getTracks().forEach(function (t) { t.stop(); });
      if (r.audioCtx) { try { r.audioCtx.close(); } catch (x) {} }
      ssave(r.s, { transcript: r.baseTranscript });
      rec = null;
      res();
    });
  }

  function replacePlaceholder(text, marker, replacement) {
    var idx = text.indexOf(marker);
    if (idx < 0) return text.replace(/\s+$/, "") + " " + replacement;
    return text.slice(0, idx) + replacement + text.slice(idx + marker.length);
  }

  function fmtResetKST(resetAtISO) {
    if (!resetAtISO) return "다음 초기화";
    try {
      var d = new Date(resetAtISO);
      return d.toLocaleString("ko-KR", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Seoul" }) + " KST";
    } catch (e) { return "다음 초기화"; }
  }

  /* ── 전사 줄바꿈 (Whisper 출력엔 문장부호가 없어 요약이 한 덩어리로 뭉침) ── */
  // 25단어(영어) / 60자(한국어) 단위로 잘라 줄바꿈 경계를 만든다.
  function chunkText(text) {
    text = (text || "").replace(/\s+/g, " ").trim();
    if (!text) return [];
    var isKorean = /[가-힣]/.test(text);
    var out = [];
    if (isKorean) {
      var chars = Array.from(text);
      for (var i = 0; i < chars.length; i += 60) out.push(chars.slice(i, i + 60).join(""));
    } else {
      var words = text.split(" ");
      for (var j = 0; j < words.length; j += 25) out.push(words.slice(j, j + 25).join(" "));
    }
    return out;
  }
  // Whisper 응답을 "[mm:ss] 텍스트" 줄 배열로. segments가 있으면 세그먼트별 정확한 시각,
  // 없으면 조각 시작 시각 하나로 묶어 chunkText로 잘라 붙인다.
  function segmentsToLines(data, offsetSeconds) {
    if (data && data.segments && data.segments.length) {
      return data.segments.map(function (seg) {
        var text = (seg.text || "").trim();
        if (!text) return null;
        return "[" + fmtSec(Math.max(0, Math.floor(offsetSeconds + (seg.start || 0)))) + "] " + text;
      }).filter(Boolean);
    }
    var text = (data && data.text || "").trim();
    if (!text) return [];
    var ts = "[" + fmtSec(Math.max(0, Math.floor(offsetSeconds))) + "] ";
    return chunkText(text).map(function (line) { return ts + line; });
  }
  // 기존에 flat 문자열로 저장된 transcript를 요약 시점에만 임시로 줄바꿈 — 저장은 건드리지 않음.
  function looksSegmented(text) {
    var lines = text.split("\n").filter(function (l) { return l.trim(); });
    if (lines.length < 2) return false;
    return (text.length / lines.length) < 400;
  }
  function ensureLineBreaks(text) {
    if (!text) return text;
    if (looksSegmented(text)) return text;
    return chunkText(text).join("\n");
  }

  /* ── API 주소 (설정값 → data.js 기본값 순으로 사용) ──── */
  function apiDefault(key) { return (window.API_DEFAULTS && window.API_DEFAULTS[key]) || null; }
  function summarizeEndpoint() {
    var cfg = Store.get("ai", {});
    if (cfg.url && cfg.url.trim()) return cfg.url.trim();
    return apiDefault("summarize");
  }
  function sttEndpoint() {
    var cfg = Store.get("ai", {});
    if (cfg.sttUrl && cfg.sttUrl.trim()) return cfg.sttUrl.trim();
    if (cfg.url && cfg.url.trim()) {
      try { return new URL(cfg.url, location.href).origin + "/transcribe"; } catch (e) {}
    }
    return apiDefault("transcribe");
  }
  function usageEndpoint() {
    var t = sttEndpoint();
    return t ? t.replace(/\/transcribe\/?$/, "/usage") : null;
  }
  // 과목/주차 문맥을 Whisper initial_prompt 힌트로 — 고유명사·전문용어 인식 정확도를 올려줌
  function buildTranscribeHint(s) {
    var c = s.course;
    var terms = (c.keywords || []).join(", ");
    return c.en + " lecture, week " + s.week + ": " + (s.topic || "") + (terms ? ". Terms: " + terms : "");
  }
  function sendChunkToServer(payload) {
    var endpoint = sttEndpoint();
    if (!endpoint) return Promise.reject(new Error("받아쓰기 API 주소 없음"));
    return fetch(endpoint, {
      method: "POST",
      headers: {
        "content-type": (payload.blob && payload.blob.type) || "audio/webm",
        "x-language": payload.lang || "",
        "x-duration-sec": String(payload.duration),
        "x-initial-prompt": encodeURIComponent(payload.hint || "")
      },
      body: payload.blob
    }).then(function (r) {
      if (r.status === 429) {
        return r.json().catch(function () { return {}; }).then(function (data) {
          var err = new Error("daily_budget");
          err.budget = true; err.resetAt = data.resetAt || null;
          throw err;
        });
      }
      if (!r.ok) throw new Error("HTTP " + r.status);
      return r.json();
    });
  }
  function sendChunkWithRetry(payload) {
    var attempt = 0;
    function tryOnce() {
      attempt++;
      return sendChunkToServer(payload).catch(function (e) {
        if (e && e.budget) throw e;
        if (attempt >= 3) throw e;
        return new Promise(function (res) { setTimeout(res, 800 * attempt); }).then(tryOnce);
      });
    }
    return tryOnce();
  }

  /* ── 이월/실패 조각 저장·재처리 ───────── */
  function persistPending(s, item) {
    var blobId = skey(s) + "/pending/" + item.seq + "-" + Date.now();
    return AudioStore.put(blobId, item.blob).then(function () {
      var d = sdata(s);
      var pending = (d.pending || []).concat([{
        seq: item.seq, status: item.status, placeholder: item.placeholder,
        blobId: blobId, duration: item.duration, lang: item.lang,
        resetAt: item.resetAt || null, addedAt: new Date().toISOString()
      }]);
      ssave(s, { pending: pending });
    });
  }
  function processPendingItem(s, item) {
    return AudioStore.get(item.blobId).then(function (blob) {
      if (!blob) return { ok: false, remove: true };
      return sendChunkWithRetry({ blob: blob, duration: item.duration, lang: item.lang, hint: buildTranscribeHint(s) })
        .then(function (data) {
          var offset = (item.seq - 1) * (ROTATE_MS / 1000);
          var lines = segmentsToLines(data, offset);
          return { ok: true, text: lines.length ? lines.join("\n") : "(무음)" };
        })
        .catch(function (e) {
          if (e && e.budget) return { ok: false, budget: true, resetAt: e.resetAt };
          return { ok: false };
        });
    });
  }
  function resolvePendingForSession(s) {
    var pending = (sdata(s).pending || []).slice();
    if (!pending.length) return Promise.resolve({ resolved: 0, remaining: 0 });
    var remaining = [], resolvedCount = 0;
    var chain = Promise.resolve();
    pending.forEach(function (item) {
      chain = chain.then(function () {
        return processPendingItem(s, item).then(function (r) {
          if (r.ok) {
            var dd = sdata(s);
            ssave(s, { transcript: replacePlaceholder(dd.transcript || "", item.placeholder, r.text) });
            AudioStore.del(item.blobId);
            resolvedCount++;
          } else if (!r.remove) {
            remaining.push(r.budget ? { seq: item.seq, status: item.status, placeholder: item.placeholder, blobId: item.blobId, duration: item.duration, lang: item.lang, resetAt: r.resetAt || item.resetAt, addedAt: item.addedAt } : item);
          }
        });
      });
    });
    return chain.then(function () {
      ssave(s, { pending: remaining });
      return { resolved: resolvedCount, remaining: remaining.length };
    });
  }

  /* ── 업로드된 오디오 받아쓰기(용량 초과 시 조각 분할) ── */
  var UPLOAD_DIRECT_MAX_BYTES = 2.5 * 1024 * 1024;
  var UPLOAD_CHUNK_SEC = 90; // 16kHz mono WAV 기준 조각당 약 2.9MB — 배포 후 실측으로 확정한 값

  function getAudioDuration(blob) {
    return new Promise(function (resolve) {
      var url = URL.createObjectURL(blob);
      var a = new Audio();
      a.preload = "metadata";
      a.onloadedmetadata = function () { var dur = a.duration; URL.revokeObjectURL(url); resolve(isFinite(dur) ? dur : 0); };
      a.onerror = function () { URL.revokeObjectURL(url); resolve(0); };
      a.src = url;
    });
  }
  function encodeWav(float32, sampleRate) {
    var buffer = new ArrayBuffer(44 + float32.length * 2);
    var view = new DataView(buffer);
    function writeStr(off, str) { for (var i = 0; i < str.length; i++) view.setUint8(off + i, str.charCodeAt(i)); }
    writeStr(0, "RIFF"); view.setUint32(4, 36 + float32.length * 2, true);
    writeStr(8, "WAVE"); writeStr(12, "fmt "); view.setUint32(16, 16, true);
    view.setUint16(20, 1, true); view.setUint16(22, 1, true);
    view.setUint32(24, sampleRate, true); view.setUint32(28, sampleRate * 2, true);
    view.setUint16(32, 2, true); view.setUint16(34, 16, true);
    writeStr(36, "data"); view.setUint32(40, float32.length * 2, true);
    var off = 44;
    for (var i = 0; i < float32.length; i++, off += 2) {
      var v = Math.max(-1, Math.min(1, float32[i]));
      view.setInt16(off, v < 0 ? v * 0x8000 : v * 0x7fff, true);
    }
    return new Blob([buffer], { type: "audio/wav" });
  }
  function decodeAndChunkWav(blob, chunkSeconds) {
    var AC = window.AudioContext || window.webkitAudioContext;
    return blob.arrayBuffer().then(function (buf) {
      var actx = new AC();
      return actx.decodeAudioData(buf).then(function (decoded) {
        var targetRate = 16000;
        var offlineLen = Math.max(1, Math.ceil(decoded.duration * targetRate));
        var offline = new OfflineAudioContext(1, offlineLen, targetRate);
        var src = offline.createBufferSource();
        src.buffer = decoded; src.connect(offline.destination); src.start(0);
        return offline.startRendering().then(function (rendered) {
          var samples = rendered.getChannelData(0);
          var out = [], chunkLen = chunkSeconds * targetRate;
          for (var pos = 0; pos < samples.length; pos += chunkLen) {
            var slice = samples.subarray(pos, Math.min(pos + chunkLen, samples.length));
            out.push({ blob: encodeWav(slice, targetRate), duration: slice.length / targetRate });
          }
          try { actx.close(); } catch (x) {}
          return out;
        });
      });
    });
  }
  function transcribeUploadedAudio(s, a, row) {
    var c = s.course;
    if (c.transcribe === false) { alert("이 과목은 받아쓰기를 사용하지 않습니다."); return; }
    if (!sttEndpoint()) { alert("설정에서 받아쓰기 API 주소를 먼저 넣어주세요."); return; }
    var lang2 = (Store.get("lang/" + c.id, c.sttLang) || "ko-KR").slice(0, 2);
    var statusSpan = el("span", { class: "tiny dim", text: "처리 중…" });
    row.appendChild(statusSpan);
    var hint = buildTranscribeHint(s);
    AudioStore.get(a.id).then(function (blob) {
      if (!blob) throw new Error("오디오를 찾을 수 없음");
      if (blob.size <= UPLOAD_DIRECT_MAX_BYTES) {
        return getAudioDuration(blob).then(function (dur) {
          return sendChunkWithRetry({ blob: blob, duration: dur || 1, lang: lang2, hint: hint }).then(function (data) { return segmentsToLines(data, 0); });
        });
      }
      statusSpan.textContent = "큰 파일 · 여러 조각으로 나누는 중… (노트북에서 실행 권장)";
      return decodeAndChunkWav(blob, UPLOAD_CHUNK_SEC).then(function (wavChunks) {
        var lines = [], chain = Promise.resolve();
        wavChunks.forEach(function (wb, i) {
          chain = chain.then(function () {
            statusSpan.textContent = "조각 " + (i + 1) + "/" + wavChunks.length + " 전송 중…";
            return sendChunkWithRetry({ blob: wb.blob, duration: wb.duration, lang: lang2, hint: hint })
              .then(function (data) { lines = lines.concat(segmentsToLines(data, i * UPLOAD_CHUNK_SEC)); })
              .catch(function (e) { lines.push(e && e.budget ? "[예산 초과로 실패: 조각 " + (i + 1) + "]" : "[실패: 조각 " + (i + 1) + "]"); });
          });
        });
        return chain.then(function () { return lines; });
      });
    }).then(function (lines) {
      var dd = sdata(s);
      var addition = "[업로드: " + (a.label || "오디오") + "]\n" + lines.join("\n").trim();
      ssave(s, { transcript: ((dd.transcript || "").trim() + "\n\n" + addition).trim() });
      drawTranscriptIfOpen(s);
      statusSpan.textContent = "완료";
      setTimeout(function () { if (row.contains(statusSpan)) row.removeChild(statusSpan); }, 3000);
    }).catch(function (e) {
      statusSpan.textContent = "실패: " + (e && e.message ? e.message : e);
    });
  }
  // 세션 모달이 아직 열려 있을 때만 즉시 갱신 — 없으면 다음에 열 때 sdata()가 최신값을 준다.
  function drawTranscriptIfOpen(s) {
    if (openModal && openModal.key === skey(s) && openModal.redraw) openModal.redraw();
  }

  /* ── 요약 ─────────────────────────────── */
  function makeSummary(s, slot, redraw) {
    var d = sdata(s);
    var text = (d.transcript || "").trim();
    var note = (d.note || "").trim();
    if (!text && !note) { alert("요약할 내용이 없습니다. 받아쓰기 결과나 메모를 먼저 채워주세요."); return; }
    var cfg = Store.get("ai", {});
    var url = summarizeEndpoint();
    slot.innerHTML = "";
    slot.appendChild(el("div", { class: "empty", text: "요약을 만드는 중…" }));

    var finish = function (md, mode) {
      ssave(s, { summary: { text: md, mode: mode, at: new Date().toLocaleString("ko-KR") } });
      redraw();
    };

    if (url) {
      aiSummary(cfg, url, s, text, note).then(function (md) { finish(md, "ai"); })
        .catch(function (e) {
          finish(localSummary(s, text, note) + "\n\n_AI 요약 실패(" + (e.message || e) + ") → 기기 내 요약으로 대체_", "local");
        });
    } else {
      setTimeout(function () { finish(localSummary(s, text, note), "local"); }, 120);
    }
  }

  function prompt(s, text, note) {
    var c = s.course;
    var next = c.weekTopics[s.week] || "(마지막 주)";
    return "너는 대학생의 수업 노트 정리 조수다. 아래는 " + c.name + "(" + c.code + ", " + c.prof + ") 수업의 " +
      s.week + "주차(" + s.date + ") 자동 받아쓰기 기록과 학생 메모다. 받아쓰기에는 오타와 오인식이 많으니 문맥으로 보정해라.\n" +
      "이번 주 실라버스 주제: " + (s.topic || "") + "\n다음 주 주제: " + next + "\n\n" +
      "받아쓰기 중 학생이 '[★ mm:ss]'로 표시한 구간이 있다면 그 구간을 최우선으로 다뤄라.\n\n" +
      "다음 형식의 한국어 마크다운으로만 답하라. 없는 항목은 생략하지 말고 '해당 없음'이라고 써라.\n" +
      "## 한 줄 요약\n## 핵심 내용 (5~8개 불릿, 수식/용어는 원어 병기)\n## 오늘 나온 용어\n## 과제·공지·시험 언급\n## 헷갈릴 만한 부분 / 복습 포인트\n## 다음 수업 예습 한 가지\n\n" +
      "=== 받아쓰기 ===\n" + text.slice(0, 24000) + "\n\n=== 학생 메모 ===\n" + (note || "(없음)");
  }

  function aiSummary(cfg, url, s, text, note) {
    var body, headers = { "content-type": "application/json" };
    var isAnthropic = /anthropic\.com/.test(url);
    if (isAnthropic) {
      headers["x-api-key"] = cfg.key || "";
      headers["anthropic-version"] = "2023-06-01";
      headers["anthropic-dangerous-direct-browser-access"] = "true";
      body = { model: cfg.model || "claude-sonnet-4-6", max_tokens: 2000, messages: [{ role: "user", content: prompt(s, text, note) }] };
    } else {
      if (cfg.key) headers["authorization"] = "Bearer " + cfg.key;
      body = { prompt: prompt(s, text, note), course: s.course.id, week: s.week, date: s.date, transcript: text, note: note };
    }
    return fetch(url, { method: "POST", headers: headers, body: JSON.stringify(body) })
      .then(function (r) { if (!r.ok) throw new Error("HTTP " + r.status); return r.json(); })
      .then(function (data) {
        if (typeof data === "string") return data;
        if (data.summary) return data.summary;
        if (Array.isArray(data.content)) return data.content.filter(function (b) { return b.type === "text"; }).map(function (b) { return b.text; }).join("\n");
        if (data.choices && data.choices[0]) return data.choices[0].message.content;
        throw new Error("응답 형식을 모르겠음");
      });
  }

  var STOP = "그리고,그래서,이제,근데,그러니까,여기서,우리가,이것은,저는,그거,이거,about,which,there,their,would,could,should,because,really,going,okay,right,think,thing,just,like,that,this,with,from,have,what,when,then,they,here,also,were,been,into,very,much,some,more,than,them,will,does,make".split(",");

  function localSummary(s, text, note) {
    var c = s.course;
    var all = (text + "\n" + note).trim();
    var sents = all.split(/(?:[.!?。]|다\.|요\.|\n)+/).map(function (x) { return x.trim(); }).filter(function (x) { return x.length > 12; });
    var freq = {};
    all.toLowerCase().split(/[^0-9a-z가-힣]+/).forEach(function (w) {
      if (w.length < 2 || STOP.indexOf(w) >= 0) return;
      freq[w] = (freq[w] || 0) + 1;
    });
    var scored = sents.map(function (x, i) {
      var sc = 0;
      x.toLowerCase().split(/[^0-9a-z가-힣]+/).forEach(function (w) { sc += (freq[w] || 0); });
      var weighted = sc / Math.sqrt(x.length + 8);
      if (x.indexOf("★") >= 0) weighted += 1000; // 녹음 중 북마크한 구간 최우선
      return { i: i, x: x, sc: weighted };
    }).sort(function (a, b) { return b.sc - a.sc; }).slice(0, 6).sort(function (a, b) { return a.i - b.i; });

    var hits = (c.keywords || []).filter(function (k) { return all.toLowerCase().indexOf(k.toLowerCase()) >= 0; });
    var actionRe = /(과제|숙제|퀴즈|시험|중간|기말|제출|마감|다음\s?주|리포트|발표|assignment|homework|quiz|exam|midterm|final|due|deadline|submit|next week|report)/i;
    var actions = sents.filter(function (x) { return actionRe.test(x); }).slice(0, 6);

    var md = "## 한 줄 요약\n" + (s.topic ? s.topic + " (실라버스 기준)" : "(주제 미정)") + "\n\n";
    md += "## 핵심 내용\n" + (scored.length ? scored.map(function (o) { return "- " + o.x; }).join("\n") : "- 받아쓰기 내용이 짧아 추출하지 못했습니다.") + "\n\n";
    md += "## 오늘 나온 용어\n" + (hits.length ? hits.map(function (h) { return "`" + h + "`"; }).join(" ") : "해당 없음") + "\n\n";
    md += "## 과제·공지·시험 언급\n" + (actions.length ? actions.map(function (a) { return "- " + a; }).join("\n") : "해당 없음") + "\n\n";
    md += "## 다음 수업 예습\n" + (c.weekTopics[s.week] ? "- " + c.weekTopics[s.week] : "- (학기 마지막)") + "\n";
    return md;
  }

  function mdToHtml(md) {
    var out = [], inUl = false;
    md.split("\n").forEach(function (line) {
      if (/^##\s+/.test(line)) { if (inUl) { out.push("</ul>"); inUl = false; } out.push("<h4>" + esc(line.replace(/^##\s+/, "")) + "</h4>"); return; }
      if (/^[-*]\s+/.test(line)) { if (!inUl) { out.push("<ul>"); inUl = true; } out.push("<li>" + inline(line.replace(/^[-*]\s+/, "")) + "</li>"); return; }
      if (!line.trim()) { if (inUl) { out.push("</ul>"); inUl = false; } return; }
      if (inUl) { out.push("</ul>"); inUl = false; }
      out.push("<p>" + inline(line) + "</p>");
    });
    if (inUl) out.push("</ul>");
    return out.join("");
  }
  function inline(t) {
    return esc(t).replace(/`([^`]+)`/g, '<span class="chip">$1</span>').replace(/\*\*([^*]+)\*\*/g, "<b>$1</b>").replace(/_([^_]+)_/g, "<i>$1</i>");
  }

  /* ── 설정 ─────────────────────────────── */
  function openSettings() {
    var cfg = Store.get("ai", {});
    var scrim = el("div", { class: "scrim", onclick: function (e) { if (e.target === scrim) closeS(); } });
    function closeS() { document.body.removeChild(scrim); document.body.style.overflow = ""; }
    var url = el("input", { class: "add-row", style: "width:100%;background:var(--ink);border:1px solid var(--line);border-radius:8px;padding:9px 12px", placeholder: apiDefault("summarize") || "https://... (비워두면 기기 내 요약만 사용)", value: cfg.url || "" });
    var keyI = el("input", { type: "password", style: "width:100%;background:var(--ink);border:1px solid var(--line);border-radius:8px;padding:9px 12px", placeholder: "비워둘 수 있음", value: cfg.key || "" });
    var model = el("input", { style: "width:100%;background:var(--ink);border:1px solid var(--line);border-radius:8px;padding:9px 12px", placeholder: "claude-sonnet-4-6", value: cfg.model || "" });
    var sttUrl = el("input", { style: "width:100%;background:var(--ink);border:1px solid var(--line);border-radius:8px;padding:9px 12px", placeholder: apiDefault("transcribe") || "비워두면 요약 API 주소에서 자동으로 유추 (…/transcribe)", value: cfg.sttUrl || "" });
    var usageBox = el("p", { class: "tiny dim", style: "margin:6px 0 16px", text: "오늘 사용량 확인 중…" });
    refreshUsageBox();
    // Store에 저장하기 전, 지금 입력창에 있는 값 기준으로 미리보기 — sttEndpoint()와 같은 우선순위
    // (직접 입력한 받아쓰기 주소 → 직접 입력한 요약 주소에서 유추 → data.js 기본값)
    function liveSttEndpoint() {
      if (sttUrl.value.trim()) return sttUrl.value.trim();
      if (url.value.trim()) {
        try { return new URL(url.value.trim(), location.href).origin + "/transcribe"; } catch (e) {}
      }
      return apiDefault("transcribe");
    }
    function refreshUsageBox() {
      var ue = liveSttEndpoint();
      ue = ue ? ue.replace(/\/transcribe\/?$/, "/usage") : null;
      if (!ue) { usageBox.textContent = "받아쓰기 API 주소가 없어 사용량을 확인할 수 없습니다."; return; }
      fetch(ue).then(function (r) { return r.json(); }).then(function (u) {
        var usedMin = Math.round((u.usedSeconds || 0) / 60);
        var limitMin = Math.round((u.limitSeconds || 0) / 60);
        usageBox.textContent = "오늘 사용량 " + usedMin + "분 / " + limitMin + "분 · 초기화 " + (u.resetAtLabel || "매일 09:00 (KST)");
      }).catch(function () { usageBox.textContent = "사용량을 확인할 수 없습니다."; });
    }
    sttUrl.addEventListener("blur", refreshUsageBox);
    url.addEventListener("blur", refreshUsageBox);

    var m = el("div", { class: "modal" }, [
      el("div", { class: "modal-head" }, [el("h2", { text: "설정 · 백업" }), el("button", { class: "ghost", text: "닫기 ✕", onclick: closeS })]),
      el("p", { class: "eyebrow", text: "요약 API 주소" }), url,
      el("p", { class: "tiny dim", style: "margin:6px 0 16px", text: "비워두면 위 placeholder의 기본 서버를 씁니다. 직접 만든 프록시가 있으면 여기 넣어 덮어쓰세요 — {prompt, transcript, note, ...}를 받아 {summary:\"마크다운\"} 을 돌려주면 됩니다." }),
      el("p", { class: "eyebrow", text: "API 키 (선택)" }), keyI,
      el("p", { class: "tiny dim", style: "margin:6px 0 16px", text: "브라우저에 저장되는 키는 이 기기에서 개발자도구로 볼 수 있습니다. 공개 사이트에서는 키 없이 프록시만 쓰세요." }),
      el("p", { class: "eyebrow", text: "모델" }), model,
      el("p", { class: "eyebrow", style: "margin-top:16px", text: "받아쓰기 API 주소 (선택)" }), sttUrl,
      usageBox,
      el("div", { class: "rec-bar", style: "margin-top:20px" }, [
        el("button", { class: "btn primary", text: "저장", onclick: function () {
          Store.set("ai", { url: url.value.trim(), key: keyI.value.trim(), model: model.value.trim(), sttUrl: sttUrl.value.trim() });
          closeS();
        } }),
        el("button", { class: "btn", text: "↓ 전체 백업(JSON)", onclick: function () {
          var blob = new Blob([JSON.stringify(Store.dump(), null, 2)], { type: "application/json" });
          var a = el("a", { href: URL.createObjectURL(blob), download: "class-toowani-backup-" + todayISO + ".json" });
          document.body.appendChild(a); a.click(); a.remove();
        } }),
        el("label", { class: "btn", style: "cursor:pointer" }, [
          document.createTextNode("↑ 백업 불러오기"),
          el("input", { type: "file", accept: "application/json", style: "display:none", onchange: function (e) {
            var f = e.target.files[0]; if (!f) return;
            f.text().then(function (t) { Store.load(JSON.parse(t)); alert("불러왔습니다."); closeS(); route(); });
          } })
        ])
      ]),
      el("p", { class: "tiny dim", style: "margin-top:18px", text: "메모·자막·요약은 이 브라우저에만 저장됩니다. 오디오는 IndexedDB에 들어갑니다. 학기말에 백업을 받아두세요." })
    ]);
    scrim.appendChild(m); document.body.appendChild(scrim); document.body.style.overflow = "hidden";
  }

  /* ── 지난 학기(아카이브) ──────────────── */
  function renderArchive() {
    var meta = (window.SEMESTERS || []).filter(function (x) { return x.id === SEM_ID; })[0] || { id: SEM_ID, label: SEM_ID };
    var arc = (window.ARCHIVES || {})[SEM_ID];
    var key = "archive/" + SEM_ID;
    var rows = Store.get(key, []);
    function save() { Store.set(key, rows); render(); }

    var listBox = el("div", { class: "grid g2" });
    function render() {
      listBox.innerHTML = "";
      if (!rows.length) listBox.appendChild(el("div", { class: "empty", text: "아직 비어 있습니다. 아래에서 추가하세요." }));
      rows.forEach(function (r, i) {
        listBox.appendChild(el("div", { class: "card" }, [
          el("div", { class: "tiny mono dim", text: (r.code || "") + (r.prof ? " · " + r.prof : "") }),
          el("h3", { style: "margin-top:6px;font-size:17px", text: r.name }),
          el("div", { class: "rec-bar", style: "margin-top:10px" }, [
            r.grade ? el("span", { class: "flag", text: "성적 " + r.grade }) : null,
            r.credits ? el("span", { class: "flag", text: r.credits + "학점" }) : null
          ]),
          r.note ? el("p", { class: "small mute", style: "margin-top:12px", text: r.note }) : null,
          r.link ? el("p", { style: "margin-top:10px" }, [el("a", { class: "small mono", href: r.link, target: "_blank", rel: "noopener", text: "프로젝트 →" })]) : null,
          el("button", { class: "ghost", style: "margin-top:12px", text: "삭제", onclick: function () { rows.splice(i, 1); save(); } })
        ]));
      });
    }
    render();

    var courseGrid = null;
    if (arc) {
      courseGrid = el("div", { class: "grid g2" });
      arc.courses.forEach(function (co) {
        courseGrid.appendChild(el("div", { class: "card" }, [
          el("div", { class: "tiny mono dim", text: co.code || "" }),
          el("h3", { style: "margin-top:6px;font-size:17px", text: co.name }),
          el("div", { class: "rec-bar", style: "margin-top:10px" }, [
            el("span", { class: "flag", text: co.grade }),
            el("span", { class: "flag", text: co.credits + "학점" })
          ])
        ]));
      });
    }

    function field(ph, w) { return el("input", { placeholder: ph, style: "flex:" + (w || 1) + ";min-width:110px;background:var(--ink);border:1px solid var(--line);border-radius:8px;padding:9px 12px" }); }
    var fName = field("과목명", 2), fCode = field("과목코드"), fProf = field("교수"), fCr = field("학점"), fGrade = field("성적"), fLink = field("프로젝트/코드 링크", 2);
    var fNote = el("textarea", { class: "note", style: "min-height:80px;margin-top:8px", placeholder: "한 줄 회고 · 배운 것 · 다시 본다면" });

    shell([
      el("section", { class: "hero" }, [el("div", {}, [
        el("p", { class: "eyebrow", text: "지난 학기 · 기록만 남김" }),
        el("h1", { text: meta.label }),
        arc
          ? el("p", { class: "mute", style: "margin-top:10px", text: "취득 " + arc.earned + "학점" + (arc.gpa ? " · 평점 " + arc.gpa : " · GPA 미산입") })
          : el("p", { class: "mute", style: "margin-top:10px", text: "성적 · 프로젝트 링크 · 회고만 정리하는 페이지입니다." }),
        (arc && arc.note) ? el("p", { class: "tiny dim", style: "margin-top:8px", text: "※ " + arc.note }) : null
      ])]),
      arc ? el("section", { class: "block" }, [
        el("div", { class: "block-head" }, [el("h2", { text: "수강 과목" }), el("span", { class: "eyebrow", text: arc.courses.length + "과목" })]),
        courseGrid
      ]) : null,
      el("section", { class: "block" }, [
        el("div", { class: "block-head" }, [el("h2", { text: "추가 기록" }), el("span", { class: "eyebrow", text: "이 브라우저에 저장 · 프로젝트 링크·회고" })]),
        listBox
      ]),
      el("section", { class: "block" }, [
        el("div", { class: "block-head" }, [el("h2", { text: "과목 추가" })]),
        el("div", { class: "card" }, [
          el("div", { class: "rec-bar" }, [fName, fCode, fProf, fCr, fGrade]),
          el("div", { class: "rec-bar", style: "margin-top:8px" }, [fLink]),
          fNote,
          el("button", { class: "btn primary", style: "margin-top:12px", text: "추가", onclick: function () {
            if (!fName.value.trim()) return;
            rows.push({ name: fName.value.trim(), code: fCode.value.trim(), prof: fProf.value.trim(), credits: fCr.value.trim(), grade: fGrade.value.trim(), link: fLink.value.trim(), note: fNote.value.trim() });
            [fName, fCode, fProf, fCr, fGrade, fLink].forEach(function (x) { x.value = ""; }); fNote.value = "";
            save();
          } })
        ])
      ])
    ]);
  }

  /* ── 부트 ─────────────────────────────── */
  document.addEventListener("DOMContentLoaded", function () {
    root = $("#app");
    var header = $("header.top .top-in");
    if (header && SEM) header.appendChild(nav(location.hash.indexOf("tt") > 0 ? "tt" : "today"));
    route();
  });
})();
