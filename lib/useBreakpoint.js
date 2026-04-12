"use client";

import { useEffect, useState } from "react";

export function useBreakpoint() {
  const [width, setWidth] = useState(
    typeof window !== "undefined" ? window.innerWidth : 0
  );

  useEffect(() => {
    let timeout = null;

    const handleResize = () => {
      // debounce (estää lagin resize aikana)
      clearTimeout(timeout);
      timeout = setTimeout(() => {
        setWidth(window.innerWidth);
      }, 100);
    };

    handleResize();

    window.addEventListener("resize", handleResize);
    return () => {
      clearTimeout(timeout);
      window.removeEventListener("resize", handleResize);
    };
  }, []);

  return {
    width,
    isMobile: width < 768,
    isTablet: width >= 768 && width < 1024,
    isDesktop: width >= 1024,
  };
}
