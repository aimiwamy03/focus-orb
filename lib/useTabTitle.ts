import { useEffect } from 'react';
import { formatTabTitle } from './scatter';

export function useTabTitle(
  minutesRemaining: number | null,
  isManualFocus: boolean
) {
  useEffect(() => {
    if (minutesRemaining !== null) {
      const title = formatTabTitle(minutesRemaining);
      document.title = isManualFocus 
        ? `${title} - Focus` 
        : `${title} - Focus Orb`;
      
      // Update favicon color based on time
      updateFavicon(minutesRemaining);
    } else {
      document.title = 'Focus Orb';
      updateFavicon(null);
    }
  }, [minutesRemaining, isManualFocus]);
}

function updateFavicon(minutesRemaining: number | null) {
  // Remove existing favicon
  const existingFavicon = document.querySelector('link[rel="icon"]');
  if (existingFavicon) {
    existingFavicon.remove();
  }

  // Create new favicon
  const link = document.createElement('link');
  link.rel = 'icon';
  
  // Generate SVG favicon with dot that changes color
  const color = minutesRemaining === null ? '#888' :
    minutesRemaining > 30 ? '#4ade80' : // green
    minutesRemaining > 10 ? '#fbbf24' : // yellow
    '#ef4444'; // red
  
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">
      <circle cx="16" cy="16" r="12" fill="${color}"/>
    </svg>
  `;
  
  link.href = `data:image/svg+xml,${encodeURIComponent(svg)}`;
  document.head.appendChild(link);
}
