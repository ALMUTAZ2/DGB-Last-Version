import { GoogleGenAI } from "@google/genai";
async function run() {
  try {
    const res = await fetch("http://localhost:3000/api/gemini/summarize", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
         masterJson: '{"decisions": [{"decision": "test"}]}',
         transcript: 'test meeting transcript',
         geminiApiKey: process.env.GEMINI_API_KEY
      })
    });
    const text = await res.text();
    console.log("Status:", res.status);
    if(res.status === 200) console.log("Success! Length:", text.length);
    else console.log("Body:", text);
  } catch (e) {
    console.error("Fetch error:", e);
  }
}
run();
