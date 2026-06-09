import { NextRequest, NextResponse } from "next/server";
import { PDFParse } from "pdf-parse";

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const files = formData.getAll("files") as File[];

    if (!files || files.length === 0) {
      return NextResponse.json({ error: "No files uploaded" }, { status: 400 });
    }

    const candidates = [];

    for (const file of files) {
      const arrayBuffer = await file.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      
      // Extract text from PDF using PDFParse v2 API
      const parser = new PDFParse({ data: buffer });
      const pdfData = await parser.getText();
      const text = pdfData.text;
      await parser.destroy();

      // Extract candidate name from file name (strip extension)
      const name = file.name.replace(/\.[^/.]+$/, "");

      // Extract email using basic regex
      const emailRegex = /[\w.-]+@[\w.-]+\.\w+/;
      const emailMatch = text.match(emailRegex);
      const email = emailMatch ? emailMatch[0] : "unknown@example.com";

      candidates.push({
        name,
        email,
        text,
      });
    }

    const webhookUrl = process.env.NEXT_PUBLIC_N8N_WEBHOOK_URL;
    if (!webhookUrl) {
      return NextResponse.json({ error: "Webhook URL not configured" }, { status: 500 });
    }

    // Send the array of candidates to n8n Webhook
    const n8nResponse = await fetch(webhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        source: "web",
        candidates,
      }),
    });

    if (!n8nResponse.ok) {
      const errText = await n8nResponse.text();
      return NextResponse.json(
        { error: `n8n webhook call failed: ${n8nResponse.status} - ${errText}` },
        { status: 502 }
      );
    }

    // Check if response has content
    let responseData = null;
    const contentType = n8nResponse.headers.get("content-type");
    if (contentType && contentType.includes("application/json")) {
      responseData = await n8nResponse.json();
    } else {
      responseData = { message: await n8nResponse.text() };
    }

    return NextResponse.json({
      success: true,
      message: "CVs processed and forwarded to n8n successfully",
      data: responseData,
    });
  } catch (error: unknown) {
    console.error("Error in parse-cv route:", error);
    const errorMessage = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
