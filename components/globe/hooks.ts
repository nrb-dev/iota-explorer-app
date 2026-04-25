import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import type { GlobeMethods } from 'react-globe.gl';
import type { Light, MeshPhongMaterial, Object3D, PointsMaterial } from 'three';
import type { Validator, ZoomBand } from './types';

const POLL_INTERVAL_MS = 60_000;

/* ── Fetch + poll validators with visibility-aware pause ── */
export function useValidators() {
  const [validators, setValidators] = useState<Validator[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let mounted = true;
    let intervalId: ReturnType<typeof setInterval> | null = null;

    const fetchValidators = async () => {
      try {
        const res = await fetch('/api/validators');
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data: Validator[] = await res.json();
        if (mounted) {
          setValidators(data);
          setError(null);
          setIsLoading(false);
        }
      } catch (err) {
        console.error('Failed to fetch validators:', err);
        if (mounted) {
          setError(err instanceof Error ? err : new Error('Unknown error'));
          setIsLoading(false);
        }
      }
    };

    const startPolling = () => {
      if (intervalId !== null) return;
      intervalId = setInterval(fetchValidators, POLL_INTERVAL_MS);
    };

    const stopPolling = () => {
      if (intervalId !== null) {
        clearInterval(intervalId);
        intervalId = null;
      }
    };

    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        fetchValidators(); // refresh immediately on focus
        startPolling();
      } else {
        stopPolling();
      }
    };

    fetchValidators();
    startPolling();
    document.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
      mounted = false;
      stopPolling();
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, []);

  return { validators, isLoading, error };
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
export function useValidatorsKey(validators: Validator[]): string {
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
