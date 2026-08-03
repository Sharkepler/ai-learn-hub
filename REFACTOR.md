# 重构说明：ai-learn-hub 对齐助手风格规范

> 重构时间：2026-08-03 ｜ 目标项目：`ai-learn-hub`（智学，React 18 + TS + Vite 6 + Tailwind v4）
> 目标：将代码风格、常量组织、命名与整体约定统一到本助手在 `CODE_REVIEW.md` 中确立的工程规范；**不改变任何功能逻辑**。

## 改动清单

### 1. 常量集中（CODE_REVIEW M4）
- 新增 `src/lib/constants.ts`，集中跨模块共享常量：
  - 存储键：`SESSION_KEY` / `LEGACY_SESSION_KEY` / `THEME_KEY` / `SYNC_CFG_KEY` / `LAST_SYNC_KEY`
  - 配置：`ALLOWED_LOGINS` / `AI_ENDPOINT` / `AI_MODEL` / `DEFAULT_SYNC_CFG`
- 同步更新 `auth.ts` / `ai.ts` / `sync.ts` / `state/store.tsx` / `theme.ts` 的 import 与引用。
- 顺手修掉一个真实隐患：`LAST_KEY = "aih_last_sync"` 在 `store.tsx` 与 `sync.ts` 各定义一次（重复 key），现已统一为单一 `LAST_SYNC_KEY`。

### 2. 命名歧义消除
- `src/lib/assetCatalog.ts` → `src/lib/productCatalog.ts`（静态商品目录），与 `assets.ts`（用户资产记录 + 成本计算）彻底区分。
- 更新 `AssetThumb.tsx` / `AssetCalculator.tsx` 两处 import。

### 3. lint / format 基建（CODE_REVIEW M2）
- 新增 `eslint.config.js`（flat config：js + typescript-eslint recommended + eslint-config-prettier）、`prettier.config.js`、`.prettierignore`。
- `tsconfig.json` 开启 `noUnusedLocals` / `noUnusedParameters`（原为 `false`）。
- `package.json` 增加 `lint` / `format` / `format:check` 脚本，并把对应 devDeps 写入 `devDependencies`。
- 全量 `prettier --write` 统一格式（2 空格 / 双引号 / 分号 / 尾逗号 / 行宽 90）。
- 用严格未用检查清掉 10 处真实残留（未用变量与 import）：`MediaLog` / `sync` / `db` / `store` / `Inspiration` / `Learning` / `Settings`。
- 修掉 2 处真实 lint 问题：`SearchModal` 正则多余转义、`Dashboard` 的 `let` → `const`。
- 删除 4 处失效的 `react-hooks/exhaustive-deps` 禁用注释（该插件未纳入，留着会导致 lint 报错）。
- `no-explicit-any` 降为 warning：GitHub API / IndexedDB 动态数据处有意使用 `any`，作为守护而非阻断。

## 验收（四方均通过）
| 检查 | 结果 |
|------|------|
| `npm run typecheck` (tsc --noEmit) | 0 错误 |
| `npm run lint` (eslint) | 0 错误（17 条 `any` 警告，非阻断） |
| `npm run format:check` (prettier) | 全部合规 |
| `npm run build` (vite) | 构建成功（仅既有 chunk 体积提醒，与本次无关） |

## 运行方式
```bash
npm install       # 拉取新增的 lint/format devDeps
npm run format    # 按本规范格式化 src
npm run lint      # 风格 / 质量门禁
npm run typecheck # 类型检查
npm run dev       # 本地开发
npm run build     # 生产构建
```

## 刻意未动（保持范围）
- 模块私有存储键（`aih_assets` / `moodLog` / `monthlyReviews` / `aih_ai_key` 等）仍留在各自文件，属单 owner，搬迁无收益。
- 未加测试（本轮按约定只做风格 / 组织 / 命名，不含 CODE_REVIEW T1 测试基线）。
- 未改写 git 历史：泄露的 API Key 已从源码移除，但旧明文可能仍在历史中；如需根除请单独用 `git filter-repo` / BFG。
