---
name: Cyber-Technical Grid
colors:
  surface: '#131313'
  surface-dim: '#131313'
  surface-bright: '#393939'
  surface-container-lowest: '#0e0e0e'
  surface-container-low: '#1b1b1b'
  surface-container: '#1f1f1f'
  surface-container-high: '#2a2a2a'
  surface-container-highest: '#353535'
  on-surface: '#e2e2e2'
  on-surface-variant: '#d3c2cc'
  inverse-surface: '#e2e2e2'
  inverse-on-surface: '#303030'
  outline: '#9c8c96'
  outline-variant: '#4f434b'
  surface-tint: '#fbaeea'
  primary: '#ffdcf4'
  on-primary: '#52184c'
  primary-container: '#ffb1ee'
  on-primary-container: '#7c3e73'
  inverse-primary: '#88487d'
  secondary: '#edffe1'
  on-secondary: '#013a00'
  secondary-container: '#28ff1d'
  on-secondary-container: '#027100'
  tertiary: '#e7e6e6'
  on-tertiary: '#2f3131'
  tertiary-container: '#cacaca'
  on-tertiary-container: '#545555'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#ffd7f3'
  primary-fixed-dim: '#fbaeea'
  on-primary-fixed: '#390035'
  on-primary-fixed-variant: '#6c3064'
  secondary-fixed: '#77ff61'
  secondary-fixed-dim: '#02e600'
  on-secondary-fixed: '#002200'
  on-secondary-fixed-variant: '#015300'
  tertiary-fixed: '#e3e2e2'
  tertiary-fixed-dim: '#c7c6c6'
  on-tertiary-fixed: '#1a1c1c'
  on-tertiary-fixed-variant: '#464747'
  background: '#131313'
  on-background: '#e2e2e2'
  surface-variant: '#353535'
typography:
  headline-lg:
    fontFamily: Space Grotesk
    fontSize: 48px
    fontWeight: '700'
    lineHeight: '1.1'
    letterSpacing: -0.02em
  headline-md:
    fontFamily: Space Grotesk
    fontSize: 32px
    fontWeight: '600'
    lineHeight: '1.2'
    letterSpacing: -0.01em
  headline-sm:
    fontFamily: Space Grotesk
    fontSize: 24px
    fontWeight: '600'
    lineHeight: '1.2'
    letterSpacing: '0'
  body-lg:
    fontFamily: Inter
    fontSize: 18px
    fontWeight: '400'
    lineHeight: '1.6'
    letterSpacing: '0'
  body-md:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: '1.5'
    letterSpacing: '0'
  body-sm:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: '1.5'
    letterSpacing: '0'
  label-mono-lg:
    fontFamily: Space Grotesk
    fontSize: 14px
    fontWeight: '500'
    lineHeight: '1'
    letterSpacing: 0.05em
  label-mono-sm:
    fontFamily: Space Grotesk
    fontSize: 12px
    fontWeight: '500'
    lineHeight: '1'
    letterSpacing: 0.1em
spacing:
  unit: 4px
  xs: 4px
  sm: 8px
  md: 16px
  lg: 24px
  xl: 48px
  gutter: 24px
  margin: 32px
---

## Brand & Style

This design system is engineered for technical precision and high-energy performance, specifically tailored for API testing and development environments. It balances the raw, industrial aesthetic of Neo-Brutalism with the sleek clarity of modern Minimalism. The interface should feel like a high-end command center—authoritative, fast, and uncompromisingly technical.

The emotional response should be one of "Technical Mastery." By utilizing a deep black foundation contrasted with high-luminance accents, the design system minimizes ocular strain during long debugging sessions while highlighting critical data points with surgical accuracy. The visual language favors sharp edges and rigid grids over soft decorations, emphasizing the "code-first" nature of the product.

## Colors

The color palette is strictly high-contrast to ensure maximum legibility in a dark environment. 

- **Primary (#FFB1EE):** A vibrant magenta-pink used for primary actions, active states, and critical highlights. It provides the "high-energy" signature of the system.
- **Secondary (#00FF00):** A terminal-inspired green reserved for "Success" states, active API endpoints, and healthy system status. It reinforces the technical, "go" signal.
- **Neutral (#000000 / #A0A0A0 / #FFFFFF):** The background is a pure black (#000000) to create infinite depth. Grays are used for secondary text and structural borders to maintain hierarchy without competing with the primary accents.

Avoid any use of blues or purples to maintain the distinct, aggressive identity of this design system.

## Typography

Typography is used as a structural element. **Space Grotesk** is chosen for headlines and labels because its geometric quirks evoke a technical, futuristic feeling. It should be used for all "UI Chrome"—buttons, tabs, and headers.

**Inter** is the workhorse for content. It is used for body text, descriptions, and documentation where readability is paramount. For actual code blocks or API response data, fallback to a system-level Monospace font to ensure character alignment and precision. Use high tracking (letter-spacing) on small labels to enhance the "technical schematic" look.

## Layout & Spacing

This design system utilizes a **strict fluid grid** based on a 4px baseline unit. All components and layouts should snap to multiples of 8px to maintain mathematical consistency.

The layout philosophy mimics an IDE (Integrated Development Environment). Use a 12-column grid for main dashboard views, but allow for collapsible side panels (Left: Navigation; Right: Documentation/Details). Gutters should remain consistent at 24px to provide "air" between dense data sets. Elements should be packed tightly enough to display significant amounts of information without feeling cluttered, prioritizing data density over excessive whitespace.

## Elevation & Depth

Depth in this design system is achieved through **Tonal Layering** and **High-Contrast Outlines** rather than traditional shadows. 

1.  **Base Layer:** Pure #000000.
2.  **Surface Layer:** A slightly elevated dark charcoal (#121212) for cards and panels.
3.  **Borders:** Instead of shadows, use 1px solid borders. Use #A0A0A0 (Low opacity) for inactive containers and the primary #FFB1EE for active or hovered containers.
4.  **No Blurs:** Avoid glassmorphism. Surfaces should be opaque and solid to emphasize the "brutalist" and "precise" nature of an API platform.

## Shapes

The shape language is **Sharp (0px)**. To maintain a professional and technical feel, avoid rounded corners on all functional elements. Rectangular buttons, input fields, and panels reinforce the grid-based, mechanical nature of the interface. This lack of "softness" communicates the precision required for API testing. Only use circles for status indicators or avatars to provide a clear visual distinction from interactive UI elements.

## Components

- **Buttons:** Primary buttons are solid #FFB1EE with black text, using `label-mono-lg` typography. Secondary buttons use a 1px #FFB1EE border with no fill.
- **Input Fields:** Pure black background with a 1px #A0A0A0 border. On focus, the border transitions to #FFB1EE and a subtle "glow" is achieved via a 1px outer stroke—not a soft shadow.
- **Chips/Badges:** Small, rectangular badges for HTTP methods (e.g., GET, POST). GET should use the secondary green (#00FF00); other methods should use the tertiary gray or primary pink.
- **Cards:** No shadows. Defined by a 1px border (#222222). Headers within cards should have a solid bottom border to separate metadata from content.
- **API Response Viewer:** Use a dark charcoal background (#080808) with syntax highlighting that utilizes only Pink, Green, and White.
- **Checkboxes/Radios:** Square and sharp. Active states must use a solid #FFB1EE fill.