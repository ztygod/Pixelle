import {useEffect, useState} from "react";

export function useTerminalPulse(
  frameCount: number,
  intervalMs = 160,
  active = true,
): number {
  const [frame, setFrame] = useState(0);

  useEffect(() => {
    if (!active || frameCount <= 1) {
      setFrame(0);
      return undefined;
    }

    const timer = setInterval(() => {
      setFrame((current) => (current + 1) % frameCount);
    }, intervalMs);

    return () => {
      clearInterval(timer);
    };
  }, [active, frameCount, intervalMs]);

  return frame;
}
