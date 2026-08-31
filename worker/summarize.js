/* class.toowani 요약/받아쓰기 프록시 — Cloudflare Worker
 *
 * 배포:
 *   1) Workers 새 프로젝트 생성 → 이 파일 내용 붙여넣기
 *   2) Settings → Variables → Secret 에 ANTHROPIC_API_KEY 추가
 *   3) Workers AI 바인딩(AI)과 KV 네임스페이스(BUDGET_KV)를 wrangler.toml 대로 연결
 *   4) 사이트 설정 화면의 "요약 API 주소"에 이 Worker 주소를 입력 (API 키는 비워둠)
 *      "받아쓰기 API 주소"는 비워두면 요약 API 주소에서 자동으로 유추합니다.
 *
 * 이렇게 하면 API 키가 브라우저에 노출되지 않습니다.
 *
 * 라우팅:
 *   POST /          → 기존 요약 프록시 (동작 그대로)
 *   POST /transcribe → Workers AI Whisper로 오디오 조각 받아쓰기 (일일 예산 가드 포함)
 *   GET  /usage      → 오늘 사용량/한도 조회
 */

const ALLOW = ["https://class.toowani.com", "http://localhost"]; // 로컬 테스트는 http://localhost:포트 도 허용

export default {
  async fetch(request, env) {
    const origin = allowedOrigin(request.headers.get("Origin"));
    const url = new URL(request.url);
    if (request.method === "OPTIONS") return cors(new Response(null, { status: 204 }), origin);

    if (url.pathname === "/transcribe") return handleTranscribe(request, env, origin);
    if (url.pathname === "/usage" && request.method === "GET") return handleUsage(env, origin);

    // 기존 요약 프록시 — 동작 그대로
    if (request.method !== "POST") return cors(new Response("POST only", { status: 405 }), origin);

    let body;
    try { body = await request.json(); } catch { return cors(json({ error: "bad json" }, 400), origin); }
    const prompt = String(body.prompt || "").slice(0, 60000);
    if (!prompt) return cors(json({ error: "prompt 없음" }, 400), origin);

    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01"
      },
      body: JSON.stringify({
        model: body.model || "claude-sonnet-4-6",
        max_tokens: 2000,
        messages: [{ role: "user", content: prompt }]
      })
    });

    if (!r.ok) return cors(json({ error: "upstream " + r.status, detail: await r.text() }, 502), origin);
    const data = await r.json();
    const summary = (data.content || []).filter(b => b.type === "text").map(b => b.text).join("\n");
    return cors(json({ summary }), origin);
  }
};

/* ── 받아쓰기 (Workers AI Whisper) ─────────────────────── */

// Cloudflare가 1회 요청 크기 제한을 공개하지 않아서([0] 확인 결과) 우리 쪽에서 상한을 걸어둔다.
// 배포 후 실측: base64 인코딩 경로로 5분·mono 32kbps opus(1.84MB)와 90초·16kHz WAV(2.88MB)
// 모두 성공 — 그 위로 여유를 두고 4MB로 설정. (문서화되지 않은 값이라 나중에 실패하면 더 낮출 것)
const MAX_AUDIO_BYTES = 4 * 1024 * 1024;

async function handleTranscribe(request, env, origin) {
  if (request.method !== "POST") return cors(new Response("POST only", { status: 405 }), origin);

  const durationHeader = request.headers.get("x-duration-sec");
  const duration = durationHeader ? parseFloat(durationHeader) : NaN;
  if (!(duration > 0)) return cors(json({ error: "x-duration-sec 헤더(초 단위) 필요" }, 400), origin);

  const budget = await reserveBudget(env, duration);
  if (!budget.ok) {
    return cors(json({ reason: "daily_budget", usedSeconds: budget.used, limitSeconds: budget.limit, resetAt: nextResetISO() }, 429), origin);
  }

  const buf = await request.arrayBuffer();
  if (buf.byteLength > MAX_AUDIO_BYTES) {
    await refundBudget(env, duration);
    return cors(json({ error: "audio too large", maxBytes: MAX_AUDIO_BYTES, gotBytes: buf.byteLength }, 413), origin);
  }
  if (buf.byteLength === 0) {
    await refundBudget(env, duration);
    return cors(json({ error: "empty body" }, 400), origin);
  }

  const contentType = (request.headers.get("content-type") || "audio/webm").split(";")[0].trim();
  const language = (request.headers.get("x-language") || "").trim();
  const model = env.TRANSCRIBE_MODEL || "@cf/openai/whisper-large-v3-turbo";
  const b64 = arrayBufferToBase64(buf);
  const input = { audio: b64, task: "transcribe" };
  if (language) input.language = language;

  let result;
  try {
    result = await env.AI.run(model, input);
  } catch (e) {
    await refundBudget(env, duration);
    if (isQuotaError(e)) {
      return cors(json({ reason: "daily_budget", note: "Workers AI 자체 한도", resetAt: nextResetISO() }, 429), origin);
    }
    return cors(json({ error: "transcribe upstream", detail: String((e && e.message) || e) }, 502), origin);
  }

  const info = result && result.transcription_info;
  return cors(json({
    text: (result && result.text) || "",
    segments: (result && result.segments) || null,
    duration: (info && info.duration) || duration
  }), origin);
}

function arrayBufferToBase64(buf) {
  let binary = "";
  const bytes = new Uint8Array(buf);
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}
function isQuotaError(e) {
  const msg = String((e && e.message) || e || "").toLowerCase();
  return /limit|quota|rate|too many|capacity|429/.test(msg);
}

async function handleUsage(env, origin) {
  const limit = dailyBudgetSeconds(env);
  const used = await usedSeconds(env);
  return cors(json({
    usedSeconds: used,
    limitSeconds: limit,
    remainingSeconds: Math.max(0, limit - used),
    resetAt: nextResetISO(),
    resetAtLabel: "매일 09:00 (KST)"
  }), origin);
}

/* ── 일일 예산 가드 (KV, Durable Object 없이) ──────────── */

function dailyBudgetSeconds(env) {
  return parseInt(env.DAILY_BUDGET_SECONDS || "12000", 10); // 기본 200분 — [0] 확인 결과 플랜을 못 밝혀 보수적으로 잡음
}
function utcDateKey() {
  return new Date().toISOString().slice(0, 10); // YYYY-MM-DD, UTC 자정 기준 = KST 09:00 기준
}
function nextResetISO() {
  const d = new Date();
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + 1, 0, 0, 0)).toISOString();
}
async function usedSeconds(env) {
  const raw = await env.BUDGET_KV.get("budget/" + utcDateKey());
  return raw ? parseInt(raw, 10) : 0;
}
async function reserveBudget(env, addSeconds) {
  const limit = dailyBudgetSeconds(env);
  const used = await usedSeconds(env);
  if (used + addSeconds > limit) return { ok: false, used, limit };
  await env.BUDGET_KV.put("budget/" + utcDateKey(), String(used + addSeconds), { expirationTtl: 172800 });
  return { ok: true, used: used + addSeconds, limit };
}
async function refundBudget(env, seconds) {
  const used = await usedSeconds(env);
  await env.BUDGET_KV.put("budget/" + utcDateKey(), String(Math.max(0, used - seconds)), { expirationTtl: 172800 });
}

/* ── 공통 ─────────────────────────────────────────────── */

function json(o, status = 200) {
  return new Response(JSON.stringify(o), { status, headers: { "content-type": "application/json" } });
}
function allowedOrigin(origin) {
  if (!origin) return ALLOW[0];
  const ok = ALLOW.some((a) => origin === a || origin.indexOf(a + ":") === 0);
  return ok ? origin : ALLOW[0];
}
function cors(res, origin) {
  res.headers.set("Access-Control-Allow-Origin", origin);
  res.headers.set("Access-Control-Allow-Headers", "content-type, authorization, x-language, x-duration-sec");
  res.headers.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.headers.append("Vary", "Origin");
  return res;
}
