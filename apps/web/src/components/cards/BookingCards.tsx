"use client";

import type {BookingResult, BookingWidget} from "@acme/travel";
import {CalendarDays, CheckCircle2, CreditCard, ShieldCheck, UserRound, Users, XCircle} from "lucide-react";

import {Button} from "@/components/ui/button";
import {Card, CardContent, CardFooter, CardHeader} from "@/components/ui/card";
import {dateRange, guests, money} from "@/lib/format";
import {cn} from "@/lib/utils";

/** "booked" once book went through for this prebook, "replaced" when a newer widget for it is shown below. */
export type WidgetState = "open" | "booked" | "replaced";

export function BookingWidgetCard({
    widget,
    state,
    disabled,
    onPay
}: {
    widget: BookingWidget;
    state: WidgetState;
    disabled: boolean;
    onPay: (widget: BookingWidget) => void;
}) {
    return (
        <Card className={cn("my-2 max-w-md gap-0 py-0", state === "replaced" && "opacity-60")} data-testid="booking-widget">
            <CardHeader className="flex gap-3 p-3">
                {widget.photo !== undefined && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={widget.photo} alt="" className="aspect-square w-1/5 shrink-0 rounded-lg object-cover" />
                )}
                <div className="min-w-0">
                    <div className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Review your stay</div>
                    <div className="leading-snug font-semibold">{widget.hotel_name}</div>
                    {widget.room_name !== undefined && <div className="text-sm text-muted-foreground">{widget.room_name}</div>}
                    {widget.board_name !== undefined && <div className="text-xs text-muted-foreground">{widget.board_name}</div>}
                </div>
            </CardHeader>
            <CardContent className="space-y-1.5 border-t px-3 py-2 text-sm">
                <Row icon={CalendarDays}>
                    {dateRange(widget.checkin, widget.checkout)} · {widget.nights} night{widget.nights === 1 ? "" : "s"}
                </Row>
                <Row icon={Users}>{guests(widget.adults, widget.children)}</Row>
                <Row icon={UserRound}>
                    {widget.primary_guest === null ? (
                        <span className="text-amber-700">Guest name and email missing</span>
                    ) : (
                        <span data-testid="widget-guest">
                            {widget.primary_guest.name} · <span className="text-muted-foreground">{widget.primary_guest.email}</span>
                            {widget.holder !== null && widget.holder.email !== widget.primary_guest.email && (
                                <span className="block text-xs text-muted-foreground">Booked by {widget.holder.name}</span>
                            )}
                        </span>
                    )}
                </Row>
                <Row icon={ShieldCheck}>
                    {widget.refundable
                        ? `Free cancellation${widget.cancellation_deadline === undefined ? "" : ` until ${widget.cancellation_deadline.replace("T", " ")}`}`
                        : "Non-refundable"}
                </Row>
            </CardContent>
            <CardFooter className="flex items-center justify-between gap-3 border-t bg-muted/50 px-3 py-3">
                <div>
                    <div className="text-lg font-semibold">{money(widget.price, widget.currency)}</div>
                    {widget.price_changed_percent !== undefined && (
                        <div className="text-xs text-amber-700">Price changed {widget.price_changed_percent}% since search</div>
                    )}
                </div>
                {state === "booked" ? (
                    <span className="flex items-center gap-1 text-sm font-medium">
                        <CheckCircle2 className="size-4" /> Booked
                    </span>
                ) : state === "replaced" ? (
                    <span className="text-xs text-muted-foreground">Updated below</span>
                ) : (
                    <Button disabled={disabled} onClick={() => onPay(widget)} data-testid="pay">
                        <CreditCard /> {widget.action_label}
                    </Button>
                )}
            </CardFooter>
        </Card>
    );
}

export function BookingResultCard({result, kind}: {result: BookingResult; kind: "book" | "cancel"}) {
    const ok = kind === "book" ? result.status === "booked" : result.status === "cancelled";
    const refundCurrency = result.refund_currency ?? result.currency;
    return (
        <div
            className={cn("my-2 max-w-md rounded-xl border p-3 text-sm", ok ? "bg-muted/50" : "border-destructive/30 bg-destructive/5")}
            data-testid={`${kind}-result`}
        >
            <div className="flex items-center gap-2 font-semibold">
                {ok ? <CheckCircle2 className="size-4" /> : <XCircle className="size-4 text-destructive" />}
                {kind === "book" ? (ok ? "Booked" : `Booking ${result.provider_status ?? result.status}`) : ok ? "Cancelled" : `Cancellation ${result.status}`}
                <span className="font-normal text-muted-foreground">· {result.hotel_name}</span>
            </div>
            <div className="mt-1 text-muted-foreground">
                {dateRange(result.checkin, result.checkout)} · {money(result.price, result.currency)}
                {result.room_name !== undefined && ` · ${result.room_name}`}
            </div>
            {result.booking_id !== undefined && (
                <div className="mt-1 font-mono text-xs text-muted-foreground">
                    Booking {result.booking_id}
                    {result.hotel_confirmation_code !== undefined && ` · Hotel ref ${result.hotel_confirmation_code}`}
                </div>
            )}
            {kind === "cancel" && result.refund_amount !== undefined && (
                <div className="mt-1">
                    Refund {money(result.refund_amount, refundCurrency)}
                    {result.cancellation_fee !== undefined && ` · fee ${money(result.cancellation_fee, refundCurrency)}`}
                </div>
            )}
        </div>
    );
}

function Row({icon: Icon, children}: {icon: typeof Users; children: React.ReactNode}) {
    return (
        <div className="flex items-center gap-2">
            <Icon className="size-4 shrink-0 text-muted-foreground" />
            {children}
        </div>
    );
}
