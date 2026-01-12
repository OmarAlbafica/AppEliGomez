import React, { createContext, useContext, useState } from 'react';

// Escala de fuente: 1 = 100%, 1.5 = 150%, 2 = 200%, 4 = 400%
export type FontScale = 1 | 1.25 | 1.5 | 1.75 | 2 | 2.5 | 3 | 4;

export interface Theme {
  isDark: boolean;
  fontScale: FontScale;
  
  // Colores
  colors: {
    background: string;
    surface: string;
    text: string;
    textSecondary: string;
    border: string;
    divider: string;
    primary: string;
    primaryLight: string;
    success: string;
    warning: string;
    error: string;
    info: string;
  };
  
  // Funciones para escalar dimensiones
  scale: (size: number) => number;
}

// Colores para Light Mode
const lightColors = {
  background: '#f5f5f5',
  surface: '#ffffff',
  text: '#1a1a1a',
  textSecondary: '#666666',
  border: '#dddddd',
  divider: '#eeeeee',
  primary: '#667eea',
  primaryLight: '#e8ebf7',
  success: '#4CAF50',
  warning: '#FFC107',
  error: '#F44336',
  info: '#2196F3',
};

// Colores para Dark Mode
const darkColors = {
  background: '#0a0a0a',
  surface: '#1a1a1a',
  text: '#ffffff',
  textSecondary: '#b0b0b0',
  border: '#333333',
  divider: '#2a2a2a',
  primary: '#7c8ff0',
  primaryLight: '#2d3f6a',
  success: '#66bb6a',
  warning: '#ffa726',
  error: '#ef5350',
  info: '#42a5f5',
};

export interface ThemeContextType {
  theme: Theme;
  toggleTheme: () => void;
  setFontScale: (scale: FontScale) => void;
}

export const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

/**
 * Hook para usar el tema en cualquier componente
 */
export const useTheme = (): ThemeContextType => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme debe estar dentro de ThemeProvider');
  }
  return context;
};

/**
 * Hook para obtener solo el tema (útil para estilos)
 */
export const useAppTheme = (): Theme => {
  const { theme } = useTheme();
  return theme;
};

/**
 * Crear tema basado en isDark y fontScale
 */
export const createTheme = (isDark: boolean, fontScale: FontScale): Theme => {
  const colors = isDark ? darkColors : lightColors;
  
  return {
    isDark,
    fontScale,
    colors,
    scale: (size: number) => size * fontScale,
  };
};
