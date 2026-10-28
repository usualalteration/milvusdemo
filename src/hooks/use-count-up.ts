/** Smooth number count-up hook with easing. */

import * as React from "react";

export function useCountUp(target: number, duration = 800): number {
  const [value, setValue] = React.useState(0);
  const fromRef = React.useRef(0);

  React.useEffect(() => {
    const from = fromRef.current;
    const start = performance.now();
    let frame = 0;

    const tick = (now: number) => {
      const progress = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - progress, 3);
      const next = from + (target - from) * eased;
      setValue(next);
      if (progress < 1) {
        frame = requestAnimationFrame(tick);
      } else {
        fromRef.current = target;
      }
    };

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [target, duration]);

  return value;
}