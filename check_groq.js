const apiKey = process.env.GROQ_API_KEY || "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";
fetch("https://api.groq.com/openai/v1/models", { headers: { "Authorization": `Bearer ${apiKey}` }})
  .then(res => res.json())
  .then(data => console.log(data))
  .catch(console.error);
