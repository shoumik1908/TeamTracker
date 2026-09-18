export async function generateMeetingSummary(transcriptText: string): Promise<string> {
  const systemPrompt = `You are an expert executive assistant.
Your task is to read a Microsoft Teams meeting transcript and produce a highly concise summary.
Format your response exactly as follows:
- Provide a brief 3-5 line summary of the main topics discussed.
- Provide a bulleted list of Action Items (decisions made or tasks assigned).

Keep it professional, brief, and highly readable. Do not include any filler text.`;

  // TT-119: every failure here used to be swallowed and the *error message* returned as
  // the summary — which the caller then cached in the database. A transient API error
  // became the meeting's permanent summary, the user read "Failed to generate AI summary"
  // as content, no retry ever happened and monitoring saw nothing wrong. Failures now
  // throw, so the caller can decline to cache and report honestly.
  try {
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'llama-3.1-8b-instant',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `Transcript:\n${transcriptText.substring(0, 30000)}` } // limit to 30k chars to avoid token limits
        ],
        temperature: 0.2,
        max_tokens: 500
      }),
      // Also TT-119: an unbounded fetch pinned the request handler indefinitely.
      signal: AbortSignal.timeout(Number(process.env.AI_REQUEST_TIMEOUT_MS) || 120_000),
    });

    if (!response.ok) {
      throw new Error(`Groq API error: ${response.status}`);
    }

    const data: any = await response.json();
    const content = data.choices?.[0]?.message?.content;
    if (!content || !content.trim()) {
      throw new Error('The model returned an empty summary.');
    }
    return content;
  } catch (error: any) {
    console.error('Failed to generate AI summary:', error);
    throw new Error(`Could not generate a summary: ${error?.message || error}`);
  }
}
