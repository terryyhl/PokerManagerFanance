// @ts-nocheck — 诊断组件，跳过类型检查
import React from 'react';

/**
 * ErrorBoundary — 捕获桌面组件的渲染错误并显示组件堆栈
 */
export default class TableErrorBoundary extends React.Component {
  state = { error: null, stack: '' };

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error('[TableErrorBoundary]', error.message, '\nComponent Stack:', info.componentStack);
    this.setState({ stack: info.componentStack || '' });
  }

  render() {
    const { error, stack } = this.state;
    if (error) {
      return (
        <div className="min-h-screen bg-background-dark text-white flex flex-col items-center justify-center p-6 gap-4">
          <span className="material-symbols-outlined text-5xl text-red-400">bug_report</span>
          <h2 className="text-lg font-bold text-red-400">渲染错误</h2>
          <p className="text-sm text-slate-400 text-center max-w-sm break-all">{String(error.message)}</p>
          <pre className="text-[10px] text-slate-500 max-w-sm max-h-60 overflow-auto bg-black/30 rounded-lg p-3 w-full whitespace-pre-wrap">
            {stack}
          </pre>
          <button
            onClick={() => this.setState({ error: null, stack: '' })}
            className="px-4 py-2 bg-primary rounded-lg text-sm font-bold"
          >
            重试
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
