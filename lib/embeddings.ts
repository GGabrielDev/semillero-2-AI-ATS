import { Logger } from "./logger";

export async function generateEmbedding(text: string): Promise<number[]> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("Missing GEMINI_API_KEY environment variable");
  }

  try {
    const start = Date.now();
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-001:embedContent?key=${apiKey}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "models/gemini-embedding-001",
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

    // Adapt embedding dimensionality dynamically to fit the database vector(1536) schema limit.
    const targetDimension = 1536;
    let finalEmbedding = [...embedding];

    if (finalEmbedding.length > targetDimension) {
      // Truncate (Matryoshka Representation Learning allows this without loss of semantic meaning)
      finalEmbedding = finalEmbedding.slice(0, targetDimension);
    } else {
      // Pad with zeros if the embedding is smaller
      while (finalEmbedding.length < targetDimension) {
        finalEmbedding.push(0.0);
      }
    }

    return finalEmbedding;
  } catch (error) {
    Logger.error("Failed to generate embedding", error);
    throw error;
  }
}
