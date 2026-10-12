import fs from 'fs';
import path from 'path';

// Jewelry assets catalog
export interface JewelryItem {
  id: string;
  type: 'earring' | 'necklace' | 'ring' | 'bracelet';
  name: string;
  category: string;
  metal: string;
  gem: string;
  previewSvg: string;
  // Svg asset path
  svgDataUri: string;
}

// Generate high quality SVG data URIs
function createEarringSvg(color1: string, color2: string, style: 'drop' | 'hoop' | 'stud' | 'chandelier' | 'emerald_teardrop' | 'pearl'): string {
  let content = '';
  if (style === 'drop') {
    content = `
      <defs>
        <radialGradient id="g" cx="50%" cy="30%" r="70%">
          <stop offset="0%" stop-color="#fff"/>
          <stop offset="40%" stop-color="${color1}"/>
          <stop offset="100%" stop-color="${color2}"/>
        </radialGradient>
        <filter id="glow"><feGaussianBlur stdDeviation="2" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
      </defs>
      <!-- Ear wire hook -->
      <path d="M 60 15 Q 60 5 50 5 Q 40 5 40 20 L 40 35" fill="none" stroke="${color1}" stroke-width="3" stroke-linecap="round"/>
      <circle cx="40" cy="38" r="4" fill="${color1}"/>
      <!-- Connection link -->
      <line x1="40" y1="42" x2="40" y2="52" stroke="${color1}" stroke-width="2.5"/>
      <!-- Gemstone drop -->
      <path d="M 40 52 C 25 75 15 95 40 120 C 65 95 55 75 40 52 Z" fill="url(#g)" filter="url(#glow)"/>
      <!-- Inner facet lines -->
      <path d="M 40 58 L 30 90 L 40 115 L 50 90 Z" fill="none" stroke="#ffffff" stroke-width="1.2" opacity="0.6"/>
      <circle cx="40" cy="85" r="5" fill="#ffffff" opacity="0.8"/>
    `;
  } else if (style === 'hoop') {
    content = `
      <defs>
        <linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#fff"/>
          <stop offset="30%" stop-color="${color1}"/>
          <stop offset="100%" stop-color="${color2}"/>
        </linearGradient>
      </defs>
      <circle cx="40" cy="65" r="35" fill="none" stroke="url(#g)" stroke-width="7"/>
      <circle cx="40" cy="65" r="35" fill="none" stroke="#fff" stroke-width="1.5" stroke-dasharray="3, 7" opacity="0.8"/>
      <!-- Latch -->
      <rect x="36" y="26" width="8" height="6" rx="2" fill="${color1}"/>
    `;
  } else if (style === 'stud') {
    content = `
      <defs>
        <radialGradient id="g" cx="35%" cy="35%" r="65%">
          <stop offset="0%" stop-color="#fff"/>
          <stop offset="45%" stop-color="${color1}"/>
          <stop offset="100%" stop-color="${color2}"/>
        </radialGradient>
      </defs>
      <circle cx="40" cy="40" r="28" fill="${color2}" stroke="${color1}" stroke-width="3"/>
      <!-- Star diamond facet -->
      <polygon points="40,15 48,32 65,40 48,48 40,65 32,48 15,40 32,32" fill="url(#g)"/>
      <circle cx="40" cy="40" r="7" fill="#fff" opacity="0.9"/>
    `;
  } else if (style === 'chandelier') {
    content = `
      <defs>
        <linearGradient id="g" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stop-color="${color1}"/>
          <stop offset="100%" stop-color="${color2}"/>
        </linearGradient>
      </defs>
      <circle cx="40" cy="15" r="5" fill="${color1}"/>
      <polygon points="20,35 60,35 40,55" fill="${color1}"/>
      <circle cx="25" cy="70" r="7" fill="${color2}"/>
      <circle cx="40" cy="80" r="9" fill="${color2}"/>
      <circle cx="55" cy="70" r="7" fill="${color2}"/>
      <line x1="25" y1="35" x2="25" y2="63" stroke="${color1}" stroke-width="2"/>
      <line x1="40" y1="55" x2="40" y2="71" stroke="${color1}" stroke-width="2"/>
      <line x1="55" y1="35" x2="55" y2="63" stroke="${color1}" stroke-width="2"/>
    `;
  } else if (style === 'emerald_teardrop') {
    content = `
      <defs>
        <linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#34D399"/>
          <stop offset="60%" stop-color="${color1}"/>
          <stop offset="100%" stop-color="${color2}"/>
        </linearGradient>
      </defs>
      <circle cx="40" cy="20" r="6" fill="#FBBF24"/>
      <path d="M 40 35 C 20 60 10 90 40 120 C 70 90 60 60 40 35 Z" fill="url(#g)" stroke="#FBBF24" stroke-width="3"/>
      <polygon points="40,50 28,85 40,110 52,85" fill="none" stroke="#fff" opacity="0.6" stroke-width="1.5"/>
    `;
  } else {
    // Pearl
    content = `
      <defs>
        <radialGradient id="g" cx="30%" cy="30%" r="70%">
          <stop offset="0%" stop-color="#ffffff"/>
          <stop offset="60%" stop-color="#fdf4f5"/>
          <stop offset="100%" stop-color="#cbd5e1"/>
        </radialGradient>
      </defs>
      <path d="M 40 10 L 40 35" stroke="${color1}" stroke-width="3"/>
      <circle cx="40" cy="25" r="4" fill="${color1}"/>
      <circle cx="40" cy="65" r="26" fill="url(#g)" stroke="${color1}" stroke-width="2"/>
      <ellipse cx="32" cy="55" rx="6" ry="4" fill="#ffffff" opacity="0.8"/>
    `;
  }

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 130" width="80" height="130">${content}</svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

function createNecklaceSvg(color1: string, color2: string, style: 'choker' | 'pendant' | 'diamond_v' | 'pearl_strand' | 'emerald_solitaire' | 'gold_chain'): string {
  let content = '';
  if (style === 'pendant') {
    content = `
      <defs>
        <linearGradient id="chainG" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stop-color="${color1}"/>
          <stop offset="50%" stop-color="#ffffff"/>
          <stop offset="100%" stop-color="${color1}"/>
        </linearGradient>
        <radialGradient id="gemG" cx="40%" cy="30%" r="70%">
          <stop offset="0%" stop-color="#ffffff"/>
          <stop offset="40%" stop-color="${color2}"/>
          <stop offset="100%" stop-color="#0f172a"/>
        </radialGradient>
      </defs>
      <!-- Chain arc draping over collarbones -->
      <path d="M 20 20 Q 150 140 280 20" fill="none" stroke="url(#chainG)" stroke-width="3.5" stroke-linecap="round"/>
      <path d="M 20 20 Q 150 140 280 20" fill="none" stroke="#fff" stroke-width="1" stroke-dasharray="4,6" opacity="0.8"/>
      <!-- Bail -->
      <rect x="145" y="78" width="10" height="12" rx="3" fill="${color1}"/>
      <!-- Pendant Stone -->
      <path d="M 150 90 L 170 120 L 150 150 L 130 120 Z" fill="url(#gemG)" stroke="${color1}" stroke-width="3"/>
      <polygon points="150,98 162,120 150,140 138,120" fill="none" stroke="#fff" stroke-width="1.2" opacity="0.7"/>
      <circle cx="150" cy="118" r="4" fill="#fff" opacity="0.9"/>
    `;
  } else if (style === 'diamond_v') {
    content = `
      <defs>
        <linearGradient id="vG" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stop-color="${color1}"/>
          <stop offset="50%" stop-color="#fff"/>
          <stop offset="100%" stop-color="${color1}"/>
        </linearGradient>
      </defs>
      <path d="M 25 30 L 150 110 L 275 30" fill="none" stroke="url(#vG)" stroke-width="4.5"/>
      <path d="M 150 110 L 150 145" stroke="url(#vG)" stroke-width="3.5"/>
      <!-- Graduated diamonds along V -->
      <circle cx="150" cy="110" r="9" fill="#fff" stroke="${color1}" stroke-width="2"/>
      <circle cx="150" cy="145" r="12" fill="#fff" stroke="${color1}" stroke-width="2.5"/>
      <circle cx="120" cy="90" r="6" fill="#fff"/>
      <circle cx="180" cy="90" r="6" fill="#fff"/>
      <circle cx="95" cy="72" r="5" fill="#fff"/>
      <circle cx="205" cy="72" r="5" fill="#fff"/>
    `;
  } else if (style === 'pearl_strand') {
    let pearls = '';
    const points = [
      [30, 25], [55, 42], [85, 60], [115, 75], [150, 85], [185, 75], [215, 60], [245, 42], [270, 25]
    ];
    for (const [x, y] of points) {
      pearls += `<circle cx="${x}" cy="${y}" r="11" fill="#fff" stroke="#e2e8f0" stroke-width="1.5"/><ellipse cx="${x - 3}" cy="${y - 3}" rx="3" ry="2" fill="#f8fafc" opacity="0.9"/>`;
    }
    content = `
      <path d="M 30 25 Q 150 100 270 25" fill="none" stroke="#cbd5e1" stroke-width="2"/>
      ${pearls}
    `;
  } else if (style === 'choker') {
    content = `
      <defs>
        <linearGradient id="chokerG" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stop-color="${color1}"/>
          <stop offset="50%" stop-color="#fff"/>
          <stop offset="100%" stop-color="${color1}"/>
        </linearGradient>
      </defs>
      <path d="M 30 20 Q 150 75 270 20" fill="none" stroke="url(#chokerG)" stroke-width="12" stroke-linecap="round"/>
      <path d="M 30 20 Q 150 75 270 20" fill="none" stroke="#1e293b" stroke-width="2" stroke-dasharray="3, 4"/>
      <circle cx="150" cy="48" r="12" fill="${color2}" stroke="${color1}" stroke-width="3"/>
      <circle cx="150" cy="48" r="5" fill="#fff" opacity="0.85"/>
    `;
  } else if (style === 'emerald_solitaire') {
    content = `
      <path d="M 20 20 Q 150 135 280 20" fill="none" stroke="${color1}" stroke-width="3"/>
      <rect x="135" y="80" width="30" height="24" rx="5" fill="${color2}" stroke="${color1}" stroke-width="3"/>
      <rect x="140" y="84" width="20" height="16" rx="3" fill="none" stroke="#fff" stroke-width="1.2" opacity="0.7"/>
      <circle cx="145" cy="89" r="2.5" fill="#fff"/>
    `;
  } else {
    // Bold Gold Cuban Link
    content = `
      <defs>
        <linearGradient id="chainG" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#FEF08A"/>
          <stop offset="40%" stop-color="${color1}"/>
          <stop offset="100%" stop-color="#854D0E"/>
        </linearGradient>
      </defs>
      <path d="M 25 25 Q 150 120 275 25" fill="none" stroke="url(#chainG)" stroke-width="10" stroke-linecap="round"/>
      <path d="M 25 25 Q 150 120 275 25" fill="none" stroke="#fff" stroke-width="1.5" stroke-dasharray="6, 8" opacity="0.6"/>
    `;
  }

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 170" width="300" height="170">${content}</svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

function createRingSvg(color1: string, color2: string, style: 'solitaire' | 'halo' | 'trilogy' | 'band' | 'emerald_cut' | 'ruby_vintage'): string {
  let content = '';
  if (style === 'solitaire') {
    content = `
      <defs>
        <linearGradient id="rBand" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#fff"/>
          <stop offset="30%" stop-color="${color1}"/>
          <stop offset="100%" stop-color="#713f12"/>
        </linearGradient>
        <radialGradient id="gemG" cx="30%" cy="30%" r="70%">
          <stop offset="0%" stop-color="#fff"/>
          <stop offset="50%" stop-color="${color2}"/>
          <stop offset="100%" stop-color="#1e1b4b"/>
        </radialGradient>
      </defs>
      <!-- Ring Band -->
      <ellipse cx="50" cy="65" rx="36" ry="18" fill="none" stroke="url(#rBand)" stroke-width="9"/>
      <!-- Prongs -->
      <path d="M 42 45 L 45 32 M 58 45 L 55 32" stroke="${color1}" stroke-width="3.5"/>
      <!-- Solitaire Brilliant Diamond -->
      <polygon points="50,15 68,28 62,48 38,48 32,28" fill="url(#gemG)" stroke="${color1}" stroke-width="2"/>
      <polygon points="50,20 62,30 50,42 38,30" fill="none" stroke="#fff" opacity="0.75" stroke-width="1.2"/>
      <circle cx="50" cy="27" r="4" fill="#fff" opacity="0.9"/>
    `;
  } else if (style === 'halo') {
    content = `
      <ellipse cx="50" cy="65" rx="36" ry="18" fill="none" stroke="${color1}" stroke-width="8"/>
      <!-- Halo surround -->
      <circle cx="50" cy="35" r="20" fill="${color1}" stroke="#fff" stroke-width="1"/>
      <circle cx="50" cy="35" r="14" fill="${color2}"/>
      <circle cx="50" cy="35" r="6" fill="#fff" opacity="0.9"/>
    `;
  } else if (style === 'emerald_cut') {
    content = `
      <ellipse cx="50" cy="65" rx="36" ry="18" fill="none" stroke="${color1}" stroke-width="9"/>
      <rect x="34" y="20" width="32" height="24" rx="4" fill="${color2}" stroke="${color1}" stroke-width="3"/>
      <rect x="40" y="24" width="20" height="16" rx="2" fill="none" stroke="#fff" stroke-width="1.2" opacity="0.8"/>
      <circle cx="45" cy="28" r="3" fill="#fff"/>
    `;
  } else if (style === 'trilogy') {
    content = `
      <ellipse cx="50" cy="65" rx="36" ry="18" fill="none" stroke="${color1}" stroke-width="8"/>
      <circle cx="32" cy="38" r="9" fill="${color2}" stroke="${color1}" stroke-width="2"/>
      <circle cx="50" cy="33" r="14" fill="#fff" stroke="${color1}" stroke-width="2.5"/>
      <circle cx="68" cy="38" r="9" fill="${color2}" stroke="${color1}" stroke-width="2"/>
    `;
  } else if (style === 'band') {
    content = `
      <ellipse cx="50" cy="55" rx="38" ry="20" fill="none" stroke="${color1}" stroke-width="14"/>
      <ellipse cx="50" cy="55" rx="38" ry="20" fill="none" stroke="#fff" stroke-width="2" stroke-dasharray="4, 5" opacity="0.8"/>
    `;
  } else {
    // Ruby vintage
    content = `
      <ellipse cx="50" cy="65" rx="36" ry="18" fill="none" stroke="${color1}" stroke-width="8"/>
      <polygon points="50,18 68,34 50,50 32,34" fill="${color2}" stroke="${color1}" stroke-width="3"/>
      <circle cx="50" cy="34" r="5" fill="#fff" opacity="0.85"/>
    `;
  }

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 95" width="100" height="95">${content}</svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

function createBraceletSvg(color1: string, color2: string, style: 'tennis' | 'cuff' | 'charm' | 'bangle' | 'chain' | 'gem_cuff'): string {
  let content = '';
  if (style === 'tennis') {
    content = `
      <defs>
        <linearGradient id="tG" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stop-color="${color1}"/>
          <stop offset="50%" stop-color="#fff"/>
          <stop offset="100%" stop-color="${color1}"/>
        </linearGradient>
      </defs>
      <ellipse cx="90" cy="50" rx="75" ry="32" fill="none" stroke="url(#tG)" stroke-width="6"/>
      <!-- Continuous diamonds around wrist ellipse -->
      <ellipse cx="90" cy="50" rx="75" ry="32" fill="none" stroke="#fff" stroke-width="6" stroke-dasharray="5, 8"/>
    `;
  } else if (style === 'cuff') {
    content = `
      <defs>
        <linearGradient id="cG" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#FEF08A"/>
          <stop offset="40%" stop-color="${color1}"/>
          <stop offset="100%" stop-color="#854D0E"/>
        </linearGradient>
      </defs>
      <path d="M 25 65 C 25 30 155 30 155 65" fill="none" stroke="url(#cG)" stroke-width="20" stroke-linecap="round"/>
      <path d="M 25 65 C 25 30 155 30 155 65" fill="none" stroke="#fff" stroke-width="2" stroke-dasharray="6, 8" opacity="0.7"/>
    `;
  } else if (style === 'charm') {
    content = `
      <ellipse cx="90" cy="45" rx="70" ry="28" fill="none" stroke="${color1}" stroke-width="5"/>
      <!-- Hanging charms -->
      <circle cx="65" cy="72" r="9" fill="${color2}" stroke="${color1}" stroke-width="2"/>
      <line x1="65" y1="62" x2="65" y2="72" stroke="${color1}" stroke-width="2"/>
      <polygon points="90,66 97,78 83,78" fill="#FBBF24" stroke="${color1}" stroke-width="2"/>
      <circle cx="115" cy="72" r="9" fill="${color2}" stroke="${color1}" stroke-width="2"/>
      <line x1="115" y1="62" x2="115" y2="72" stroke="${color1}" stroke-width="2"/>
    `;
  } else if (style === 'bangle') {
    content = `
      <ellipse cx="90" cy="50" rx="75" ry="30" fill="none" stroke="${color1}" stroke-width="12"/>
      <ellipse cx="90" cy="50" rx="75" ry="30" fill="none" stroke="#fff" stroke-width="2" opacity="0.8"/>
    `;
  } else if (style === 'chain') {
    content = `
      <ellipse cx="90" cy="50" rx="72" ry="28" fill="none" stroke="${color1}" stroke-width="7" stroke-dasharray="10, 6"/>
    `;
  } else {
    // Gem cuff
    content = `
      <ellipse cx="90" cy="50" rx="75" ry="30" fill="none" stroke="${color1}" stroke-width="14"/>
      <rect x="75" y="16" width="30" height="14" rx="4" fill="${color2}" stroke="${color1}" stroke-width="2"/>
    `;
  }

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 180 95" width="180" height="95">${content}</svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

export const JEWELRY_CATALOG: JewelryItem[] = [
  // 1. EARRINGS (6 sample items)
  {
    id: 'earring-diamond-drop',
    type: 'earring',
    name: 'Starlight Diamond Drops',
    category: 'Earrings',
    metal: '18K White Gold',
    gem: 'VVS Diamond',
    previewSvg: createEarringSvg('#E2E8F0', '#38BDF8', 'drop'),
    svgDataUri: createEarringSvg('#E2E8F0', '#38BDF8', 'drop')
  },
  {
    id: 'earring-gold-hoop',
    type: 'earring',
    name: 'Aura Classic Hoops',
    category: 'Earrings',
    metal: '18K Yellow Gold',
    gem: 'Polished Gold',
    previewSvg: createEarringSvg('#EAB308', '#CA8A04', 'hoop'),
    svgDataUri: createEarringSvg('#EAB308', '#CA8A04', 'hoop')
  },
  {
    id: 'earring-solitaire-stud',
    type: 'earring',
    name: 'Celeste Brilliant Studs',
    category: 'Earrings',
    metal: 'Platinum',
    gem: 'Round Diamond',
    previewSvg: createEarringSvg('#E2E8F0', '#93C5FD', 'stud'),
    svgDataUri: createEarringSvg('#E2E8F0', '#93C5FD', 'stud')
  },
  {
    id: 'earring-emerald-teardrop',
    type: 'earring',
    name: 'Verdant Emerald Teardrops',
    category: 'Earrings',
    metal: '18K Yellow Gold',
    gem: 'Colombian Emerald',
    previewSvg: createEarringSvg('#10B981', '#064E3B', 'emerald_teardrop'),
    svgDataUri: createEarringSvg('#10B981', '#064E3B', 'emerald_teardrop')
  },
  {
    id: 'earring-pearl-drop',
    type: 'earring',
    name: 'Akoya Pearl Drops',
    category: 'Earrings',
    metal: 'Rose Gold',
    gem: 'Lustrous Pearl',
    previewSvg: createEarringSvg('#F43F5E', '#CBD5E1', 'pearl'),
    svgDataUri: createEarringSvg('#F43F5E', '#CBD5E1', 'pearl')
  },
  {
    id: 'earring-chandelier',
    type: 'earring',
    name: 'Royal Chandelier Cascades',
    category: 'Earrings',
    metal: '18K White Gold',
    gem: 'Sapphire & Diamond',
    previewSvg: createEarringSvg('#E2E8F0', '#3B82F6', 'chandelier'),
    svgDataUri: createEarringSvg('#E2E8F0', '#3B82F6', 'chandelier')
  },

  // 2. NECKLACES (6 sample items)
  {
    id: 'necklace-sapphire-pendant',
    type: 'necklace',
    name: 'Ocean Heart Sapphire Pendant',
    category: 'Necklaces',
    metal: '18K White Gold',
    gem: 'Royal Blue Sapphire',
    previewSvg: createNecklaceSvg('#E2E8F0', '#2563EB', 'pendant'),
    svgDataUri: createNecklaceSvg('#E2E8F0', '#2563EB', 'pendant')
  },
  {
    id: 'necklace-diamond-v',
    type: 'necklace',
    name: 'Cascading Diamond Chevron',
    category: 'Necklaces',
    metal: 'Platinum',
    gem: 'Brilliant Diamond',
    previewSvg: createNecklaceSvg('#E2E8F0', '#60A5FA', 'diamond_v'),
    svgDataUri: createNecklaceSvg('#E2E8F0', '#60A5FA', 'diamond_v')
  },
  {
    id: 'necklace-pearl-strand',
    type: 'necklace',
    name: 'Princess Akoya Pearl Strand',
    category: 'Necklaces',
    metal: '14K White Clasp',
    gem: 'South Sea Pearls',
    previewSvg: createNecklaceSvg('#CBD5E1', '#F8FAFC', 'pearl_strand'),
    svgDataUri: createNecklaceSvg('#CBD5E1', '#F8FAFC', 'pearl_strand')
  },
  {
    id: 'necklace-gold-choker',
    type: 'necklace',
    name: 'Sleek Lumina Choker',
    category: 'Necklaces',
    metal: '18K Yellow Gold',
    gem: 'Solitaire Ruby',
    previewSvg: createNecklaceSvg('#F59E0B', '#EF4444', 'choker'),
    svgDataUri: createNecklaceSvg('#F59E0B', '#EF4444', 'choker')
  },
  {
    id: 'necklace-emerald-solitaire',
    type: 'necklace',
    name: 'Dynasty Emerald Solitaire',
    category: 'Necklaces',
    metal: '18K Yellow Gold',
    gem: 'Emerald Cut',
    previewSvg: createNecklaceSvg('#EAB308', '#059669', 'emerald_solitaire'),
    svgDataUri: createNecklaceSvg('#EAB308', '#059669', 'emerald_solitaire')
  },
  {
    id: 'necklace-cuban-chain',
    type: 'necklace',
    name: 'Bold Sovereign Cuban Link',
    category: 'Necklaces',
    metal: '24K Gold Plate',
    gem: 'Solid Link',
    previewSvg: createNecklaceSvg('#FBBF24', '#B45309', 'gold_chain'),
    svgDataUri: createNecklaceSvg('#FBBF24', '#B45309', 'gold_chain')
  },

  // 3. RINGS (6 sample items)
  {
    id: 'ring-solitaire-diamond',
    type: 'ring',
    name: 'Eternity Solitaire Diamond Ring',
    category: 'Rings',
    metal: 'Platinum',
    gem: 'Round Brilliant Diamond',
    previewSvg: createRingSvg('#E2E8F0', '#38BDF8', 'solitaire'),
    svgDataUri: createRingSvg('#E2E8F0', '#38BDF8', 'solitaire')
  },
  {
    id: 'ring-halo-sapphire',
    type: 'ring',
    name: 'Midnight Halo Sapphire Ring',
    category: 'Rings',
    metal: '18K White Gold',
    gem: 'Cushion Sapphire',
    previewSvg: createRingSvg('#E2E8F0', '#1D4ED8', 'halo'),
    svgDataUri: createRingSvg('#E2E8F0', '#1D4ED8', 'halo')
  },
  {
    id: 'ring-emerald-cut',
    type: 'ring',
    name: 'Imperial Emerald Cut Ring',
    category: 'Rings',
    metal: '18K Yellow Gold',
    gem: 'Zambian Emerald',
    previewSvg: createRingSvg('#F59E0B', '#059669', 'emerald_cut'),
    svgDataUri: createRingSvg('#F59E0B', '#059669', 'emerald_cut')
  },
  {
    id: 'ring-trilogy-diamond',
    type: 'ring',
    name: 'Past Present Future Trilogy',
    category: 'Rings',
    metal: '18K White Gold',
    gem: 'Triple Diamond',
    previewSvg: createRingSvg('#E2E8F0', '#93C5FD', 'trilogy'),
    svgDataUri: createRingSvg('#E2E8F0', '#93C5FD', 'trilogy')
  },
  {
    id: 'ring-gold-band',
    type: 'ring',
    name: 'Heritage Beveled Wedding Band',
    category: 'Rings',
    metal: '18K Yellow Gold',
    gem: 'Satin Finish',
    previewSvg: createRingSvg('#F59E0B', '#B45309', 'band'),
    svgDataUri: createRingSvg('#F59E0B', '#B45309', 'band')
  },
  {
    id: 'ring-ruby-vintage',
    type: 'ring',
    name: 'Art Deco Pigeon Blood Ruby',
    category: 'Rings',
    metal: 'Rose Gold',
    gem: 'Burmese Ruby',
    previewSvg: createRingSvg('#FB7185', '#E11D48', 'ruby_vintage'),
    svgDataUri: createRingSvg('#FB7185', '#E11D48', 'ruby_vintage')
  },

  // 4. BRACELETS (6 sample items)
  {
    id: 'bracelet-diamond-tennis',
    type: 'bracelet',
    name: 'Signature Diamond Tennis Bracelet',
    category: 'Bracelets',
    metal: 'Platinum',
    gem: 'Round Diamonds (5ctw)',
    previewSvg: createBraceletSvg('#E2E8F0', '#38BDF8', 'tennis'),
    svgDataUri: createBraceletSvg('#E2E8F0', '#38BDF8', 'tennis')
  },
  {
    id: 'bracelet-gold-cuff',
    type: 'bracelet',
    name: 'Atelier Sculptural Gold Cuff',
    category: 'Bracelets',
    metal: '18K Yellow Gold',
    gem: 'Polished Mirror Finish',
    previewSvg: createBraceletSvg('#F59E0B', '#D97706', 'cuff'),
    svgDataUri: createBraceletSvg('#F59E0B', '#D97706', 'cuff')
  },
  {
    id: 'bracelet-celestial-charm',
    type: 'bracelet',
    name: 'Celestial Fortune Charm Bracelet',
    category: 'Bracelets',
    metal: '18K White Gold',
    gem: 'Sapphire & Topaz',
    previewSvg: createBraceletSvg('#E2E8F0', '#3B82F6', 'charm'),
    svgDataUri: createBraceletSvg('#E2E8F0', '#3B82F6', 'charm')
  },
  {
    id: 'bracelet-emerald-bangle',
    type: 'bracelet',
    name: 'Verdant Gemstone Hinged Cuff',
    category: 'Bracelets',
    metal: '18K Yellow Gold',
    gem: 'Baguette Emeralds',
    previewSvg: createBraceletSvg('#F59E0B', '#10B981', 'gem_cuff'),
    svgDataUri: createBraceletSvg('#F59E0B', '#10B981', 'gem_cuff')
  },
  {
    id: 'bracelet-stack-bangle',
    type: 'bracelet',
    name: 'Minimalist Stacking Bangles',
    category: 'Bracelets',
    metal: 'Rose & White Gold',
    gem: 'Dual Finish',
    previewSvg: createBraceletSvg('#FDA4AF', '#E2E8F0', 'bangle'),
    svgDataUri: createBraceletSvg('#FDA4AF', '#E2E8F0', 'bangle')
  },
  {
    id: 'bracelet-cuban-link',
    type: 'bracelet',
    name: 'Sovereign Curb Chain Bracelet',
    category: 'Bracelets',
    metal: '18K Yellow Gold',
    gem: 'Heavy Gauge Links',
    previewSvg: createBraceletSvg('#FBBF24', '#B45309', 'chain'),
    svgDataUri: createBraceletSvg('#FBBF24', '#B45309', 'chain')
  }
];
