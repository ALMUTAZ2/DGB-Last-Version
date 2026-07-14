const apiKey = process.env.GROQ_API_KEY || "invalid";

const callGroqWithRetry = async (models, systemInstruction, userMessage, apiKey, maxRetries = 2) => {
  let lastError;
  for (const model of models) {
    let retries = 0;
    while (retries <= maxRetries) {
      try {
        console.log(`Trying Groq model: ${model}`);
        const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${apiKey}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            model: model,
            messages: [
              { role: "system", content: systemInstruction },
              { role: "user", content: userMessage }
            ],
            temperature: 0.1
          })
        });
        
        if (!response.ok) {
           const errorData = await response.json().catch(() => ({}));
           const error = new Error(errorData.error?.message || `Groq API error: ${response.status}`);
           error.status = response.status;
           throw error;
        }
        
        const data = await response.json();
        return { text: data.choices[0].message.content };
      } catch (error) {
        lastError = error;
        const isTransient = error.status === 429 || error.status === 503 || error.status === 500 || (error.message && error.message.toLowerCase().includes("rate limit"));
        
        if (isTransient && retries < maxRetries) {
          retries++;
          const delay = Math.pow(2, retries) * 1500;
          console.log(`Groq API busy (${error.status}) for ${model}. Retrying ${retries}/${maxRetries} in ${delay}ms...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        } else {
           console.log(`Groq Model ${model} failed permanently: ${error.message}`);
           break; // Try next model
        }
      }
    }
  }
  throw lastError;
};

callGroqWithRetry(["qwen-2.5-32b", "llama-3.3-70b-versatile"], "hello", "world", apiKey)
  .then(console.log)
  .catch(e => console.log("Final error", e.message));
