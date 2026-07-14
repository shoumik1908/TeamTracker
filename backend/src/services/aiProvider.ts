import { AzureOpenAI } from 'openai';

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface ChatOptions {
  model?: string;
  temperature?: number;
  maxTokens?: number;
  jsonMode?: boolean;
  responseSchema?: any;
  tools?: any[];
  toolChoice?: any;
}

export interface AIResponse {
  provider: 'groq' | 'azure';
  content: string;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
  };
}

// Check environment configuration at startup
export function validateAiConfig() {
  const missingGroq = !process.env.GROQ_API_KEY;
  const missingAzure = [
    'AZURE_OPENAI_API_KEY',
    'AZURE_OPENAI_ENDPOINT',
    'AZURE_OPENAI_DEPLOYMENT',
    'AZURE_OPENAI_API_VERSION'
  ].filter(key => !process.env[key]);

  if (missingGroq) {
    console.warn('[AI Config] Warning: GROQ_API_KEY is not configured.');
  } else {
    console.log('[AI Config] Groq primary provider configuration is active.');
  }

  if (missingAzure.length > 0) {
    console.warn(`[AI Config] Warning: Azure OpenAI fallback is incomplete. Missing env: ${missingAzure.join(', ')}`);
  } else {
    console.log('[AI Config] Azure OpenAI fallback provider configuration is active.');
  }
}

// Extensible factory design for provider retrieval
class AIProviderFactory {
  private static azureClient: AzureOpenAI | null = null;

  static getAzureClient(): AzureOpenAI {
    if (!this.azureClient) {
      const apiKey = process.env.AZURE_OPENAI_API_KEY;
      const endpoint = process.env.AZURE_OPENAI_ENDPOINT;
      const apiVersion = process.env.AZURE_OPENAI_API_VERSION;

      if (!apiKey || !endpoint || !apiVersion) {
        throw new Error('Azure OpenAI credentials are not fully configured in environment.');
      }

      this.azureClient = new AzureOpenAI({
        apiKey,
        endpoint,
        apiVersion
      });
    }
    return this.azureClient;
  }

  // 1. Primary execution on Groq (Llama models via direct fetch for flexibility)
  static async callGroq(messages: ChatMessage[], options: ChatOptions): Promise<AIResponse> {
    const startTime = Date.now();
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) {
      throw new Error('GROQ_API_KEY is missing.');
    }

    const model = options.model || 'llama-3.3-70b-versatile';
    const body: any = {
      model,
      messages,
      temperature: options.temperature ?? 0.2
    };

    if (options.maxTokens) {
      body.max_tokens = options.maxTokens;
    }

    if (options.tools) {
      body.tools = options.tools;
    }

    if (options.toolChoice) {
      body.tool_choice = options.toolChoice;
    } else if (options.responseSchema) {
      body.response_format = {
        type: 'json_schema',
        json_schema: options.responseSchema
      };
    } else if (options.jsonMode) {
      body.response_format = { type: 'json_object' };
    }

    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify(body)
    });

    const duration = Date.now() - startTime;
    const responseData = await res.json() as any;

    if (!res.ok) {
      const errMsg = responseData?.error?.message ?? `HTTP ${res.status}`;
      const err: any = new Error(errMsg);
      err.status = res.status;
      err.code = responseData?.error?.code;
      throw err;
    }

    const toolCall = responseData.choices?.[0]?.message?.tool_calls?.[0];
    const content = toolCall ? toolCall.function.arguments : (responseData.choices?.[0]?.message?.content ?? '');
    console.log(`[AI Logs] Provider: Groq | Model: ${model} | Response Time: ${duration}ms`);

    return {
      provider: 'groq',
      content,
      usage: responseData.usage ? {
        prompt_tokens: responseData.usage.prompt_tokens,
        completion_tokens: responseData.usage.completion_tokens,
        total_tokens: responseData.usage.total_tokens
      } : undefined
    };
  }

  // 2. Secondary fallback execution on Azure OpenAI
  static async callAzure(messages: ChatMessage[], options: ChatOptions): Promise<AIResponse> {
    const startTime = Date.now();
    const client = this.getAzureClient();
    const deployment = process.env.AZURE_OPENAI_DEPLOYMENT;

    if (!deployment) {
      throw new Error('AZURE_OPENAI_DEPLOYMENT is not configured.');
    }

    const res = await client.chat.completions.create({
      model: deployment,
      messages,
      // GPT-5 mini only supports default temperature (1) - do not pass temperature
      // GPT-5 mini requires max_completion_tokens (not the deprecated max_tokens)
      ...(options.maxTokens ? { max_completion_tokens: options.maxTokens } : {}),
      ...(options.tools ? { tools: options.tools } : {}),
      ...(options.toolChoice ? { tool_choice: options.toolChoice } : {}),
      response_format: options.responseSchema 
        ? { type: 'json_schema', json_schema: options.responseSchema }
        : (options.jsonMode ? { type: 'json_object' } : undefined)
    } as any);

    const duration = Date.now() - startTime;
    const toolCall = res.choices?.[0]?.message?.tool_calls?.[0];
    const content = toolCall ? (toolCall as any).function.arguments : (res.choices?.[0]?.message?.content ?? '');
    console.log(`[AI Logs] Provider: Azure GPT-5 mini (fallback) | Deployment: ${deployment} | Response Time: ${duration}ms`);

    return {
      provider: 'azure',
      content,
      usage: res.usage ? {
        prompt_tokens: res.usage.prompt_tokens,
        completion_tokens: res.usage.completion_tokens,
        total_tokens: res.usage.total_tokens
      } : undefined
    };
  }
}

// Main high-level AI provider service exposing unified completions
export const aiProvider = {
  /**
   * Unified chat completion with built-in retry and fallback logic
   */
  chat: async (messages: ChatMessage[], options: ChatOptions = {}): Promise<AIResponse> => {
    let lastError: any = null;

    // Retry configuration for Groq
    const maxRetries = 1;
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        if (attempt > 0) {
          const delay = 500 + Math.random() * 500;
          console.warn(`[AI Logs] Retrying Groq request (attempt ${attempt}/${maxRetries}) after ${Math.round(delay)}ms...`);
          await new Promise(r => setTimeout(r, delay));
        }
        return await AIProviderFactory.callGroq(messages, options);
      } catch (err: any) {
        lastError = err;
        console.error(`[AI Logs] Groq execution error: ${err.message}`);

        // Check if error is NOT a candidate for fallback
        const isBadRequest = err.status === 400;
        const isUnauthorized = err.status === 401 || err.status === 403;
        const isProgrammingError = err instanceof TypeError || err instanceof ReferenceError;

        if (isBadRequest || isUnauthorized || isProgrammingError) {
          console.error(`[AI Logs] Bad request or auth error detected. Bypassing Azure fallback and throwing error.`);
          throw err;
        }
      }
    }

    // If we reach here, Groq has failed. Trigger fallback to Azure OpenAI
    console.warn(`[AI Logs] Fallback initiated to Azure OpenAI. Reason: ${lastError?.message || 'Unknown network or rate limit error'}`);
    try {
      return await AIProviderFactory.callAzure(messages, options);
    } catch (azureErr: any) {
      console.error(`[AI Logs] Azure OpenAI fallback failed: ${azureErr.message}`);
      const combinedError = new Error(
        `Groq AI rate limit reached, and Azure OpenAI fallback failed: ${azureErr.message}. (Original Groq error: ${lastError.message})`
      );
      (combinedError as any).status = lastError.status || 429;
      throw combinedError;
    }
  },

  /**
   * Simple text completion helper
   */
  askAI: async (prompt: string, options: ChatOptions = {}): Promise<AIResponse> => {
    return aiProvider.chat([{ role: 'user', content: prompt }], options);
  },

  /**
   * Abstract helpers for future high-level operations
   */
  generateSummary: async (data: any): Promise<AIResponse> => {
    const prompt = `Summarize the following project dataset:\n${JSON.stringify(data)}`;
    return aiProvider.askAI(prompt);
  },

  generateInsights: async (data: any): Promise<AIResponse> => {
    const prompt = `Provide actionable insights based on this team metric dataset:\n${JSON.stringify(data)}`;
    return aiProvider.askAI(prompt);
  }
};
