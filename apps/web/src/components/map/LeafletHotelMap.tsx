"use client";

import "leaflet/dist/leaflet.css";
import "./HotelMap.css";

import {divIcon, latLngBounds, type LatLngTuple, type Marker as LeafletMarker} from "leaflet";
import {useEffect, useMemo, useRef} from "react";
import {MapContainer, Marker, TileLayer, useMap} from "react-leaflet";

import type {HotelMapProps, MapPin} from "./HotelMap";

export default function LeafletHotelMap({pins, activeId = null, onHover, onSelect}: HotelMapProps) {
    const bounds = useMemo(() => latLngBounds(pins.map((pin): LatLngTuple => [pin.latitude, pin.longitude])), [pins]);
    // Pins are fixed for a rendered card, so remounting on a new set is simpler than refitting.
    const boundsKey = pins.map((pin) => `${pin.latitude},${pin.longitude}`).join(";");
    return (
        <MapContainer
            key={boundsKey}
            bounds={bounds}
            boundsOptions={{paddingTopLeft: [32, 48], paddingBottomRight: [32, 16], maxZoom: 15}}
            scrollWheelZoom={false}
            className="isolate size-full"
        >
            <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
                maxZoom={19}
            />
            {pins.map((pin) => (
                <PricePin key={pin.id} pin={pin} active={pin.id === activeId} onHover={onHover} onSelect={onSelect} />
            ))}
            <TrackSize />
        </MapContainer>
    );
}

function PricePin({
    pin,
    active,
    onHover,
    onSelect
}: {
    pin: MapPin;
    active: boolean;
    onHover?: (id: string | null) => void;
    onSelect?: (id: string) => void;
}) {
    const marker = useRef<LeafletMarker>(null);
    const position = useMemo((): LatLngTuple => [pin.latitude, pin.longitude], [pin.latitude, pin.longitude]);
    const icon = useMemo(
        () => divIcon({className: "price-pin-anchor", iconSize: [0, 0], html: `<span class="price-pin">${escapeHtml(pin.label)}</span>`}),
        [pin.label]
    );
    const handlers = useMemo(
        () => ({
            mouseover: () => onHover?.(pin.id),
            mouseout: () => onHover?.(null),
            click: () => onSelect?.(pin.id)
        }),
        [onHover, onSelect, pin.id]
    );

    // Toggling a class instead of swapping the icon keeps the hovered element in place, so mouse events don't flicker.
    useEffect(() => {
        marker.current?.getElement()?.classList.toggle("is-active", active);
    }, [active, icon]);

    return (
        <Marker
            ref={marker}
            position={position}
            icon={icon}
            title={pin.title}
            keyboard={onSelect !== undefined}
            interactive={onSelect !== undefined || onHover !== undefined}
            zIndexOffset={active ? 1000 : 0}
            eventHandlers={handlers}
        />
    );
}

function TrackSize() {
    const map = useMap();
    useEffect(() => {
        const observer = new ResizeObserver(() => map.invalidateSize());
        observer.observe(map.getContainer());
        return () => observer.disconnect();
    }, [map]);
    return null;
}

function escapeHtml(text: string): string {
    return text.replace(/[&<>"']/g, (char) => `&#${char.charCodeAt(0)};`);
}
