import { useEffect, useRef } from "react";

export function usePolling(fn: () => void, delay = 20000) {
  const savedCallback = useRef(fn);

  useEffect(() => {
    savedCallback.current = fn;
  }, [fn]);

  useEffect(() => {
    function tick() {
      savedCallback.current();
    }
    tick(); // Initial call
    const id = setInterval(tick, delay);
    return () => clearInterval(id);
  }, [delay]);
}
