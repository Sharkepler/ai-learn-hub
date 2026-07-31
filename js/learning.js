/* ===== 学习追踪模块 ===== */
App.modules = App.modules || {};
App.modules.learning = (function () {
  const { el, esc, toast, openModal, closeModal, today, fmtDate, fmtDur, uid } = App.util;
  const TOPICS = ["AI技术", "编程", "行业趋势", "产品设计", "其他"];

  let filterTopic = "全部";

  const render = async (view) => {
    const all = (await App.db.getAll("learnings")).filter((x) => !x.deleted);
    all.sort((a, b) => (b.date + b.createdAt).localeCompare(a.date + a.createdAt));

    view.innerHTML = "";
    view.appendChild(el("h2", { class: "section" }, "📚 学习追踪"));

    // 本周统计
    const wk = App.util.weekKey();
    const weekItems = all.filter((x) => x.date >= wk);
    const weekMin = weekItems.reduce((s, x) => s + (x.duration || 0), 0);
    const statGrid = el("div", { class: "stat-grid" }, [
      stat(weekMin, "本周学习时长"),
      stat(weekItems.length, "本周记录数"),
      stat(new Set(all.map((x) => x.date)).size, "累计学习天数"),
      stat(all.length, "总记录数"),
    ]);
    view.appendChild(statGrid);

    // 主题筛选
    const chips = el("div", { class: "tags", style: "margin:14px 0 6px" },
      ["全部", ...TOPICS].map((t) =>
        el("span", { class: "chip" + (t === filterTopic ? "" : " gray"),
          onclick: () => { filterTopic = t; render(view); } }, t)));
    view.appendChild(chips);

    // 学习路径可视化
    view.appendChild(learningPath(all));

    // 列表
    view.appendChild(el("h3", {}, "最近记录"));
    const list = filterTopic === "全部" ? all : all.filter((x) => x.topic === filterTopic);
    if (!list.length) {
      view.appendChild(el("div", { class: "empty" }, [
        el("div", { class: "big" }, "📝"), el("div", {}, "还没有学习记录，点右下角 ＋ 开始记录吧"),
      ]));
      return;
    }
    list.forEach((item) => view.appendChild(itemCard(item, view)));
  };

  const stat = (num, lbl) => el("div", { class: "stat" }, [
    el("div", { class: "num" }, String(num)),
    el("div", { class: "lbl" }, lbl),
  ]);

  // 学习路径：按主题聚合进度
  const learningPath = (all) => {
    const wrap = el("div", { class: "card" });
    wrap.appendChild(el("div", { class: "row between" }, [
      el("strong", {}, "🧭 学习路径"),
      el("span", { class: "muted tiny" }, "按主题聚合进度"),
    ]));
    const byTopic = {};
    TOPICS.forEach((t) => (byTopic[t] = []));
    all.forEach((x) => { (byTopic[x.topic] = byTopic[x.topic] || []).push(x); });
    TOPICS.forEach((t) => {
      const items = byTopic[t] || [];
      const avg = items.length ? Math.round(items.reduce((s, x) => s + (x.progress || 0), 0) / items.length) : 0;
      const row = el("div", { style: "margin-top:10px" }, [
        el("div", { class: "row between" }, [
          el("span", {}, `${t} · ${items.length} 项`),
          el("span", { class: "muted tiny" }, `${avg}%`),
        ]),
        el("div", { class: "progress" }, el("span", { style: `width:${avg}%` })),
      ]);
      wrap.appendChild(row);
    });
    return wrap;
  };

  const itemCard = (item, view) => {
    const card = el("div", { class: "item" });
    card.appendChild(el("div", { class: "row between" }, [
      el("div", { class: "title" }, item.title),
      el("span", { class: "chip" }, item.topic),
    ]));
    card.appendChild(el("div", { class: "meta" }, [
      el("span", { class: "muted tiny" }, fmtDate(item.date)),
      el("span", { class: "muted tiny" }, "⏱ " + fmtDur(item.duration)),
      item.progress ? el("span", { class: "muted tiny" }, "进度 " + item.progress + "%") : null,
    ]));
    if (item.content) card.appendChild(el("div", { class: "body" }, item.content.length > 160 ? item.content.slice(0, 160) + "…" : item.content));
    const actions = el("div", { class: "actions" });
    const bSum = el("button", { class: "text-btn" }, "✨ AI 总结");
    bSum.onclick = () => aiSummary(item);
    const bEdit = el("button", { class: "text-btn" }, "编辑");
    bEdit.onclick = () => openForm(item, view);
    const bDel = el("button", { class: "text-btn", style: "color:var(--danger)" }, "删除");
    bDel.onclick = async () => { await App.db.markDeleted("learnings", item.id); toast("已删除"); render(view); };
    actions.append(bSum, bEdit, bDel);
    card.appendChild(actions);
    return card;
  };

  const aiSummary = async (item) => {
    if (!(await App.ai.available())) return App.app.openSettings();
    const box = el("div", { class: "ai-box" }, [el("span", { class: "ai-loading" }, [el("i"), el("i"), el("i")])]);
    openModal(el("div", {}, [el("h3", {}, "✨ AI 总结：" + item.title), box]));
    try {
      const text = await App.ai.summarize(`主题：${item.topic}\n${item.content || item.title}`);
      box.textContent = text;
    } catch (e) { box.textContent = "⚠️ " + e.message; }
  };

  // 新建 / 编辑表单
  const openForm = (item, view) => {
    const isEdit = !!item;
    const f = el("div", {});
    f.appendChild(el("h3", {}, isEdit ? "编辑学习记录" : "新建学习记录"));

    const dateI = el("input", { class: "input", type: "date", value: (item && item.date) || today() });
    const topicI = el("select", { class: "input" },
      TOPICS.map((t) => el("option", { value: t, selected: item && item.topic === t ? "selected" : null }, t)));
    const titleI = el("input", { class: "input", placeholder: "学习内容标题，如：Transformer 注意力机制", value: item ? item.title : "" });
    const durI = el("input", { class: "input", type: "number", min: "0", placeholder: "学习时长（分钟）", value: item ? item.duration : "" });
    const progI = el("input", { class: "input", type: "range", min: "0", max: "100", step: "5", value: item ? item.progress : 0 });
    const progLabel = el("span", { class: "muted tiny" }, (item ? item.progress : 0) + "%");
    progI.oninput = () => (progLabel.textContent = progI.value + "%");
    const contentI = el("textarea", { class: "textarea", placeholder: "笔记 / 心得（支持 #标签）" }, item ? item.content : "");

    f.appendChild(field("日期", dateI));
    f.appendChild(field("主题分类", topicI));
    f.appendChild(field("标题", titleI));
    f.appendChild(field("学习时长（分钟）", durI));
    f.appendChild(field("完成进度", el("div", { class: "row" }, [progI, progLabel])));
    f.appendChild(field("笔记内容", contentI));

    const save = el("button", { class: "btn block" }, isEdit ? "保存修改" : "添加记录");
    save.onclick = async () => {
      const title = titleI.value.trim();
      if (!title) return toast("请填写标题");
      const rec = {
        id: item ? item.id : uid(),
        date: dateI.value || today(),
        topic: topicI.value,
        title,
        duration: Number(durI.value) || 0,
        progress: Number(progI.value) || 0,
        content: contentI.value.trim(),
        tags: App.util.extractTags(contentI.value),
        createdAt: item ? item.createdAt : Date.now(),
      };
      await App.db.put("learnings", rec);
      closeModal(); toast("已保存");
      if (view) render(view);
    };
    f.appendChild(save);
    openModal(f);
  };

  const field = (label, node) => el("div", { class: "field" }, [el("label", {}, label), node]);

  return { render, openForm };
})();
