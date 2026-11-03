import { Component, lazy, Suspense, useCallback, useEffect, useState, type ReactNode } from "react";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import relief from "@/assets/trinetra-relief.png.asset.json";
import { INTRO_FADE_MS, introDuration, shouldShowIntro } from "./introRules";

const LogoScene = lazy(() => import("./LogoScene"));

class SceneBoundary extends Component<{ children: ReactNode; fallback: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() { return this.state.failed ? this.props.fallback : this.props.children; }
}

export default function LogoIntro() {
  const [visible, setVisible] = useState(() => shouldShowIntro(window.location.pathname) && !window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  const [leaving, setLeaving] = useState(false);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const finish = useCallback(() => setLeaving(true), []);
  const markReady = useCallback(() => setReady(true), []);
  const markFailed = useCallback(() => setFailed(true), []);

  useEffect(() => {
    if (!visible) return;
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onChange = () => { if (motion.matches) setVisible(false); };
    motion.addEventListener("change", onChange);
    const timer = window.setTimeout(finish, Math.max(0, introDuration(motion.matches) - INTRO_FADE_MS));
    return () => { window.clearTimeout(timer); motion.removeEventListener("change", onChange); };
  }, [visible, finish]);
  useEffect(() => {
    if (!leaving) return;
    const timer = window.setTimeout(() => setVisible(false), INTRO_FADE_MS);
    return () => window.clearTimeout(timer);
  }, [leaving]);
  useEffect(() => {
    if (!visible) return;
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") finish(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [visible, finish]);

  if (!visible) return null;
  const fallback = <div className="intro-fallback"><img src={relief.url} alt="Trinetra Yoga" /></div>;
  return (
    <section className={`logo-intro${leaving ? " logo-intro-leaving" : ""}`} aria-label="Trinetra Yoga opening logo" data-scene-ready={ready || undefined}>
      {(!ready || failed) && fallback}
      {!failed && <SceneBoundary fallback={fallback}><Suspense fallback={null}><LogoScene onReady={markReady} onFailure={markFailed} /></Suspense></SceneBoundary>}
      <Button className="intro-skip" variant="ghost" size="icon" aria-label="Skip intro" title="Skip intro" onClick={finish}>
        <ArrowRight />
      </Button>
      <div className="intro-progress" aria-hidden="true"><span /></div>
    </section>
  );
}