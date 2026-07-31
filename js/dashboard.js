/* ===== 数据看板（自绘 SVG 图表） ===== */
App.modules = App.modules || {};
App.modules.dashboard = (function () {
  const { el, fmtDur } = App.util;
  let range = "week"; // week | month

  const render = async (view) => {
    const [learnings, inspirations] = await Promise.all([
      App.db.getAll("learnings"), App.db.getAll("inspirations"),
    ]);
    view.innerHTML = "";
    view.appendChild(el("h2", { class: "section" }, "📊 数据看板"));

    // 范围切换
    const seg = el("div", { class: "seg" }, [
      segBtn("周", "week"), segBtn("月", "month"),
    ]);
    view.appendChild(seg);

    // 统计卡
    const stats = computeStats(learnings, inspirations, range);
    view.appendChild(el("div", { class: "stat-grid" }, [
      stat(fmtDur(stats.totalMin), range === "week" ? "本周学习时长" : "本月学习时长"),
      stat(stats.learnCount, range === "week" ? "本周学习记录" : "本月学习记录"),
      stat(stats.inspCount, range === "week" ? "本周灵感" : "本月灵感"),
      stat(stats.activeDays + " 天", "活跃天数"),
    ]));

    // 每日学习时长柱状图
    view.appendChild(chartCard("⏱ 每日学习时长", barChart(stats.dailyMin)));
    // 灵感产出趋势
    view.appendChild(chartCard("💡 灵感产出趋势", barChart(stats.dailyInsp, "#06b6d4")));
    // 学习规律（按星期）
    view.appendChild(chartCard("🗓 学习规律（星期分布）", barChart(stats.byWeekday.map((v, i) => ({ label: ["一","二","三","四","五","六","日"][i], value: v })), "#10b981")));
    // 创造力高峰（按小时）
    view.appendChild(chartCard("🌟 创造力高峰（时段分布）", barChart(stats.byHour.map((v, i) => ({ label: i + "时", value: v })), "#f59e0b")));
  };

  const segBtn = (label, val) => {
    const b = el("button", { class: range === val ? "active" : "" }, label);
    b.onclick = () => { range = val; render(document.getElementById("view")); };
    return b;
  };
  const stat = (num, lbl) => el("div", { class: "stat" }, [
    el("div", { class: "num" }, String(num)), el("div", { class: "lbl" }, lbl),
  ]);
  const chartCard = (title, svg) => el("div", { class: "chart-wrap" }, [
    el("div", { class: "chart-title" }, title), svg,
  ]);

  // ===== 统计计算 =====
  const computeStats = (learnings, inspirations, range) => {
    const now = new Date();
    let days, startKey;
    if (range === "week") {
      const ws = App.util.weekStart(now);
      startKey = ws.toISOString().slice(0, 10);
      days = 7;
    } else {
      startKey = App.util.monthKey(now) + "-01";
      days = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    }
    const inRange = (key) => key >= startKey && key <= now.toISOString().slice(0, 10);

    const dailyMin = Array.from({ length: days }, (_, i) => {
      const d = App.util.addDays(range === "week" ? App.util.weekStart(now) : new Date(now.getFullYear(), now.getMonth(), 1), i);
      return { label: `${d.getMonth() + 1}/${d.getDate()}`, value: 0, key: d.toISOString().slice(0, 10) };
    });
    const dailyInsp = dailyMin.map((d) => ({ ...d, value: 0 }));
    const idx = (key) => dailyMin.findIndex((d) => d.key === key);

    let totalMin = 0, learnCount = 0, activeDays = new Set();
    learnings.filter((x) => inRange(x.date)).forEach((x) => {
      const i = idx(x.date);
      if (i >= 0) { dailyMin[i].value += x.duration || 0; }
      totalMin += x.duration || 0; learnCount++; activeDays.add(x.date);
    });

    const byWeekday = Array(7).fill(0);
    const byHour = Array(24).fill(0);
    let inspCount = 0;
    inspirations.forEach((x) => {
      const dt = new Date(x.createdAt);
      const key = dt.toISOString().slice(0, 10);
      if (inRange(key)) {
        const i = idx(key);
        if (i >= 0) dailyInsp[i].value += 1;
        inspCount++; byWeekday[(dt.getDay() + 6) % 7] += 1; byHour[dt.getHours()] += 1;
      }
    });

    return { totalMin, learnCount, inspCount, activeDays: activeDays.size, dailyMin, dailyInsp, byWeekday, byHour };
  };

  // ===== SVG 柱状图 =====
  const barChart = (data, color = "#4f46e5") => {
    const W = 640, H = 180, pad = 28, n = data.length;
    const max = Math.max(1, ...data.map((d) => d.value));
    const bw = (W - pad * 2) / n;
    const svg = `<svg class="chart" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg">
      ${data.map((d, i) => {
        const h = (d.value / max) * (H - pad - 16);
        const x = pad + i * bw + bw * 0.18;
        const w = bw * 0.64;
        const y = H - pad - h;
        const showLabel = n <= 14 || i % Math.ceil(n / 10) === 0;
        return `<g>
          <rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${w.toFixed(1)}" height="${Math.max(0, h).toFixed(1)}" rx="3" fill="${color}"/>
          ${d.value ? `<text x="${(x + w / 2).toFixed(1)}" y="${(y - 4).toFixed(1)}" font-size="10" fill="#6b7080" text-anchor="middle">${d.value}</text>` : ""}
          ${showLabel ? `<text x="${(x + w / 2).toFixed(1)}" y="${H - 8}" font-size="9" fill="#9aa0b0" text-anchor="middle">${escLabel(d.label)}</text>` : ""}
        </g>`;
      }).join("")}
      <line x1="${pad}" y1="${H - pad}" x2="${W - pad}" y2="${H - pad}" stroke="#e4e6ef"/>
    </svg>`;
    return strToSvg(svg);
  };

  // 简单转义标签文本（避免破坏 SVG）
  const escLabel = (s) => String(s).replace(/[<>&]/g, "");

  const strToSvg = (svgStr) => {
    const div = document.createElement("div");
    div.innerHTML = svgStr;
    return div.firstChild;
  };

  return { render };
})();
