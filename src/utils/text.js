/**
 * Normaliza texto: convierte a minúsculas y elimina tildes
 * PRESERVA la letra "ñ" (caracter distintivo del español)
 * Ejemplo: "Capuchá" → "capucha"
 * Ejemplo: "Puños" → "puños" (no "punños")
 */
export const normalizeText = (text) => {
  if (!text) return '';
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/n\u0303/g, 'ñ') // ✅ Preservar la ñ antes de eliminar diacríticos
    .replace(/[\u0300-\u036f]/g, '') // Eliminar el resto de tildes
    .trim();
};

/**
 * Capitaliza la primera letra de cada palabra
 * Ejemplo: "pegado capucha" → "Pegado Capucha"
 */
export const capitalizeWords = (text) => {
  if (!text) return '';
  return text
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
};