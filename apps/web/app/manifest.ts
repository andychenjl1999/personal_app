import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Todo Calendar',
    short_name: 'Todos',
    description: 'Plan and complete todos across month, day, and list views.',
    start_url: '/',
    display: 'standalone',
    background_color: '#f5f3ee',
    theme_color: '#245c47',
    icons: [
      {
        src: '/icon-192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'maskable',
      },
      {
        src: '/icon-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
  };
}
