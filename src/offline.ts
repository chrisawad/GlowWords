async function prepareOfflinePlay() {
  if (!import.meta.env.PROD || !window.isSecureContext) return false;
  try {
    const worker = navigator.serviceWorker;
    if (!worker) return false;
    await worker.register(`${import.meta.env.BASE_URL}sw.js`, { updateViaCache: 'none' });
    await worker.ready;
    return true;
  } catch (error) {
    console.warn('Offline play is unavailable.', error);
    return false;
  }
}

export const offlineReady = prepareOfflinePlay();
