/**
 * Dynamic text sizing for T-shirt quote overlays
 * Calculates appropriate font size, line height, and letter spacing
 * based on quote character count to ensure quotes always fit on the shirt
 */

interface ShirtTextStyles {
  fontSize: string;
  lineHeight: number;
  letterSpacing: string;
  authorFontSize: string;
}

/**
 * Calculate appropriate text styles for a quote based on its length
 * @param quoteText - The quote text to size
 * @param isStorePage - Whether this is for the larger Store page display
 * @returns CSS styles for the quote text
 */
export function getShirtQuoteStyles(quoteText: string, isStorePage: boolean = false): ShirtTextStyles {
  const charCount = quoteText.length;
  
  // Base multiplier for store page (larger) vs archive page (smaller cards)
  const sizeMultiplier = isStorePage ? 1.5 : 1;
  
  // Define breakpoints for different quote lengths
  // Very short quotes (under 50 chars) - largest font
  if (charCount < 50) {
    return {
      fontSize: `${0.95 * sizeMultiplier}rem`,
      lineHeight: 1.35,
      letterSpacing: '0.02em',
      authorFontSize: `${0.7 * sizeMultiplier}rem`,
    };
  }
  
  // Short quotes (50-100 chars)
  if (charCount < 100) {
    return {
      fontSize: `${0.85 * sizeMultiplier}rem`,
      lineHeight: 1.3,
      letterSpacing: '0.01em',
      authorFontSize: `${0.65 * sizeMultiplier}rem`,
    };
  }
  
  // Medium quotes (100-150 chars)
  if (charCount < 150) {
    return {
      fontSize: `${0.72 * sizeMultiplier}rem`,
      lineHeight: 1.25,
      letterSpacing: '0.01em',
      authorFontSize: `${0.55 * sizeMultiplier}rem`,
    };
  }
  
  // Long quotes (150-200 chars)
  if (charCount < 200) {
    return {
      fontSize: `${0.62 * sizeMultiplier}rem`,
      lineHeight: 1.22,
      letterSpacing: '0em',
      authorFontSize: `${0.5 * sizeMultiplier}rem`,
    };
  }
  
  // Very long quotes (200-280 chars)
  if (charCount < 280) {
    return {
      fontSize: `${0.52 * sizeMultiplier}rem`,
      lineHeight: 1.2,
      letterSpacing: '-0.01em',
      authorFontSize: `${0.45 * sizeMultiplier}rem`,
    };
  }
  
  // Extra long quotes (280+ chars) - smallest readable font
  return {
    fontSize: `${0.44 * sizeMultiplier}rem`,
    lineHeight: 1.18,
    letterSpacing: '-0.02em',
    authorFontSize: `${0.4 * sizeMultiplier}rem`,
  };
}

/**
 * Get responsive QR code size based on author font size
 * @param authorFontSize - The author font size in rem
 * @param isStorePage - Whether this is for the larger Store page display
 * @returns Tailwind classes for QR code sizing
 */
export function getQRCodeClasses(isStorePage: boolean = false): string {
  if (isStorePage) {
    return 'h-4 w-4 md:h-5 md:w-5';
  }
  return 'h-2.5 w-2.5 md:h-3 md:w-3';
}
