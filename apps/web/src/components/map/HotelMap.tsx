"use client";

import dynamic from "next/dynamic";

export interface MapPin {
    id: string;
    label: string;
    title: string;
    latitude: number;
    longitude: number;
}

export interface HotelMapProps {
    pins: MapPin[];
    activeId?: string | null;
    onHover?: (id: string | null) => void;
    onSelect?: (id: string) => void;
}

// Leaflet touches `window` on import, so it only loads in the browser.
export const HotelMap = dynamic<HotelMapProps>(() => import("./LeafletHotelMap"), {
    ssr: false,
    loading: () => <div className="size-full animate-pulse bg-muted" />
});
