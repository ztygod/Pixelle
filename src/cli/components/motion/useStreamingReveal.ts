import {useEffect, useState} from "react";

export function useStreamingReveal(
  totalLines: number,
  intervalMs = 90,
  active = true,
): number {
  const [visibleLines, setVisibleLines] = useState(active ? 1 : totalLines);

  useEffect(() => {
    if (!active) {
      setVisibleLines(totalLines);
      return undefined;
    }

    if (visibleLines >= totalLines) {
      return undefined;
    }

    setVisibleLines((current) => Math.min(Math.max(1, current), totalLines));

    const timer = setInterval(() => {
      setVisibleLines((current) => {
        if (current >= totalLines) {
          return current;
        }

        return current + 1;
      });
    }, intervalMs);

    return () => {
      clearInterval(timer);
    };
  }, [active, intervalMs, totalLines, visibleLines]);

  return Math.min(visibleLines, totalLines);
}
