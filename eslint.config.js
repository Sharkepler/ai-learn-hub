import js from "@eslint/js";
import tseslint from "typescript-eslint";
import prettier from "eslint-config-prettier";
import globals from "globals";

// 统一代码风格与基础质量门禁（不替代 tsc 的类型检查）。
// 风格以 Prettier 为准（eslint-config-prettier 关闭所有格式规则），
// 这里只保留少量轻量规则，避免误伤既有逻辑。
export default tseslint.config(
  {
    ignores: ["dist", "node_modules", "*.config.js", "eslint.config.js"],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  prettier,
  {
    languageOptions: {
      globals: { ...globals.browser, ...globals.node },
      parserOptions: { ecmaVersion: 2020, sourceType: "module" },
    },
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      // 动态外部数据（GitHub API / IndexedDB JSON）处有意用 any，降级为警告，
      // 作为守护而非阻断，避免对既有代码误伤。
      "@typescript-eslint/no-explicit-any": "warn",
    },
  }
);
