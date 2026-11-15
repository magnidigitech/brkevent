/**
 * Robust Camera Manager & Stream Cleanup Utility
 * Ensures camera hardware and browser recording indicators (red/green dots)
 * shut down immediately when navigating away or unmounting scanner components.
 */

export function stopAllCameraStreams(): void {
  if (typeof window === 'undefined') return;

  try {
    // 1. Scan and stop all video elements across the entire document
    const videoElements = document.querySelectorAll('video');
    videoElements.forEach((video) => {
      try {
        const stream = video.srcObject;
        if (stream && stream instanceof MediaStream) {
          stream.getTracks().forEach((track) => {
            try {
              track.stop();
            } catch {}
          });
          video.srcObject = null;
        }
        video.pause();
      } catch {}
    });

    // 2. Inspect Html5Qrcode DOM containers and forcefully shut down tracks
    const qrContainers = document.querySelectorAll('[id*="qr-reader"], [id*="html5qr"]');
    qrContainers.forEach((container) => {
      try {
        const videos = container.querySelectorAll('video');
        videos.forEach((video) => {
          if (video.srcObject && video.srcObject instanceof MediaStream) {
            video.srcObject.getTracks().forEach((track) => {
              try {
                track.stop();
              } catch {}
            });
            video.srcObject = null;
          }
        });
      } catch {}
    });
  } catch (err) {
    console.warn('Error stopping camera streams:', err);
  }
}
