/* ===== 设置 + 云端同步桥接 + AI 工具箱 ===== */
App.modules = App.modules || {};
App.modules.settings = (function () {
  const { el, toast, openModal, closeModal } = App.util;

  const render = async (view) => {
    view.innerHTML = "";
    view.appendChild(el("h2", { class: "section" }, "⚙️ 设置"));

    // AI 提供方
    const cfg = await App.ai.getCfg();
    const cardAI = el("div", { class: "card" });
    cardAI.appendChild(el("strong", {}, "🤖 AI 提供方（OpenAI 兼容）"));
    cardAI.appendChild(el("div", { class: "muted tiny", style: "margin:4px 0 10px" }, "默认已接入你配置好的 LongCat 接口，可改为任意 OpenAI 兼容端点。"));
    const ep = el("input", { class: "input", value: cfg.endpoint, placeholder: "https://.../chat/completions" });
    const key = el("input", { class: "input", type: "password", value: cfg.apiKey, placeholder: "API Key" });
    const model = el("input", { class: "input", value: cfg.model, placeholder: "模型名，如 LongCat-2.0" });
    cardAI.append(
      field("接口地址（完整 /chat/completions 路径）", ep),
      field("API Key", key),
      field("模型名称", model),
    );
    const saveAI = el("button", { class: "btn", style: "margin-right:8px" }, "保存配置");
    saveAI.onclick = async () => {
      await App.ai.saveCfg({ endpoint: ep.value.trim(), apiKey: key.value.trim(), model: model.value.trim() });
      toast("AI 配置已保存");
    };
    const testAI = el("button", { class: "btn ghost" }, "测试连接");
    testAI.onclick = async () => {
      testAI.disabled = true; testAI.textContent = "测试中…";
      try {
        const r = await App.ai.chat([{ role: "user", content: "ping" }], { max_tokens: 10 });
        toast("连接成功 ✅");
      } catch (e) { toast("失败：" + e.message.slice(0, 40)); }
      testAI.disabled = false; testAI.textContent = "测试连接";
    };
    cardAI.appendChild(el("div", { class: "row" }, [saveAI, testAI]));
    view.appendChild(cardAI);

    // AI 工具箱
    const toolCard = el("div", { class: "card" });
    toolCard.appendChild(el("strong", {}, "🧰 AI 工具箱"));
    const topicI = el("input", { class: "input", placeholder: "输入一个主题，如：大模型微调" });
    toolCard.appendChild(field("主题", topicI));
    const bFrame = el("button", { class: "btn ghost", style: "margin-right:8px;margin-bottom:8px" }, "📐 生成知识框架");
    bFrame.onclick = () => runAI("framework", topicI.value);
    const bRes = el("button", { class: "btn ghost", style: "margin-bottom:8px" }, "🔗 推荐学习资源");
    bRes.onclick = () => runAI("resources", topicI.value);
    toolCard.append(el("div", { class: "row" }, [bFrame, bRes]));
    view.appendChild(toolCard);

    // 数据管理（本地存储 + 云端同步桥接）
    const dataCard = el("div", { class: "card" });
    dataCard.appendChild(el("strong", {}, "💾 数据管理"));
    dataCard.appendChild(el("div", { class: "muted tiny", style: "margin:4px 0 10px" },
      "数据保存在本机（IndexedDB）。导出为文件即可备份或迁移到其它设备，导入即可恢复——这是本应用的云端同步桥接方案。"));
    const bExp = el("button", { class: "btn ghost", style: "margin-right:8px" }, "⬇ 导出备份");
    bExp.onclick = doExport;
    const fileI = el("input", { type: "file", accept: ".json", style: "display:none" });
    fileI.onchange = () => doImport(fileI.files[0]);
    const bImp = el("button", { class: "btn ghost", style: "margin-right:8px" }, "⬆ 导入恢复");
    bImp.onclick = () => fileI.click();
    const bClear = el("button", { class: "btn danger" }, "清空全部");
    bClear.onclick = async () => {
      if (!confirm("确定清空所有学习与灵感数据？此操作不可恢复。")) return;
      await Promise.all([App.db.clear("learnings"), App.db.clear("inspirations")]);
      toast("已清空"); App.app.show("learning");
    };
    dataCard.append(el("div", { class: "row", style: "flex-wrap:wrap;gap:8px" }, [bExp, bImp, bClear]), fileI);
    view.appendChild(dataCard);

    // 云同步
    await renderSyncCard(view);

    // 访问密码（仅本人可打开）
    await renderLockCard(view);

    // 关于
    const about = el("div", { class: "card muted tiny" }, [
      el("strong", {}, "关于 · 智学"), el("br"),
      "个人 AI 学习与灵感管理工具。本地优先，AI 可选。\n",
      "支持学习追踪、灵感记录（文字/语音/图片）、AI 总结与关联、周月数据看板。",
    ]);
    view.appendChild(about);
  };

  // 云同步配置
  const renderSyncCard = async (view) => {
    const s = await App.sync.getState();
    const last = await App.sync.getLastSync();
    const card = el("div", { class: "card" });
    card.appendChild(el("strong", {}, "☁️ 云同步（跨设备）"));
    card.appendChild(el("div", { class: "muted tiny", style: "margin:4px 0 10px" },
      "数据存于你的私有 GitHub 仓库，手机记录、电脑整理，自动互通。需一个具备 repo 权限的 GitHub Token（建议用「细粒度 Token」仅授权 ai-learn-hub-data 仓库，更安全）。"));

    const enChk = el("input", { type: "checkbox", checked: s.enabled ? "checked" : null });
    const autoChk = el("input", { type: "checkbox", checked: s.auto ? "checked" : null });
    const tokenI = el("input", { class: "input", type: "password", value: s.token || "", placeholder: "ghp_... 或 github_pat_..." });
    const repoI = el("input", { class: "input", value: s.repo || "Sharkepler/ai-learn-hub-data", placeholder: "owner/repo" });
    const branchI = el("input", { class: "input", value: s.branch || "main", placeholder: "main" });
    const statusLine = el("div", { class: "muted tiny", id: "syncStatusLine" },
      last ? "上次同步：" + App.util.fmtDateTime(last) : "尚未同步");

    const save = el("button", { class: "btn", style: "margin-right:8px" }, "保存并启用");
    save.onclick = async () => {
      await App.sync.saveCfg({
        enabled: enChk.checked, token: tokenI.value.trim(),
        repo: repoI.value.trim() || "Sharkepler/ai-learn-hub-data",
        branch: branchI.value.trim() || "main", auto: autoChk.checked,
      });
      toast("云同步配置已保存");
      const r = await App.sync.syncNow({ refresh: true });
      if (r && r.ok) { toast("已同步 ✅"); statusLine.textContent = "上次同步：" + App.util.fmtDateTime(Date.now()); }
      else if (r && r.skipped) toast("未配置或未完成");
      else if (r && !r.ok) toast("首次同步失败：" + (r.error || "").slice(0, 40));
      App.app.show("settings");
    };
    const now = el("button", { class: "btn ghost" }, "立即同步");
    now.onclick = async () => {
      now.disabled = true; now.textContent = "同步中…";
      const r = await App.sync.syncNow({ refresh: true });
      now.disabled = false; now.textContent = "立即同步";
      if (r && r.ok) { toast("已同步 ✅"); statusLine.textContent = "上次同步：" + App.util.fmtDateTime(Date.now()); }
      else if (r && r.skipped) toast("请先保存配置");
      else if (r && !r.ok) toast("同步失败：" + (r.error || "").slice(0, 40));
    };

    card.append(
      el("label", { class: "row", style: "gap:8px;margin-bottom:8px" }, [enChk, el("span", {}, "启用云同步")]),
      field("GitHub Token（仅存本机）", tokenI),
      field("数据仓库（私有）", repoI),
      field("分支", branchI),
      el("label", { class: "row", style: "gap:8px;margin:8px 0" }, [autoChk, el("span", {}, "自动同步（本地改动后自动上传）")]),
      el("div", { class: "row", style: "flex-wrap:wrap;gap:8px" }, [save, now]),
      statusLine,
    );
    view.appendChild(card);
  };

  // 访问密码
  const renderLockCard = async (view) => {
    const card = el("div", { class: "card" });
    card.appendChild(el("strong", {}, "🔒 访问密码"));
    const set = await App.lock.isSet();
    if (!set) {
      card.appendChild(el("div", { class: "muted tiny", style: "margin:4px 0 10px" },
        "设置一个密码，之后打开本网页需输入密码才能查看和编辑。密码仅保存在本机，不会上传。"));
      const newPin = el("input", { class: "input", type: "password", maxlength: "16", placeholder: "设置访问密码（至少 4 位）" });
      const setBtn = el("button", { class: "btn", style: "margin-top:6px" }, "启用访问密码");
      setBtn.onclick = async () => {
        const v = newPin.value.trim();
        if (v.length < 4) return toast("密码至少 4 位");
        await App.lock.set(v);
        toast("已启用访问密码 🔒");
        App.app.show("settings");
      };
      card.append(field("新密码", newPin), el("div", { class: "row" }, [setBtn]));
    } else {
      card.appendChild(el("div", { class: "muted tiny", style: "margin:4px 0 10px" },
        "访问密码已启用，打开网页需输入密码。可在此修改、关闭或立即锁定。"));
      const oldPin = el("input", { class: "input", type: "password", placeholder: "当前密码" });
      const newPin = el("input", { class: "input", type: "password", placeholder: "新密码（留空则不修改）" });
      const changeBtn = el("button", { class: "btn", style: "margin-right:8px" }, "修改密码");
      changeBtn.onclick = async () => {
        if (!(await App.lock.verify(oldPin.value))) return toast("当前密码错误");
        const v = newPin.value.trim();
        if (v && v.length < 4) return toast("新密码至少 4 位");
        if (v) await App.lock.set(v);
        toast("已更新 ✅"); App.app.show("settings");
      };
      const offBtn = el("button", { class: "btn danger", style: "margin-right:8px" }, "关闭访问密码");
      offBtn.onclick = async () => {
        if (!(await App.lock.verify(oldPin.value))) return toast("当前密码错误");
        if (!confirm("关闭后任何拿到链接的人都能打开并查看/编辑，确认关闭？")) return;
        await App.lock.remove();
        toast("已关闭访问密码"); App.app.show("settings");
      };
      const lockBtn = el("button", { class: "btn ghost" }, "立即锁定");
      lockBtn.onclick = () => App.app.lockNow();
      card.append(
        field("当前密码", oldPin),
        field("新密码（可选）", newPin),
        el("div", { class: "row", style: "flex-wrap:wrap;gap:8px" }, [changeBtn, offBtn, lockBtn]),
      );
    }
    view.appendChild(card);
  };

  const field = (label, node) => el("div", { class: "field" }, [el("label", {}, label), node]);

  const runAI = async (type, topic) => {
    if (!(await App.ai.available())) return App.app.openSettings();
    if (!topic || !topic.trim()) return toast("请先输入主题");
    const box = el("div", { class: "ai-box" }, [el("span", { class: "ai-loading" }, [el("i"), el("i"), el("i")])]);
    openModal(el("div", {}, [el("h3", {}, type === "framework" ? "📐 知识框架：" + topic : "🔗 学习资源：" + topic), box]));
    try {
      const out = type === "framework" ? await App.ai.framework(topic) : await App.ai.resources(topic);
      box.textContent = out;
    } catch (e) { box.textContent = "⚠️ " + e.message; }
  };

  const doExport = async () => {
    const json = await App.db.exportAll();
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = el("a", { href: url, download: `智学备份_${App.util.today()}.json` });
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
    toast("已导出备份文件");
  };

  const doImport = async (file) => {
    if (!file) return;
    try {
      const text = await file.text();
      await App.db.importAll(text);
      toast("导入成功，正在刷新…");
      App.app.show("learning");
    } catch (e) { toast("导入失败：" + e.message.slice(0, 40)); }
  };

  return { render };
})();
