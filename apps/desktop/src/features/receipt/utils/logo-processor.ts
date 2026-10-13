/**
 * Production-ready Logo Processor for Thermal Receipts.
 * 
 * Features:
 * 1. Binary Magic Bytes (Signature) validation — not just file extensions
 * 2. Strict SVG sanitization (blocks scripts, event handlers, active content)
 * 3. File size (max 5MB) and dimension checks
 * 4. Standardization to PNG data URL via HTML Canvas
 * 5. Aspect-ratio preserving scaling
 * 6. Floyd-Steinberg error diffusion dithering & monochrome thresholding
 *    to prevent washed-out or faint prints on 203/300 DPI thermal paper.
 */

export interface LogoValidationResult {
  valid: boolean;
  error?: string;
  dataUrl?: string;
  originalFormat?: string;
  width?: number;
  height?: number;
}

export interface LogoProcessOptions {
  monochrome?: boolean; // Apply Floyd-Steinberg dithering for thermal print
  threshold?: number;   // 0-255 luminance cutoff (default: 138)
  maxWidth?: number;    // e.g. 500px for print rasterization
  maxHeight?: number;   // e.g. 250px
}

/**
 * Sniffs the actual image format from binary magic numbers.
 */
export async function detectImageFormat(file: File): Promise<string | null> {
  const buffer = await file.slice(0, 32).arrayBuffer();
  const bytes = new Uint8Array(buffer);

  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  ) {
    return 'image/png';
  }

  // JPEG / JPG: FF D8 FF
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return 'image/jpeg';
  }

  // GIF: 47 49 46 38 (GIF8)
  if (bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x38) {
    return 'image/gif';
  }

  // BMP: 42 4D (BM)
  if (bytes[0] === 0x42 && bytes[1] === 0x4d) {
    return 'image/bmp';
  }

  // WebP: RIFF ... WEBP (bytes 0-3 "RIFF", bytes 8-11 "WEBP")
  if (
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  ) {
    return 'image/webp';
  }

  // TIFF: Little endian (II: 49 49 2A 00) or Big endian (MM: 4D 4D 00 2A)
  if (
    (bytes[0] === 0x49 && bytes[1] === 0x49 && bytes[2] === 0x2a && bytes[3] === 0x00) ||
    (bytes[0] === 0x4d && bytes[1] === 0x4d && bytes[2] === 0x00 && bytes[3] === 0x2a)
  ) {
    return 'image/tiff';
  }

  // ICO: 00 00 01 00
  if (bytes[0] === 0x00 && bytes[1] === 0x00 && bytes[2] === 0x01 && bytes[3] === 0x00) {
    return 'image/x-icon';
  }

  // SVG inspection (text with xml or svg tag)
  const textSample = await file.slice(0, 1024).text();
  const trimmed = textSample.trim().toLowerCase();
  if (trimmed.includes('<svg') || (trimmed.startsWith('<?xml') && trimmed.includes('<svg'))) {
    return 'image/svg+xml';
  }

  return null;
}

/**
 * Sanitizes an SVG string to prevent XSS and malicious active content.
 */
export function sanitizeSvg(svgContent: string): string {
  // Check for dangerous scripts or event handlers
  const forbiddenPatterns = [
    /<script[\s\S]*?>[\s\S]*?<\/script>/gi,
    /<script[\s\S]*?>/gi,
    /\bon[a-z]+\s*=\s*(?:'[^']*'|"[^"]*"|[^\s>]+)/gi, // onload=..., onclick=..., etc.
    /javascript:/gi,
    /data:\s*text\/html/gi,
    /<foreignObject[\s\S]*?>[\s\S]*?<\/foreignObject>/gi,
    /<iframe[\s\S]*?>/gi,
    /<embed[\s\S]*?>/gi,
    /<object[\s\S]*?>/gi,
  ];

  let clean = svgContent;
  for (const pattern of forbiddenPatterns) {
    clean = clean.replace(pattern, '');
  }

  return clean;
}

/**
 * Validates and processes any uploaded logo file into a thermal-optimized PNG.
 */
export async function processLogoFile(
  file: File,
  options: LogoProcessOptions = {}
): Promise<LogoValidationResult> {
  const MAX_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB

  if (!file) {
    return { valid: false, error: 'No file provided.' };
  }

  if (file.size > MAX_SIZE_BYTES) {
    return { valid: false, error: 'File size exceeds 5MB limit. Please upload a smaller image.' };
  }

  const detectedFormat = await detectImageFormat(file);
  if (!detectedFormat) {
    return {
      valid: false,
      error: 'Unsupported or corrupt image format. Supported formats: PNG, JPG, WebP, SVG, GIF, BMP, TIFF, ICO.',
    };
  }

  try {
    let sourceUrl: string;

    if (detectedFormat === 'image/svg+xml') {
      const rawText = await file.text();
      const sanitized = sanitizeSvg(rawText);

      // Verify that the sanitized SVG is still valid SVG
      if (!sanitized.includes('<svg') || !sanitized.includes('</svg>')) {
        return { valid: false, error: 'Invalid or unsafe SVG file.' };
      }

      sourceUrl = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(sanitized)}`;
    } else {
      sourceUrl = await readFileAsDataURL(file);
    }

    // Load into an HTML Image element to obtain dimensions and rasterize via Canvas
    const img = await loadImage(sourceUrl);

    if (img.width < 10 || img.height < 10) {
      return { valid: false, error: 'Image dimensions are too small to be printable.' };
    }

    if (img.width > 3000 || img.height > 3000) {
      return { valid: false, error: 'Image dimensions exceed 3000px maximum limit.' };
    }

    // Standardize to Canvas PNG
    const processedDataUrl = rasterizeToMonochrome(img, options);

    return {
      valid: true,
      dataUrl: processedDataUrl,
      originalFormat: detectedFormat,
      width: img.width,
      height: img.height,
    };
  } catch (err) {
    return {
      valid: false,
      error: `Failed to process image: ${err instanceof Error ? err.message : 'Unknown error'}`,
    };
  }
}

/**
 * Draws the image onto a standard Canvas, scales down proportionally,
 * fills transparent regions with pure white, and optionally applies
 * Floyd-Steinberg error diffusion dithering for crisp monochrome thermal print.
 */
export function rasterizeToMonochrome(
  img: HTMLImageElement,
  options: LogoProcessOptions = {}
): string {
  const maxWidth = options.maxWidth ?? 400;
  const maxHeight = options.maxHeight ?? 180;
  const applyDither = options.monochrome ?? false;
  const threshold = options.threshold ?? 138;

  // Preserve aspect ratio
  let targetWidth = img.width;
  let targetHeight = img.height;

  if (targetWidth > maxWidth) {
    targetHeight = Math.round((targetHeight * maxWidth) / targetWidth);
    targetWidth = maxWidth;
  }

  if (targetHeight > maxHeight) {
    targetWidth = Math.round((targetWidth * maxHeight) / targetHeight);
    targetHeight = maxHeight;
  }

  const canvas = document.createElement('canvas');
  canvas.width = targetWidth;
  canvas.height = targetHeight;

  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) {
    throw new Error('Canvas 2D context unavailable.');
  }

  // Thermal printers need pure white for transparent backgrounds
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, targetWidth, targetHeight);

  // Draw image
  ctx.drawImage(img, 0, 0, targetWidth, targetHeight);

  if (applyDither) {
    // Floyd-Steinberg Dithering algorithm for razor-sharp monochrome thermal print
    const imgData = ctx.getImageData(0, 0, targetWidth, targetHeight);
    const data = imgData.data;

    // Convert to grayscale luminance array
    const w = targetWidth;
    const h = targetHeight;
    const gray = new Float32Array(w * h);

    for (let i = 0; i < data.length; i += 4) {
      // Relative luminance (sRGB formula)
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const a = data[i + 3] / 255;
      // White blend for alpha
      const lum = (0.299 * r + 0.587 * g + 0.114 * b) * a + 255 * (1 - a);
      gray[i / 4] = lum;
    }

    // Error diffusion loop
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const idx = y * w + x;
        const oldPixel = gray[idx];
        const newPixel = oldPixel < threshold ? 0 : 255;
        gray[idx] = newPixel;
        const quantError = oldPixel - newPixel;

        // Distribute error to neighboring pixels
        if (x + 1 < w) gray[idx + 1] += quantError * (7 / 16);
        if (x - 1 >= 0 && y + 1 < h) gray[(y + 1) * w + (x - 1)] += quantError * (3 / 16);
        if (y + 1 < h) gray[(y + 1) * w + x] += quantError * (5 / 16);
        if (x + 1 < w && y + 1 < h) gray[(y + 1) * w + (x + 1)] += quantError * (1 / 16);
      }
    }

    // Write back to canvas
    for (let i = 0; i < data.length; i += 4) {
      const val = gray[i / 4] < 128 ? 0 : 255;
      data[i] = val;
      data[i + 1] = val;
      data[i + 2] = val;
      data[i + 3] = 255;
    }

    ctx.putImageData(imgData, 0, 0);
  }

  return canvas.toDataURL('image/png');
}

function readFileAsDataURL(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('Failed to read file as data URL.'));
    reader.readAsDataURL(file);
  });
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Failed to load image element.'));
    img.src = src;
  });
}
