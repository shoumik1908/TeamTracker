export async function generateMeetingSummary(transcriptText: string): Promise<string> {
  const systemPrompt = `You are an expert executive assistant.
Your task is to read a Microsoft Teams meeting transcript and produce a highly concise summary.
Format your response exactly as follows:
- Provide a brief 3-5 line summary of the main topics discussed.
- Provide a bulleted list of Action Items (decisions made or tasks assigned).

Keep it professional, brief, and highly readable. Do not include any filler text.`;

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
      })
    });

    if (!response.ok) {
      throw new Error(`Groq API error: ${response.status}`);
    }

    const data: any = await response.json();
    return data.choices?.[0]?.message?.content || 'No summary could be generated.';
  } catch (error) {
    console.error('Failed to generate AI summary:', error);
    return 'Failed to generate AI summary due to an API error.';
  }
}
