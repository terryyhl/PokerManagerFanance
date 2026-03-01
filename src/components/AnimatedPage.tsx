import React, { useEffect, useRef } from 'react';
import anime from 'animejs/lib/anime.es.js';

interface AnimatedPageProps {
  children: React.ReactNode;
  animationType?: 'fade' | 'slide-up' | 'slide-left';
}

export default function AnimatedPage({ children, animationType = 'fade' }: AnimatedPageProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    if (animationType === 'fade') {
      anime({
        targets: containerRef.current,
        opacity: [0, 1],
        duration: 400,
        easing: 'easeOutQuad',
      });
    } else if (animationType === 'slide-up') {
      anime({
        targets: containerRef.current,
        translateY: [20, 0],
        opacity: [0, 1],
        duration: 500,
        easing: 'easeOutQuart',
      });
    } else if (animationType === 'slide-left') {
      anime({
        targets: containerRef.current,
        translateX: [20, 0],
        opacity: [0, 1],
        duration: 500,
        easing: 'easeOutQuart',
      });
    }
  }, [animationType]);

  return (
    <div ref={containerRef} className="h-full w-full opacity-0">
      {children}
    </div>
  );
}
