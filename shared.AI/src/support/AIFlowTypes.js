// @flow

/*
 * TYPES
 */

// export type DallERequestOptions = { prompt?: string, n?: number, size?: string, response_format?: string, user?: string }
export type CompletionsRequest = { model: string, prompt?: string, max_tokens?: number, user?: string, suffix?: string, temperature?: string, top_p?: string, n?: number }
export type ResearchListResult = { initialQuery: string, currentQuery: string, selection?: string, options?: [string] }

export type JSONClickData = { unclickedLinks: Array<string>, clickedLinks: Array<string>, initialSubject: string, remixes: Array<string>, totalTokensUsed: number }

export type ChatResponse = {
  id: string,
  object: string,
  created: number,
  model: string,
  usage: {
    prompt_tokens: number,
    completion_tokens: number,
    total_tokens: number,
  },
  choices: Array<{
    message: {
      role: string,
      content: string,
    },
    finish_reason: string,
    index: number,
  }>,
}

// https://platform.openai.com/docs/api-reference/completions
export type ChatRequest = {
  model: string /* currently only gpt-3.5-turbo is supported */,
  messages: Array<{
    role: 'system' | 'user' | 'assistant',
    content: string,
  }>,
  suffix?: string,
  temperature?: number,
  max_tokens?: number,
  top_p?: number,
  presence_penalty?: number,
  frequency_penalty?: number,
  best_of?: number,
  n?: number,
  stream?: boolean,
  logprobs?: number,
  echo?: boolean,
}
