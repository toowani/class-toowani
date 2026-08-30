/* 저장소 어댑터
 * - 텍스트/메모/요약 → localStorage (사용 불가 환경이면 메모리로 자동 폴백)
 * - 녹음 오디오 → IndexedDB (용량이 커서 localStorage에 못 넣음)
 */
(function () {
  var mem = {};
  var LS = (function () {
    try {
      var k = "__cw_probe__";
      window.localStorage.setItem(k, "1");
      window.localStorage.removeItem(k);
      return window.localStorage;
    } catch (e) {
      return null;
    }
  })();

  var PREFIX = "class.toowani/";

  var Store = {
    persistent: !!LS,
    get: function (key, fallback) {
      var raw = LS ? LS.getItem(PREFIX + key) : mem[key];
      if (raw == null) return fallback;
      try { return JSON.parse(raw); } catch (e) { return fallback; }
    },
    set: function (key, value) {
      var raw = JSON.stringify(value);
      if (LS) { try { LS.setItem(PREFIX + key, raw); } catch (e) { mem[key] = raw; } }
      else { mem[key] = raw; }
      window.dispatchEvent(new CustomEvent("store:write", { detail: { key: key } }));
    },
    remove: function (key) {
      if (LS) LS.removeItem(PREFIX + key);
      delete mem[key];
    },
    keys: function () {
      var out = [];
      if (LS) {
        for (var i = 0; i < LS.length; i++) {
          var k = LS.key(i);
          if (k.indexOf(PREFIX) === 0) out.push(k.slice(PREFIX.length));
        }
      } else {
        for (var m in mem) out.push(m);
      }
      return out;
    },
    dump: function () {
      var o = {};
      this.keys().forEach(function (k) { o[k] = Store.get(k, null); });
      return o;
    },
    load: function (obj) {
      Object.keys(obj).forEach(function (k) { Store.set(k, obj[k]); });
    }
  };

  /* ── IndexedDB: 오디오 blob ─────────────────────────── */
  var DB_NAME = "class-toowani-audio", STORE = "clips", dbp = null;
  function db() {
    if (dbp) return dbp;
    dbp = new Promise(function (res, rej) {
      if (!window.indexedDB) return rej(new Error("no-idb"));
      var r = indexedDB.open(DB_NAME, 1);
      r.onupgradeneeded = function () {
        if (!r.result.objectStoreNames.contains(STORE)) r.result.createObjectStore(STORE);
      };
      r.onsuccess = function () { res(r.result); };
      r.onerror = function () { rej(r.error); };
    });
    return dbp;
  }
  var Audio = {
    put: function (id, blob) {
      return db().then(function (d) {
        return new Promise(function (res, rej) {
          var tx = d.transaction(STORE, "readwrite");
          tx.objectStore(STORE).put(blob, id);
          tx.oncomplete = function () { res(true); };
          tx.onerror = function () { rej(tx.error); };
        });
      });
    },
    get: function (id) {
      return db().then(function (d) {
        return new Promise(function (res, rej) {
          var tx = d.transaction(STORE, "readonly");
          var q = tx.objectStore(STORE).get(id);
          q.onsuccess = function () { res(q.result || null); };
          q.onerror = function () { rej(q.error); };
        });
      });
    },
    del: function (id) {
      return db().then(function (d) {
        return new Promise(function (res) {
          var tx = d.transaction(STORE, "readwrite");
          tx.objectStore(STORE).delete(id);
          tx.oncomplete = function () { res(true); };
        });
      });
    }
  };

  window.Store = Store;
  window.AudioStore = Audio;
})();
