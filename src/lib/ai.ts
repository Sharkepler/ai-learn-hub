// AI assist via LongCat (OpenAI-compatible chat completions).
const ENDPOINT = "https://api.longcat.chat/openai/v1/chat/completions";
const MODEL = "LongCat-2.0";
const API_KEY = "ak_2kH3nu92L4a77hd6On7ch1Ys6Xu29";

export interface Msg {
  role: "system" | "user" | "assistant";
  content: string;
}

export async function complete(
  messages: Msg[],
  opts: { signal?: AbortSignal } = {}
): Promise<string> {
  const res = await fetch(ENDPOINT, {
    method: "POST",
    signal: opts.signal,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${API_KEY}`,
    },
    body: JSON.stringify({
      model: MODEL,
      messages,
      temperature: 0.7,
      stream: false,
    }),
  });
  if (!res.ok) {
    const t = await res.text().catch(() => "");
    throw new Error(`AI 请求失败 ${res.status} ${t.slice(0, 80)}`);
  }
  const data = await res.json();
  return data?.choices?.[0]?.message?.content?.trim() || "";
}

const SYS =
  "你是「智学」里的 AI 学习助手，帮助用户整理灵感、提炼知识框架、推荐学习资源。回答简洁、有结构、用中文。不要使用破折号（—）。";

export function summarize(text: string) {
  return complete([
    { role: "system", content: SYS },
    {
      role: "user",
      content: `用 2-3 句话总结下面这段灵感的核心观点，并列出 3 个关键要点：\n\n${text}`,
    },
  ]);
}

export function knowledgeFrame(text: string) {
  return complete([
    { role: "system", content: SYS },
    {
      role: "user",
      content: `把下面内容整理成一个知识框架（用层级列表，最多三层），并指出它属于哪个领域：\n\n${text}`,
    },
  ]);
}

export function resources(text: string) {
  return complete([
    { role: "system", content: SYS },
    {
      role: "user",
      content: `针对下面的兴趣点，推荐 3-5 个具体的学习资源（书 / 课程 / 工具 / 社区），并说明理由：\n\n${text}`,
    },
  ]);
}

export function relate(items: { text: string; tags: string[] }[]) {
  const list = items
    .map((i, idx) => `${idx + 1}. ${i.text.slice(0, 60)} ${i.tags.map((t) => "#" + t).join(" ")}`)
    .join("\n");
  return complete([
    { role: "system", content: SYS },
    {
      role: "user",
      content: `下面是用户最近的一些灵感，找出它们之间可能的关联，给出 2-3 条联想建议：\n\n${list}`,
    },
  ]);
}
