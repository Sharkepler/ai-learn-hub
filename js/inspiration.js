/* ===== 灵感记录模块 ===== */
App.modules = App.modules || {};
App.modules.inspiration = (function () {
  const { el, esc, toast, openModal, closeModal, fmtDateTime, uid } = App.util;

  let filterTag = "全部";
  let allItems = [];

  const render = async (view) => {
    allItems = (await App.db.getAll("inspirations")).filter((x) => !x.deleted);
    allItems.sort((a, b) => b.createdAt - a.createdAt);

    view.innerHTML = "";
    view.appendChild(el("h2", { class: "section" }, "💡 灵感记录"));

    // 快速捕捉
    view.appendChild(quickCapture(view));

    // 标签筛选
    const tags = ["全部", ...new Set(allItems.flatMap((x) => x.tags || []))].filter(Boolean);
    view.appendChild(el("div", { class: "tags", style: "margin:6px 0 6px" },
      tags.map((t) => el("span", {
        class: "chip" + (t === filterTag ? "" : " gray"),
        onclick: () => { filterTag = t; render(view); },
      }, t === "全部" ? "全部" : "#" + t))));

    // AI 关联分析（全部灵感）
    if (allItems.length >= 2) {
      const b = el("button", { class: "btn ghost block", style: "margin-bottom:10px" }, "🧩 AI 关联分析（全部灵感）");
      b.onclick = aiAssociate;
      view.appendChild(b);
    }

    view.appendChild(el("h3", {}, "灵感墙"));
    const list = filterTag === "全部" ? allItems : allItems.filter((x) => (x.tags || []).includes(filterTag));
    if (!list.length) {
      view.appendChild(el("div", { class: "empty" }, [
        el("div", { class: "big" }, "✨"), el("div", {}, "还没有灵感，上方输入框随手记一条"),
      ]));
      return;
    }
    list.forEach((it) => view.appendChild(itemCard(it, view)));
  };

  // 快速捕捉条
  const quickCapture = (view) => {
    const wrap = el("div", { class: "card" });
    const ta = el("textarea", { class: "textarea", placeholder: "随时记录一个想法…（用 #标签 自动归类）", style: "border:none;padding:0;min-height:64px" });
    const imgs = [];
    const thumbs = el("div", { class: "thumbs" });
    const fileInput = el("input", { type: "file", accept: "image/*", multiple: "multiple", style: "display:none" });
    fileInput.onchange = async () => {
      for (const f of fileInput.files) {
        const blob = f; // File 即 Blob
        imgs.push({ name: f.name, type: f.type, blob });
      }
      renderThumbs();
    };
    const renderThumbs = () => {
      thumbs.innerHTML = "";
      imgs.forEach((im, i) => {
        const url = URL.createObjectURL(im.blob);
        const img = el("img", { src: url, alt: im.name });
        thumbs.appendChild(img);
      });
      if (imgs.length < 6) {
        const add = el("div", { class: "add", onclick: () => fileInput.click() }, "＋");
        thumbs.appendChild(add);
      }
    };
    renderThumbs();

    // 语音转文字
    const recBtn = el("button", { class: "icon-btn", title: "语音输入", style: "font-size:15px" }, "🎤");
    let recognizing = false, recog = null;
    recBtn.onclick = () => {
      if (!("webkitSpeechRecognition" in window) && !("SpeechRecognition" in window)) {
        return toast("当前浏览器不支持语音输入，请用 Chrome/Edge");
      }
      const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (recognizing) { recog.stop(); return; }
      recog = new SR();
      recog.lang = "zh-CN"; recog.interimResults = true; recog.continuous = false;
      recog.onresult = (e) => {
        let txt = ""; for (let i = 0; i < e.results.length; i++) txt += e.results[i][0].transcript;
        ta.value = (ta.value ? ta.value + " " : "") + txt;
      };
      recog.onend = () => { recognizing = false; recBtn.innerHTML = "🎤"; recBtn.style.background = ""; };
      recog.onerror = () => { recognizing = false; recBtn.innerHTML = "🎤"; toast("语音识别结束"); };
      recog.start(); recognizing = true;
      recBtn.innerHTML = "<span class='rec-dot'></span>"; recBtn.style.background = "#ffe1e1";
    };

    const save = el("button", { class: "btn", style: "padding:7px 14px;font-size:13px" }, "保存灵感");
    save.onclick = async () => {
      const text = ta.value.trim();
      if (!text && !imgs.length) return toast("写点什么或加张图吧");
      const rec = {
        id: uid(), createdAt: Date.now(),
        text, tags: App.util.extractTags(text),
        images: imgs,
      };
      await App.db.put("inspirations", rec);
      toast("灵感已保存 ✨"); render(view);
    };

    wrap.append(
      ta,
      thumbs,
      el("div", { class: "row between", style: "margin-top:8px" }, [
        el("div", { class: "row" }, [recBtn]),
        save,
      ])
    );
    return wrap;
  };

  const itemCard = (it, view) => {
    const card = el("div", { class: "item" });
    card.appendChild(el("div", { class: "meta" }, [el("span", { class: "muted tiny" }, fmtDateTime(it.createdAt))]));
    if (it.text) card.appendChild(el("div", { class: "body" }, it.text));
    if (it.images && it.images.length) {
      const th = el("div", { class: "thumbs" });
      it.images.forEach((im) => {
        const url = URL.createObjectURL(im.blob);
        const img = el("img", { src: url, alt: im.name, onclick: () => openImage(url) });
        th.appendChild(img);
      });
      card.appendChild(th);
    }
    if (it.tags && it.tags.length) {
      card.appendChild(el("div", { class: "tags", style: "margin-top:8px" },
        it.tags.map((t) => el("span", { class: "chip gray" }, "#" + t))));
    }
    const actions = el("div", { class: "actions" });
    const bEdit = el("button", { class: "text-btn" }, "编辑");
    bEdit.onclick = () => openForm(it, view);
    const bDel = el("button", { class: "text-btn", style: "color:var(--danger)" }, "删除");
    bDel.onclick = async () => { await App.db.markDeleted("inspirations", it.id); toast("已删除"); render(view); };
    actions.append(bEdit, bDel);
    card.appendChild(actions);
    return card;
  };

  const openImage = (url) => {
    const img = el("img", { src: url, style: "width:100%;border-radius:12px" });
    openModal(img);
  };

  const openForm = (it, view) => {
    const ta = el("textarea", { class: "textarea" }, it.text);
    const f = el("div", {}, [el("h3", {}, "编辑灵感"), field("内容", ta)]);
    const save = el("button", { class: "btn block" }, "保存");
    save.onclick = async () => {
      it.text = ta.value.trim(); it.tags = App.util.extractTags(it.text);
      await App.db.put("inspirations", it); closeModal(); toast("已保存"); render(view);
    };
    f.appendChild(save);
    openModal(f);
  };

  const aiAssociate = async () => {
    if (!(await App.ai.available())) return App.app.openSettings();
    const texts = allItems.map((x) => x.text || (x.images ? "[图片灵感]" : "")).filter(Boolean);
    const box = el("div", { class: "ai-box" }, [el("span", { class: "ai-loading" }, [el("i"), el("i"), el("i")])]);
    openModal(el("div", {}, [el("h3", {}, "🧩 AI 灵感关联分析"), box]));
    try {
      const out = await App.ai.associate(texts.slice(0, 30));
      box.textContent = out;
    } catch (e) { box.textContent = "⚠️ " + e.message; }
  };

  const field = (label, node) => el("div", { class: "field" }, [el("label", {}, label), node]);

  return { render };
})();
