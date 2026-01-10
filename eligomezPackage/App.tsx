import React, { useState } from 'react';
import { View, StyleSheet, StatusBar, SafeAreaView } from 'react-native';
import {
  SafeAreaProvider,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';
import { HomeScreen } from './src/screens/HomeScreen';
import { LoginScreen } from './src/screens/LoginScreen';
import { CrearPedidoScreen } from './src/screens/CrearPedidoScreen';
import { ClientesScreen } from './src/screens/ClientesScreen';
import { EncomendistasScreen } from './src/screens/EncomendistasScreen';
import { HistorialScreen } from './src/screens/HistorialScreen';
import { PorRemunerarScreen } from './src/screens/PorRemunerarScreen';
import { ScannerScreen } from './src/screens/ScannerScreen';
import { Usuario } from './src/services/authService';

function AppContent() {
  const insets = useSafeAreaInsets();
  const [usuario, setUsuario] = useState<Usuario | null>(null);
  const [currentScreen, setCurrentScreen] = useState<string>('login');

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
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
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
        <HistorialScreen onNavigate={handleNavigate} />
      )}
      {currentScreen === 'PorRemunerar' && (
        <PorRemunerarScreen onNavigate={handleNavigate} />
      )}
      {currentScreen === 'Scanner' && (
        <ScannerScreen onNavigate={handleNavigate} />
      )}
    </View>
  );
}

function App() {
  return (
    <SafeAreaProvider>
      <AppContent />
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
});

export default App;
