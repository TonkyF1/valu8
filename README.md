# Valu8: UK Car Valuations

Build a complete, production-ready, premium web app called **Valu8** — an elegant AI-powered car valuation tool designed specifically for private sellers in the UK.

**Design Style (strictly follow this)**:

- Ultra-premium, classy, modern luxury SaaS aesthetic (Linear + Apple-level polish)

- Dark charcoal/black background (#111111 or #0F0F0F)

- Premium teal accent colour (#00D4C8)

- Clean sans-serif typography, generous whitespace, subtle animations, high-end feel on mobile and desktop

**Core Features (all must be fully functional)**:

1. **Authentication**

   - Email/password login + magic link

   - Simple protected dashboard

2. **Dashboard ("My Valuations")**

   - List of all previous valuations with car summary, date, and quick view button

   - Total valuations counter and average value found (mock data is fine)

3. **Landing / Input Page**

   - Clean hero: "Instant AI Car Valuation for Private Sellers"

   - Subheadline with key benefits

   - Compact Vehicle Details form:

     - Make → searchable dropdown with 40+ real manufacturers (BMW, Audi, Mercedes, Ford, Volkswagen, Peugeot, Renault, Vauxhall, Toyota, Honda, Nissan, Land Rover, Porsche, Tesla, Jaguar, MINI, Skoda, Seat, Citroën, Fiat, Alfa Romeo, Mazda, Hyundai, Kia, Volvo, etc.)

     - Model → text input or dropdown

     - Year → dropdown (1995–2026)

     - Mileage, UK Registration plate, MOT expiry date, brief service history notes

4. **Photo Uploader**

   - Drag-and-drop + mobile camera support

   - Shows live thumbnails with individual "X" delete button

   - Guided 6-photo requirement with clear labels:

     1. Front 3/4 angle

     2. Rear 3/4 angle

     3. Driver’s side full profile

     4. Interior (dashboard + seats)

     5. Odometer / mileage

     6. Engine bay

   - User can still submit with fewer photos but encouraged to add all 6

5. **Analysis Flow**

   - Beautiful loading screen ("Analysing Your Vehicle") with progress steps that automatically advances to the full report (no manual refresh)

6. **Full Valuation Report (premium layout)**

   - Large photo gallery at the top

   - Condition score with circular gauge (e.g. 7.8/10 "Good")

   - Three clear value tiers:

     - Dealer Trade-in

     - Private Sale (highlighted as "Best Return")

     - Dealer Retail

   - Honest Analysis (concise, professional, personalised)

   - Market Positioning

   - Strengths + Watch Points (bullet style)

   - Seller Recommendations (actionable: recommended listing price, where to sell, what to highlight, documents to prepare)

   - HPI Check Summary (simulated, "All Clear" style)

   - MOT History (simulated timeline with pass/fail notes)

   - Data sources & disclaimer footer

   - Buttons: Share, Download PDF (mock), Save to My Valuations

**Test Mode**:

- Everything is completely free

- Show a small top banner: "TEST MODE — Full Report Unlocked • AI-powered valuations • Not financial advice"

**Tech**:

Use Next.js 15 (App Router), Tailwind, shadcn/ui, Supabase (auth + database for saved valuations + photo storage). Make it fast, mobile-first, and extremely polished.

Generate the full working app with clear setup instructions.

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://valu8.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/101f88bb-9f15-4d61-bcf3-d147a9f39355).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
