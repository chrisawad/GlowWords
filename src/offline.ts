async function prepareOfflinePlay() {
  if (!import.meta.env.PROD || !window.isSecureContext) return;
  try {
    const worker = navigator.serviceWorker;
    if (!worker) return;
    await worker.register(`${import.meta.env.BASE_URL}sw.js`, { updateViaCache: 'none' });
  } catch (error) {
    console.warn('Offline play is unavailable.', error);
  }
}

void prepareOfflinePlay();
