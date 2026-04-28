const Groq = require('groq-sdk');
require('dotenv').config({ path: '.env.local' });

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

async function main() {
  try {
    const response = await groq.chat.completions.create({
      model: "llama-3.2-90b-vision-preview",
      messages: [
        { role: "system", content: "You are a helpful assistant." },
        { role: "user", content: [
            { type: "text", text: "What's in this image?" },
            { type: "image_url", image_url: { url: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=" } }
        ]}
      ],
      response_format: { type: "json_object" }
    });
    console.log(response.choices[0].message.content);
  } catch (error) {
    console.error("Error:", error);
  }
}

main();
