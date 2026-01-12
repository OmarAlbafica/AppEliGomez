import React, { useState, useEffect } from 'react';
import { View, StyleSheet, StatusBar, SafeAreaView, Text, BackHandler } from 'react-native';
import {
  SafeAreaProvider,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';
import { ThemeProvider } from './src/context/ThemeProvider';
import { useAppTheme } from './src/context/ThemeContext';
import { HomeScreen } from './src/screens/HomeScreen';
import { LoginScreen } from './src/screens/LoginScreen';
import { CrearPedidoScreen } from './src/screens/CrearPedidoScreen';
import { ClientesScreen } from './src/screens/ClientesScreen';
import { EncomendistasScreen } from './src/screens/EncomendistasScreen';
import { PorRemunerarScreen } from './src/screens/PorRemunerarScreen';
import { ScannerScreen } from './src/screens/ScannerScreen';
import { ScannerScreenOptimizado } from './src/screens/ScannerScreenOptimizado';
import { ScannerScreenVisionCamera } from './src/screens/ScannerScreenVisionCamera';
import { HistorialScreenOptimizado } from './src/screens/HistorialScreenOptimizado';
import { RetiredTodayScreen } from './src/screens/RetiredTodayScreen';
import { SettingsScreen } from './src/screens/SettingsScreen';
import { Usuario } from './src/services/authService';

function AppContent() {
  const insets = useSafeAreaInsets();
  const theme = useAppTheme();
  const [usuario, setUsuario] = useState<Usuario | null>(null);
  const [currentScreen, setCurrentScreen] = useState<string>('login');

  // Deshabilitar botón atrás del dispositivo
  useEffect(() => {
    const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
      // Retornar true consume el evento y evita que cierre la app
      return true;
    });

    return () => backHandler.remove();
  }, []);

  const handleLoginSuccess = (usuarioData: Usuario) => {
    console.log('✅ Login exitoso, usuario:', usuarioData);
    setUsuario(usuarioData);
    setCurrentScreen('home');
  };

  const handleLogout = () => {
    console.log('🚪 Logout realizado');
    setUsuario(null);
    setCurrentScreen('login');
  };

  const handleNavigate = (screen: string) => {
    console.log('📱 Navegando a:', screen);
    setCurrentScreen(screen);
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top, backgroundColor: theme.colors.background }]}>
      <StatusBar barStyle={theme.isDark ? 'light-content' : 'dark-content'} backgroundColor={theme.colors.background} translucent />
      {currentScreen === 'login' && (
        <LoginScreen onLoginSuccess={handleLoginSuccess} />
      )}
      {currentScreen === 'home' && (
        <HomeScreen 
          usuario={usuario} 
          onLogout={handleLogout}
          onNavigate={handleNavigate}
        />
      )}
      {currentScreen === 'CrearPedido' && (
        <CrearPedidoScreen onNavigate={handleNavigate} />
      )}
      {currentScreen === 'Clientes' && (
        <ClientesScreen onNavigate={handleNavigate} />
      )}
      {currentScreen === 'Encomendistas' && (
        <EncomendistasScreen onNavigate={handleNavigate} />
      )}
      {currentScreen === 'Historial' && (
        <HistorialScreenOptimizado onNavigate={handleNavigate} />
      )}
      {currentScreen === 'PorRemunerar' && (
        <PorRemunerarScreen onNavigate={handleNavigate} />
      )}
      {currentScreen === 'RetiredToday' && (
        <RetiredTodayScreen onNavigate={handleNavigate} />
      )}
      {currentScreen === 'Scanner' && (
        <ScannerScreenVisionCamera onNavigate={handleNavigate} />
      )}
      {currentScreen === 'ScannerOptimizado' && (
        <ScannerScreenVisionCamera onNavigate={handleNavigate} />
      )}
      {currentScreen === 'HistorialOptimizado' && (
        <HistorialScreenOptimizado onNavigate={handleNavigate} />
      )}
      {currentScreen === 'Settings' && (
        <SettingsScreen 
          onNavigate={handleNavigate}
          onClose={() => setCurrentScreen('home')}
        />
      )}
      {currentScreen === 'QRGenerator' && (
        <View style={styles.container}>
          <Text style={{ fontSize: 24, fontWeight: 'bold', marginTop: 20, marginLeft: 20, color: theme.colors.primary }}>
            🎫 QR Generator
          </Text>
          <Text style={{ fontSize: 16, marginLeft: 20, marginTop: 10, color: theme.colors.textSecondary }}>
            Próximamente: Generador de códigos QR para pedidos
          </Text>
        </View>
      )}
    </View>
  );
}

function App() {
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <AppContent />
      </ThemeProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});

export default App;
