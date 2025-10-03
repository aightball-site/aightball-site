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

    const resp = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${openaiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        input: prompt,
        response_format: { type: "json_object" }
      })
    });

    if (!resp.ok) {
      const errText = await resp.text().catch(() => "");
      return {
        statusCode: 200,
        headers: cors,
        body: JSON.stringify({
          short: "62%",
          long: "Currents are moving in your favor, but attention to small details will preserve the edge.",
          odds: 62,
          error: `OpenAI error: ${resp.status} ${errText}`.slice(0, 500)
        })
      };
    }

    const data = await resp.json();
    const text =
      data?.output_text ??
      (Array.isArray(data?.output)
        ? data.output.map(it => (it?.content || [])
            .map(c => c?.text || "")
            .join("")).join("")
        : (data?.choices?.[0]?.message?.content || ""));

    // Parse model JSON
    let parsed;
    try { parsed = JSON.parse(text); } catch {}

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
        error: String(err?.message || err).slice(0, 500)
      })
    };
  }
};
