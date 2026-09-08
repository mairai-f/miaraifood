import React, { useEffect, useRef, useState } from 'react';

export interface MapPoint {
  lat: number;
  lng: number;
  label: string;
  type: 'courier' | 'store' | 'customer';
}

export interface RealLeafletMapProps {
  origin: MapPoint;
  destination: MapPoint;
  driverPos?: { lat: number; lng: number };
  token?: string;
  className?: string;
}

declare global {
  interface Window {
    L: any;
  }
}

export function RealLeafletMap({ origin, destination, driverPos, className = "h-full w-full" }: RealLeafletMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const driverMarkerRef = useRef<any>(null);
  const polylineRef = useRef<any>(null);
  const [leafletLoaded, setLeafletLoaded] = useState(Boolean(window.L));

  // Dynamically load Leaflet JS & CSS if not already present
  useEffect(() => {
    if (window.L) {
      setLeafletLoaded(true);
      return;
    }

    const cssId = 'leaflet-css-cdn';
    if (!document.getElementById(cssId)) {
      const link = document.createElement('link');
      link.id = cssId;
      link.rel = 'stylesheet';
      link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
      document.head.appendChild(link);
    }

    const jsId = 'leaflet-js-cdn';
    if (!document.getElementById(jsId)) {
      const script = document.createElement('script');
      script.id = jsId;
      script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
      script.onload = () => setLeafletLoaded(true);
      document.body.appendChild(script);
    } else {
      const interval = setInterval(() => {
        if (window.L) {
          setLeafletLoaded(true);
          clearInterval(interval);
        }
      }, 200);
      return () => clearInterval(interval);
    }
  }, []);

  // Initialize Leaflet Map once loaded
  useEffect(() => {
    if (!leafletLoaded || !containerRef.current || mapRef.current) return;

    const L = window.L;
    const map = L.map(containerRef.current, { zoomControl: false, attributionControl: false }).setView(
      [origin.lat, origin.lng],
      14
    );

    // CartoDB Voyager Tile Layer (Visually stunning, high-res real street map)
    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
      maxZoom: 19,
      subdomains: 'abcd',
    }).addTo(map);

    mapRef.current = map;

    // Helper for HTML DivIcons
    const createCustomIcon = (type: 'courier' | 'store' | 'customer', label: string) => {
      const iconSvg = type === 'courier' ? '🛵' : type === 'store' ? '🏪' : '🏠';

      return L.divIcon({
        className: 'custom-leaflet-marker',
        html: `
          <div style="display:flex; flex-direction:column; align-items:center; transform: translate(-50%, -100%);">
            <div style="background-color:${type === 'courier' ? '#f97316' : type === 'store' ? '#f59e0b' : '#10b981'}; color:#0f172a; padding:6px 10px; border-radius:12px; font-weight:800; font-size:12px; box-shadow:0 10px 15px -3px rgba(0,0,0,0.5); display:flex; align-items:center; gap:4px; border:2px solid #ffffff;">
              <span>${iconSvg}</span>
              <span style="white-space:nowrap;">${label}</span>
            </div>
            <div style="width:0; height:0; border-left:6px solid transparent; border-right:6px solid transparent; border-top:8px solid ${type === 'courier' ? '#f97316' : type === 'store' ? '#f59e0b' : '#10b981'};"></div>
          </div>
        `,
        iconSize: [0, 0],
      });
    };

    // Add Origin Marker
    L.marker([origin.lat, origin.lng], { icon: createCustomIcon(origin.type, origin.label) }).addTo(map);

    // Add Destination Marker
    L.marker([destination.lat, destination.lng], { icon: createCustomIcon(destination.type, destination.label) }).addTo(map);

    // Add Driver Marker if present
    const driverPoint = driverPos ?? { lat: origin.lat, lng: origin.lng };
    const driverMarker = L.marker([driverPoint.lat, driverPoint.lng], {
      icon: createCustomIcon('courier', 'Motoboy'),
    }).addTo(map);
    driverMarkerRef.current = driverMarker;

    const route = L.polyline([[origin.lat, origin.lng], [destination.lat, destination.lng]], {
      color: '#f97316', weight: 4, opacity: 0.8, dashArray: '8, 8',
    }).addTo(map);
    polylineRef.current = route;
    map.fitBounds(route.getBounds(), { padding: [40, 40] });

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, [leafletLoaded, origin.lat, origin.lng, destination.lat, destination.lng]);

  // Update Driver Marker on Live Location GPS event
  useEffect(() => {
    if (driverPos && driverMarkerRef.current && window.L) {
      driverMarkerRef.current.setLatLng([driverPos.lat, driverPos.lng]);
    }
  }, [driverPos?.lat, driverPos?.lng]);

  return (
    <div className={`relative overflow-hidden rounded-2xl ${className}`}>
      {!leafletLoaded && (
        <div className="flex h-full w-full items-center justify-center bg-slate-900 text-xs font-semibold text-slate-400">
          Carregando Mapa Real (OpenStreetMap)...
        </div>
      )}
      <div ref={containerRef} className="h-full w-full z-0" />
    </div>
  );
}
