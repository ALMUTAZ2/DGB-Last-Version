import Groq from "groq-sdk";

async function run() {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    console.log("No API key");
    return;
  }
  const groq = new Groq({ apiKey });
  try {
    const models = await groq.models.list();
    console.log(models.data.map(m => m.id));
  } catch (e) {
    console.log("Error", e);
  }
}
run();
