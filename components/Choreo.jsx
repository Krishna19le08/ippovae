"use client";
import { useEffect } from "react";
import Lenis from "lenis";
import "lenis/dist/lenis.css";

export default function Choreo() {
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    let stop = null;

    const start = () => {
      const lenis = new Lenis({ anchors: true, lerp: 0.1 });
      window.lenis = lenis;
      let raf = requestAnimationFrame(function loop(t) {
        lenis.raf(t);
        raf = requestAnimationFrame(loop);
      });
      stop = () => {
        cancelAnimationFrame(raf);
        lenis.destroy();
        delete window.lenis;
        stop = null;
      };
    };

    // follow the setting live: reduce motion turns smooth scrolling off, clearing it turns it back on
    const sync = () => {
      if (mq.matches) stop?.();
      else if (!stop) start();
    };
    sync();
    mq.addEventListener("change", sync);
    return () => {
      mq.removeEventListener("change", sync);
      stop?.();
    };
  }, []);
  return null;
}
