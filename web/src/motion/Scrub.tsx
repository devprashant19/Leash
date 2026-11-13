import { useRef, type CSSProperties } from 'react';
import { motion, useScroll, useSpring, useTransform, type MotionStyle } from 'motion/react';

/**
 * Scroll-scrubbed character reveal: each char goes from dim to full as the block scrolls
 * through `offset`, with a soft leading edge (`soft` chars wide) and a smoothed catch-up
 * (the reference keeps revealing ~0.5 s after the scroll stops).
 */
export function ScrubChars({ text, as: As = 'p', className, offset = ['start 70%', 'end 70%'], from = 0.2, soft = 10 }: {
  text: string; as?: 'p' | 'h2' | 'h3' | 'div'; className?: string; offset?: [string, string]; from?: number; soft?: number;
}) {
  const ref = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: offset as never });
  const smooth = useSpring(scrollYProgress, { stiffness: 90, damping: 24, mass: 0.6 });
  const n = text.length;
  const p = useTransform(smooth, (v) => v * (n + soft));
  const MotionTag = motion[As] as typeof motion.p;
  let i = 0;
  return (
    <MotionTag ref={ref as never} className={className} style={{ '--p': p } as unknown as MotionStyle}>
      <span className="sr">{text}</span>
      <span aria-hidden="true">
        {text.split(' ').map((w, wi, arr) => (
          <span key={wi}>
            <span className="sr-word">
              {[...w].map((c) => {
                const idx = i++;
                return (
                  <span key={idx} className="sc" style={{ '--i': idx, '--soft': soft, '--from': from } as CSSProperties}>{c}</span>
                );
              })}
            </span>
            {wi < arr.length - 1 ? (i++, ' ') : null}
          </span>
        ))}
      </span>
    </MotionTag>
  );
}
