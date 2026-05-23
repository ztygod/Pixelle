import {useTerminalPulse} from "./useTerminalPulse.js";

export function useFrameSequence(
  frames: readonly string[],
  intervalMs = 160,
  active = true,
): string {
  const frame = useTerminalPulse(frames.length, intervalMs, active);
  return frames[frame] ?? frames[0] ?? "";
}

