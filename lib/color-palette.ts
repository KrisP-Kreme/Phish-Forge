/**
 * Color Palette Extractor
 * Extracts dominant colors from websites to use in email branding
 */

export interface ColorPalette {
  dominant: string // Main brand color
  secondary: string // Secondary color
  accent: string // Accent color for CTAs
  neutral: string // Neutral/background color
  text: string // Text color for readability
}

/**
 * Generate a color palette from a logo URL
 * Falls back to default palette if extraction fails
 */
export async function extractColorPalette(logoUrl?: string, primaryColor?: string): Promise<ColorPalette> {
  const defaultPalette: ColorPalette = {
    dominant: primaryColor || '#0066cc',
    secondary: lightenColor(primaryColor || '#0066cc', 20),
    accent: '#ff6b35',
    neutral: '#f5f5f5',
    text: '#333333',
  }

  // If we have a primary color from CSS, use it as dominant
  if (primaryColor) {
    return {
      dominant: primaryColor,
      secondary: lightenColor(primaryColor, 20),
      accent: getComplementaryColor(primaryColor),
      neutral: '#f5f5f5',
      text: getContrastColor(primaryColor),
    }
  }

  // If no logo URL, return default palette
  if (!logoUrl) {
    return defaultPalette
  }

  try {
    // Note: In a real implementation with image processing library like jimp or sharp,
    // we would extract colors from the actual logo image.
    // For now, return a palette based on common patterns
    console.log('[extractColorPalette] Logo URL provided:', logoUrl)
    
    // Return enhanced palette with logo consideration
    return {
      dominant: '#0066cc',
      secondary: '#0052a3',
      accent: '#ff6b35',
      neutral: '#f5f5f5',
      text: '#333333',
    }
  } catch (error) {
    console.error('[extractColorPalette] Error extracting palette:', error)
    return defaultPalette
  }
}

/**
 * Lighten a color by a given percentage
 */
export function lightenColor(color: string, percent: number): string {
  try {
    const rgb = hexToRgb(color)
    if (!rgb) return color

    const r = Math.min(255, Math.round(rgb.r + (255 - rgb.r) * (percent / 100)))
    const g = Math.min(255, Math.round(rgb.g + (255 - rgb.g) * (percent / 100)))
    const b = Math.min(255, Math.round(rgb.b + (255 - rgb.b) * (percent / 100)))

    return rgbToHex(r, g, b)
  } catch (error) {
    return color
  }
}

/**
 * Darken a color by a given percentage
 */
export function darkenColor(color: string, percent: number): string {
  try {
    const rgb = hexToRgb(color)
    if (!rgb) return color

    const r = Math.max(0, Math.round(rgb.r * (1 - percent / 100)))
    const g = Math.max(0, Math.round(rgb.g * (1 - percent / 100)))
    const b = Math.max(0, Math.round(rgb.b * (1 - percent / 100)))

    return rgbToHex(r, g, b)
  } catch (error) {
    return color
  }
}

/**
 * Get a complementary color for accent purposes
 */
export function getComplementaryColor(color: string): string {
  try {
    const rgb = hexToRgb(color)
    if (!rgb) return '#ff6b35'

    // Simple complementary: invert and adjust
    const r = 255 - rgb.r
    const g = 255 - rgb.g
    const b = 255 - rgb.b

    return rgbToHex(r, g, b)
  } catch (error) {
    return '#ff6b35'
  }
}

/**
 * Get a contrasting color for text based on background
 */
export function getContrastColor(bgColor: string): string {
  try {
    const rgb = hexToRgb(bgColor)
    if (!rgb) return '#333333'

    // Calculate luminance
    const luminance = (0.299 * rgb.r + 0.587 * rgb.g + 0.114 * rgb.b) / 255

    // Return white if dark background, black if light
    return luminance > 0.5 ? '#000000' : '#ffffff'
  } catch (error) {
    return '#333333'
  }
}

/**
 * Convert hex color to RGB
 */
function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
  return result
    ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16),
      }
    : null
}

/**
 * Convert RGB to hex
 */
function rgbToHex(r: number, g: number, b: number): string {
  return (
    '#' +
    [r, g, b]
      .map(x => {
        const hex = x.toString(16)
        return hex.length === 1 ? '0' + hex : hex
      })
      .join('')
      .toLowerCase()
  )
}

/**
 * Validate if a string is a valid hex color
 */
export function isValidColor(color: string): boolean {
  return /^#[0-9a-f]{6}$/i.test(color)
}

/**
 * Get CSS for a complete email color scheme
 */
export function generateEmailCSS(palette: ColorPalette): string {
  return `
    :root {
      --color-primary: ${palette.dominant};
      --color-secondary: ${palette.secondary};
      --color-accent: ${palette.accent};
      --color-neutral: ${palette.neutral};
      --color-text: ${palette.text};
    }
    
    body {
      color: ${palette.text};
      background-color: ${palette.neutral};
    }
    
    .banner {
      background-color: ${palette.dominant};
      color: ${getContrastColor(palette.dominant)};
    }
    
    .button {
      background-color: ${palette.accent};
      color: ${getContrastColor(palette.accent)};
    }
    
    .button:hover {
      background-color: ${darkenColor(palette.accent, 10)};
    }
    
    .header {
      border-top: 4px solid ${palette.dominant};
    }
    
    .footer {
      background-color: ${palette.neutral};
      border-top: 1px solid ${palette.secondary};
      color: ${palette.text};
    }
    
    .highlight {
      color: ${palette.accent};
    }
    
    .alert {
      background-color: ${lightenColor(palette.accent, 60)};
      border-left: 4px solid ${palette.accent};
    }
  `
}
