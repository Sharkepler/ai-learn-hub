/* ===== AI 辅助能力（OpenAI 兼容接口，默认 LongCat） ===== */
App.ai = (function () {
  // 默认配置：与你已接入 WorkBuddy 的 LongCat 一致
  const DEFAULTS = {
    endpoint: "https://api.longcat.chat/openai/v1/chat/completions",
    apiKey: "ak_2kH3nu92L4a77hd6On7ch1Ys6Xu29",
    model: "LongCat-2.0",
  };

  const getCfg = async () => {
    const [endpoint, apiKey, model] = await Promise.all([
      App.db.getSetting("ai.endpoint", DEFAULTS.endpoint),
      App.db.getSetting("ai.apiKey", DEFAULTS.apiKey),
      App.db.getSetting("ai.model", DEFAULTS.model),
    ]);
    return { endpoint, apiKey, model };
  };

  const saveCfg = async (cfg) => {
    await App.db.setSetting("ai.endpoint", cfg.endpoint);
    await App.db.setSetting("ai.apiKey", cfg.apiKey);
    await App.db.setSetting("ai.model", cfg.model);
  };

  const available = async () => {
    const c = await getCfg();
    return !!(c.endpoint && c.apiKey && c.model);
  };

  // 核心：发送对话消息，返回文本
  const chat = async (messages, opts = {}) => {
    const c = await getCfg();
    if (!c.endpoint || !c.apiKey || !c.model)
      throw new Error("未配置 AI 提供方，请前往「设置」填写接口地址与密钥。");

    const body = {
      model: c.model,
      messages,
      max_tokens: opts.max_tokens || 1200,
      temperature: opts.temperature ?? 0.6,
    };
    if (opts.tools) body.tools = opts.tools;

    const resp = await fetch(c.endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${c.apiKey}` },
      body: JSON.stringify(body),
    });
    if (!resp.ok) {
      const txt = await resp.text().catch(() => "");
      throw new Error(`AI 请求失败 (${resp.status}): ${txt.slice(0, 200)}`);
    }
    const data = await resp.json();
    const choice = data.choices && data.choices[0];
    if (!choice) throw new Error("AI 返回为空");
    return (choice.message && choice.message.content) || "";
  };

  // 1) 总结学习笔记
  const summarize = (note) => chat([
    { role: "system", content: "你是一个学习笔记整理助手。请用简洁的中文总结要点，使用分条列表，并提炼 3-5 个关键词。直接输出内容，不要寒暄。" },
    { role: "user", content: `请总结以下学习笔记：\n\n${note}` },
  ], { max_tokens: 800 });

  // 2) 生成知识框架
  const framework = (topic, note) => chat([
    { role: "system", content: "你是一个知识架构师。请为给定主题生成结构化的知识框架（使用 Markdown 多级列表），覆盖核心概念、关键技术与进阶方向。直接输出。" },
    { role: "user", content: `主题：${topic}\n已有笔记：\n${note || "（无）"}\n\n请生成知识框架：` },
  ], { max_tokens: 1100 });

  // 3) 推荐学习资源
  const resources = (topic) => chat([
    { role: "system", content: "你是一个 AI/技术学习顾问。请针对主题推荐学习资源，分类型（文档/课程/文章/项目/工具）给出 5-8 条，每条含名称与一句话说明。中文输出，Markdown 列表。" },
    { role: "user", content: `请为「${topic}」推荐学习资源：` },
  ], { max_tokens: 900 });

  // 4) 灵感关联分析
  const associate = (items) => chat([
    { role: "system", content: "你是一个创意关联分析师。请分析下面多条灵感之间的潜在联系、可组合的项目方向，并指出值得优先探索的主题。中文输出，Markdown 列表，简明扼要。" },
    { role: "user", content: "以下是用户的灵感碎片：\n\n" +
      items.map((t, i) => `${i + 1}. ${t}`).join("\n") },
  ], { max_tokens: 1000 });

  // 5) 通用问答（灵感/学习检索补充）
  const ask = (prompt) => chat([
    { role: "system", content: "你是用户的个人 AI 学习伙伴，帮助用户思考、归纳和发散。用简洁中文回答。" },
    { role: "user", content: prompt },
  ]);

  return { DEFAULTS, getCfg, saveCfg, available, chat, summarize, framework, resources, associate, ask };
})();
