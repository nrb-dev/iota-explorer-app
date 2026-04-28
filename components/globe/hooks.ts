'use client';

import { useRef, useState, useCallback, useMemo, useEffect } from 'react';
import useSWR from 'swr';
import type { GlobeMethods } from 'react-globe.gl';
import type { Light, MeshPhongMaterial, Object3D, PointsMaterial } from 'three';
import type {
  GeoValidator,
  Validator,
  ValidatorApiResponse,
  ZoomBand,
} from './types';
import { useNetworkStore, withNetworkParam } from '@/lib/network-store';

/**
 * Validator data is per-epoch (~24h on IOTA), so a 5-minute refresh is
 * already overkill but keeps the dashboard feeling alive without hammering
 * the upstream RPC. SWR also revalidates on focus and reconnect.
 */
const REFRESH_INTERVAL_MS = 5 * 60_000;

const EMPTY: Validator[] = [];

const fetcher = async (url: string): Promise<ValidatorApiResponse> => {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}`);
  }
  return res.json();
};

/* ── Fetch + auto-refresh validators ── */
export function useValidators() {
  const network = useNetworkStore((state) => state.network);
  const { data, error, isLoading } = useSWR<ValidatorApiResponse, Error>(
    withNetworkParam('/api/validators', network),
    fetcher,
    {
      refreshInterval: REFRESH_INTERVAL_MS,
      revalidateOnFocus: true,
      revalidateOnReconnect: true,
      // Treat 429 as transient — back off rather than dropping the data.
      shouldRetryOnError: (err) => !err.message.includes('429'),
      errorRetryInterval: 30_000,
      keepPreviousData: true,
    }
  );

  return {
    network: data?.network ?? network,
    validators: data?.validators ?? EMPTY,
    epoch: data?.epoch ?? '0',
    totalStake: data?.totalStake ?? '0',
    referenceGasPrice: data?.referenceGasPrice ?? '0',
    isLoading: isLoading && !data,
    error: error ?? null,
  };
}

/* ── ResizeObserver wrapper ── */
export function useResponsiveDimensions(
  ref: React.RefObject<HTMLElement | null>,
  maxHeight: number
) {
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const apply = (width: number) => {
      setDimensions({ width, height: Math.min(width, maxHeight) });
    };

    apply(el.offsetWidth);
    const ro = new ResizeObserver((entries) => {
      const width = entries[0]?.contentRect.width ?? el.offsetWidth;
      apply(width);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref, maxHeight]);

  return dimensions;
}

/* ── Zoom band hysteresis ── */
export function useZoomBand(
  enterCloseAltitude: number,
  leaveCloseAltitude: number
) {
  const [band, setBand] = useState<ZoomBand>('far');
  const bandRef = useRef<ZoomBand>('far');

  const onZoom = useCallback(
    (pov: { altitude: number }) => {
      const current = bandRef.current;
      let next = current;
      if (current === 'far' && pov.altitude < enterCloseAltitude)
        next = 'close';
      else if (current === 'close' && pov.altitude > leaveCloseAltitude)
        next = 'far';
      if (next !== current) {
        bandRef.current = next;
        setBand(next);
      }
    },
    [enterCloseAltitude, leaveCloseAltitude]
  );

  return { band, onZoom };
}

/* ── Stable validator key for dependency tracking ──
   Avoids rebuilding labels when polling returns identical data. */
export function useValidatorsKey(validators: GeoValidator[]): string {
  return useMemo(
    () =>
      validators
        .map((v) => `${v.name}@${v.lat.toFixed(3)},${v.lng.toFixed(3)}`)
        .join('|'),
    [validators]
  );
}

/* ── Three.js scene setup (lights + stars + theme) ── */
export function useGlobeScene(
  globeRef: React.RefObject<GlobeMethods | undefined>,
  ready: boolean,
  isDark: boolean
) {
  // Persist star material across theme changes — only opacity adjusts.
  const starMatRef = useRef<PointsMaterial | null>(null);

  useEffect(() => {
    if (!globeRef.current || !ready) return;

    const globe = globeRef.current;
    const controls = globe.controls() as {
      autoRotate: boolean;
      autoRotateSpeed: number;
    };
    controls.autoRotate = true;
    controls.autoRotateSpeed = 0.45;

    let cancelled = false;

    import('three').then((THREE) => {
      if (cancelled) return;
      const scene = globe.scene();

      // Lights rebuild on every theme change; stars persist.
      const isLight = (o: Object3D): o is Light =>
        (o as Light).isLight === true;
      scene.children.filter(isLight).forEach((l) => scene.remove(l));

      if (isDark) {
        scene.add(new THREE.AmbientLight(0x0d0022, 2.0));
        const key = new THREE.DirectionalLight(0xaa55ff, 3.5);
        key.position.set(-2, 1.2, 2);
        scene.add(key);
        const rim = new THREE.DirectionalLight(0xbc8aff, 1.8);
        rim.position.set(2, -1, -1);
        scene.add(rim);
      } else {
        scene.add(new THREE.AmbientLight(0xffffff, 3));
        const key = new THREE.DirectionalLight(0xdcc8ff, 4);
        key.position.set(-2, 1.2, 2);
        scene.add(key);
        const rim = new THREE.DirectionalLight(0xffffff, 2.2);
        rim.position.set(2, -1, -1);
        scene.add(rim);
      }

      // Stars created once, opacity adjusted on theme change.
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
        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        const mat = new THREE.PointsMaterial({
          color: 0xb325d6,
          size: 5,
          transparent: true,
          opacity: isDark ? 0.6 : 1,
          sizeAttenuation: true,
        });
        starMatRef.current = mat;
        scene.add(new THREE.Points(geo, mat));
      } else {
        starMatRef.current.opacity = isDark ? 0.6 : 1;
      }

      const globeMat = (
        globe as { globeMaterial?: () => MeshPhongMaterial }
      ).globeMaterial?.();
      if (globeMat) {
        globeMat.shininess = isDark ? 30 : 10;
        globeMat.specular = new THREE.Color(isDark ? 0x222222 : 0x111111);
        globeMat.needsUpdate = true;
      }
    });

    return () => {
      cancelled = true;
    };
  }, [globeRef, ready, isDark]);
}
