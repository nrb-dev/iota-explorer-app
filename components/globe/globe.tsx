'use client';

import dynamic from 'next/dynamic';
import Image from 'next/image';
import { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import { useTheme } from 'next-themes';
import type { GlobeMethods } from 'react-globe.gl';
import { cn } from '@/lib/utils';
import { useVisualPreferencesStore } from '@/lib/visual-preferences-store';
import type { ArcDatum, GeoValidator, LabelDatum, Validator } from './types';
import { hasGeo } from './types';
import { groupByRegion, groupByCountry } from './grouping';
import { createRegionLabel, createCountryLabel } from './labels';
import { useResponsiveDimensions, useZoomBand, useGlobeScene } from './hooks';

const GlobeGl = dynamic(() => import('react-globe.gl'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex items-center justify-center min-h-[500px]">
      <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-[#b325d6]" />
    </div>
  ),
});

const MAX_GLOBE_HEIGHT = 800;
const DESKTOP_MAX_NEON_COMETS = 12;
const MOBILE_MAX_NEON_COMETS = 7;
const CLOSE_ENTER_ALTITUDE = 1.4;
const CLOSE_LEAVE_ALTITUDE = 1.6;
const EMPTY_VALIDATORS: Validator[] = [];

const getLat = (d: LabelDatum) => d.lat;
const getLng = (d: LabelDatum) => d.lng;
const getElement = (d: LabelDatum) => d.element;
const getArcStartLat = (d: ArcDatum) => d.startLat;
const getArcStartLng = (d: ArcDatum) => d.startLng;
const getArcEndLat = (d: ArcDatum) => d.endLat;
const getArcEndLng = (d: ArcDatum) => d.endLng;
const getArcAltitude = (d: ArcDatum) => d.altitude;
const getArcStroke = (d: ArcDatum) => d.stroke;
const getArcDashLength = (d: ArcDatum) => d.dashLength;
const getArcDashGap = (d: ArcDatum) => d.dashGap;
const getArcColor = (d: ArcDatum) => d.color;
const getArcDashInitialGap = (d: ArcDatum) => d.dashInitialGap;
const getArcDashAnimateTime = (d: ArcDatum) => d.dashAnimateTime;
const getArcLabel = (d: ArcDatum) => d.label;

function jitterCoordinate(value: number, index: number, axis: 'lat' | 'lng') {
  const wave = Math.sin((index + 1) * (axis === 'lat' ? 1.91 : 2.37));
  const offset = wave * 0.08;
  return axis === 'lat'
    ? Math.max(-85, Math.min(85, value + offset))
    : value + offset;
}

function geoDistance(from: GeoValidator, to: GeoValidator) {
  const lat = Math.abs(from.lat - to.lat);
  const lng = Math.abs(from.lng - to.lng);
  return lat + Math.min(lng, 360 - lng) * 0.6;
}

function validatorKey(validator: GeoValidator) {
  return (
    validator.iotaAddress ||
    `${validator.name}-${validator.lat}-${validator.lng}`
  );
}

function mixChannel(from: number, to: number, amount: number) {
  return Math.round(from * (1 - amount) + to * amount);
}

function createCometColor(
  isDark: boolean,
  part: 'glow' | 'tail' | 'core' | 'head'
) {
  return (t: number) => {
    const violet = isDark ? [170, 84, 255] : [126, 44, 178];
    const pink = isDark ? [255, 72, 211] : [220, 42, 171];
    const hot = isDark ? [255, 214, 249] : [255, 150, 225];
    const mix = Math.min(1, Math.max(0, t));
    const heat = Math.max(0, (mix - 0.68) / 0.32);
    const base = violet.map((channel, i) => mixChannel(channel, pink[i], mix));
    const color = base.map((channel, i) => mixChannel(channel, hot[i], heat));
    const alphaByPart = {
      glow: isDark ? 0.2 : 0.12,
      tail: isDark ? 0.42 : 0.3,
      core: isDark ? 0.68 : 0.48,
      head: isDark ? 1 : 0.86,
    };
    const fade = part === 'head' ? Math.pow(mix, 3.2) : Math.pow(mix, 2);
    const alpha = 0.01 + fade * alphaByPart[part];

    return `rgba(${color[0]}, ${color[1]}, ${color[2]}, ${alpha})`;
  };
}

function buildValidatorComet(
  from: GeoValidator,
  to: GeoValidator,
  index: number,
  isDark: boolean
): ArcDatum[] {
  const distance = geoDistance(from, to);
  const pulse = (index % 7) / 7;
  const id = `${validatorKey(from)}-${validatorKey(to)}-${index}`;
  const label = `${from.name} → ${to.name}`;
  const startLat = jitterCoordinate(from.lat, index, 'lat');
  const startLng = jitterCoordinate(from.lng, index, 'lng');
  const endLat = jitterCoordinate(to.lat, index + 11, 'lat');
  const endLng = jitterCoordinate(to.lng, index + 11, 'lng');
  const altitude = Math.min(0.54, 0.13 + distance / 310);
  const dashInitialGap = index * 0.19;
  const dashAnimateTime = 3400 + (index % 5) * 420;
  const tailLength = 0.28 + pulse * 0.05;
  const cometCycle = 0.96 + pulse * 0.08;
  const headLength = 0.042 + pulse * 0.014;
  const headOffset = Math.max(0, tailLength - headLength);

  return [
    {
      id: `${id}-glow`,
      label,
      startLat,
      startLng,
      endLat,
      endLng,
      altitude: altitude - 0.004,
      stroke: 2.2 + pulse * 0.35,
      dashLength: tailLength,
      dashGap: cometCycle - tailLength,
      dashInitialGap,
      dashAnimateTime,
      color: createCometColor(isDark, 'glow'),
    },
    {
      id: `${id}-tail`,
      label,
      startLat,
      startLng,
      endLat,
      endLng,
      altitude,
      stroke: 0.54 + pulse * 0.1,
      dashLength: tailLength,
      dashGap: cometCycle - tailLength,
      dashInitialGap,
      dashAnimateTime,
      color: createCometColor(isDark, 'tail'),
    },
    {
      id: `${id}-core`,
      label,
      startLat,
      startLng,
      endLat,
      endLng,
      altitude: altitude + 0.003,
      stroke: 0.34 + pulse * 0.08,
      dashLength: tailLength * 0.62,
      dashGap: cometCycle - tailLength * 0.62,
      dashInitialGap: dashInitialGap + tailLength * 0.18,
      dashAnimateTime,
      color: createCometColor(isDark, 'core'),
    },
    {
      id: `${id}-head`,
      label,
      startLat,
      startLng,
      endLat,
      endLng,
      altitude: altitude + 0.008,
      stroke: 0,
      dashLength: headLength,
      dashGap: cometCycle - headLength,
      dashInitialGap: dashInitialGap + headOffset,
      dashAnimateTime,
      color: createCometColor(isDark, 'head'),
    },
  ];
}

function buildValidatorArcs(
  validators: GeoValidator[],
  isDark: boolean,
  maxComets: number
): ArcDatum[] {
  const nodes = [...validators].sort((a, b) => {
    const country = a.country.localeCompare(b.country);
    if (country !== 0) return country;
    return a.name.localeCompare(b.name);
  });

  if (nodes.length < 2) return [];

  const cometBudget = Math.min(maxComets, nodes.length);
  const sampleStep = Math.max(1, Math.floor(nodes.length / cometBudget));
  const targetOffset = Math.max(2, Math.floor(nodes.length / 3));
  const arcs: ArcDatum[] = [];
  const seen = new Set<string>();

  for (
    let i = 0;
    i < nodes.length && arcs.length < cometBudget * 4;
    i += sampleStep
  ) {
    const from = nodes[i];
    const to = nodes[(i + targetOffset + (arcs.length % 5)) % nodes.length];
    if (from === to) continue;

    const key = [validatorKey(from), validatorKey(to)].sort().join(':');
    if (seen.has(key)) continue;
    seen.add(key);
    arcs.push(...buildValidatorComet(from, to, arcs.length / 4, isDark));
  }

  return arcs;
}

function canUseWebgl(): boolean {
  try {
    const canvas = document.createElement('canvas');
    return Boolean(
      canvas.getContext('webgl2') ||
      canvas.getContext('webgl') ||
      canvas.getContext('experimental-webgl')
    );
  } catch {
    return false;
  }
}

type GlobeProps = {
  className?: string;
  validators?: Validator[];
  isLoading?: boolean;
  error?: Error | null;
};

export function Globe({
  className,
  validators = EMPTY_VALIDATORS,
  isLoading = false,
  error = null,
}: GlobeProps) {
  const globeRef = useRef<GlobeMethods | undefined>(undefined);
  const containerRef = useRef<HTMLDivElement>(null);
  const prevElementsRef = useRef<HTMLElement[]>([]);
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';
  const globeArcsEnabled = useVisualPreferencesStore(
    (state) => state.globeArcsEnabled
  );

  const dimensions = useResponsiveDimensions(containerRef, MAX_GLOBE_HEIGHT);
  const { band: zoomBand, onZoom } = useZoomBand(
    CLOSE_ENTER_ALTITUDE,
    CLOSE_LEAVE_ALTITUDE
  );

  const [globeReady, setGlobeReady] = useState(false);
  const [webglAvailable, setWebglAvailable] = useState<boolean | null>(null);
  const onGlobeReady = useCallback(() => setGlobeReady(true), []);

  useGlobeScene(globeRef, globeReady, isDark);

  useEffect(() => {
    // WebGL must be detected after mount; keep the 3D renderer unmounted until then.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setWebglAvailable(canUseWebgl());
  }, []);

  const geoValidators = useMemo(() => validators.filter(hasGeo), [validators]);

  const [regionData, setRegionData] = useState<LabelDatum[]>([]);
  const [countryData, setCountryData] = useState<LabelDatum[]>([]);
  const regionGroups = useMemo(
    () => groupByRegion(geoValidators),
    [geoValidators]
  );
  const countryGroups = useMemo(
    () => groupByCountry(geoValidators),
    [geoValidators]
  );
  const arcData = useMemo(() => {
    if (!globeArcsEnabled) return [];
    const maxComets =
      dimensions.width > 0 && dimensions.width < 640
        ? MOBILE_MAX_NEON_COMETS
        : DESKTOP_MAX_NEON_COMETS;
    return buildValidatorArcs(geoValidators, isDark, maxComets);
  }, [dimensions.width, geoValidators, globeArcsEnabled, isDark]);

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    // Clean up old DOM nodes to prevent memory leaks
    prevElementsRef.current.forEach((el) => el.remove());
    prevElementsRef.current = [];

    if (geoValidators.length === 0) {
      setRegionData([]);
      setCountryData([]);
      return;
    }

    const newRegion = regionGroups.map((g) => ({
      id: `region-${g.region}`,
      lat: g.lat,
      lng: g.lng,
      element: createRegionLabel(g),
    }));

    const newCountry = countryGroups.map((g) => ({
      id: `country-${g.country}`,
      lat: g.lat,
      lng: g.lng,
      element: createCountryLabel(g),
    }));

    // Track all created elements for cleanup on next rebuild / unmount
    prevElementsRef.current = [
      ...newRegion.map((d) => d.element),
      ...newCountry.map((d) => d.element),
    ];

    setRegionData(newRegion);
    setCountryData(newCountry);

    return () => {
      // Cleanup on unmount
      prevElementsRef.current.forEach((el) => el.remove());
      prevElementsRef.current = [];
    };
  }, [geoValidators.length, regionGroups, countryGroups]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const activeData = useMemo(
    () => (zoomBand === 'close' ? countryData : regionData),
    [zoomBand, countryData, regionData]
  );

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
          z-index: 1;
        }
        .globe-hover-label:hover,
        .globe-hover-label:focus-within {
          z-index: 100 !important;
        }
        .globe-hover-list {
          opacity: 0;
          transform: translate(-50%, -4px) scale(0.95);
          transform-origin: top center;
          pointer-events: none;
          transition:
            opacity 180ms ease,
            transform 180ms ease;
          z-index: 10;
        }
        .globe-hover-label:hover .globe-hover-list,
        .globe-hover-label:focus-within .globe-hover-list {
          opacity: 1;
          transform: translate(-50%, 0) scale(1);
          pointer-events: auto;
        }
        .globe-hover-label:hover .globe-hover-badge,
        .globe-hover-label:focus-within .globe-hover-badge {
          border-color: rgba(223, 142, 255, 0.85);
          box-shadow:
            0 0 14px rgba(179, 37, 214, 0.5),
            inset 0 0 6px rgba(223, 142, 255, 0.1);
        }

        .globe-hover-list::-webkit-scrollbar {
          width: 4px;
        }
        .globe-hover-list::-webkit-scrollbar-track {
          background: transparent;
        }
        .globe-hover-list::-webkit-scrollbar-thumb {
          background: rgba(179, 37, 214, 0.4);
          border-radius: 2px;
        }
      `}</style>

      <div
        ref={containerRef}
        className={cn(
          'relative w-full overflow-visible min-h-[500px] flex items-center justify-center',
          className
        )}
        style={{
          maskImage: 'linear-gradient(to bottom, black 75%, transparent 100%)',
          WebkitMaskImage:
            'linear-gradient(to bottom, black 75%, transparent 100%)',
        }}
      >
        {isLoading && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-4 bg-black/20 backdrop-blur-sm rounded-3xl">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#b325d6]" />
            <p className="text-[#e8c8ff] text-sm font-semibold tracking-wider uppercase">
              Syncing with IOTA Network...
            </p>
          </div>
        )}

        {error && !isLoading && validators.length === 0 && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 bg-black/20 backdrop-blur-sm rounded-3xl">
            <p className="text-[#e8c8ff] text-sm font-semibold tracking-wider uppercase">
              Network sync failed
            </p>
            <p className="text-[#a87fc4] text-xs">Retrying automatically...</p>
          </div>
        )}

        {webglAvailable === false && (
          <div className="relative flex min-h-[500px] w-full items-center justify-center overflow-hidden">
            <Image
              src={isDark ? '/globeDark.png' : '/globeLight.png'}
              alt="IOTA validator globe"
              width={900}
              height={900}
              priority
              className="h-auto w-full max-w-[720px] opacity-80"
            />
            <div className="absolute bottom-16 left-1/2 max-w-sm -translate-x-1/2 rounded-lg border bg-background/80 px-4 py-3 text-center text-sm text-muted-foreground backdrop-blur">
              3D globe is unavailable because WebGL is disabled in this browser.
              Validator data is still available below.
            </div>
          </div>
        )}

        {dimensions.width > 0 && webglAvailable === true && (
          <GlobeGl
            ref={globeRef}
            onGlobeReady={onGlobeReady}
            onZoom={onZoom}
            width={dimensions.width}
            height={dimensions.height}
            backgroundColor="rgba(0,0,0,0)"
            globeImageUrl={isDark ? '/globeDark.png' : '/globeLight.png'}
            arcsData={arcData}
            arcStartLat={getArcStartLat as (d: object) => number}
            arcStartLng={getArcStartLng as (d: object) => number}
            arcEndLat={getArcEndLat as (d: object) => number}
            arcEndLng={getArcEndLng as (d: object) => number}
            arcColor={getArcColor as (d: object) => (t: number) => string}
            arcAltitude={getArcAltitude as (d: object) => number}
            arcStroke={getArcStroke as (d: object) => number}
            arcCurveResolution={56}
            arcCircularResolution={8}
            arcDashLength={getArcDashLength as (d: object) => number}
            arcDashGap={getArcDashGap as (d: object) => number}
            arcDashInitialGap={getArcDashInitialGap as (d: object) => number}
            arcDashAnimateTime={getArcDashAnimateTime as (d: object) => number}
            arcsTransitionDuration={700}
            arcLabel={getArcLabel as (d: object) => string}
            htmlElementsData={activeData}
            htmlLat={getLat as (d: object) => number}
            htmlLng={getLng as (d: object) => number}
            htmlAltitude={0.02}
            htmlElement={getElement as (d: object) => HTMLElement}
            atmosphereColor={isDark ? '#9944ee' : '#CC55FB'}
            atmosphereAltitude={isDark ? 0.28 : 0.2}
          />
        )}
      </div>
    </>
  );
}
