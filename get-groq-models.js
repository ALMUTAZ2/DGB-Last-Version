import fetch from "node-fetch";

async function run() {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    console.log("No API key");
    return;
  }
  
  const res = await fetch("https://api.groq.com/openai/v1/models", {
    headers: {
      Authorization: `Bearer ${apiKey}`
    }
  });
  const data = await res.json();
  console.log(data);
}
run();
