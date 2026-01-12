import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
} from 'react-native';
import { Usuario, authService } from '../services/authService';
import { useTheme } from '../context/ThemeContext';

interface HomeScreenProps {
  usuario: Usuario | null;
  onLogout: () => void;
  onNavigate: (screen: string) => void;
}

export const HomeScreen: React.FC<HomeScreenProps> = ({ usuario, onLogout, onNavigate }) => {
  const { theme } = useTheme();
  const scale = (size: number) => theme.scale(size);

  // Bloquear acceso sin login
  if (!usuario) {
    return (
      <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <Text style={[styles.errorText, { color: theme.colors.text, fontSize: scale(20) }]}>⛔ Acceso Denegado</Text>
        <Text style={[styles.errorDescription, { color: theme.colors.textSecondary, fontSize: scale(14) }]}>Debes iniciar sesión para acceder</Text>
        <TouchableOpacity 
          style={[styles.logoutButton, { backgroundColor: theme.colors.error }]}
          onPress={onLogout}
        >
          <Text style={[styles.logoutButtonText, { fontSize: scale(14) }]}>Volver a Login</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const handleLogout = async () => {
    Alert.alert('Confirmación', '¿Deseas cerrar sesión?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Cerrar sesión',
        onPress: async () => {
          await authService.logout();
          onLogout();
        },
        style: 'destructive',
      },
    ]);
  };

  return (
    <ScrollView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <View style={[styles.header, { backgroundColor: theme.colors.surface, borderBottomColor: theme.colors.border }]}>
        <View style={styles.headerContent}>
          <Text style={[styles.title, { color: theme.colors.text, fontSize: scale(24) }]}>
            📱 Eli Gómez
          </Text>
        </View>
        <View style={styles.headerButtons}>
          <TouchableOpacity 
            onPress={() => onNavigate('Settings')}
            style={[styles.headerButton, { backgroundColor: theme.colors.primary }]}
          >
            <Text style={[styles.headerButtonText, { fontSize: scale(18) }]}>⚙️</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            onPress={handleLogout}
            style={[styles.headerButton, { backgroundColor: theme.colors.error, marginLeft: scale(8) }]}
          >
            <Text style={[styles.headerButtonText, { fontSize: scale(18) }]}>🚪</Text>
          </TouchableOpacity>
        </View>
      </View>

      {usuario && (
        <View style={[styles.userInfo, { backgroundColor: theme.colors.surface, borderBottomColor: theme.colors.border }]}>
          <Text style={[styles.userName, { color: theme.colors.text, fontSize: scale(16) }]}>
            👋 {usuario.nombre} {usuario.apellido}
          </Text>
          <Text style={[styles.userEmail, { color: theme.colors.textSecondary, fontSize: scale(12) }]}>
            @{usuario.usuario}
          </Text>
        </View>
      )}

      <Text style={[styles.sectionTitle, { color: theme.colors.text, fontSize: scale(18) }]}>Menú Principal</Text>

      <View style={styles.grid}>
        <TouchableOpacity
          style={[styles.card, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}
          onPress={() => onNavigate('CrearPedido')}
        >
          <Text style={[styles.cardIcon, { fontSize: scale(32) }]}>📦</Text>
          <Text style={[styles.cardTitle, { color: theme.colors.text, fontSize: scale(16) }]}>Crear Pedido</Text>
          <Text style={[styles.cardDescription, { color: theme.colors.textSecondary, fontSize: scale(12) }]}>Crear nuevo pedido para clientes</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.card, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}
          onPress={() => onNavigate('Encomendistas')}
        >
          <Text style={[styles.cardIcon, { fontSize: scale(32) }]}>🚚</Text>
          <Text style={[styles.cardTitle, { color: theme.colors.text, fontSize: scale(16) }]}>Encomendistas</Text>
          <Text style={[styles.cardDescription, { color: theme.colors.textSecondary, fontSize: scale(12) }]}>Gestionar encomendistas y destinos</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.card, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}
          onPress={() => onNavigate('Clientes')}
        >
          <Text style={[styles.cardIcon, { fontSize: scale(32) }]}>👥</Text>
          <Text style={[styles.cardTitle, { color: theme.colors.text, fontSize: scale(16) }]}>Clientes</Text>
          <Text style={[styles.cardDescription, { color: theme.colors.textSecondary, fontSize: scale(12) }]}>Gestionar clientes</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.card, { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary }]}
          onPress={() => onNavigate('HistorialOptimizado')}
        >
          <Text style={[styles.cardIcon, { fontSize: scale(32), color: '#fff' }]}>📋</Text>
          <Text style={[styles.cardTitle, { color: '#fff', fontSize: scale(16), fontWeight: 'bold' }]}>Historial</Text>
          <Text style={[styles.cardDescription, { color: 'rgba(255,255,255,0.9)', fontSize: scale(12) }]}>Ver todos los pedidos</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.card, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}
          onPress={() => onNavigate('PorRemunerar')}
        >
          <Text style={[styles.cardIcon, { fontSize: scale(32) }]}>💰</Text>
          <Text style={[styles.cardTitle, { color: theme.colors.text, fontSize: scale(16) }]}>Por Remunerar</Text>
          <Text style={[styles.cardDescription, { color: theme.colors.textSecondary, fontSize: scale(12) }]}>Pedidos pendientes de cobrar</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.card, { backgroundColor: '#10B98120', borderColor: theme.colors.success }]}
          onPress={() => onNavigate('RetiredToday')}
        >
          <Text style={[styles.cardIcon, { fontSize: scale(32) }]}>📅</Text>
          <Text style={[styles.cardTitle, { color: theme.colors.text, fontSize: scale(16), fontWeight: 'bold' }]}>Retirados Hoy</Text>
          <Text style={[styles.cardDescription, { color: theme.colors.textSecondary, fontSize: scale(12) }]}>Retiros de hoy por horario</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.card, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}
          onPress={() => onNavigate('ScannerOptimizado')}
        >
          <Text style={[styles.cardIcon, { fontSize: scale(32) }]}>🔍</Text>
          <Text style={[styles.cardTitle, { color: theme.colors.text, fontSize: scale(16) }]}>Escanear Pedido</Text>
          <Text style={[styles.cardDescription, { color: theme.colors.textSecondary, fontSize: scale(12) }]}>Ver y cambiar estado de pedidos</Text>
        </TouchableOpacity>
      </View>

      <View style={{ height: scale(40) }} />
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
  },
  headerContent: {
    flex: 1,
  },
  headerButtons: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    minWidth: 44,
    minHeight: 44,
  },
  headerButtonText: {
    fontWeight: 'bold',
  },
  title: {
    fontWeight: 'bold',
  },
  logoutButton: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  logoutButtonText: {
    fontWeight: '600',
    color: '#fff',
  },
  logoutText: {
    fontSize: 20,
  },
  userInfo: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginBottom: 12,
    borderBottomWidth: 1,
  },
  userName: {
    fontWeight: '600',
  },
  userEmail: {
    marginTop: 4,
  },
  sectionTitle: {
    fontWeight: 'bold',
    paddingHorizontal: 16,
    marginVertical: 12,
  },
  grid: {
    paddingHorizontal: 12,
    paddingBottom: 20,
  },
  card: {
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 2,
    borderWidth: 1,
  },
  cardHighlight: {
    backgroundColor: '#667eea',
  },
  cardOptimizado: {
    backgroundColor: '#FF6F00',
  },
  cardOptimizadoSecondary: {
    backgroundColor: '#FF9100',
  },
  cardQR: {
    backgroundColor: '#1976D2',
  },
  cardIcon: {
    marginBottom: 6,
  },
  cardIconLight: {
    color: '#fff',
  },
  cardTitle: {
    fontWeight: '600',
    textAlign: 'center',
  },
  cardTitleLight: {
    color: '#fff',
  },
  cardDescription: {
    marginTop: 2,
    textAlign: 'center',
  },
  cardDescriptionLight: {
    color: 'rgba(255,255,255,0.9)',
  },
  errorText: {
    fontWeight: 'bold',
    textAlign: 'center',
    marginTop: 50,
  },
  errorDescription: {
    textAlign: 'center',
    marginTop: 10,
  },
});

export default HomeScreen;
