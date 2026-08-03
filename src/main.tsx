import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

// 自托管字体（拉丁字形用 Geist，中文回退系统黑体），不依赖 CDN，离线可用
import "@fontsource/geist-sans/400.css";
import "@fontsource/geist-sans/500.css";
import "@fontsource/geist-sans/600.css";
import "@fontsource/geist-sans/700.css";
import "@fontsource/geist-mono/400.css";
import "@fontsource/geist-mono/500.css";
// 编辑风格衬线（Latin 用 Newsreader，中文回退系统宋体/明朝体）
import "@fontsource/newsreader/400.css";
import "@fontsource/newsreader/500.css";
import "@fontsource/newsreader/600.css";
import "@fontsource/newsreader/700.css";
import "@fontsource/newsreader/400-italic.css";
import "@fontsource/newsreader/600-italic.css";

import "./index.css";
import App from "./App";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
