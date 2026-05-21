## 2026-05-21T11:14:53Z

You are the teamwork_preview_worker subagent (identity: worker_m7_group_widget).
Your working directory is: C:\Users\Usuario\.gemini\antigravity\scratch\casa-mahana-pms\.agents\worker_m7_group_widget\

Your mission is to implement Milestone 7 (Client Group Booking Widget) of the Casa Mahana PMS improvements project.

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A Forensic Auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

Detailed Instructions:
1. Initialize your BRIEFING.md and update progress.md.
2. Refactor `src/pages/BookingWidget.tsx`:
   - Search Engine (Step 1):
     - Expand the "Adultos" select option list from 1 up to 30.
     - Expand the "Menores" select option list from 0 up to 15.
     - Add a "Mascotas" (Pets) select dropdown in Step 1, allowing options from 0 up to 10.
     - Introduce state variables `adultosBuscados`, `menoresBuscados`, `mascotasBuscadas` (or use top-level state variables `adultos`, `menores`, and a new `mascotas` state variable initialized to 0) to remember what the customer originally searched for.
   - "Carrito de Reservas" (Step 2):
     - Convert Step 2 from a single room type selector to a shopping cart experience.
     - Display the list of available room types (`roomTypes`) returned from availability check.
     - In each room type card, add:
       - A dropdown showing the list of plans returned by `/api/v1/public/planes?tipo=${tipo}` for that room type. To implement this elegantly, when Step 2 loads (or when `roomTypes` changes), fetch plans for all available room types in parallel and store them in an object state like `allRoomPlans: Record<string, Plan[]>`. Render a `<select>` dropdown inside each card to let the user select which plan they want for that room.
       - A sleek quantity selector `[ - ] Qty [ + ]`.
         - `Qty` represents the count of rooms of this type currently added to the cart (`cart.filter(x => x.tipo === rt.tipo).length`).
         - Clicking `[ + ]` adds a new cart item for this room type. When adding:
           - Fetch or compute the cotizacion for the room using the selected plan, check-in, check-out dates, and default guest counts (`adultos = 1, menores = 0, mascotas = 0`).
           - Append the new room item to the `cart` state array.
         - Clicking `[ - ]` removes the last added room item of this type from the cart.
         - Ensure the user cannot select more rooms than the available limit (`rt.disponibles`) or less than 0.
     - Above or below the room type list, if `cart.length > 0`, display a nice cart summary panel listing all selected rooms (showing room type, selected plan, and price), the total net price, and a primary button "Siguiente: Distribuir Huéspedes" which navigates to Step 3.
   - Guest Room Allocation Console (Step 3):
     - Render a completely new step (let's keep Step 3 for this, shifting subsequent steps by 1, or refactoring the steps to accommodate this seamlessly).
     - The guest room allocation console must show:
       - The list of all selected room items in the cart (e.g. Room 1: Familiar, Room 2: Doble).
       - For each room, display:
         - Minimum and maximum physical capacities (`capacidad_min` and `capacidad_max`). Look this up from the `roomTypes` array.
         - Quantity selectors (`[ - ] Qty [ + ]` or numeric select inputs) for Adults, Minors, and Pets sleeping in that specific room.
         - A warning badge if `adultos + menores > capacidad_max` or `adultos + menores < capacidad_min` or `adultos < 1`.
         - The dynamic price for that specific room, updating reactively when guests are changed!
           - To achieve this, when guest counts (adults/minors/pets) are adjusted for a cart item, update the state immediately, and fetch the exact updated price and breakdown from the cotizacion API (`GET /api/v1/public/cotizar?plan=${plan.codigo}&adultos=${adults}&menores=${minors}&mascotas=${pets}&check_in=${checkIn}&check_out=${checkOut}`) to refresh that cart item's price, taxes, and deposit.
     - Render a floating glassmorphic validation panel at the bottom:
       - Displays:
         - Adults assigned vs searched: `assignedAdults / totalSearchedAdults`
         - Minors assigned vs searched: `assignedMinors / totalSearchedMinors`
         - Pets assigned vs searched: `assignedPets / totalSearchedPets`
         - Total capacity selected vs total guests searched.
       - Display a clean status banner:
         - If all guest counts match the search EXACTLY, and all room capacities are respected: show a green success message `"¡Perfecto! Todos los huéspedes y mascotas han sido asignados correctamente."` and enable the "Siguiente: Datos de Huésped" button.
         - If there's a discrepancy or capacity violation: show a detailed, helpful message specifying exactly how many adults, minors, or pets remain unassigned or which room exceeds its physical capacity limit. Disable the "Siguiente" button.
   - Refactor Subsequent Steps:
     - Ensure the guest details step (Step 4), payment step (Step 5), and confirmation step (Step 6) are fully compatible with this cart structure.
     - On successful payment (PayPal capture) or offline booking confirmation, call `POST /api/v1/public/reservas/multi` with the complete structured payload including all room items from the cart.
3. Run the existing test suite (`npm run test`) and production build (`npm run build`) to ensure there are no errors, all 63 tests pass cleanly, and the frontend builds successfully.
4. Write a completion report and handoff.md inside your folder, and send a message with the absolute path of your handoff.md back to the parent orchestrator (conversation ID: 1dda0ca9-158c-4fa0-a963-70ac231d1d8b).
