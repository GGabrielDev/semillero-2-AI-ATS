import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "Missing GEMINI_API_KEY environment variable" }, { status: 500 });
    }

    const body = await request.json();
    const { existingProfile, newProfile } = body;

    if (!existingProfile || !newProfile) {
      return NextResponse.json({ error: "existingProfile and newProfile are required" }, { status: 400 });
    }

    const prompt = `You are an AI recruitment assistant. Compare the existing candidate profile against the newly uploaded CV profile for a candidate. 
Analyze differences in skills, experience, and summary.
Determine:
1. If they appear to be the same person (updated resume) or two different people with the same name.
2. What new skills or experiences are present in the new profile compared to the old one.

Existing Profile:
Name: ${existingProfile.name}
Skills: ${JSON.stringify(existingProfile.skills || existingProfile.contact_info?.skills || [])}
Summary: ${existingProfile.summary || existingProfile.contact_info?.summary || ""}

New Profile:
Name: ${newProfile.candidateName || newProfile.name}
Skills: ${JSON.stringify(newProfile.skills || newProfile.contact_info?.skills || [])}
Summary: ${newProfile.summary || newProfile.contact_info?.summary || ""}

You MUST respond with a raw JSON object containing exactly these two keys:
- en: A concise 2-3 sentence summary of the differences in English.
- es: A concise 2-3 sentence summary of the differences in Spanish.

Do not include any markdown formatting, code blocks, or text outside the JSON.`;

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          contents: [{
            parts: [{ text: prompt }]
          }],
          generationConfig: {
            responseMimeType: "application/json",
          }
        }),
      }
    );

    if (!response.ok) {
      const errText = await response.text();
      return NextResponse.json({ error: `Gemini API error: ${response.status} - ${errText}` }, { status: 500 });
    }

    const data = await response.json();
    const textContent = data.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!textContent) {
      return NextResponse.json({ error: "Failed to generate comparison from Gemini" }, { status: 500 });
    }

    const parsedComparison = JSON.parse(textContent.trim());

    return NextResponse.json({
      success: true,
      comparison: parsedComparison,
    });

  } catch (error: unknown) {
    console.error("Error in compare API:", error);
    const errorMessage = error instanceof Error ? error.message : "Internal Server Error";
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
