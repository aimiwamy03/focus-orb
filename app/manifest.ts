import type { MetadataRoute } from 'next';
import { ICON_HREFS } from '@/lib/backdrop';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Focus Orb',
    short_name: 'Focus Orb',
    description: 'A dithered particle sphere that visualizes focus time and upcoming meetings',
    start_url: '/',
    display: 'standalone',
    background_color: '#000000',
    theme_color: '#000000',
    icons: [
      {
        src: ICON_HREFS.icon192,
        sizes: '192x192',
        type: 'image/png',
      },
      {
        src: ICON_HREFS.icon512,
        sizes: '512x512',
        type: 'image/png',
      },
    ],
  };
}
