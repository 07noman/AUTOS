/**
 * Pure TypeScript Code 128 (Subset B) SVG Barcode Generator.
 * Zero external runtime dependencies, ultra-crisp monochrome vector output
 * optimized for 203 DPI and 300 DPI thermal printers.
 */

// Code 128 pattern table (patterns of bar and space widths, 11 modules each except stop which is 13)
const CODE128_PATTERNS: number[] = [
  0x212222, 0x222122, 0x222221, 0x121223, 0x121322, 0x131222, 0x122213, 0x122312, 0x132212, 0x221213, // 0-9
  0x221312, 0x231212, 0x112232, 0x122132, 0x122231, 0x113222, 0x123122, 0x123221, 0x223211, 0x221132, // 10-19
  0x221231, 0x213212, 0x223112, 0x312131, 0x311222, 0x321122, 0x321221, 0x312212, 0x322112, 0x322211, // 20-29
  0x212123, 0x212321, 0x232121, 0x111323, 0x131123, 0x131321, 0x112313, 0x132113, 0x132311, 0x211313, // 30-39
  0x231113, 0x231311, 0x112133, 0x112331, 0x132131, 0x113123, 0x113321, 0x133121, 0x313121, 0x211331, // 40-49
  0x231131, 0x213113, 0x213311, 0x213131, 0x311123, 0x311321, 0x331121, 0x312113, 0x312311, 0x332111, // 50-59
  0x314111, 0x221411, 0x431111, 0x111224, 0x111422, 0x121124, 0x121421, 0x141122, 0x141221, 0x112214, // 60-69
  0x112412, 0x122114, 0x122411, 0x142112, 0x142211, 0x241211, 0x221114, 0x413111, 0x241112, 0x134111, // 70-79
  0x111242, 0x121142, 0x121241, 0x114212, 0x124112, 0x124211, 0x411212, 0x421112, 0x421211, 0x212141, // 80-89
  0x214121, 0x412121, 0x111143, 0x111341, 0x131141, 0x114113, 0x114311, 0x411113, 0x411311, 0x113141, // 90-99
  0x114131, 0x311141, 0x411131, 0x211412, 0x211214, 0x211232, 0x2331112 // 100-106 (106 is STOP pattern)
];

const START_CODE_B = 104;
const STOP_CODE = 106;

/**
 * Encodes text into Code 128B module widths (array of 1s and 0s).
 */
export function encodeCode128B(text: string): number[] {
  const safeText = text.replace(/[^\x20-\x7E]/g, '');
  if (!safeText) return [];

  const codes: number[] = [START_CODE_B];
  let checksum = START_CODE_B;

  for (let i = 0; i < safeText.length; i++) {
    const code = safeText.charCodeAt(i) - 32;
    codes.push(code);
    checksum += code * (i + 1);
  }

  const checkCode = checksum % 103;
  codes.push(checkCode);
  codes.push(STOP_CODE);

  // Convert pattern to modules
  const modules: number[] = [];
  // Quiet zone at start
  for (let q = 0; q < 10; q++) modules.push(0);

  for (let idx = 0; idx < codes.length; idx++) {
    const code = codes[idx];
    const pattern = CODE128_PATTERNS[code];
    const digits = pattern.toString(16).split('').map(d => parseInt(d, 10));

    let isBar = true;
    for (const width of digits) {
      for (let w = 0; w < width; w++) {
        modules.push(isBar ? 1 : 0);
      }
      isBar = !isBar;
    }
  }

  // Quiet zone at end
  for (let q = 0; q < 10; q++) modules.push(0);

  return modules;
}

/**
 * Generates an SVG string of a Code 128 barcode.
 */
export function generateBarcodeSvg(
  text: string,
  options: {
    height?: number;
    moduleWidth?: number;
    showText?: boolean;
    fontSize?: number;
  } = {}
): string {
  const height = options.height ?? 46;
  const moduleWidth = options.moduleWidth ?? 1.5;
  const showText = options.showText ?? true;
  const fontSize = options.fontSize ?? 11;

  const modules = encodeCode128B(text);
  if (modules.length === 0) return '';

  const totalWidth = modules.length * moduleWidth;
  const svgHeight = showText ? height + fontSize + 4 : height;

  let rects = '';
  let inBar = false;
  let barStart = 0;

  for (let i = 0; i < modules.length; i++) {
    if (modules[i] === 1) {
      if (!inBar) {
        inBar = true;
        barStart = i;
      }
    } else {
      if (inBar) {
        inBar = false;
        const x = barStart * moduleWidth;
        const width = (i - barStart) * moduleWidth;
        rects += `<rect x="${x.toFixed(2)}" y="0" width="${width.toFixed(2)}" height="${height}" fill="#000000"/>`;
      }
    }
  }

  if (inBar) {
    const x = barStart * moduleWidth;
    const width = (modules.length - barStart) * moduleWidth;
    rects += `<rect x="${x.toFixed(2)}" y="0" width="${width.toFixed(2)}" height="${height}" fill="#000000"/>`;
  }

  const textElement = showText
    ? `<text x="${(totalWidth / 2).toFixed(2)}" y="${(height + fontSize).toFixed(2)}" text-anchor="middle" font-family="monospace" font-size="${fontSize}px" font-weight="600" fill="#000000" letter-spacing="1px">${text}</text>`
    : '';

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${totalWidth.toFixed(2)} ${svgHeight.toFixed(2)}" width="${totalWidth.toFixed(2)}" height="${svgHeight.toFixed(2)}" style="display:block;margin:0 auto;background:#ffffff;">
  ${rects}
  ${textElement}
</svg>`;
}
