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

interface HomeScreenProps {
  usuario: Usuario | null;
  onLogout: () => void;
  onNavigate: (screen: string) => void;
}

export const HomeScreen: React.FC<HomeScreenProps> = ({ usuario, onLogout, onNavigate }) => {
  // Bloquear acceso sin login
  if (!usuario) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>⛔ Acceso Denegado</Text>
        <Text style={styles.errorDescription}>Debes iniciar sesión para acceder</Text>
        <TouchableOpacity 
          style={styles.logoutButton}
          onPress={onLogout}
        >
          <Text style={styles.logoutButtonText}>Volver a Login</Text>
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
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>📱 Eli Gómez - Gestor Móvil</Text>
        <TouchableOpacity onPress={handleLogout} style={styles.logoutButton}>
          <Text style={styles.logoutText}>🚪</Text>
        </TouchableOpacity>
      </View>

      {usuario && (
        <View style={styles.userInfo}>
          <Text style={styles.userName}>👋 {usuario.nombre} {usuario.apellido}</Text>
          <Text style={styles.userEmail}>{usuario.usuario}</Text>
        </View>
      )}

      <Text style={styles.sectionTitle}>Menú Principal</Text>

      <View style={styles.grid}>
        <TouchableOpacity
          style={styles.card}
          onPress={() => onNavigate('CrearPedido')}
        >
          <Text style={styles.cardIcon}>📦</Text>
          <Text style={styles.cardTitle}>Crear Pedido</Text>
          <Text style={styles.cardDescription}>Crear nuevo pedido para clientes</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.card}
          onPress={() => onNavigate('Encomendistas')}
        >
          <Text style={styles.cardIcon}>🚚</Text>
          <Text style={styles.cardTitle}>Encomendistas</Text>
          <Text style={styles.cardDescription}>Gestionar encomendistas y destinos</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.card}
          onPress={() => onNavigate('Clientes')}
        >
          <Text style={styles.cardIcon}>👥</Text>
          <Text style={styles.cardTitle}>Clientes</Text>
          <Text style={styles.cardDescription}>Gestionar clientes</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.card}
          onPress={() => onNavigate('Historial')}
        >
          <Text style={styles.cardIcon}>📋</Text>
          <Text style={styles.cardTitle}>Historial</Text>
          <Text style={styles.cardDescription}>Ver historial de pedidos</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.card}
          onPress={() => onNavigate('PorRemunerar')}
        >
          <Text style={styles.cardIcon}>💰</Text>
          <Text style={styles.cardTitle}>Por Remunerar</Text>
          <Text style={styles.cardDescription}>Pedidos pendientes de cobrar</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.card, styles.cardHighlight]}
          onPress={() => onNavigate('Scanner')}
        >
          <Text style={styles.cardIcon}>📸</Text>
          <Text style={styles.cardTitle}>Escanear QR</Text>
          <Text style={styles.cardDescription}>Cambiar estado de pedidos</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#667eea',
    paddingVertical: 16,
    paddingHorizontal: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
  },
  logoutButton: {
    padding: 8,
  },
  logoutButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
  logoutText: {
    fontSize: 20,
  },
  userInfo: {
    backgroundColor: '#667eea',
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  userName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  userEmail: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 4,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1a1a1a',
    paddingHorizontal: 16,
    marginVertical: 12,
  },
  grid: {
    paddingHorizontal: 12,
    paddingBottom: 20,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    elevation: 2,
  },
  cardHighlight: {
    backgroundColor: '#667eea',
  },
  cardIcon: {
    fontSize: 36,
    marginRight: 16,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1a1a1a',
  },
  cardDescription: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
  },
  errorText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#e74c3c',
    textAlign: 'center',
    marginTop: 50,
  },
  errorDescription: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginTop: 10,
  },
});

export default HomeScreen;
