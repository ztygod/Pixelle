import {useEffect, useState} from "react";
import {clampWidth} from "../utils/format.js";

export function useTerminalSize(): {width: number; height: number} {
  const [size, setSize] = useState(() => ({
    width: clampWidth(process.stdout.columns),
    height: process.stdout.rows ?? 24,
  }));

  useEffect(() => {
    const update = () => {
      setSize({
        width: clampWidth(process.stdout.columns),
        height: process.stdout.rows ?? 24,
      });
    };

    process.stdout.on("resize", update);
    return () => {
      process.stdout.off("resize", update);
    };
  }, []);

  return size;
}
