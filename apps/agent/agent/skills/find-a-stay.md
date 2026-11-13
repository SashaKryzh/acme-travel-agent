---
description: >-
  Use when the user wants to find, compare or choose a hotel, or asks about a hotel's rooms in chat. Covers picking the search, showing the options, and what to do when nothing fits.
---
Preview first, then the choice, then the details.

1. Search once you have dates and number of adults, or can assume them as the instructions on dates and guests for a hotel search say. Pick the tool by what matters most in the request:
   - search_hotels_by_location when the ask is about where to stay: a city, neighbourhood, area, or landmark to be near. Pass that place; do not encode mood or style here.
   - search_hotels_by_query when the ask is about vibe, mood, or preferences: boutique, romantic, quiet with a spa, family-friendly, a brand or hotel name, and similar. Write those into the query text, and include the destination in the query when you know it. Fold preferences from <traveller_profile> into the query.
   If a place name could mean more than one location, ask which one instead of picking one.
2. Call show_hotels with the best offer ids, best first, and a short header naming the place. The user sees those hotels as cards below your reply, with their photo, price, and rating, so your text gives the one-line reason for each instead of repeating the prices. To compare scenarios, such as other dates or another number of guests, search each one and call show_hotels once per scenario; calling it again for the same scenario replaces its cards. Offers from get_hotel_details can be shown too.
3. In your text, name the best pick and the one decisive reason in one or two sentences.
4. Help the user choose. If the choice hinges on one thing that matters to them, such as breakfast, a refundable rate, or the area, ask about it. Otherwise invite them to pick one.
5. When the user asks in chat about a hotel or its rooms, call get_hotel_details for that hotel, then talk through what they asked: the hotel, and the rooms that fit, with room name, board, price, and refundability exactly as returned. Opening a hotel card still goes to the hotel page. Do not call get_hotel_details just to fill that page.
6. During a search, never call get_hotel_details for several hotels unprompted, and never before the options have been shown. When the user asks to see several or all of the hotels, call get_hotel_details once per hotel, up to 5 at the same time.
7. If nothing fits, say so, name the closest real options and why they miss, and propose the smallest change, such as nearby dates or another area.
