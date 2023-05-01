export type ChatGPTAgent = 'user' | 'system' | 'assistant'

export interface ChatGPTMessage {
  role: ChatGPTAgent
  content: string
}

export interface OpenAIStreamPayload {
  model: string
  messages: ChatGPTMessage[]
  temperature: number
  top_p: number
  frequency_penalty: number
  presence_penalty: number
  max_tokens: number
  stream: boolean
  stop?: string[]
  user?: string
  n: number
}

export async function OpenAIEmbeddings(text: string) {
  const requestHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${process.env.OPENAI_API_KEY ?? ''}`,
  }

  if (process.env.OPENAI_API_ORG) {
    requestHeaders['OpenAI-Organization'] = process.env.OPENAI_API_ORG
  }

  const res = await fetch('https://api.openai.com/v1/embeddings', {
    headers: requestHeaders,
    method: 'POST',
    body: JSON.stringify({
      input: text,
      model: 'text-embedding-ada-002'
    }),
  })

  const data = await res.json();

  return data.data[0].embedding;
}
