import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Bhashyam Ramakrishna Event Entry',
    short_name: 'BRK Event',
    description: 'Gate attendance and invitation scanner for Bhashyam Ramakrishna Event',
    start_url: '/scanner',
    display: 'standalone',
    background_color: '#0f172a',
    theme_color: '#f59e0b',
    icons: [
      {
        src: '/icons/icon-192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'maskable',
      },
      {
        src: '/icons/icon-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
    ],
  };
}

