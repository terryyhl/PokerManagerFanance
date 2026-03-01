/**
 * UI Click Sound Utility
 * Provides a low-latency, synthesized "system-like" click sound.
 */

let audioContext: AudioContext | null = null;

/**
 * Initialize audio context
 */
function getAudioContext() {
    if (!audioContext) {
        audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    return audioContext;
}

/**
 * Synthesize and play a short "system-like" click sound.
 * Uses a brief burst of sound with clear attack and decay for a crisp feel.
 */
export async function playClickSound() {
    const ctx = getAudioContext();

    // Resume context if suspended (common in browsers until user interaction)
    if (ctx.state === 'suspended') {
        await ctx.resume();
    }

    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();

    // Use a high-frequency sine or triangle wave for the "tick"
    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(1500, ctx.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(1, ctx.currentTime + 0.05);

    // Sharp attack and quick exponential decay
    gainNode.gain.setValueAtTime(0, ctx.currentTime);
    gainNode.gain.linearRampToValueAtTime(0.1, ctx.currentTime + 0.002);
    gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.05);

    oscillator.connect(gainNode);
    gainNode.connect(ctx.destination);

    oscillator.start();
    oscillator.stop(ctx.currentTime + 0.05);
}

/**
 * Setup a global listener for click sounds
 */
export function setupGlobalClickSound() {
    const handleInteraction = (e: MouseEvent) => {
        // Check if clicked element or its parent is a button or clickable
        const target = e.target as HTMLElement;
        const clickable = target.closest('button, a, [role="button"], input[type="submit"], input[type="button"]');

        if (clickable) {
            playClickSound().catch(() => { });
        }
    };

    window.addEventListener('mousedown', handleInteraction, { passive: true });
    return () => window.removeEventListener('mousedown', handleInteraction);
}
