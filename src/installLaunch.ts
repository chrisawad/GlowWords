export function getPlatform() {
  const ua = navigator.userAgent;
  if (/Android/i.test(ua)) return 'android';
  if (/iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)) return 'ios';
  if (/Mac/.test(navigator.platform)) return 'mac';
  return 'desktop';
}

export function getInstallLaunch() {
  const platform = getPlatform();
  const fragment = new URLSearchParams(location.hash.slice(1));
  const query = new URLSearchParams(location.search);
  const dashboard = fragment.getAll('from').includes('games-dashboard')
    || /^https:\/\/(?:games\.chrisawad\.com\/|chrisawad\.github\.io\/Games-Dashboard(?:\/|$))/i.test(document.referrer);
  const ua = navigator.userAgent;
  const androidAppReferrer = platform === 'android' && /^android-app:\/\/(?!org\.chromium\.webapk\.)/i.test(document.referrer);
  const webView = /;\s*wv\b|Version\/4\.0.*Chrome\/|FBAN|FBAV|FB_IAB|Instagram|MicroMessenger|\bLine\/|LinkedInApp|GSA\/|Snapchat|TikTok|BytedanceWebview|Pinterest|Twitter for/i.test(ua)
    || (platform === 'ios' && /AppleWebKit/i.test(ua) && !/Safari\//i.test(ua)
      && !(navigator as Navigator & { standalone?: boolean }).standalone);
  const inheritedDisplay = platform === 'ios' && (navigator as Navigator & { standalone?: boolean }).standalone === false
    && matchMedia('(display-mode: standalone)').matches;
  const external = dashboard || window.top !== window.self || androidAppReferrer || webView || inheritedDisplay;
  const invited = ['room', 'invite', 'join'].some(key => query.has(key) || fragment.has(key));
  return { external, invited };
}
