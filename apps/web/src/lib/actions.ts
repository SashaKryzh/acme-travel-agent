/** Something the user did on a card or the hotel page. It is sent as a line after the visible text of their message. */
export type UiAction =
    | {type: "select_hotel"; offer_id: string; hotel_id: string; hotel_name: string}
    | {type: "select_room"; offer_id: string; hotel_id: string; hotel_name: string; room_name: string | null}
    | {type: "pay"; prebook_id: string};

const MARKER = "\n\n[UI action] ";

/** How a UI action reads to the model; ids stay in, so the agent never has to guess them. */
export function describeAction(action: UiAction): string {
    switch (action.type) {
        case "select_hotel":
            return `The user tapped the hotel card "${action.hotel_name}" (hotel_id ${action.hotel_id}, offer_id ${action.offer_id}).`;
        case "select_room":
            return `The user selected a room${action.room_name === null ? "" : ` "${action.room_name}"`} at "${action.hotel_name}" (hotel_id ${action.hotel_id}, offer_id ${action.offer_id}).`;
        case "pay":
            return `The user tapped Pay on the booking widget (prebook_id ${action.prebook_id}).`;
    }
}

/** The message the agent receives: what the user sees in their bubble, then the action. */
export function messageWithAction(text: string, action?: UiAction): string {
    return action === undefined ? text : `${text}${MARKER}${describeAction(action)}`;
}

/** The part of a sent message the user wrote or tapped, and whether it carried a UI action. */
export function visibleText(text: string): {text: string; action: boolean} {
    const index = text.indexOf(MARKER);
    return index === -1 ? {text, action: false} : {text: text.slice(0, index), action: true};
}
