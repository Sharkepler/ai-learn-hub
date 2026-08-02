# 智学 (ai-learn-hub) 代码与架构审查报告

> 审查时间：2026-08-02 ｜ 审查范围：全部 27 个源文件 + 构建/部署配置
> 技术栈：React 18 + TypeScript + Vite 6 + Tailwind v4 + Motion + Phosphor Icons
> 架构：纯前端 SPA，数据 = IndexedDB（本地）+ GitHub 私有仓库文件（云端同步，无后端）

---

## 0. 项目概览

**存储模型**：本地用 IndexedDB（`db.ts`，双 store：`items`/`meta`）；云端把数据按「天」切分为 `data/YYYY-MM-DD.json`，经 GitHub Contents API 读写（`sync.ts`）。无传统数据库、无后端服务器。

**关键模块**：

| 模块 | 文件 | 职责 |
|------|------|------|
| 状态层 | `state/store.tsx` | 内存 items、增删改（写本地后推云端） |
| 同步层 | `lib/sync.ts` | pushDay/pullAll/syncNow，LWW 合并，冲突重试 |
| 加密层 | `lib/crypto.ts`、`lib/auth.ts` | AES-GCM 加密会话 Token 落盘 |
| AI 层 | `lib/ai.ts` | 调用 LongCat 聊天接口（三合一） |
| 渲染层 | `lib/markdown.ts` | 自写安全 Markdown 子集渲染 |
| UI 层 | `components/ui.tsx` | Card/Button/Modal/MarkdownEditor/AiPanel 等 |
| 视图 | `views/*.tsx` | 灵感、学习、看板、设置 |

**值得肯定的设计**（先夸为敬）：
- AES-GCM 加密会话 Token、旧明文 Token 清理迁移 —— 静态加密做得到位。
- 软删除（`deleted` 标记 + 视图过滤）+ 二次确认弹框 —— 防误删且可恢复。
- 同步用 `updatedAt` 的 Last-Write-Wins 合并 + SHA 乐观锁冲突重试（最多 5 次）—— 多设备冲突处理合理。
- AI 请求支持 `AbortController` 取消 + loading 态 —— 体验考虑周全。
- 分页（列表 12 / 搜索 20）+ 多关键词高亮 —— 缩放性与 UX 兼顾。
- 类型筛选、搜索、AI 面板拆分清晰。

---

## 1. 优化项清单（按类别分组）

> **优先级图例**：`P0` 高危/须立即处理 ｜ `P1` 高（数据风险或核心缺口） ｜ `P2` 中（可维护性/性能） ｜ `P3` 低（锦上添花）

### 🔴 安全性（Security）
| 编号 | 问题 | 优先级 |
|------|------|--------|
| S1 | **AI API Key 硬编码在源码并已进入 git 历史 + 前端 bundle** | P0 |
| S2 | 密钥无「用户自配 / 可轮换」机制，密钥泄露即全局失效 | P1 |
| S3 | 无 Content-Security-Policy；`dangerouslySetInnerHTML` 依赖自写转义，脆弱 | P2 |
| S4 | 允许的登录账号 `ALLOWED_LOGINS` 硬编码；repo 等常量散落 | P3 |

### 🟠 性能（Performance）
| 编号 | 问题 | 优先级 |
|------|------|--------|
| P1 | **图片 base64 写进每日 JSON，多图易爆 GitHub 1MB/文件上限 → 同步静默失败** | P1 |
| P2 | 字体双重加载：CDN(Noto SC) + @fontsource(Geist/Newsreader)，render-blocking | P2 |
| P3 | `renderMarkdown` 每次渲染重算 + `dangerouslySetInnerHTML` 未 memo | P2 |
| P4 | 列表 `filter/sort/slice` 每渲染重算，无 `useMemo` | P3 |
| P5 | 主题 class 在 `useEffect` 后才应用 → 首屏闪烁(FOUC) | P3 |

### 🟡 可读性 / 可维护性（Maintainability）
| 编号 | 问题 | 优先级 |
|------|------|--------|
| M1 | **死代码**：`schedulePush` / `relate` / `getItem` / `withDay` / `mediaType:"voice"` | P2 |
| M2 | `tsconfig` 关闭 `noUnusedLocals/Parameters`；无 ESLint/Prettier | P2 |
| M3 | 缺少 `ErrorBoundary`，任一渲染异常即整页白屏 | P2 |
| M4 | `Inspiration.tsx` 单文件 638 行，职责偏重，可拆 hooks | P3 |

### 🟢 依赖管理（Dependencies）
| 编号 | 问题 | 优先级 |
|------|------|--------|
| D1 | 无 CI 依赖审计（npm audit / Dependabot） | P3 |
| D2 | 字体包按全量 CSS 导入，体积偏大 | P3 |

### 🔵 测试覆盖（Testing）
| 编号 | 问题 | 优先级 |
|------|------|--------|
| T1 | **零测试、无测试框架**，纯函数与同步逻辑完全无保护 | P1 |

### ⚪ 架构（Architecture）
| 编号 | 问题 | 优先级 |
|------|------|--------|
| A1 | 软删除 + LWW 合并：同一 item 的「删除」可能被另一设备「后续编辑」覆盖而丢失 | P3 |
| A2 | 无离线失败队列/重试 UI；推送失败仅 toast，用户易忽略 | P3 |

---

## 2. 逐项：问题描述 · 执行步骤 · 优先级 · 预期收益

### S1 · AI API Key 硬编码且已泄露  【P0】
**问题**：`src/lib/ai.ts:4` 写死 `const API_KEY = "ak_2kH3nu92L4a77hd6On7ch1Ys6Xu29"`。
- 该文件属于 `src/`，已随历次提交进入 git 历史，且会打进生产 bundle（`dist/assets/*.js`），任何人查看网页源码或公开仓库即可提取，**当前密钥已泄露**。
- 攻击者可用此密钥以你的额度调用 LongCat，产生费用或滥用。

**执行步骤**：
1. **立即去 LongCat 控制台吊销/轮换该 Key**（最高优先级，先止血）。
2. 从源码移除硬编码密钥，改为「用户自配」：
   - 在 `lib/ai.ts` 改为从配置读取：`const key = getAiKey();`，`getAiKey()` 从 `lib/crypto` 的 `getMeta("aiKey")` 读取。
   - 在 `Settings.tsx` 增加「AI Key」输入项，保存时 `setMeta("aiKey", value)`（复用现有 AES-GCM 加密层落盘，不落明文）。
   - `complete()` 中若无 key，抛出友好错误，AI 面板改为提示「请在设置中配置 AI Key」。
3. 用 `git filter-repo` 或 BFG 从 git 历史彻底擦除该字符串（否则轮换后旧历史仍可读到）。
4. 后续约定：密钥一律不入园；若坚持用环境变量，`import.meta.env.VITE_AI_KEY` 仍会进 bundle，仅适合「用户自己的 key」，绝不可放共用密钥。

**预期收益**：消除密钥泄露风险与潜在资损；密钥可随时轮换；符合最小权限原则。

---

### S2 · 密钥无用户自配/可轮换机制  【P1】
**问题**：AI 能力强依赖单一写死密钥，无后端代理转发，无法隔离。
**执行步骤**：同 S1 第 2 步（用户自配 + 加密存储）。如未来需要多用户，应加一个无服务函数（如 Cloudflare Worker / GitHub Pages 同源代理）转发 AI 请求，密钥仅存服务端。
**预期收益**：密钥与用户解耦，便于轮换、审计、限流。

---

### S3 · 无 CSP + innerHTML 依赖自写转义  【P2】
**问题**：`renderMarkdown` 用 `dangerouslySetInnerHTML` 渲染用户内容。虽有 `escHtml` + 链接白名单，但自写解析器对边界情况（嵌套、属性注入）覆盖不全；且无 CSP 兜底。
**执行步骤**：
1. `index.html` 增加 `<meta http-equiv="Content-Security-Policy" content="default-src 'self'; img-src 'self' data: https:; style-src 'self' 'unsafe-inline'; connect-src 'self' https://api.github.com https://api.longcat.chat">`（按实际域名收敛）。
2. 长期评估将自写 `renderMarkdown` 替换为成熟库（如 `marked` + DOMPurify），复用其已审计的 XSS 防护。
**预期收益**：即使渲染层有疏漏，CSP 也能拦截注入执行的脚本。

---

### P1 · 图片 base64 进每日 JSON 致同步静默失败  【P1】
**问题**：`compressImage` 把图压成 JPEG dataURL 存进 `item.media`，随整日 JSON 经 Contents API 上传。GitHub 单文件上限 1MB；一天内多张图或图偏大时 JSON 超限，`putDayFile` 返回 413 → 被 `pushWithTimeout` 吞掉 → toast「未同步」，**用户以为存了其实云端丢了**。
**执行步骤**：
1. 方案 A（推荐）：图片不进每日 JSON。新增 `lib/media.ts`，把图上传为独立文件 `media/<day>/<id>.jpg`（Contents API），JSON 只存相对路径；渲染时拼 `https://raw.githubusercontent.com/.../media/...`。
2. 方案 B（轻量）：在 `quickAdd`/`save` 处对单日图片总体积设硬上限（如 >700KB 时拒绝并提示「当天图片过多，请减少/压缩」），并把错误明确 toast 出来而非静默。
3. 不论哪种，都应在 `pushDayFile` 对 413 显式报错而非 catch 吞掉。
**预期收益**：避免「本地有、云端无」的隐性数据丢失；同步失败可见可救。

---

### P2 · 字体双重加载、render-blocking  【P2】
**问题**：`index.html` 从 jsdelivr CDN 加载 6 个 Noto SC 字体 CSS（render-blocking 外链）；`main.tsx` 又 `@fontsource` 导入 Geist/Newsreader。两套并存：CDN 失败则中文回退系统字体（离线即无衬线），且首屏被阻塞。
**执行步骤**：
1. 统一改为自托管：安装 `@fontsource/noto-serif-sc`、`@fontsource/noto-sans-sc`，在 `main.tsx` 按字重 `import`；删除 `index.html` 里的 6 个 `<link>` 与 `preconnect`。
2. 用 `font-display: swap`（@fontsource 默认含）避免阻塞渲染。
**预期收益**：离线可用、首屏更快、字体系统一致；去掉外链 CSP 风险。

---

### P3 · renderMarkdown 未 memo  【P2】
**问题**：`InspirationCard` 等用 `dangerouslySetInnerHTML={{__html: renderMarkdown(item.text)}}`，每次父组件渲染都重算字符串。列表项多时累积开销明显。
**执行步骤**：抽 `useMemo(() => renderMarkdown(item.text), [item.text])`；或在 `lib/markdown.ts` 加简单缓存 `Map<src, html>`（注意内容可能含用户图片 dataURL，需限制缓存大小/只缓存短文本）。
**预期收益**：长列表滚动/筛选时减少重复计算，更流畅。

---

### P4 · 列表计算缺 useMemo  【P3】
**问题**：`Inspiration.tsx`/`Learning.tsx` 的 `visible = all.filter(...).sort(...)` 在每次渲染重算（含 `tags` 派生）。
**执行步骤**：把 `visible`、`tags`、`shown` 用 `useMemo` 包起来，依赖 `all/day/tag`。
**预期收益**：筛选/输入时避免无谓重排。

---

### P5 · 主题首屏闪烁  【P3】
**问题**：`applyTheme` 在 `App` 的 `useEffect` 里跑，首帧先按系统默认再切，浅/深色切换有闪。
**执行步骤**：在 `index.html` `<head>` 内联一段同步脚本，在 React 挂载前读 `localStorage.aih_theme` 并加/去 `dark` class。
**预期收益**：消除主题闪屏，专业感提升。

---

### M1 · 清理死代码  【P2】
**问题**：`grep` 确认以下均无调用点：
- `lib/sync.ts:252` `schedulePush()`（防抖自动推送逻辑写了却从未被调用；`store.tsx` 实际走的是即时 `pushWithTimeout`）
- `lib/ai.ts:80` `relate()`
- `lib/db.ts:69` `getItem()`、`lib/db.ts:112` `withDay()`
- `types.ts` `mediaType: "voice"` 未实现（ aspirational 字段）
**执行步骤**：删除上述导出/字段；或在 `schedulePush` 真要启用时接入 `store.tsx`（建议启用，替代每次编辑即时强推，体验更好）。
**预期收益**：降低认知负担，避免「以为有自动推送其实没有」的误导。

---

### M2 · 开启严格检查 + 加 Lint  【P2】
**问题**：`tsconfig.json` 设 `noUnusedLocals:false`、`noUnusedParameters:false`，且无 ESLint/Prettier，死代码与风格问题无人拦截（M1 即是后果）。
**执行步骤**：
1. `tsconfig` 改 `noUnusedLocals:true`、`noUnusedParameters:true`。
2. 装 `eslint` + `typescript-eslint` + `prettier`，加 `.eslintrc`/`prettier.config`，`package.json` 增 `lint` 脚本，CI 里 `npm run lint`。
**预期收益**：在编译期挡住未使用变量/参数，统一风格，减少 Review 成本。

---

### M3 · 增加 ErrorBoundary  【P2】
**问题**：无错误边界，任一组件渲染抛错（如 Markdown 解析异常、IndexedDB 异常）会整页白屏，且无上报。
**执行步骤**：写 `components/ErrorBoundary.tsx`（class 组件 `componentDidCatch`），包裹 `App` 根；fallback 显示「出错了，点击重试」并提供 `location.reload()`。
**预期收益**：单点故障不致命，可恢复。

---

### M4 · 常量集中管理  【P3】
**问题**：`ALLOWED_LOGINS`、`DEFAULT_CFG.repo`、各 `localStorage` key 散落多处，难统一与配置化。
**执行步骤**：建 `lib/constants.ts` 集中常量（含可经 `import.meta.env` 覆盖的开关）。
**预期收益**：配置一目了然，便于多环境。

---

### D1 · CI 依赖审计  【P3】
**执行步骤**：`deploy.yml` 加一步 `npm audit --audit-level=high`；或在仓库启 Dependabot（`github-actions`、`npm`）。
**预期收益**：及时发现漏洞依赖。

---

### D2 · 字体按字重按需导入  【P3】
**执行步骤**：仅 `import` 实际用到的字重（当前已较克制），可用 `fontsource` 的子路径按需引入，减少打包体积。
**预期收益**：减小 bundle / 字体体积。

---

### T1 · 引入测试（核心缺口）  【P1】
**问题**：零测试。纯函数（Markdown 渲染、同步合并、标签提取）与同步逻辑无任何保护，重构易回归。
**执行步骤**：
1. 装 `vitest` + `@testing-library/react`（UI 可选），`package.json` 加 `test` 脚本，CI 增 `npm test`。
2. 先覆盖高价值纯函数：
   - `lib/markdown.ts` `renderMarkdown`：标题/列表/引用/粗斜体/链接白名单/转义。
   - `lib/sync.ts` `mergeItems`：LWW、软删传播、并列冲突。
   - `lib/util.ts` `extractTags` / `escapeHtml` / `ymd`。
3. 后续补 `store.tsx` 增删改的行为测试（用 fake-indexeddb）。
**预期收益**：建立回归防线，让后续优化（尤其 S1/P1/M3）改动可验证。

---

### A1 · 软删除与编辑的合并冲突  【P3】
**问题**：`mergeItems` 按 `updatedAt` LWW。若设备 A 删除（设 `deleted:true`、新 `updatedAt`），设备 B 随后编辑同 item（`updatedAt` 更新），合并后编辑胜出、删除丢失。
**执行步骤**：合并时若任一副本 `deleted` 且非被显式编辑覆盖，优先保留删除；或引入「删除版本号」语义。个人单用户低频可暂不改，但在 `mergeItems` 注释标明此边界。
**预期收益**：避免罕见的「删了又回来」。

---

### A2 · 同步失败可视化  【P3】
**执行步骤**：`store.tsx` 增 `lastSyncError` 状态，顶栏同步按钮在失败时显红点/提示，而非仅一次性 toast。
**预期收益**：同步问题可感知。

---

## 3. 建议实施顺序（路线图）

按「先止血 → 建防线 → 提质感」三阶段推进，**每阶段结束都对应一次可部署、低风险的小步提交**：

### 阶段一：安全止血（本周，最高优先）
1. **S1** 吊销并轮换泄露 Key → 改用户自配 + 加密存储 → 清理 git 历史。
2. **S3** 加 CSP meta（低成本高收益）。
3. **P1** 图片同步超限处理（至少做到 413 显式报错 + 提示，方案 A 可排到下阶段）。

### 阶段二：质量防线（紧随其后）
4. **T1** 引入 Vitest，补纯函数测试（为后续改动兜底）。
5. **M2** 开 `noUnusedLocals/Parameters` + ESLint/Prettier。
6. **M1** 清理死代码（借 M2 的严格模式一次性暴露）。
7. **M3** 加 ErrorBoundary。

### 阶段三：体验与可维护性打磨
8. **P2** 字体统一自托管（去 CDN）。
9. **P3/P4/P5** memo 优化、列表 useMemo、主题防闪。
10. **A1/A2/D1/D2/M4** 边界标注、同步失败可视化、依赖审计、常量集中。

---

## 4. 一句话总结

项目功能完整、UX 用心，但存在 **1 个 P0 安全事故（AI Key 泄露）** 和 **2 个 P1 结构性缺口（图片同步静默丢数据、零测试）**。先把密钥止血，再用测试+Lint 把质量底线立起来，最后做性能与体验打磨——整体改动量可控，且都能小步上线、不破坏现有功能。
