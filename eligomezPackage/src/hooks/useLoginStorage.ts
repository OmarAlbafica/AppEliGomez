import { useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface LoginData {
  email: string;
  rememberMe: boolean;
  currentUserEmail?: string;  // 🔴 Email del usuario actualmente logueado
}

const STORAGE_KEY = '@eli_gomez_login';
const CURRENT_USER_KEY = '@eli_gomez_current_user';  // 🔴 Nuevo storage para usuario actual

export const useLoginStorage = () => {
  const [loginData, setLoginData] = useState<LoginData>({
    email: '',
    rememberMe: false,
    currentUserEmail: undefined,
  });
  const [isLoading, setIsLoading] = useState(true);

  // Cargar datos al iniciar
  useEffect(() => {
    loadLoginData();
  }, []);

  const loadLoginData = async () => {
    try {
      const data = await AsyncStorage.getItem(STORAGE_KEY);
      const currentUser = await AsyncStorage.getItem(CURRENT_USER_KEY);  // 🔴
      if (data) {
        const parsedData = JSON.parse(data);
        setLoginData({
          ...parsedData,
          currentUserEmail: currentUser || undefined,  // 🔴
        });
      }
    } catch (error) {
      console.error('Error cargando datos de login:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Guardar datos de login
  const saveLoginData = async (email: string, rememberMe: boolean) => {
    try {
      const dataToSave = { email, rememberMe };
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(dataToSave));
      setLoginData({
        ...dataToSave,
        currentUserEmail: email,  // 🔴 Guardar como usuario actual
      });
    } catch (error) {
      console.error('Error guardando datos de login:', error);
    }
  };

  // 🔴 Nueva función: Guardar email del usuario actualmente logueado
  const saveCurrentUserEmail = async (email: string) => {
    try {
      await AsyncStorage.setItem(CURRENT_USER_KEY, email);
      setLoginData((prev) => ({
        ...prev,
        currentUserEmail: email,
      }));
    } catch (error) {
      console.error('Error guardando email del usuario actual:', error);
    }
  };

  // 🔴 Nueva función: Obtener email sin necesidad de estado
  const getCurrentUserEmail = async (): Promise<string | null> => {
    try {
      return await AsyncStorage.getItem(CURRENT_USER_KEY);
    } catch (error) {
      console.error('Error obteniendo email del usuario actual:', error);
      return null;
    }
  };

  // Limpiar datos guardados
  const clearLoginData = async () => {
    try {
      await AsyncStorage.removeItem(STORAGE_KEY);
      await AsyncStorage.removeItem(CURRENT_USER_KEY);  // 🔴
      setLoginData({ email: '', rememberMe: false, currentUserEmail: undefined });
    } catch (error) {
      console.error('Error limpiando datos de login:', error);
    }
  };

  return {
    loginData,
    isLoading,
    saveLoginData,
    clearLoginData,
    saveCurrentUserEmail,  // 🔴
    getCurrentUserEmail,   // 🔴
  };
};
