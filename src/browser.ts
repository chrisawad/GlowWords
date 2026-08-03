export function isSilkBrowser(): boolean {
  return typeof navigator !== 'undefined' && /\bSilk\//i.test(navigator.userAgent);
}
