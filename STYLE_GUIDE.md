# PhishForge Design System & Style Guide

> A comprehensive guide to the visual design, components, and patterns used in the PhishForge landing page.

## Table of Contents
1. [Design Philosophy](#design-philosophy)
2. [Color Palette](#color-palette)
3. [Typography](#typography)
4. [Spacing & Layout](#spacing--layout)
5. [Components](#components)
6. [Animations](#animations)
7. [Backgrounds & Textures](#backgrounds--textures)
8. [Responsive Design](#responsive-design)

---

## Design Philosophy

PhishForge uses a **hand-drawn scrapbook aesthetic** inspired by paper textures, watercolor washes, and organic materials. The design creates a warm, educational atmosphere that contrasts with typical cybersecurity interfaces, making the tool approachable while maintaining professionalism.

### Key Principles
- **Warm & Approachable**: Use warm parchment tones instead of cold tech blues
- **Paper-like Texture**: Subtle ruled paper and graph patterns create depth
- **Organic Accents**: Moss green and tea-stained yellows provide natural color accents
- **Clean Typography**: Large, bold headings with ample whitespace
- **Smooth Animations**: Framer Motion provides fluid, purposeful transitions

---

## Color Palette

### Light Theme (Default)

#### Core Colors
```css
--background: 45 70% 88%        /* Warm parchment yellow base */
--foreground: 220 8% 8%          /* Ink-black text */
--card: 40 18% 94%               /* Slightly warmer paper for cards */
--card-foreground: 220 8% 8%     /* Card text */
```

#### Accent & Interactive Colors
```css
--primary: 110 24% 35%           /* Moss green watercolor wash */
--primary-foreground: 0 0% 98%   /* White text on primary */
--secondary: 210 6% 28%          /* Charcoal grey */
--secondary-foreground: 0 0% 98% /* White text on secondary */
--accent: 100 30% 45%            /* Bright accent green */
--accent-foreground: 0 0% 98%    /* White text on accent */
```

#### Utility Colors
```css
--muted: 40 15% 92%              /* Pale paper tones */
--muted-foreground: 220 6% 40%   /* Muted text */
--destructive: 42 55% 50%        /* Tea-stained yellow for warnings */
--destructive-foreground: 220 8% 8%
--border: 40 12% 86%             /* Subtle borders */
--input: 40 18% 94%              /* Input backgrounds */
--ring: 110 24% 38%              /* Focus ring - moss green */
```

### Dark Theme

```css
--background: 220 10% 6%         /* Deep paper shadow */
--foreground: 40 20% 96%         /* Light cream text */
--primary: 110 22% 60%           /* Lighter moss green */
--accent: 115 25% 34%            /* Darker accent */
--border: 220 6% 14%             /* Dark borders */
```

### Usage Examples

```jsx
// Using CSS variables
style={{ backgroundColor: 'hsl(var(--background))' }}
style={{ color: 'hsl(var(--primary))' }}

// Using Tailwind utilities
className="bg-background text-foreground"
className="border-border"
className="text-primary hover:bg-primary/90"
```

---

## Typography

### Font Family
- **Primary**: Inter (Google Fonts)
- **Fallback**: System sans-serif

### Font Sizes & Scales

#### Headings
```css
/* Hero/Display Title */
text-4xl md:text-6xl lg:text-[5rem] xl:text-[6rem]
/* 2.25rem → 3.75rem → 5rem → 6rem */

/* Section Title */
text-3xl md:text-4xl
/* 1.875rem → 2.25rem */

/* Subsection */
text-2xl md:text-3xl
/* 1.5rem → 1.875rem */
```

#### Body Text
```css
/* Large Body */
text-lg md:text-xl lg:text-2xl
/* 1.125rem → 1.25rem → 1.5rem */

/* Regular Body */
text-base
/* 1rem */

/* Small Text */
text-sm
/* 0.875rem */
```

### Font Weights
- **Bold**: `font-bold` (700) - Used for headings and emphasis
- **Medium**: `font-medium` (500) - Used for buttons and nav items
- **Regular**: `font-normal` (400) - Default body text

### Text Colors
```jsx
// Primary text
className="text-foreground"

// Muted/secondary text
className="text-muted-foreground"

// Interactive elements
className="text-primary"

// On colored backgrounds
className="text-primary-foreground"
```

### Line Height & Letter Spacing
```css
leading-[1.1]         /* Tight leading for large headings */
tracking-tight        /* Condensed tracking for hero text */
leading-relaxed       /* Body text spacing */
```

---

## Spacing & Layout

### Container Widths
```css
max-w-7xl            /* Main content wrapper: 80rem (1280px) */
max-w-5xl            /* Section content: 64rem (1024px) */
max-w-2xl            /* Text blocks: 42rem (672px) */
```

### Padding Scale
```css
p-8 md:p-16 lg:p-24  /* Section padding */
p-3                   /* Card padding */
p-4                   /* Small container padding */
px-6 py-4            /* Navigation padding */
```

### Margin & Gap
```css
gap-8                 /* Standard element spacing */
gap-12                /* Large element spacing */
gap-20                /* Extra large (profile sections) */
mb-6                  /* Heading bottom margin */
mb-8                  /* Content bottom margin */
mb-12                 /* Section bottom margin */
mt-6                  /* Content top margin */
```

### Grid Layouts
```css
/* Two-column profile layout */
grid grid-cols-1 md:grid-cols-2 gap-20

/* Responsive content grid */
grid grid-cols-1 md:grid-cols-2 items-start gap-6
```

---

## Components

### 1. Navigation Bar

#### Main Horizontal Navigation
```jsx
<nav className="fixed top-0 left-0 right-0 z-50 border-b backdrop-blur-sm">
  <div className="max-w-7xl mx-auto px-6 py-4">
    {/* Logo & Links */}
  </div>
</nav>
```

**Characteristics:**
- Fixed positioning at top
- Backdrop blur effect: `backdrop-blur-sm`
- Bottom border with theme color
- Semi-transparent background: `hsl(var(--background) / 0.8)`
- z-index: 50

#### Side Dot Navigation
```jsx
<nav className="fixed top-0 right-0 h-screen flex flex-col justify-center z-30 p-4">
  <button className="w-3 h-3 rounded-full my-2 transition-all">
    {/* Active state: scale-150 */}
  </button>
</nav>
```

**Characteristics:**
- Fixed right side position
- Vertically centered
- Active indicator: `scale-150` transform
- Color shifts: primary (active) → muted (inactive)

### 2. Buttons

#### Primary Button
```jsx
<Button variant="default" size="lg">
  Join Now
</Button>
```

#### Outline Button (CTA)
```jsx
<Button 
  variant="outline" 
  size="lg"
  className="text-primary bg-transparent border border-primary hover:bg-primary hover:text-foreground"
>
  {buttonText}
</Button>
```

#### Button Variants
```typescript
variant: 'default' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'link'
size: 'default' | 'sm' | 'lg' | 'icon'
```

**States:**
- Default: `bg-primary text-primary-foreground`
- Hover: `hover:bg-primary/90`
- Focus: `focus-visible:ring-2 focus-visible:ring-ring`
- Disabled: `disabled:opacity-50`

### 3. Sections

Full-height sections with snap scrolling:

```jsx
<section className="relative w-full snap-start flex flex-col justify-center items-center p-8 md:p-16 lg:p-24 h-screen">
  {/* Content */}
</section>
```

**Layout Properties:**
- Snap scrolling: `snap-start` (child) + `snap-y snap-mandatory` (parent)
- Full viewport height: `h-screen` or `min-h-screen`
- Centered content: `flex justify-center items-center`
- Responsive padding: `p-8 md:p-16 lg:p-24`

### 4. Cards

#### Profile Card
```jsx
<div className="rounded-lg p-3 border w-full max-w-[420px]" 
     style={{ 
       backgroundColor: 'var(--background)', 
       borderColor: 'var(--border)' 
     }}>
  <div className="aspect-square rounded-lg overflow-hidden">
    {/* Image */}
  </div>
</div>
```

**Characteristics:**
- Subtle border with theme color
- Aspect ratio maintained: `aspect-square`
- Rounded corners: `rounded-lg`
- Card background matches theme

### 5. Icons

Using Lucide React icons:

```jsx
import { Shield, Copy, RotateCcw, X } from 'lucide-react'

<Shield className="w-8 h-8" style={{ color: 'hsl(var(--primary))' }} />
```

**Standard Sizes:**
- Large (Logo): `w-8 h-8` (32px)
- Medium (Actions): `w-6 h-6` (24px)
- Small (UI): `w-4 h-4` (16px)

### 6. Links

Social Media Links:
```jsx
<a href="..." 
   target="_blank" 
   rel="noopener noreferrer"
   className="text-[var(--accent-foreground)] hover:text-[var(--accent)]">
  <svg>...</svg>
</a>
```

Navigation Links:
```jsx
<button 
  className="text-base font-medium transition-all hover:scale-105"
  style={{ 
    color: isActive ? 'hsl(var(--primary))' : 'hsl(var(--muted-foreground))'
  }}>
  {label}
</button>
```

---

## Animations

### Framer Motion Patterns

#### 1. Fade In from Bottom
```jsx
<motion.div
  initial={{ opacity: 0, y: 50 }}
  animate={{ opacity: 1, y: 0 }}
  transition={{ duration: 0.5 }}
>
  {content}
</motion.div>
```

#### 2. Fade In with Delay
```jsx
<motion.div
  initial={{ opacity: 0, y: 20 }}
  animate={isActive ? { opacity: 1, y: 0 } : {}}
  transition={{ duration: 0.5, delay: 0.2 }}
>
  {content}
</motion.div>
```

#### 3. Scale In
```jsx
<motion.img
  initial={{ opacity: 0, scale: 0.8 }}
  animate={isActive ? { opacity: 1, scale: 1 } : {}}
  transition={{ duration: 0.5 }}
/>
```

#### 4. Exit Animation
```jsx
<motion.div
  initial={{ opacity: 0 }}
  animate={{ opacity: 1 }}
  exit={{ opacity: 0 }}
>
  {content}
</motion.div>
```

### Transition Patterns

#### Standard Transitions
```css
transition-all         /* All properties */
transition-colors      /* Color changes */
transition-opacity     /* Fade effects */
```

#### Timing Functions
```jsx
// Framer Motion
transition={{ duration: 0.5 }}
transition={{ duration: 0.6 }}
transition={{ stiffness: 100, damping: 30 }}

// CSS
/* Implicit: ease-out for most transitions */
```

### Scroll Progress Indicator
```jsx
const { scrollYProgress } = useScroll({ container: containerRef })
const scaleX = useSpring(scrollYProgress, { 
  stiffness: 100, 
  damping: 30, 
  restDelta: 0.001 
})

<motion.div style={{ scaleX }} />
```

---

## Backgrounds & Textures

### Paper Texture Pattern

The background uses a ruled paper effect with graph lines:

```css
body {
  background:
    /* Ruled lines (horizontal) */
    repeating-linear-gradient(
      to bottom,
      rgba(70, 130, 255, 0.12) 0px,
      rgba(70, 130, 255, 0.12) 1px,
      rgba(70, 130, 255, 0.06) 24px,
      transparent 24px
    ),
    /* Graph lines (vertical) */
    linear-gradient(
      90deg, 
      rgba(70,130,255,0.06) 0px, 
      rgba(70,130,255,0.06) 6px, 
      transparent 6px
    ),
    /* Base color */
    hsl(var(--background));
  
  background-size: auto, 100% 24px, auto;
  background-repeat: repeat, repeat, no-repeat;
}
```

**Effect:** Creates a subtle notebook paper texture with:
- Horizontal rules every 24px
- Vertical graph lines every 6px
- Semi-transparent blue lines (rgba 70,130,255)
- Layered over warm parchment background

### Noise Texture Utility
```css
.noise {
  background-image: url("data:image/svg+xml,...");
}
```

---

## Responsive Design

### Breakpoints

PhishForge uses Tailwind's default breakpoints:

```css
/* Mobile First */
base:  /* 0px+ */
sm:    /* 640px+ */
md:    /* 768px+ */
lg:    /* 1024px+ */
xl:    /* 1280px+ */
2xl:   /* 1536px+ */
```

### Responsive Patterns

#### 1. Progressive Font Scaling
```css
text-4xl md:text-6xl lg:text-[5rem] xl:text-[6rem]
```

#### 2. Adaptive Padding
```css
p-8 md:p-16 lg:p-24
px-6 md:px-8 lg:px-12
```

#### 3. Grid Collapse
```css
grid grid-cols-1 md:grid-cols-2
```

#### 4. Conditional Display
```css
hidden md:block                  /* Hide on mobile */
flex md:hidden                   /* Show on mobile only */
```

#### 5. Flexible Widths
```css
w-full max-w-[420px] md:max-w-[520px]
```

### Mobile Considerations
- **Navigation**: Scrollable sections with dot navigation remain accessible
- **Images**: Responsive sizing with `flex-shrink-0` to prevent crushing
- **Typography**: Dramatic scale reduction on mobile (6rem → 2.25rem)
- **Spacing**: Reduced padding on smaller screens (24 → 8)

---

## Accessibility

### Focus States
```css
focus-visible:outline-none 
focus-visible:ring-2 
focus-visible:ring-ring 
focus-visible:ring-offset-2
```

### ARIA Labels
```jsx
<button aria-label="Navigate to features">
  {/* Icon-only button */}
</button>
```

### Semantic HTML
- Use proper heading hierarchy (h1, h2, h3)
- `<nav>` for navigation elements
- `<section>` with `id` attributes for scroll targets
- `target="_blank"` paired with `rel="noopener noreferrer"`

### Scroll Behavior
```css
html {
  scroll-behavior: smooth;
}
```

### Hidden Scrollbars
```css
/* Chrome, Safari, Opera */
.overflow-y-auto::-webkit-scrollbar {
  display: none;
}

/* IE, Edge, Firefox */
.overflow-y-auto {
  -ms-overflow-style: none;
  scrollbar-width: none;
}
```

---

## Component Library

PhishForge uses **shadcn/ui** components built on:
- **Radix UI** primitives (headless, accessible)
- **Tailwind CSS** for styling
- **class-variance-authority** for variant management

### Key Components Used
- Button
- Card
- Badge
- Input
- Carousel
- Dialog
- Toast/Sonner (notifications)
- Accordion
- Tabs

### Customization Pattern
```typescript
const buttonVariants = cva(
  "base-classes",
  {
    variants: {
      variant: { /* ... */ },
      size: { /* ... */ }
    }
  }
)
```

---

## Animation Timing Reference

### Duration Scale
```typescript
50ms   // Instant feedback
100ms  // Quick transitions
200ms  // Standard transitions
500ms  // Content reveals (standard)
600ms  // Large content/images
800ms  // Page transitions
1000ms // Thinking/loading states
```

### Delays for Staggered Content
```typescript
delay: 0.2    // First stagger
delay: 0.4    // Second stagger
delay: 0.6    // Third stagger
```

---

## Logo & Branding

### PhishForge Logo
```jsx
<Shield className="w-8 h-8" style={{ color: 'hsl(var(--primary))' }} />
<span className="text-2xl font-bold">PhishForge</span>
```

**Characteristics:**
- Shield icon from Lucide React
- Moss green primary color
- Bold 2xl font size
- Paired with icon for recognition

### Mascot Image
- **File**: `/weldfish.png`
- **Usage**: Hero section decoration
- **Sizing**: `w-56 md:w-72 lg:w-96`

---

## Code Examples

### Complete Section Component
```jsx
<section
  id="features"
  className="relative w-full snap-start flex flex-col justify-center items-center p-8 md:p-16 lg:p-24 h-screen"
>
  <div className="flex items-start justify-between gap-12 flex-col">
    <motion.h2
      className="text-4xl md:text-6xl lg:text-[5rem] font-bold leading-[1.1] tracking-tight"
      initial={{ opacity: 0, y: 50 }}
      animate={isActive ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.5 }}
    >
      Why Us?
    </motion.h2>
    <motion.p
      className="text-lg md:text-xl lg:text-2xl max-w-2xl mt-6 text-muted-foreground"
      initial={{ opacity: 0, y: 50 }}
      animate={isActive ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.5, delay: 0.2 }}
    >
      We provide resources, mentorship, and a supportive network.
    </motion.p>
  </div>
</section>
```

### Theme-Aware Styling
```jsx
<div style={{ 
  backgroundColor: 'hsl(var(--background))', 
  borderColor: 'hsl(var(--border))' 
}}>
  {/* Content */}
</div>
```

---

## Design Tokens Summary

| Token | Light Value | Usage |
|-------|-------------|-------|
| `--background` | 45 70% 88% | Page background |
| `--foreground` | 220 8% 8% | Primary text |
| `--primary` | 110 24% 35% | Brand color, CTAs |
| `--accent` | 100 30% 45% | Interactive elements |
| `--border` | 40 12% 86% | Dividers, outlines |
| `--muted` | 40 15% 92% | Disabled states |
| `--destructive` | 42 55% 50% | Warnings |

---

## Version & Maintenance

- **Design System Version**: 1.0
- **Framework**: Next.js 15 + React 18
- **Styling**: Tailwind CSS v3 + CSS Variables
- **Animation**: Framer Motion
- **Components**: shadcn/ui (Radix UI)
- **Last Updated**: March 2026

---

## Resources

- [Tailwind CSS Documentation](https://tailwindcss.com)
- [Framer Motion Documentation](https://www.framer.com/motion)
- [shadcn/ui Components](https://ui.shadcn.com)
- [Radix UI Primitives](https://www.radix-ui.com)
- [Lucide Icons](https://lucide.dev)

---

*For questions or contributions to the design system, please contact the PhishForge development team.*
