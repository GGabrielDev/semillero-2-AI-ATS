import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
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

    const webhookUrl = process.env.NEXT_PUBLIC_N8N_WEBHOOK_URL;
    const baseUrl = webhookUrl
      ? webhookUrl.replace(/\/evaluate-candidate$/, "")
      : "https://n8n.gaboggamer.online/webhook";

    const targetUrl = `${baseUrl}/suggest-next-steps`;

    const response = await fetch(targetUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        candidateName,
        jobTitle,
        currentStage,
        candidateSummary,
        candidateSkills,
        jobRequirements,
        commentHistory,
        lang,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      return NextResponse.json(
        { error: `n8n suggestion error: ${response.status} - ${errText}` },
        { status: 500 }
      );
    }

    const data = await response.json();
    
    // Support either direct suggestion string, or wrapped inside an object/array
    let result = Array.isArray(data) ? data[0] : data;
    if (result && result.json) {
      result = result.json;
    }
    
    const suggestionText = typeof result === "string" ? result : result.suggestion;

    if (!suggestionText) {
      return NextResponse.json({ error: "Invalid response structure from n8n suggestion" }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      suggestion: suggestionText.trim(),
    });

  } catch (error: unknown) {
    console.error("Error in interviews suggest API:", error);
    const errorMessage = error instanceof Error ? error.message : "Internal Server Error";
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
