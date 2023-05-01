import { type ChatGPTMessage } from '../../components/ChatLine'
import { OpenAIEmbeddings } from '../../utils/OpenAIEmbeddings';
import { OpenAIStream, OpenAIStreamPayload } from '../../utils/OpenAIStream'
// import { PineconeClient, QueryRequest } from "@cm-igarashi-ryosuke/pinecone";
import { PineconeClient } from '../../utils/PineconeClient';

// break the app if the API key is missing
if (!process.env.OPENAI_API_KEY) {
  throw new Error('Missing Environment Variable OPENAI_API_KEY')
}

// Edge Runtime
export const config = {
  runtime: 'edge',
}

const handler = async (req: Request): Promise<Response> => {
  const body = await req.json();
  const messages = body.messages as ChatGPTMessage[];

  // messagesの最後の要素を取得する
  const lastMessage = messages.pop();

  // console.log({ lastMessage });

  // リクエストパラメーターのバリデーション
  if (!lastMessage) {
    return new Response('No messages', { status: 400 })
  }

  if (lastMessage.content.length <= 0 || lastMessage.content.length >= 100) {
    return new Response('The length of the last message must be between 0 and 100', { status: 400 })
  }

  if (lastMessage.role !== 'user') {
    return new Response('The last message must be from the user', { status: 400 })
  }

  // Pineconeの初期化
  const pinecone = new PineconeClient();
  await pinecone.init();

  // rateLimitのチェック（本当はPineconeでやるべきことではない）
  // const rateCount = await pinecone.fetchRateCount();

  // console.log({ rateCount });

  // if (rateCount > 100) {
  //   return new Response('Rate limit exceeded', { status: 429 })
  // }

  // await pinecone.upsertRateCount(rateCount + 1);

  const question = lastMessage.content;

  // lastMessageのcontextをtokenizeする
  const queryEmbed = await OpenAIEmbeddings(question);
  const data = await pinecone.query({
    topK: 5,
    vector: queryEmbed,
    includeMetadata: true,
    includeValues: false,
  });

  // console.log(data.matches);

  const sentences = data.matches?.map((match: any) => {
    const meta = match.metadata;
    return `text: ${meta.sentence}
    title: ${meta.title}
    url: ${meta.url}`
  });

  // console.log(sentences);

  const userMessage: ChatGPTMessage = {
    role: 'user',
    content: `
    ### 指示 ###
    以下のコンテキストと会話履歴を元に回答してください。
    質問に関連する内容がコンテキストに含まれない場合は「その質問に関連する情報は提供されていません。」とだけ回答してください。
    回答セクションのフォーマットに従って回答してください。
    回答セクションの{title}と{url}にはコンテキストに含まれるtitleとurlを変更せずに出力してください。

    ### コンテキスト ###
    ${sentences?.join('\n')}
    
    ### 質問 ###
    ${question}

    ### 回答フォーマット ###
    {Answer}
    【{title}】
    {url}
    `
  };

  // console.log(userMessage);

  messages.push(userMessage);

  messages.unshift({
    role: 'user',
    content: '記事とスクラップの使い分けについて教えて下さい'
  })

  messages.unshift({
    role: 'assistant',
    content: `記事は、学んだことをまとめたものや、自分が発信したい情報をまとめたものを公開するためのものです。一方、スクラップは、今まさに取り組んでいる物事や、まだ解決方法が分かっていない問題、学習ログなど、気軽に残していくのに最適です。また、スクラップはスレッド形式で情報をまとめることができ、他のユーザーとの情報共有や意見交換にも利用できます。記事とスクラップは、それぞれの目的に合わせて使い分けることが大切です。詳しくは以下の記事をご覧ください。

    【Zennのスクラップ（Scraps）の使い方】
    https://zenn.dev/zenn/articles/about-zenn-scraps`
  })

  const systemMessage: ChatGPTMessage =
  {
    role: 'system',
    content: `あなたはZennの使い方を学習したカスタマーサポートAIです。
    回答は簡潔に分かりやすく答えてください。
    回答は日本語で行います。
    `,
  };

  messages.unshift(systemMessage);

  const payload: OpenAIStreamPayload = {
    model: 'gpt-3.5-turbo',
    messages: messages,
    temperature: process.env.AI_TEMP ? parseFloat(process.env.AI_TEMP) : 0.7,
    max_tokens: process.env.AI_MAX_TOKENS
      ? parseInt(process.env.AI_MAX_TOKENS)
      : 100,
    top_p: 1.0,
    frequency_penalty: 0,
    presence_penalty: 0,
    stream: true,
    user: body?.user,
    n: 1,
  }

  const stream = await OpenAIStream(payload)
  return new Response(stream)
}

export default handler

