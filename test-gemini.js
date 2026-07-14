import { GoogleGenAI } from "@google/genai";
async function run() {
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  try {
    const res = await ai.models.generateContent({
      model: "gemini-1.5-pro",
      contents: "Hello"
    });
    console.log(res.text);
  } catch(e) {
    console.log("Error 1.5-pro:", e.message);
  }
}
run();
