import { useLayoutEffect, useRef, useState } from 'react';

interface Highlight {
  top: number;
  left: number;
  width: number;
  height: number;
}

export function HomeTour({ target, onDismiss }: { target: HTMLElement | null; onDismiss: () => void }) {
  const [highlight, setHighlight] = useState<Highlight | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useLayoutEffect(() => {
    if (!target) return;
    const measure = () => {
      const rect = target.getBoundingClientRect();
      setHighlight({
        top: rect.top - 12,
        left: rect.left - 12,
        width: rect.width + 24,
        height: rect.height + 24,
      });
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(target);
    window.addEventListener('resize', measure);
    window.addEventListener('scroll', measure, true);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', measure);
      window.removeEventListener('scroll', measure, true);
    };
  }, [target]);

  useLayoutEffect(() => {
    if (highlight) buttonRef.current?.focus();
  }, [Boolean(highlight)]);

  if (!highlight) return null;

  return (
    <div className="home-tour" role="dialog" aria-modal="true" aria-label="首頁導覽">
      <div
        className="home-tour-spotlight"
        style={{
          top: highlight.top,
          left: highlight.left,
          width: highlight.width,
          height: highlight.height,
        }}
      />
      <div className="home-tour-message" style={{ top: highlight.top + highlight.height + 30 }}>
        <p>點擊「種子畫廊」，就能隨時回到首頁。</p>
        <button ref={buttonRef} type="button" onClick={onDismiss}>
          知道了
        </button>
      </div>
    </div>
  );
}
