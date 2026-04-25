'use client';

import dynamic from 'next/dynamic';
import { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import { useTheme } from 'next-themes';
import type { GlobeMethods } from 'react-globe.gl';
import { cn } from '@/lib/utils';
import type { LabelDatum } from './types';
import { groupByRegion, groupByCountry } from './grouping';
import { createRegionLabel, createCountryLabel } from './labels';
import {
  useValidators,
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

const MAX_GLOBE_HEIGHT = 600;
const CLOSE_ENTER_ALTITUDE = 1.4;
const CLOSE_LEAVE_ALTITUDE = 1.6;

const getLat = (d: LabelDatum) => d.lat;
const getLng = (d: LabelDatum) => d.lng;
const getElement = (d: LabelDatum) => d.element;

export function Globe({ className }: { className?: string }) {
  const globeRef = useRef<GlobeMethods | undefined>(undefined);
  const containerRef = useRef<HTMLDivElement>(null);
  const prevElementsRef = useRef<HTMLElement[]>([]);
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';

  const { validators, isLoading, error } = useValidators();
  const dimensions = useResponsiveDimensions(containerRef, MAX_GLOBE_HEIGHT);
  const { band: zoomBand, onZoom } = useZoomBand(
    CLOSE_ENTER_ALTITUDE,
    CLOSE_LEAVE_ALTITUDE
  );

  const [globeReady, setGlobeReady] = useState(false);
  const onGlobeReady = useCallback(() => setGlobeReady(true), []);

  useGlobeScene(globeRef, globeReady, isDark);

  /* ── Build label datasets only when validator set actually changes ──
     The key gates rebuild work; polling returning identical data is a no-op. */
  const validatorsKey = useValidatorsKey(validators);

  const [regionData, setRegionData] = useState<LabelDatum[]>([]);
  const [countryData, setCountryData] = useState<LabelDatum[]>([]);

  useEffect(() => {
    // Clean up old DOM nodes to prevent memory leaks
    prevElementsRef.current.forEach((el) => el.remove());
    prevElementsRef.current = [];

    if (validators.length === 0) {
      setRegionData([]);
      setCountryData([]);
      return;
    }

    const newRegion = groupByRegion(validators).map((g) => ({
      id: `region-${g.region}`,
      lat: g.lat,
      lng: g.lng,
      element: createRegionLabel(g),
    }));

    const newCountry = groupByCountry(validators).map((g) => ({
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

        {dimensions.width > 0 && (
          <GlobeGl
            ref={globeRef}
            onGlobeReady={onGlobeReady}
            onZoom={onZoom}
            width={dimensions.width}
            height={dimensions.height}
            backgroundColor="rgba(0,0,0,0)"
            globeImageUrl={isDark ? './globeDark.png' : './globeLight.png'}
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
