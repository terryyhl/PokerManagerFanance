export default function AuthLoading() {
  return (
    <div className="min-h-screen bg-background-dark flex flex-col items-center justify-center gap-3">
      <span className="material-symbols-outlined animate-spin text-3xl text-primary">progress_activity</span>
      <span className="text-sm text-slate-400">正在恢复登录...</span>
    </div>
  );
}
