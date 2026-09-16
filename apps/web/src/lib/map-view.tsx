"use client";

import * as maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { useEffect, useRef } from "react";

export interface MapMarker {
  readonly id: string;
  readonly latitude: number;
  readonly longitude: number;
  readonly label: string;
  readonly tone?: "default" | "risk";
}

export interface MapRoute {
  readonly id: string;
  readonly coordinates: readonly (readonly [number, number])[];
}

const ROUTES_SOURCE_ID = "fieldops-routes";
const ROUTES_LAYER_ID = "fieldops-routes-line";

interface RouteFeatureCollection {
  readonly type: "FeatureCollection";
  readonly features: readonly {
    readonly type: "Feature";
    readonly properties: Record<string, never>;
    readonly geometry: { readonly type: "LineString"; readonly coordinates: readonly (readonly [number, number])[] };
  }[];
}

function toRouteCollection(routes: readonly MapRoute[]): RouteFeatureCollection {
  return {
    features: routes.map((route) => ({
      geometry: { coordinates: route.coordinates, type: "LineString" as const },
      properties: {},
      type: "Feature" as const
    })),
    type: "FeatureCollection"
  };
}

// Estilo público do MapLibre (sem necessidade de chave) usado até
// NEXT_PUBLIC_MAPTILER_KEY ser configurada. Com a chave, troca para o
// estilo real do MapTiler (free tier).
const FALLBACK_STYLE_URL = "https://demotiles.maplibre.org/style.json";

function styleUrl(): string {
  const key = process.env.NEXT_PUBLIC_MAPTILER_KEY;
  return key ? `https://api.maptiler.com/maps/streets-v2/style.json?key=${key}` : FALLBACK_STYLE_URL;
}

export function MapView({
  className,
  markers,
  routes = []
}: {
  className?: string;
  markers: readonly MapMarker[];
  routes?: readonly MapRoute[];
}): React.ReactNode {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | undefined>(undefined);
  const markerInstancesRef = useRef<maplibregl.Marker[]>([]);

  useEffect(() => {
    if (!containerRef.current) {
      return;
    }

    const map = new maplibregl.Map({
      attributionControl: false,
      center: [-46.633308, -23.55052],
      container: containerRef.current,
      style: styleUrl(),
      zoom: 10
    });
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");
    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = undefined;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) {
      return;
    }

    function ensureRoutesLayer(): void {
      if (map!.getSource(ROUTES_SOURCE_ID)) {
        return;
      }

      map!.addSource(ROUTES_SOURCE_ID, { data: toRouteCollection([]), type: "geojson" });
      map!.addLayer({
        id: ROUTES_LAYER_ID,
        paint: { "line-color": "#0E5F4B", "line-dasharray": [2, 2], "line-width": 2 },
        source: ROUTES_SOURCE_ID,
        type: "line"
      });
    }

    function renderMarkersAndRoutes(): void {
      for (const marker of markerInstancesRef.current) {
        marker.remove();
      }
      markerInstancesRef.current = [];

      ensureRoutesLayer();
      const routesSource = map!.getSource(ROUTES_SOURCE_ID) as maplibregl.GeoJSONSource;
      void routesSource.setData(toRouteCollection(routes));

      if (markers.length === 0 || !map) {
        return;
      }

      const bounds = new maplibregl.LngLatBounds();
      for (const item of markers) {
        const element = document.createElement("div");
        element.className =
          item.tone === "risk"
            ? "rounded-full border-2 border-white bg-[#B42318] px-2 py-1 text-xs font-semibold text-white shadow-sm"
            : "rounded-full border-2 border-white bg-[#0E5F4B] px-2 py-1 text-xs font-semibold text-white shadow-sm";
        element.textContent = item.label;

        const marker = new maplibregl.Marker({ element })
          .setLngLat([item.longitude, item.latitude])
          .addTo(map);
        markerInstancesRef.current.push(marker);
        bounds.extend([item.longitude, item.latitude]);
      }

      if (markers.length === 1) {
        map.setCenter([markers[0]!.longitude, markers[0]!.latitude]);
        map.setZoom(13);
      } else {
        map.fitBounds(bounds, { maxZoom: 14, padding: 40 });
      }
    }

    if (map.isStyleLoaded()) {
      renderMarkersAndRoutes();
    } else {
      map.once("load", renderMarkersAndRoutes);
    }
  }, [markers, routes]);

  return <div className={className} ref={containerRef} />;
}
