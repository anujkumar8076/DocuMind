import { ChatGroq } from '@langchain/groq';
import { ChatOpenAI } from '@langchain/openai';
import { BaseChatModel } from '@langchain/core/language_models/chat_models';

/**
 * Factory providing high-speed Groq LLM (Llama 3.3 70B) or OpenAI GPT-4o
 */
export function getChatModel(options?: {
  streaming?: boolean;
  temperature?: number;
  fastModel?: boolean;
}): BaseChatModel {
  const temperature = options?.temperature ?? 0.1;
  const streaming = options?.streaming ?? false;

  // 1. Prefer Groq if GROQ_API_KEY is available (500 tokens/sec, free tier)
  if (process.env.GROQ_API_KEY) {
    const modelName = options?.fastModel
      ? 'llama-3.1-8b-instant'
      : (process.env.GROQ_MODEL || 'llama-3.3-70b-versatile');

    return new ChatGroq({
      apiKey: process.env.GROQ_API_KEY,
      model: modelName,
      temperature,
      streaming,
    });
  }

  // 2. Fallback to OpenAI
  const modelName = options?.fastModel
    ? 'gpt-4o-mini'
    : (process.env.OPENAI_CHAT_MODEL || 'gpt-4o');

  return new ChatOpenAI({
    apiKey: process.env.OPENAI_API_KEY || '',
    modelName,
    temperature,
    streaming,
  });
}
