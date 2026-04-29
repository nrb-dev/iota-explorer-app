'use client';

import dynamic from 'next/dynamic';
import Image from 'next/image';
import { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import { useTheme } from 'next-themes';
import type { GlobeMethods } from 'react-globe.gl';
import { cn } from '@/lib/utils';
import type { LabelDatum, Validator } from './types';
import { hasGeo } from './types';
import { groupByRegion, groupByCountry } from './grouping';
import { createRegionLabel, createCountryLabel } from './labels';
import {
  useResponsiveDimensions,
  useZoomBand,
  useValidatorsKey,
  useGlobeScene,
} from './hooks';

const GlobeGl = dynamic(() => import('react-globe.gl'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex items-center justify-center min-h-[500px]">
      <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-[#b325d6]" />
    </div>
  ),
});

const MAX_GLOBE_HEIGHT = 800;
const CLOSE_ENTER_ALTITUDE = 1.4;
const CLOSE_LEAVE_ALTITUDE = 1.6;
const EMPTY_VALIDATORS: Validator[] = [];

const getLat = (d: LabelDatum) => d.lat;
const getLng = (d: LabelDatum) => d.lng;
const getElement = (d: LabelDatum) => d.element;

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

  /* ── Build label datasets only when validator set actually changes ──
     The key gates rebuild work; polling returning identical data is a no-op. */
  const geoValidators = useMemo(() => validators.filter(hasGeo), [validators]);
  const validatorsKey = useValidatorsKey(geoValidators);

  const [regionData, setRegionData] = useState<LabelDatum[]>([]);
  const [countryData, setCountryData] = useState<LabelDatum[]>([]);

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

    const newRegion = groupByRegion(geoValidators).map((g) => ({
      id: `region-${g.region}`,
      lat: g.lat,
      lng: g.lng,
      element: createRegionLabel(g),
    }));

    const newCountry = groupByCountry(geoValidators).map((g) => ({
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [validatorsKey]);
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
              3D globe is unavailable because WebGL is disabled in this
              browser. Validator data is still available below.
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
