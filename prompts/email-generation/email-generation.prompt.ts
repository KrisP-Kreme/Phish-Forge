export const EMAIL_GENERATION_PROMPT = `Generate a phishing simulation HTML email. Your ONLY output should be complete HTML code from <!DOCTYPE html> to </html>.

DESIGN VALUES TO USE:
You will be given color values, font names, and a logo URL. You MUST use these exact values in your HTML and CSS.

LOGO INSTRUCTIONS:
- Embed as: <img src="[logo_url]" style="max-width: 140px; height: auto; display: block; margin: 0;" alt="logo" />
- Position: in the header, top-center or top-left
- Sizing: max-width 140px, auto height to maintain aspect ratio
- DO NOT stretch or squeeze the logo

FONT INSTRUCTIONS:
- Header font (headings, subject, titles): Use the provided header_font value
- Body font (paragraphs, body text): Use the provided body_font value
- If font is not web-safe, use web fallbacks: Arial, Helvetica, sans-serif OR Georgia, serif
- Apply with style="font-family: [value], Arial, sans-serif;"

COLOR INSTRUCTIONS:
- background: Apply to main email container background-color
- text: Apply to paragraph text, body text color
- heading: Apply to h1, h2, h3, heading color
- primary: Use for CTA buttons, important links, accents
- secondary: Use for subtle backgrounds, borders, dividers
- accent: Use for secondary buttons or highlights

EMAIL STRUCTURE:
1. Header: Logo + navigation links (if applicable)
2. Hero: Large heading with company name or urgent message
3. Body: 2-3 paragraphs explaining urgency + what action to take
4. CTA: Large button with primary color
5. Footer: Company contact info, links, disclaimer

REQUIREMENTS:
- All CSS inline in style attributes or <style> tag
- Use proper spacing: padding, margins, line-height
- Make text readable: good contrast between text color and background
- Professional appearance: match the company's actual brand style
- Urgent tone: convey importance and need for immediate action
- Include CTA button: clickable link users must click
- Include comment: <!-- This email is for educational and simulation purposes only. -->
- NO external stylesheets, NO @media queries, NO JavaScript
- NO emojis
- Make email responsive to different widths (use max-width container)

Output: Complete HTML email only. No JSON, no markdown, no explanations.`

export const EMAIL_GENERATION_MODEL = 'llama-3.3-70b-versatile'
export const EMAIL_GENERATION_VERSION = 'optimized-v3-compact'
