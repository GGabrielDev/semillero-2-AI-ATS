import { Logger } from "./logger";

export async function generateEmbedding(text: string): Promise<number[]> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("Missing GEMINI_API_KEY environment variable");
  }

  try {
    const start = Date.now();
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:embedContent?key=${apiKey}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "models/text-embedding-004",
          content: {
            parts: [{ text }],
          },
        }),
      }
    );

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Gemini embedding API error: ${response.status} - ${errText}`);
    }

    const data = await response.json();
    const embedding = data.embedding?.values;

    if (!Array.isArray(embedding)) {
      throw new Error("Invalid embedding response structure from Gemini API");
    }

    Logger.info("Generated Gemini embedding successfully", {
      textLength: text.length,
      originalDimension: embedding.length,
    }, Date.now() - start);

    // Gemini text-embedding-004 outputs 768 dimensions.
    // Pad with zeros to fit database vector(1536) schema limit.
    const targetDimension = 1536;
    const paddedEmbedding = [...embedding];
    while (paddedEmbedding.length < targetDimension) {
      paddedEmbedding.push(0.0);
    }

    return paddedEmbedding;
  } catch (error) {
    Logger.error("Failed to generate embedding", error);
    throw error;
  }
}
