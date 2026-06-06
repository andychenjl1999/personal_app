import type { MetadataRoute } from 'next';

export default function manifest():
    MetadataRoute.Manifest {
    return {
        name: 'Personal App',
        short_name: 'Personal',
        description: 'Personal App Platform',
        start_url: '/',
        display: 'standalone',
        background_color: '#f4f5f7',
        theme_color: '#176b87',
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