# Quote-It Design Guidelines

## Design Approach

**Reference-Based: Minimalist Social Media**
Drawing inspiration from Twitter's clean feed structure, Medium's typography-first approach, and Apple's minimalist aesthetic. The design emphasizes readability, simplicity, and content hierarchy with monochromatic treatment.

**Core Principles:**
- Typography-first: Quotes are the hero element
- Maximum readability: High contrast, generous spacing
- Mobile-native: Touch-friendly targets, thumb-zone optimization
- Intentional whitespace: Breathing room around content
- Brutalist touches: Bold typography, stark contrasts, unapologetic simplicity

---

## Typography System

**Font Stack:**
- Primary: "Inter" (Google Fonts) - Interface elements, body text
- Display: "Space Grotesk" (Google Fonts) - Logo, headers, featured quotes

**Type Scale:**
```
Logo "IT": text-6xl (60px), font-bold, tracking-tight
Quote Content: text-2xl to text-4xl (24-36px), font-medium, leading-tight
Author/Username: text-sm (14px), font-medium
Metadata (votes, time): text-xs (12px), font-normal
Body Text: text-base (16px), line-height-relaxed
CTAs: text-base (16px), font-semibold
```

**Hierarchy Rules:**
- Featured/winning quotes: Largest scale (text-4xl)
- Feed quotes: Medium scale (text-2xl)
- Metadata always smallest, subdued treatment
- Logo maintains consistent oversized presence

---

## Layout System

**Spacing Primitives:** 
Use Tailwind units of **4, 6, 8, 12, 16** for consistent rhythm (p-4, m-6, gap-8, py-12, px-16)

**Container Strategy:**
- Max-width constraints: max-w-2xl for content feeds, max-w-7xl for wider layouts
- Mobile: px-4 side padding
- Tablet: px-6 side padding  
- Desktop: px-8 side padding

**Grid Systems:**
- Feed: Single column (max-w-2xl centered)
- Leaderboard: Single column on mobile, 2-column on desktop (grid-cols-1 md:grid-cols-2)
- Store: 1 column mobile, 2-3 columns desktop for product grids
- Profile: Single column quote list with stats sidebar on desktop

**Vertical Rhythm:**
- Section spacing: py-12 mobile, py-16 desktop
- Card spacing: p-6 to p-8
- List item spacing: gap-6 between quotes in feed

---

## Component Library

### Navigation
**Top Bar (Fixed):**
- Height: h-16
- Contents: Logo "IT" (left), Create Quote button (center/right), Profile icon (right)
- Transparent background with bottom border
- Mobile: Condensed with icon-only buttons
- Desktop: Full navigation with labels

**Bottom Navigation (Mobile Only):**
- Fixed bottom bar: h-16
- 4 icons: Feed, Trending, Store, Profile
- Active state indicated with bold icon variant
- Safe area padding for notched devices

### Quote Cards
**Feed Quote Card:**
- Padding: p-6 to p-8
- Border: All sides, subtle weight
- Quote text: text-2xl, font-medium, mb-4
- Author: text-sm, mb-6
- Vote controls: Horizontal layout with count between up/down arrows
- Hover: Subtle lift effect (shadow-md)

**Featured/Winner Card:**
- Larger padding: p-8 to p-12
- Quote text: text-4xl, font-bold
- Badge: "Winner - Week #X" above quote
- Decorative quotation marks (optional typographic element)
- CTA: "Shop This Design" button prominent below

### Buttons
**Primary Actions:**
- Height: h-12 (48px touch target)
- Padding: px-8
- Rounded: rounded-full (pill shape)
- Font: font-semibold, text-base
- Examples: "Post Quote", "Shop Now", "Vote"

**Secondary Actions:**
- Height: h-10
- Outlined style with border
- Rounded: rounded-full

**Icon Buttons:**
- Size: w-10 h-10 (40px touch target)
- Rounded: rounded-full
- Vote arrows, share, bookmark

### Forms
**Quote Input:**
- Large textarea: min-h-32, text-2xl input
- Character counter: Bottom right, text-xs
- Max width: max-w-2xl
- Placeholder: Inspiring quote guidance

**Authentication Forms:**
- Input height: h-12
- Rounded: rounded-lg
- Labels: text-sm, font-medium, mb-2
- Error states: Border change + text-xs error message

### Voting System
**Vote Component:**
- Horizontal layout: [Up Arrow] [Count] [Down Arrow]
- Icon size: w-6 h-6
- Count: text-base, font-semibold, mx-4
- Interactive states: Scale on click, number animation

---

## Page-Specific Layouts

### Home/Feed Page
**Structure:**
1. Fixed top navigation
2. Feed container (max-w-2xl, centered)
3. Filter tabs: "Recent" | "Trending" | "Top" (sticky below nav)
4. Infinite scroll quote cards with gap-6
5. Fixed "Create Quote" FAB (bottom-right, mobile only)
6. Bottom navigation (mobile)

**Quote Card Pattern:**
- Stacked vertically with consistent gap-6
- Each card self-contained with all interactions
- Lazy load images (profile avatars) if added later

### Create/Post Page
**Single-Purpose Layout:**
- Centered form: max-w-2xl
- Large textarea dominates (min-h-64)
- Character counter below
- "Cancel" and "Post" buttons at bottom
- Mobile: Full-screen modal
- Desktop: Modal overlay with backdrop blur

### Leaderboard Page
**Weekly Winners Showcase:**
- Hero section: Current week's leader (large featured card)
- Grid of runners-up: 2-3 columns on desktop
- Archive navigation: Previous weeks dropdown
- Each card shows: Quote, votes, author, "Shop" button

### Store Page
**E-commerce Layout:**
1. Hero: Featured winning quote as lifestyle product shot
   - Full-width image with text overlay
   - "Shop the Collection" CTA with blurred background
2. Product grid: 1 col mobile, 3 col desktop
3. Product cards: Image, quote preview, price, "Add to Cart"
4. Sticky cart icon in navigation (item count badge)

**Product Detail Modal:**
- Large product image carousel
- Quote displayed on shirt mockup
- Size selector (S, M, L, XL, XXL)
- Quantity selector
- "Add to Cart" CTA (h-14, full width mobile)
- Quote author credit and week won

### Profile Page
**Two-Column Desktop Layout:**
- Left: User info card (sticky)
  - Avatar (if available), username, join date
  - Stats: Posts, Total Votes, Wins
- Right: User's quotes feed (same card style as main feed)
- Mobile: Stacks vertically

**User Stats Card:**
- Grid layout for numbers
- Large numbers (text-3xl) with small labels (text-xs)
- Dividers between stat groups

---

## Images

**Hero Image (Store Page):**
- Lifestyle photography showing T-shirt being worn
- Outdoor/urban setting with natural lighting
- High contrast to work with monochrome aesthetic
- Dimensions: Minimum 1920x1080, optimized for web
- Position: Top of store page, text overlay with "Shop Winning Designs"

**Product Images:**
- Clean T-shirt mockups on neutral background
- Front view showing quote clearly
- Consistent lighting and angle across all products
- Square aspect ratio (1:1) for grid consistency
- Resolution: 800x800px minimum

**Profile Avatars (Optional Future):**
- Circular crop, 40x40px in feed, 120x120px on profile
- Use Heroicons user-circle icon as default placeholder

---

## Interaction Patterns

**Micro-interactions:**
- Vote animation: Number count-up, arrow highlight
- Card tap: Subtle scale (scale-[0.98]) on touch
- Button press: Quick opacity change (active:opacity-80)
- Loading states: Skeleton screens matching card structure

**Navigation Transitions:**
- Page changes: Simple fade
- Modal appearance: Slide up from bottom (mobile), fade with scale (desktop)
- No distracting animations - prioritize speed

---

## Accessibility Standards

- Minimum touch targets: 44x44px (Apple) / 48x48px (Material)
- Form labels always visible (no floating labels)
- Error messages in text, not just color
- Focus indicators on all interactive elements
- Semantic HTML throughout
- ARIA labels for icon-only buttons
- Alt text for all meaningful images

---

## Icon Library
**Heroicons** (outline for default, solid for active states)
- arrow-up, arrow-down (voting)
- heart (favorites)
- share (share quote)
- user-circle (profile)
- shopping-bag (store)
- fire (trending)
- trophy (winners)
- plus-circle (create)