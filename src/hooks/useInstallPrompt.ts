import { useState, useEffect, useCallback } from 'react';

interface BeforeInstallPromptEvent extends Event {
    prompt(): Promise<void>;
    userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const DISMISS_KEY = 'poker:pwa-dismiss';
// 用户关闭提示后 7 天内不再弹出
const DISMISS_DAYS = 7;

function isDismissed(): boolean {
    const ts = localStorage.getItem(DISMISS_KEY);
    if (!ts) return false;
    const diff = Date.now() - parseInt(ts, 10);
    return diff < DISMISS_DAYS * 24 * 60 * 60 * 1000;
}

export function useInstallPrompt() {
    const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
    const [showBanner, setShowBanner] = useState(false);
    // iOS Safari 不支持 beforeinstallprompt，需要引导用户手动添加
    const [isIOS, setIsIOS] = useState(false);
    const [isStandalone, setIsStandalone] = useState(false);

    useEffect(() => {
        // 已经在 standalone 模式（已安装）
        const standalone = window.matchMedia('(display-mode: standalone)').matches
            || (navigator as any).standalone === true;
        setIsStandalone(standalone);
        if (standalone) return;

        // iOS 检测
        const ios = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
        setIsIOS(ios);

        // iOS 没有 beforeinstallprompt，如果没被dismiss就直接显示引导
        if (ios && !isDismissed()) {
            setShowBanner(true);
            return;
        }

        const handler = (e: Event) => {
            e.preventDefault();
            setDeferredPrompt(e as BeforeInstallPromptEvent);
            if (!isDismissed()) {
                setShowBanner(true);
            }
        };

        window.addEventListener('beforeinstallprompt', handler);
        return () => window.removeEventListener('beforeinstallprompt', handler);
    }, []);

    const install = useCallback(async () => {
        if (!deferredPrompt) return;
        await deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        if (outcome === 'accepted') {
            setShowBanner(false);
        }
        setDeferredPrompt(null);
    }, [deferredPrompt]);

    const dismiss = useCallback(() => {
        localStorage.setItem(DISMISS_KEY, String(Date.now()));
        setShowBanner(false);
    }, []);

    return { showBanner, isIOS, isStandalone, install, dismiss, canInstall: !!deferredPrompt };
}
