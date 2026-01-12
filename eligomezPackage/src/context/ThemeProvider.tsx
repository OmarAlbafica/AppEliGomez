import React, { useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ThemeContext, ThemeContextType, createTheme, FontScale } from './ThemeContext';

interface ThemeProviderProps {
  children: React.ReactNode;
}

export const ThemeProvider: React.FC<ThemeProviderProps> = ({ children }) => {
  const [isDark, setIsDark] = useState(false);
  const [fontScale, setFontScale] = useState<FontScale>(1);
  const [isInitialized, setIsInitialized] = useState(false);

  // Cargar preferencias guardadas
  useEffect(() => {
    const loadPreferences = async () => {
      try {
        const savedTheme = await AsyncStorage.getItem('app_theme');
        const savedFontScale = await AsyncStorage.getItem('app_font_scale');

        if (savedTheme) {
          setIsDark(savedTheme === 'dark');
        }
        if (savedFontScale) {
          setFontScale(parseFloat(savedFontScale) as FontScale);
        }
      } catch (error) {
        console.error('Error cargando preferencias de tema:', error);
      } finally {
        setIsInitialized(true);
      }
    };

    loadPreferences();
  }, []);

  // Guardar cuando cambia el tema
  useEffect(() => {
    const saveTheme = async () => {
      try {
        await AsyncStorage.setItem('app_theme', isDark ? 'dark' : 'light');
      } catch (error) {
        console.error('Error guardando tema:', error);
      }
    };

    if (isInitialized) {
      saveTheme();
    }
  }, [isDark, isInitialized]);

  // Guardar cuando cambia la escala de fuente
  useEffect(() => {
    const saveFontScale = async () => {
      try {
        await AsyncStorage.setItem('app_font_scale', fontScale.toString());
      } catch (error) {
        console.error('Error guardando escala de fuente:', error);
      }
    };

    if (isInitialized) {
      saveFontScale();
    }
  }, [fontScale, isInitialized]);

  const toggleTheme = () => {
    setIsDark(!isDark);
  };

  const theme = createTheme(isDark, fontScale);

  const value: ThemeContextType = {
    theme,
    toggleTheme,
    setFontScale,
  };

  if (!isInitialized) {
    return null; // O mostrar un splash screen
  }

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
};
