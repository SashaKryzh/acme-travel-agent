"use client";

import type {HotelCard, HotelGroup} from "@acme/travel";
import {BedDouble, Coffee, ListIcon, MapIcon, MapPin, Star} from "lucide-react";
import {useCallback, useMemo, useState} from "react";

import {Badge} from "@/components/ui/badge";
import {ToggleGroup, ToggleGroupItem} from "@/components/ui/toggle-group";
import {dateRange, guests, money} from "@/lib/format";
import {cn} from "@/lib/utils";

import {HotelMap, type MapPin as HotelPin} from "../map/HotelMap";

type View = "list" | "map";

export function HotelGroupCard({group, onOpen}: {group: HotelGroup; onOpen: (hotel: HotelCard) => void}) {
    const [view, setView] = useState<View>("list");
    const pins = useMemo(() => group.hotels.flatMap(hotelPin), [group.hotels]);
    return (
        <div className="my-2">
            <div className="mb-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
                {group.title !== null && <span className="font-semibold">{group.title}</span>}
                <span className="text-muted-foreground">
                    {dateRange(group.stay.checkin, group.stay.checkout)} · {guests(group.stay.adults, group.stay.children)}
                </span>
                {pins.length > 0 && (
                    <ToggleGroup
                        type="single"
                        variant="outline"
                        size="sm"
                        value={view}
                        onValueChange={(value) => value !== "" && setView(value as View)}
                        className="ml-auto"
                    >
                        <ToggleGroupItem value="list" aria-label="List">
                            <ListIcon /> List
                        </ToggleGroupItem>
                        <ToggleGroupItem value="map" aria-label="Map">
                            <MapIcon /> Map
                        </ToggleGroupItem>
                    </ToggleGroup>
                )}
            </div>
            {view === "map" && pins.length > 0 ? (
                <HotelMapView hotels={group.hotels} pins={pins} onOpen={onOpen} />
            ) : (
                <div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,14rem),1fr))] gap-3">
                    {group.hotels.map((hotel) => (
                        <HotelTile key={hotel.offer_id} hotel={hotel} onOpen={onOpen} />
                    ))}
                </div>
            )}
        </div>
    );
}

function HotelTile({hotel, onOpen}: {hotel: HotelCard; onOpen: (hotel: HotelCard) => void}) {
    return (
        <button
            onClick={() => onOpen(hotel)}
            data-testid="hotel-card"
            className="overflow-hidden rounded-xl border bg-card text-left shadow-xs transition hover:shadow-md focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        >
            <div className="aspect-[4/3] bg-muted">
                {hotel.photo !== undefined && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={hotel.photo} alt="" className="h-full w-full object-cover" loading="lazy" />
                )}
            </div>
            <div className="space-y-1 p-3">
                <div className="flex items-start justify-between gap-2">
                    <span className="line-clamp-2 text-sm leading-snug font-semibold">{hotel.name}</span>
                    {hotel.rating !== undefined && <Rating value={hotel.rating} />}
                </div>
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    {hotel.stars !== undefined && <Stars value={hotel.stars} />}
                    {hotel.city !== undefined && (
                        <span className="flex min-w-0 items-center gap-0.5">
                            <MapPin className="size-3 shrink-0" />
                            <span className="truncate">{hotel.city}</span>
                        </span>
                    )}
                    {hotel.review_count !== undefined && <span>· {hotel.review_count} reviews</span>}
                </div>
                <div className="flex flex-wrap gap-1 pt-1">
                    {hotel.board_name !== undefined && (
                        <Badge variant="secondary">
                            <Coffee /> {hotel.board_name}
                        </Badge>
                    )}
                    <Badge variant={hotel.refundable ? "default" : "secondary"}>{hotel.refundable ? "Free cancellation" : "Non-refundable"}</Badge>
                </div>
                <div className="flex items-end justify-between gap-2 pt-1">
                    {hotel.room_name !== undefined ? (
                        <span className="flex min-w-0 items-center gap-1 text-xs text-muted-foreground">
                            <BedDouble className="size-3 shrink-0" />
                            <span className="truncate">{hotel.room_name}</span>
                        </span>
                    ) : (
                        <span />
                    )}
                    <Price amount={hotel.price_amount} currency={hotel.price_currency} nights={hotel.nights} />
                </div>
            </div>
        </button>
    );
}

function HotelMapView({hotels, pins, onOpen}: {hotels: HotelCard[]; pins: HotelPin[]; onOpen: (hotel: HotelCard) => void}) {
    const [activeId, setActiveId] = useState<string | null>(null);
    const open = useCallback(
        (id: string) => {
            const hotel = hotels.find((candidate) => candidate.offer_id === id);
            if (hotel !== undefined) onOpen(hotel);
        },
        [hotels, onOpen]
    );
    return (
        <div className="grid gap-3 sm:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
            <div className="aspect-[4/3] overflow-hidden rounded-xl border bg-muted" data-testid="hotel-map">
                <HotelMap pins={pins} activeId={activeId} onHover={setActiveId} onSelect={open} />
            </div>
            {/* On wide screens the map's aspect ratio sets the row height and the list scrolls within it. */}
            <div className="relative">
                <ul className="space-y-1.5 sm:absolute sm:inset-0 sm:overflow-y-auto sm:pr-1">
                    {hotels.map((hotel) => {
                        const located = hotel.latitude !== undefined && hotel.longitude !== undefined;
                        return (
                            <li key={hotel.offer_id}>
                                <button
                                    onClick={() => onOpen(hotel)}
                                    onMouseEnter={() => located && setActiveId(hotel.offer_id)}
                                    onMouseLeave={() => setActiveId(null)}
                                    onFocus={() => located && setActiveId(hotel.offer_id)}
                                    onBlur={() => setActiveId(null)}
                                    className={cn(
                                        "flex w-full items-center gap-2.5 rounded-lg border bg-card p-1.5 text-left transition",
                                        hotel.offer_id === activeId ? "border-foreground shadow-md" : "hover:border-foreground/30"
                                    )}
                                >
                                    <div className="size-12 shrink-0 overflow-hidden rounded-md bg-muted">
                                        {hotel.photo !== undefined && (
                                            // eslint-disable-next-line @next/next/no-img-element
                                            <img src={hotel.photo} alt="" className="h-full w-full object-cover" loading="lazy" />
                                        )}
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <div className="truncate text-sm font-medium">{hotel.name}</div>
                                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                            {hotel.rating !== undefined && <Rating value={hotel.rating} />}
                                            {hotel.stars !== undefined && <Stars value={hotel.stars} />}
                                            {!located && <span className="truncate">· Not on map</span>}
                                        </div>
                                    </div>
                                    <Price amount={hotel.price_amount} currency={hotel.price_currency} nights={hotel.nights} />
                                </button>
                            </li>
                        );
                    })}
                </ul>
            </div>
        </div>
    );
}

export function Rating({value}: {value: number}) {
    return <span className="shrink-0 rounded-md bg-primary px-1.5 py-0.5 text-xs font-semibold text-primary-foreground">{value.toFixed(1)}</span>;
}

export function Stars({value}: {value: number}) {
    return (
        <span className="flex items-center gap-0.5">
            {value}
            <Star className="size-3 fill-amber-400 stroke-amber-400" />
        </span>
    );
}

function Price({amount, currency, nights}: {amount: number; currency: string; nights: number}) {
    return (
        <span className="shrink-0 text-right">
            <span className="block text-base font-semibold">{money(amount, currency)}</span>
            <span className="block text-[11px] text-muted-foreground">
                {nights} night{nights === 1 ? "" : "s"}
            </span>
        </span>
    );
}

function hotelPin(hotel: HotelCard): HotelPin[] {
    if (hotel.latitude === undefined || hotel.longitude === undefined) return [];
    return [{id: hotel.offer_id, label: money(hotel.price_amount, hotel.price_currency), title: hotel.name, latitude: hotel.latitude, longitude: hotel.longitude}];
}
