import { Dimensions } from 'react-native';

const { width, height } = Dimensions.get('window');

// Guidelinesize están basadas en dispositivo estándar ~5"
const guidelineBaseWidth: number = 414;
const guidelineBaseHeight: number = 736;

const horizontalScale = (size: number): number =>
  Number(((width / guidelineBaseWidth) * size).toFixed(2));

const verticalScale = (size: number): number =>
  Number(((height / guidelineBaseHeight) * size).toFixed(2));

const moderateScale = (size: number, factor = 0.5): number =>
  Number((size + (horizontalScale(size) - size) * factor).toFixed(2));

type ScaleType = 'w' | 'h' | 'm';

/**
 * Escala un valor en función del tipo de escala especificado.
 * Por defecto usa escala moderada para mejor compatibilidad.
 * @param size El valor a escalar.
 * @param type El tipo de escala (w=ancho, h=alto, m=moderada). Por defecto 'm'
 * @param factor Factor de moderación (0-1). Por defecto 0.5
 */
const scale = (size: number, type: ScaleType = 'm', factor: number = 0.5): number => {
  if (isNaN(size)) {
    throw new Error('El valor proporcionado no es un número.');
  }
  switch (type) {
    case 'w':
      return horizontalScale(size);
    case 'h':
      return verticalScale(size);
    default:
      return moderateScale(size, factor);
  }
};

export { scale, horizontalScale, verticalScale, moderateScale };
