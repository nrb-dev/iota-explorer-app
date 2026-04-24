'use client';

import dynamic from 'next/dynamic';
import { useEffect, useState, useRef, useCallback } from 'react';
import { useTheme } from 'next-themes';
import type { GlobeMethods } from 'react-globe.gl';
import { cn } from '@/lib/utils';

const GlobeGl = dynamic(() => import('react-globe.gl'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex items-center justify-center min-h-[500px]">
      <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary" />
    </div>
  ),
});

type Region =
  | 'Europe'
  | 'Asia'
  | 'North America'
  | 'South America'
  | 'Africa'
  | 'Oceania';

type Country = {
  name: string;
  region: Region;
  lat: number;
  lng: number;
};

const COUNTRIES: Country[] = [
  { name: 'Poland', region: 'Europe', lat: 51.9194, lng: 19.1451 },
  { name: 'United Kingdom', region: 'Europe', lat: 55.3781, lng: -3.436 },
  { name: 'South Korea', region: 'Asia', lat: 35.9078, lng: 127.7669 },
  {
    name: 'United States',
    region: 'North America',
    lat: 37.0902,
    lng: -95.7129,
  },
];

const MAX_GLOBE_HEIGHT = 600;
const CLOSE_ENTER_ALTITUDE = 1.4;
const CLOSE_LEAVE_ALTITUDE = 1.6;

type LabelDatum = {
  id: string;
  lat: number;
  lng: number;
  element: HTMLElement;
};

const getLat = (d: object) => (d as LabelDatum).lat;
const getLng = (d: object) => (d as LabelDatum).lng;
const getElement = (d: object) => (d as LabelDatum).element;

/* ── Geometry helpers ── */
function computeCentroid(points: Array<{ lat: number; lng: number }>) {
  let x = 0,
    y = 0,
    z = 0;
  for (const p of points) {
    const latRad = (p.lat * Math.PI) / 180;
    const lngRad = (p.lng * Math.PI) / 180;
    x += Math.cos(latRad) * Math.cos(lngRad);
    y += Math.cos(latRad) * Math.sin(lngRad);
    z += Math.sin(latRad);
  }
  const n = points.length;
  x /= n;
  y /= n;
  z /= n;
  const lng = Math.atan2(y, x);
  const lat = Math.atan2(z, Math.sqrt(x * x + y * y));
  return { lat: (lat * 180) / Math.PI, lng: (lng * 180) / Math.PI };
}

function groupByRegion(countries: Country[]) {
  const map = new Map<Region, Country[]>();
  for (const c of countries) {
    const list = map.get(c.region) ?? [];
    list.push(c);
    map.set(c.region, list);
  }
  return Array.from(map.entries()).map(([region, list]) => {
    const { lat, lng } = computeCentroid(list);
    return { region, lat, lng, countries: list.map((c) => c.name).sort() };
  });
}

function createPulsingDot(): HTMLElement {
  const dotWrap = document.createElement('div');
  dotWrap.style.cssText = `position: relative; width: 6px; height: 6px; flex-shrink: 0;`;
  const pulse = document.createElement('span');
  pulse.className = 'globe-label-pulse';
  pulse.style.cssText = `position: absolute; inset: -3px; border-radius: 50%; background: rgba(179, 37, 214, 0.35);`;
  const dot = document.createElement('span');
  dot.style.cssText = `position: absolute; inset: 0; border-radius: 50%; background: #df8eff; box-shadow: 0 0 5px #b325d6;`;
  dotWrap.appendChild(pulse);
  dotWrap.appendChild(dot);
  return dotWrap;
}

const BADGE_BASE_CSS = `
  display: flex; align-items: center; gap: 6px; padding: 3px 8px 3px 5px;
  background: rgba(15, 5, 30, 0.75); border: 1px solid rgba(223, 142, 255, 0.5);
  border-radius: 999px; backdrop-filter: blur(6px);
  box-shadow: 0 0 10px rgba(179, 37, 214, 0.3), inset 0 0 6px rgba(223,142,255,0.05);
  white-space: nowrap; transition: border-color 160ms ease, box-shadow 160ms ease;
`;

const LABEL_TEXT_CSS = `
  font-family: 'SF Pro Display', 'Inter', system-ui, sans-serif;
  font-size: 9px; font-weight: 600; letter-spacing: 0.07em;
  text-transform: uppercase; color: #e8c8ff; text-shadow: 0 0 6px rgba(179,37,214,0.8);
`;

function createRegionLabel(region: Region, countries: string[]): HTMLElement {
  const wrapper = document.createElement('div');
  wrapper.className = 'globe-label globe-region-label';
  wrapper.tabIndex = 0;
  wrapper.style.cssText = `position: relative; transform: translate(-50%, -100%); pointer-events: auto; cursor: default; outline: none;`;
  const badge = document.createElement('div');
  badge.className = 'globe-region-badge';
  badge.style.cssText = BADGE_BASE_CSS;
  const label = document.createElement('span');
  label.textContent = region;
  label.style.cssText = LABEL_TEXT_CSS;
  const count = document.createElement('span');
  count.textContent = String(countries.length);
  count.style.cssText = `
    display: inline-flex; align-items: center; justify-content: center;
    min-width: 16px; height: 14px; padding: 0 4px; border-radius: 999px;
    background: rgba(179, 37, 214, 0.55); border: 1px solid rgba(223, 142, 255, 0.45);
    color: #fff; font-family: 'SF Pro Display', 'Inter', system-ui, sans-serif;
    font-size: 9px; font-weight: 700; line-height: 1;
  `;
  badge.appendChild(createPulsingDot());
  badge.appendChild(label);
  badge.appendChild(count);
  const list = document.createElement('div');
  list.className = 'globe-region-list';
  list.style.cssText = `
    position: absolute; top: calc(100% + 6px); left: 50%; display: flex;
    flex-direction: column; gap: 3px; padding: 6px 10px;
    background: rgba(15, 5, 30, 0.88); border: 1px solid rgba(223, 142, 255, 0.4);
    border-radius: 10px; backdrop-filter: blur(8px);
    box-shadow: 0 4px 16px rgba(0,0,0,0.4), 0 0 12px rgba(179, 37, 214, 0.35); white-space: nowrap;
  `;
  for (const country of countries) {
    const item = document.createElement('div');
    item.textContent = country;
    item.style.cssText = `font-family: 'SF Pro Display', 'Inter', system-ui, sans-serif; font-size: 10px; font-weight: 500; color: #e8c8ff; text-shadow: 0 0 4px rgba(179,37,214,0.6);`;
    list.appendChild(item);
  }
  wrapper.appendChild(badge);
  wrapper.appendChild(list);
  return wrapper;
}

function createCountryLabel(name: string): HTMLElement {
  const wrapper = document.createElement('div');
  wrapper.className = 'globe-label globe-country-label';
  wrapper.style.cssText = `display: flex; flex-direction: column; align-items: center; pointer-events: none; transform: translate(-50%, -100%);`;
  const badge = document.createElement('div');
  badge.style.cssText = BADGE_BASE_CSS;
  const label = document.createElement('span');
  label.textContent = name;
  label.style.cssText = LABEL_TEXT_CSS;
  badge.appendChild(createPulsingDot());
  badge.appendChild(label);
  wrapper.appendChild(badge);
  return wrapper;
}

export function Globe({ className }: { className?: string }) {
  const globeRef = useRef<GlobeMethods | undefined>(undefined);
  const containerRef = useRef<HTMLDivElement>(null);
  const starMatRef = useRef<any>(null);
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';

  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const [globeReady, setGlobeReady] = useState(false);
  const [regionData, setRegionData] = useState<LabelDatum[]>([]);
  const [countryData, setCountryData] = useState<LabelDatum[]>([]);
  const [zoomBand, setZoomBand] = useState<'far' | 'close'>('far');
  const zoomBandRef = useRef<'far' | 'close'>('far');

  useEffect(() => {
    const regions = groupByRegion(COUNTRIES).map((g) => ({
      id: `region-${g.region}`,
      lat: g.lat,
      lng: g.lng,
      element: createRegionLabel(g.region, g.countries),
    }));
    const countries = COUNTRIES.map((c) => ({
      id: `country-${c.name}`,
      lat: c.lat,
      lng: c.lng,
      element: createCountryLabel(c.name),
    }));
    setRegionData(regions);
    setCountryData(countries);
  }, []);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const apply = (width: number) => {
      const height = Math.min(width, MAX_GLOBE_HEIGHT);
      setDimensions({ width, height });
    };
    apply(el.offsetWidth);
    const ro = new ResizeObserver((entries) => {
      const width = entries[0]?.contentRect.width ?? el.offsetWidth;
      apply(width);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  /* ── Dynamic Scene & Lighting Setup ── */
  useEffect(() => {
    if (!globeRef.current || !globeReady) return;

    const globe = globeRef.current;
    const controls: any = globe.controls();
    controls.autoRotate = true;
    controls.autoRotateSpeed = 0.45;

    import('three').then((THREE) => {
      const scene = globe.scene();

      // Reset lights to prevent stacking
      scene.children
        .filter((c: any) => c.isLight)
        .forEach((l: any) => scene.remove(l));

      if (isDark) {
        // DARK MODE LIGHTING
        scene.add(new THREE.AmbientLight(0x0d0022, 2.0));
        const keyLight = new THREE.DirectionalLight(0xaa55ff, 3.5);
        keyLight.position.set(-2, 1.2, 2);
        scene.add(keyLight);
        const rimLight = new THREE.DirectionalLight(0xbc8aff, 1.8);
        rimLight.position.set(2, -1, -1);
        scene.add(rimLight);
      } else {
        // LIGHT MODE LIGHTING
        scene.add(new THREE.AmbientLight(0xffffff, 3));
        const keyLight = new THREE.DirectionalLight(0xdcc8ff, 4);
        keyLight.position.set(-2, 1.2, 2);
        scene.add(keyLight);
        const rimLight = new THREE.DirectionalLight(0xffffff, 2.2);
        rimLight.position.set(2, -1, -1);
        scene.add(rimLight);
      }

      // Stars logic
      if (!starMatRef.current) {
        const starCount = 4000;
        const positions = new Float32Array(starCount * 3);
        for (let i = 0; i < starCount; i++) {
          const theta = Math.random() * Math.PI * 2;
          const phi = Math.acos(2 * Math.random() - 1);
          const r = 800 + Math.random() * 800;
          positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
          positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
          positions[i * 3 + 2] = r * Math.cos(phi);
        }
        const starGeo = new THREE.BufferGeometry();
        starGeo.setAttribute(
          'position',
          new THREE.BufferAttribute(positions, 3)
        );
        const starMat = new THREE.PointsMaterial({
          color: 0xb325d6,
          size: 5,
          transparent: true,
          opacity: isDark ? 0.6 : 1,
          sizeAttenuation: true,
        });
        starMatRef.current = starMat;
        scene.add(new THREE.Points(starGeo, starMat));
      } else {
        starMatRef.current.opacity = isDark ? 0.6 : 1;
      }

      const globeMat: any = (globe as any).globeMaterial?.();
      if (globeMat) {
        globeMat.shininess = isDark ? 30 : 10;
        globeMat.specular = new THREE.Color(isDark ? 0x222222 : 0x111111);
        globeMat.needsUpdate = true;
      }
    });
  }, [globeReady, isDark]);

  const onGlobeReady = useCallback(() => setGlobeReady(true), []);

  const handleZoom = useCallback((pov: { altitude: number }) => {
    const current = zoomBandRef.current;
    let next = current;
    if (current === 'far' && pov.altitude < CLOSE_ENTER_ALTITUDE) {
      next = 'close';
    } else if (current === 'close' && pov.altitude > CLOSE_LEAVE_ALTITUDE) {
      next = 'far';
    }
    if (next !== current) {
      zoomBandRef.current = next;
      setZoomBand(next);
    }
  }, []);

  const activeData = zoomBand === 'close' ? countryData : regionData;

  return (
    <>
      <style jsx global>{`
        @keyframes globe-label-pulse-ring {
          0% {
            transform: scale(0.85);
            opacity: 0.8;
          }
          60% {
            transform: scale(1.7);
            opacity: 0;
          }
          100% {
            transform: scale(0.85);
            opacity: 0;
          }
        }
        .globe-label-pulse {
          animation: globe-label-pulse-ring 1.8s cubic-bezier(0.4, 0, 0.6, 1)
            infinite;
        }
        @keyframes globe-label-fade-in {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }
        .globe-label {
          animation: globe-label-fade-in 220ms ease-out both;
        }
        .globe-region-list {
          opacity: 0;
          transform: translate(-50%, -4px) scale(0.95);
          transform-origin: top center;
          pointer-events: none;
          transition:
            opacity 180ms ease,
            transform 180ms ease;
        }
        .globe-region-label:hover .globe-region-list,
        .globe-region-label:focus-within .globe-region-list {
          opacity: 1;
          transform: translate(-50%, 0) scale(1);
          pointer-events: auto;
        }
      `}</style>

      <div
        ref={containerRef}
        className={cn(
          'relative w-full overflow-visible min-h-[500px]',
          className
        )}
        style={{
          maskImage: 'linear-gradient(to bottom, black 75%, transparent 100%)',
          WebkitMaskImage:
            'linear-gradient(to bottom, black 75%, transparent 100%)',
        }}
      >
        {dimensions.width > 0 && (
          <GlobeGl
            ref={globeRef}
            onGlobeReady={onGlobeReady}
            onZoom={handleZoom}
            width={dimensions.width}
            height={dimensions.height}
            backgroundColor="rgba(0,0,0,0)"
            globeImageUrl={isDark ? './globeDark.png' : './globeLight.png'}
            htmlElementsData={activeData}
            htmlLat={getLat}
            htmlLng={getLng}
            htmlAltitude={0.02}
            htmlElement={getElement}
            atmosphereColor={isDark ? '#9944ee' : '#CC55FB'}
            atmosphereAltitude={isDark ? 0.28 : 0.2}
          />
        )}
      </div>
    </>
  );
}
