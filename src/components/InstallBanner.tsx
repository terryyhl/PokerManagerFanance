import { useInstallPrompt } from '../hooks/useInstallPrompt';

export default function InstallBanner() {
    const { showBanner, isIOS, isStandalone, install, dismiss, canInstall } = useInstallPrompt();

    if (!showBanner || isStandalone) return null;

    return (
        <div className="fixed bottom-0 left-0 right-0 z-[200] px-4 pb-4 pt-3 bg-gradient-to-t from-slate-900 via-slate-900/98 to-slate-900/90 backdrop-blur-md border-t border-slate-700/50 animate-slideUp">
            <div className="max-w-md mx-auto flex items-center gap-3">
                <img src="/icons/icon-192.png" alt="" className="w-12 h-12 rounded-xl shrink-0" />
                <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-white truncate">添加扑克记账到桌面</p>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                        {isIOS ? '点击 分享 → 添加到主屏幕' : '安装后获得更好的体验'}
                    </p>
                </div>
                {canInstall ? (
                    <button
                        onClick={install}
                        className="shrink-0 px-4 py-2 bg-primary hover:bg-blue-600 text-white text-xs font-bold rounded-lg transition-colors active:scale-95"
                    >
                        安装
                    </button>
                ) : isIOS ? (
                    <button
                        onClick={dismiss}
                        className="shrink-0 px-3 py-2 bg-slate-700 text-slate-300 text-xs font-bold rounded-lg transition-colors active:scale-95"
                    >
                        知道了
                    </button>
                ) : null}
                <button onClick={dismiss} className="shrink-0 p-1 text-slate-500 hover:text-slate-300 transition-colors">
                    <span className="material-symbols-outlined text-[18px]">close</span>
                </button>
            </div>
        </div>
    );
}
