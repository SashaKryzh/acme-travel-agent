"use client";

import type {HotelCard, HotelPage} from "@acme/travel";
import {BedDouble, Clock, Loader2, MapPin, MessageCircle} from "lucide-react";
import {useEffect, useState} from "react";

import {Badge} from "@/components/ui/badge";
import {Button} from "@/components/ui/button";
import {Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle} from "@/components/ui/sheet";
import type {UiAction} from "@/lib/actions";
import {dateRange, guests, money} from "@/lib/format";

import {Rating, Stars} from "./cards/HotelGroupCard";
import {HotelMap} from "./map/HotelMap";

/** The hotel page a card opens: photos, the map, every room for the card's stay, and what guests say. */
export function HotelSheet({
    sessionId,
    card,
    busy,
    onClose,
    onAction
}: {
    sessionId: string | undefined;
    card: HotelCard | null;
    busy: boolean;
    onClose: () => void;
    onAction: (text: string, action: UiAction) => void;
}) {
    const [page, setPage] = useState<HotelPage | null>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        setPage(null);
        setError(null);
        if (card === null || sessionId === undefined) return;
        const controller = new AbortController();
        const query = new URLSearchParams({sessionId, offerId: card.offer_id});
        fetch(`/acme/v1/hotel-page?${query}`, {signal: controller.signal})
            .then(async (response) => {
                const body = (await response.json()) as HotelPage | {error: string};
                if ("error" in body) setError(body.error);
                else setPage(body);
            })
            .catch((reason: unknown) => {
                if (!controller.signal.aborted) setError(String(reason));
            });
        return () => controller.abort();
    }, [sessionId, card]);

    const hotel = page?.hotel;
    const facilities = hotel?.facilities ?? [];
    const latitude = hotel?.latitude ?? card?.latitude;
    const longitude = hotel?.longitude ?? card?.longitude;
    return (
        <Sheet open={card !== null} onOpenChange={(open) => !open && onClose()}>
            <SheetContent className="w-full gap-0 overflow-y-auto sm:max-w-xl" data-testid="hotel-sheet">
                <SheetHeader className="border-b">
                    <SheetTitle>{card?.name}</SheetTitle>
                    <SheetDescription>
                        {page === null ? "Loading rooms and details…" : `${dateRange(page.stay.checkin, page.stay.checkout)} · ${guests(page.stay.adults, page.stay.children)}`}
                    </SheetDescription>
                </SheetHeader>

                {page === null && error === null && (
                    <div className="flex items-center gap-2 p-6 text-sm text-muted-foreground">
                        <Loader2 className="size-4 animate-spin" /> Loading rooms and details…
                    </div>
                )}
                {error !== null && <div className="m-4 rounded-lg bg-destructive/10 p-3 text-sm text-destructive">{error}</div>}

                {card !== null && hotel !== undefined && page !== null && (
                    <div className="space-y-5 pb-8">
                        {hotel.images.length > 0 && (
                            <div className="flex snap-x gap-1 overflow-x-auto">
                                {hotel.images.map((image) => (
                                    // eslint-disable-next-line @next/next/no-img-element
                                    <img key={image} src={image} alt="" className="aspect-[4/3] w-4/5 shrink-0 snap-start object-cover" loading="lazy" />
                                ))}
                            </div>
                        )}
                        <div className="space-y-2 px-4">
                            <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                                {hotel.stars !== undefined && <Stars value={hotel.stars} />}
                                {hotel.rating !== undefined && <Rating value={hotel.rating} />}
                                {hotel.review_count !== undefined && <span>{hotel.review_count} reviews</span>}
                                {hotel.address !== undefined && (
                                    <span className="flex items-center gap-1">
                                        <MapPin className="size-3.5" /> {hotel.address}
                                    </span>
                                )}
                            </div>
                            {latitude !== undefined && longitude !== undefined && (
                                <div className="aspect-[2/1] overflow-hidden rounded-xl border bg-muted">
                                    <HotelMap
                                        pins={[{id: card.offer_id, label: money(card.price_amount, card.price_currency), title: hotel.name, latitude, longitude}]}
                                        activeId={card.offer_id}
                                    />
                                </div>
                            )}
                            {(hotel.checkin_time !== undefined || hotel.checkout_time !== undefined) && (
                                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                    <Clock className="size-3.5" /> Check-in {hotel.checkin_time ?? "?"} · Check-out {hotel.checkout_time ?? "?"}
                                </div>
                            )}
                            <Button
                                variant="outline"
                                size="sm"
                                disabled={busy}
                                onClick={() =>
                                    onAction(`Tell me more about ${hotel.name}`, {
                                        type: "select_hotel",
                                        offer_id: card.offer_id,
                                        hotel_id: card.hotel_id,
                                        hotel_name: hotel.name
                                    })
                                }
                            >
                                <MessageCircle /> Ask the agent about this hotel
                            </Button>
                        </div>

                        <section className="px-4">
                            <h3 className="mb-2 text-sm font-semibold">Rooms</h3>
                            {page.rooms.length === 0 && <p className="text-sm text-muted-foreground">No rooms available for these dates.</p>}
                            <ul className="space-y-2">
                                {page.rooms.map((room) => (
                                    <li key={room.offer_id} className="flex items-center gap-3 rounded-xl border p-3" data-testid="room">
                                        {room.photo !== undefined && (
                                            // eslint-disable-next-line @next/next/no-img-element
                                            <img src={room.photo} alt="" className="aspect-square w-1/6 shrink-0 rounded-lg object-cover" loading="lazy" />
                                        )}
                                        <div className="min-w-0 flex-1 text-sm">
                                            <div className="flex items-center gap-1 font-medium">
                                                <BedDouble className="size-3.5 shrink-0 text-muted-foreground" />
                                                <span className="truncate">{room.room_name ?? "Room"}</span>
                                            </div>
                                            <div className="text-xs text-muted-foreground">
                                                {room.board_name ?? "Room only"} · {room.refundable ? "Free cancellation" : "Non-refundable"}
                                            </div>
                                        </div>
                                        <div className="flex shrink-0 flex-col items-end gap-1">
                                            <span className="font-semibold">{money(room.price_amount, room.price_currency)}</span>
                                            <Button
                                                size="xs"
                                                disabled={busy}
                                                onClick={() =>
                                                    onAction(`I'd like the ${room.room_name ?? "room"} at ${hotel.name}`, {
                                                        type: "select_room",
                                                        offer_id: room.offer_id,
                                                        hotel_id: hotel.hotel_id,
                                                        hotel_name: hotel.name,
                                                        room_name: room.room_name ?? null
                                                    })
                                                }
                                            >
                                                Select
                                            </Button>
                                        </div>
                                    </li>
                                ))}
                            </ul>
                        </section>

                        {hotel.description !== undefined && (
                            <section className="px-4">
                                <h3 className="mb-1 text-sm font-semibold">About</h3>
                                <p className="text-sm leading-relaxed whitespace-pre-line text-muted-foreground">{hotel.description}</p>
                            </section>
                        )}
                        {facilities.length > 0 && (
                            <section className="px-4">
                                <h3 className="mb-2 text-sm font-semibold">Facilities</h3>
                                <div className="flex flex-wrap gap-1.5">
                                    {facilities.map((facility) => (
                                        <Badge key={facility} variant="outline">
                                            {facility}
                                        </Badge>
                                    ))}
                                </div>
                            </section>
                        )}
                    </div>
                )}
            </SheetContent>
        </Sheet>
    );
}
