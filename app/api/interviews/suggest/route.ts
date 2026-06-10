import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "Missing GEMINI_API_KEY environment variable" }, { status: 500 });
    }

    const body = await request.json();
    const {
      candidateName,
      jobTitle,
      currentStage,
      candidateSummary,
      candidateSkills,
      jobRequirements,
      commentHistory,
      lang,
    } = body;

    if (!candidateName || !jobTitle || !currentStage) {
      return NextResponse.json({ error: "Missing required parameters" }, { status: 400 });
    }

    const formattedComments = (commentHistory || [])
      .map((c: { author?: string; text?: string; timestamp?: string }) => 
        `[${c.timestamp ? new Date(c.timestamp).toLocaleString() : ""}] ${c.author || "Agent"}: ${c.text}`
      )
      .join("\n");

    const prompt = `You are an AI recruitment co-pilot. Suggest the next step for this candidate in their interview process.

Candidate Name: ${candidateName}
Vacancy: ${jobTitle}
Current Interview Stage: ${currentStage}
Candidate Summary: ${candidateSummary || "None provided"}
Candidate Skills: ${JSON.stringify(candidateSkills || [])}
Job Requirements: ${jobRequirements || "None provided"}

Interview Comments History:
${formattedComments || "No comments yet"}

Provide your suggestion for the next steps.
Requirements:
1. MUST be extremely brief and concise (max 3-4 bullet points).
2. MUST focus on actionable suggestions based on their current stage, comment history, and candidate profile.
3. Respond in ${lang === "es" ? "Spanish" : "English"}.
4. Use standard Markdown formatting. Keep it professional.

Do not include any pre-text or post-text. Return only the markdown content.`;

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
          }]
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
      return NextResponse.json({ error: "Failed to generate suggestion from Gemini" }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      suggestion: textContent.trim(),
    });

  } catch (error: unknown) {
    console.error("Error in interviews suggest API:", error);
    const errorMessage = error instanceof Error ? error.message : "Internal Server Error";
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
