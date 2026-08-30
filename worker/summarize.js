/* class.toowani 요약 프록시 — Cloudflare Worker
 *
 * 배포:
 *   1) Workers 새 프로젝트 생성 → 이 파일 내용 붙여넣기
 *   2) Settings → Variables → Secret 에 ANTHROPIC_API_KEY 추가
 *   3) 사이트 설정 화면의 "요약 API 주소"에 이 Worker 주소를 입력 (API 키는 비워둠)
 *
 * 이렇게 하면 API 키가 브라우저에 노출되지 않습니다.
 */

const ALLOW = "https://class.toowani.com"; // 로컬 테스트 중이면 "*"

export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") return cors(new Response(null, { status: 204 }));
    if (request.method !== "POST") return cors(new Response("POST only", { status: 405 }));

    let body;
    try { body = await request.json(); } catch { return cors(json({ error: "bad json" }, 400)); }
    const prompt = String(body.prompt || "").slice(0, 60000);
    if (!prompt) return cors(json({ error: "prompt 없음" }, 400));

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

    if (!r.ok) return cors(json({ error: "upstream " + r.status, detail: await r.text() }, 502));
    const data = await r.json();
    const summary = (data.content || []).filter(b => b.type === "text").map(b => b.text).join("\n");
    return cors(json({ summary }));
  }
};

function json(o, status = 200) {
  return new Response(JSON.stringify(o), { status, headers: { "content-type": "application/json" } });
}
function cors(res) {
  res.headers.set("Access-Control-Allow-Origin", ALLOW);
  res.headers.set("Access-Control-Allow-Headers", "content-type, authorization");
  res.headers.set("Access-Control-Allow-Methods", "POST, OPTIONS");
  return res;
}
