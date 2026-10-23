export function extractJson<T = any>(text: string): T {
  if (!text) throw new Error('Empty response from AI model');

  // Strip markdown fences
  let cleaned = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();

  // Try direct parse
  try {
    return JSON.parse(cleaned);
  } catch (_e) {
    // Try finding outer { } or [ ]
    const matchObj = text.match(/\{[\s\S]*\}/);
    if (matchObj) {
      try {
        return JSON.parse(matchObj[0]);
      } catch (_e2) {}
    }

    const matchArr = text.match(/\[[\s\S]*\]/);
    if (matchArr) {
      try {
        return JSON.parse(matchArr[0]);
      } catch (_e3) {}
    }

    throw new Error(`Failed to parse JSON from AI response: ${text.slice(0, 200)}...`);
  }
}
