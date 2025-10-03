// netlify/functions/reading.js
export const handler = async (event, context) => {
  const cors = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Content-Type": "application/json"
  };

  // CORS preflight
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers: cors, body: "" };
  }

  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      headers: cors,
      body: JSON.stringify({ error: "Method not allowed" })
    };
  }

  // Parse JSON body
  let question = "";
  try {
    const body = JSON.parse(event.body || "{}");
    question = (body?.question || "").toString().slice(0, 200).trim();
  } catch {}

  const prompt = `
You are "AIght Ball", a mystical probabilistic oracle.
Return ONLY strict JSON (no backticks), with keys:
{
  "short": string,
  "long": string,
  "odds": number
}
Guidelines:
- If the question is empty or vague, still reply with a fun, generic reading.
- Keep "long" around 25–50 words.
- Ensure "odds" is 0..100 and matches "short" if short is a %.

The user's question is: "${question}"
  `.trim();

  try {
    const openaiKey = process.env.OPENAI_API_KEY;
    if (!openaiKey) throw new Error("Missing OPENAI_API_KEY");

    // 🔄 Use Chat Completions (stable) instead of Responses API
    const resp = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${openaiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: `You are "AIght Ball", a mystical probabilistic oracle.
Return ONLY strict JSON (no backticks), with keys:
{
  "short": string,
  "long": string,
  "odds": number
}
Guidelines:
- If the question is empty or vague, still reply with a fun, generic reading.
- Keep "long" around 25–50 words.
- Ensure "odds" is 0..100 and matches "short" if short is a %.`
          },
          { role: "user", content: prompt }
        ],
        response_format: { type: "json_object" } // force valid JSON
      })
    });

    const status = resp.status;
    const raw = await resp.text().catch(() => "");
    if (!resp.ok) {
      return {
        statusCode: 200,
        headers: cors,
        body: JSON.stringify({
          short: "62%",
          long: "Currents are moving in your favor, but attention to small details will preserve the edge.",
          odds: 62,
          debug: { where: "openai-chat", status, raw: raw.slice(0, 400) }
        })
      };
    }

    // Parse chat response
    let data; try { data = JSON.parse(raw); } catch { data = null; }
    const content = data?.choices?.[0]?.message?.content || "";

    let parsed = null;
    try { parsed = JSON.parse(content); } catch {}

    // Fallbacks / sanitization
    let odds = 50, short = "50%", long = "The outcome balances on a knife-edge; ready yourself to tip the scales with purpose.";
    if (parsed && typeof parsed === "object") {
      const n = Number(parsed.odds);
      odds = Number.isFinite(n) ? Math.max(0, Math.min(100, Math.round(n))) : 50;
      short = typeof parsed.short === "string" ? parsed.short : `${odds}%`;
      long  = typeof parsed.long  === "string" ? parsed.long  : long;
      if (/^\d{1,3}%$/.test(short)) short = `${odds}%`;
    }

    return {
      statusCode: 200,
      headers: cors,
      body: JSON.stringify({ short, long, odds })
    };

  } catch (err) {
    return {
      statusCode: 200,
      headers: cors,
      body: JSON.stringify({
        short: "61%",
        long: "Conditions are favorable if you proceed with steady attention and tidy edges; small missteps could ripple larger than expected.",
        odds: 61,
        debug: { where: "catch", message: String(err?.message || err) }
      })
    };
  }
};




