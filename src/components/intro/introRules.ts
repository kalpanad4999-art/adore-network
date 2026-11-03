export const INTRO_DURATION_MS = 4000;
export const INTRO_FADE_MS = 450;

export function introDuration(reducedMotion: boolean) {
  return reducedMotion ? 0 : INTRO_DURATION_MS;
}

// Recovery and external links must remain immediately available.
export function shouldShowIntro(pathname: string) {
  return pathname === "/" || pathname === "/auth" || pathname === "/index";
}