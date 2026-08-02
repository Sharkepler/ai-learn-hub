import { Component, type ReactNode } from "react";

// 顶层错误边界：避免单个组件崩溃导致整页白屏。
export class ErrorBoundary extends Component<
  { children: ReactNode },
  { error: Error | null }
> {
  state: { error: Error | null } = { error: null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, info: unknown) {
    console.error("App crashed:", error, info);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="grid min-h-[100dvh] place-items-center bg-bg p-6">
          <div className="max-w-md rounded-2xl border border-border bg-surface p-6 text-center">
            <h2 className="text-lg font-bold tracking-tight">页面出错了</h2>
            <p className="mt-2 text-sm leading-relaxed text-text-2">
              遇到了意外错误。刷新页面通常可以恢复；若反复出现，请在「设置」中退出后重新登录。
            </p>
            <pre className="mt-3 max-h-32 overflow-auto rounded-lg bg-surface-2 p-2 text-left text-xs text-text-2">
              {this.state.error.message}
            </pre>
            <button
              onClick={() => location.reload()}
              className="mt-4 rounded-full bg-accent px-4 py-2 text-sm font-semibold text-white"
            >
              刷新页面
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
