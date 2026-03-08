import React from 'react';

interface AnimatedPageProps {
  children: React.ReactNode;
  animationType?: 'fade' | 'slide-up' | 'slide-left';
}

export default function AnimatedPage({ children }: AnimatedPageProps) {
  return (
    <div className="h-full w-full">
      {children}
    </div>
  );
}
