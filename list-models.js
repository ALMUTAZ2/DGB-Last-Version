import { GoogleGenAI } from "@google/genai";
async function run() {
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  try {
    const res = await ai.models.list();
    for await (const m of res) {
      console.log(m.name);
    }
  } catch(e) {
    console.log("Error:", e.message);
  }
}
run();
