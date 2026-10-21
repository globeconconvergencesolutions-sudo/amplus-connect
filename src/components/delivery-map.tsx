import { useEffect, useId, useRef } from "react";
import type { DeliveryDropPoint } from "@/lib/delivery";
import "leaflet/dist/leaflet.css";

type MapPoint = { lat: number; lng: number };

export function DeliveryMap({
  hq,
  dropPoints,
  pin,
  onPin,
  interactive,
}: {
  hq: MapPoint & { label?: string };
  dropPoints?: DeliveryDropPoint[];
  pin?: MapPoint | null;
  onPin?: (point: MapPoint) => void;
  interactive?: boolean;
}) {
  const id = useId().replace(/:/g, "");
  const elId = `amplus-map-${id}`;
  const mapRef = useRef<import("leaflet").Map | null>(null);
  const pinRef = useRef<import("leaflet").CircleMarker | null>(null);
  const onPinRef = useRef(onPin);
  const hqRef = useRef(hq);
  const pointsRef = useRef(dropPoints);
  const pinStartRef = useRef(pin);
  onPinRef.current = onPin;
  hqRef.current = hq;
  pointsRef.current = dropPoints;
  pinStartRef.current = pin;
  const pointKey = (dropPoints ?? []).map((row) => row.id).join(",");

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const L = await import("leaflet");
      if (cancelled) return;
      const el = document.getElementById(elId);
      if (!el) return;
      const map = L.map(el, { scrollWheelZoom: false, attributionControl: true });
      mapRef.current = map;
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>',
        maxZoom: 19,
      }).addTo(map);

      const yard = hqRef.current;
      L.circleMarker([yard.lat, yard.lng], {
        radius: 8,
        color: "#1f2a37",
        fillColor: "#1f2a37",
        fillOpacity: 1,
      })
        .addTo(map)
        .bindPopup(yard.label ?? "Amplus yard");

      for (const point of pointsRef.current ?? []) {
        L.circleMarker([point.lat, point.lng], {
          radius: 6,
          color: "#c47b14",
          fillColor: "#c47b14",
          fillOpacity: 0.9,
        })
          .addTo(map)
          .bindPopup(`<strong>${point.name}</strong><br/>${point.landmark}`);
      }

      if (onPinRef.current) {
        map.on("click", (event: { latlng: { lat: number; lng: number } }) => {
          onPinRef.current?.({ lat: event.latlng.lat, lng: event.latlng.lng });
        });
      }

      const start = pinStartRef.current ?? yard;
      map.setView([start.lat, start.lng], pinStartRef.current ? 12 : 7);
      map.invalidateSize();
    })();

    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
      pinRef.current = null;
    };
  }, [elId, pointKey, interactive]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !pin) return;
    void import("leaflet").then((L) => {
      if (pinRef.current) {
        pinRef.current.setLatLng([pin.lat, pin.lng]);
      } else {
        pinRef.current = L.circleMarker([pin.lat, pin.lng], {
          radius: 9,
          color: "#c47b14",
          fillColor: "#ffffff",
          fillOpacity: 1,
          weight: 3,
        }).addTo(map);
      }
      map.setView([pin.lat, pin.lng], Math.max(map.getZoom(), 12));
    });
  }, [pin]);

  return (
    <div
      id={elId}
      className="h-64 w-full overflow-hidden rounded-lg border border-border sm:h-80"
      role="application"
      aria-label="Delivery map"
    />
  );
}
