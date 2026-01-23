import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Image,
} from 'react-native';
import { Usuario, authService } from '../services/authService';
import { useTheme } from '../context/ThemeContext';
import { AnimatedCard } from '../components/AnimatedCard';
import { 
  TruckIcon, 
  UsersIcon, 
  HistoryIcon, 
  MoneyIcon, 
  ScanIcon,
  SettingsIcon,
  LogoutIcon
} from '../components/icons';
import { CustomAlert } from '../components/CustomAlert';

interface HomeScreenProps {
  usuario: Usuario | null;
  onLogout: () => void;
  onNavigate: (screen: string) => void;
}

export const HomeScreen: React.FC<HomeScreenProps> = ({ usuario, onLogout, onNavigate }) => {
  const { theme } = useTheme();
  const scale = (size: number) => theme.scale(size);
  const styles = createStyles(scale);

  // Estados para CustomAlert
  const [alertVisible, setAlertVisible] = useState(false);
  const [alertTitle, setAlertTitle] = useState('');
  const [alertMessage, setAlertMessage] = useState('');
  const [alertButtons, setAlertButtons] = useState<any[]>([]);

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
    setAlertTitle('Confirmación');
    setAlertMessage('¿Deseas cerrar sesión?');
    setAlertButtons([
      { 
        text: 'Cancelar', 
        style: 'cancel',
        onPress: () => setAlertVisible(false)
      },
      {
        text: 'Cerrar sesión',
        style: 'destructive',
        onPress: async () => {
          await authService.logout();
          onLogout();
        },
      },
    ]);
    setAlertVisible(true);
  };

  return (
    <ScrollView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      {/* Modern Header */}
      <View style={[styles.header, { backgroundColor: theme.colors.background }]}>
        <View>
          <Text style={[styles.greeting, { color: theme.colors.textSecondary, fontSize: scale(14) }]}>
            Bienvenido de vuelta
          </Text>
          <Text style={[styles.userName, { color: theme.colors.text, fontSize: scale(24) }]}>
            {usuario.nombre} {usuario.apellido}
          </Text>
        </View>
        <View style={styles.headerButtons}>
          <TouchableOpacity 
            onPress={() => onNavigate('Settings')}
            style={[styles.iconButton, { backgroundColor: theme.colors.surface }]}
          >
            <SettingsIcon size={22} color={theme.colors.text} />
          </TouchableOpacity>
          <TouchableOpacity 
            onPress={handleLogout}
            style={[styles.iconButton, { backgroundColor: theme.colors.surface, marginLeft: scale(8) }]}
          >
            <LogoutIcon size={22} color={theme.colors.error} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Main Grid */}
      <View style={styles.gridContainer}>
        <View style={styles.row}>
          <AnimatedCard
            title="Crear Pedido"
            subtitle="Nuevo"
            icon={
              <Image 
                source={require('../assets/logo.png')} 
                style={{ width: 32, height: 32, tintColor: '#fff' }}
                resizeMode="contain"
              />
            }
            onPress={() => onNavigate('CrearPedido')}
            gradient={['#667eea', '#764ba2']}
          />
          <AnimatedCard
            title="Encomendistas"
            subtitle="Gestionar"
            icon={<TruckIcon size={28} color="#fff" />}
            onPress={() => onNavigate('Encomendistas')}
            gradient={['#f093fb', '#f5576c']}
          />
        </View>

        <View style={styles.row}>
          <AnimatedCard
            title="Clientes"
            subtitle="Listado"
            icon={<UsersIcon size={28} color="#fff" />}
            onPress={() => onNavigate('Clientes')}
            gradient={['#4facfe', '#00f2fe']}
          />
          <AnimatedCard
            title="Historial"
            subtitle="Ver todo"
            icon={<HistoryIcon size={28} color="#fff" />}
            onPress={() => onNavigate('HistorialOptimizado')}
            gradient={['#43e97b', '#38f9d7']}
          />
        </View>

        <View style={styles.row}>
          <AnimatedCard
            title="Remunerar"
            subtitle="Pendientes"
            icon={<MoneyIcon size={28} color="#fff" />}
            onPress={() => onNavigate('PorRemunerar')}
            gradient={['#fa709a', '#fee140']}
          />
          <AnimatedCard
            title="Escanear"
            subtitle="QR"
            icon={<ScanIcon size={28} color="#fff" />}
            onPress={() => onNavigate('ScannerOptimizado')}
            gradient={['#30cfd0', '#330867']}
          />
        </View>

        <View style={styles.row}>
          <AnimatedCard
            title="Urgentes"
            subtitle="Empacar"
            icon={<Text style={{ fontSize: 28 }}>🚨</Text>}
            onPress={() => onNavigate('UrgentesEmpacar')}
            gradient={['#DC2626', '#991B1B']}
          />
          <AnimatedCard
            title="Envíos"
            subtitle="Encomienda"
            icon={<Text style={{ fontSize: 28 }}>📦</Text>}
            onPress={() => onNavigate('EnviosPorEncomienda')}
            gradient={['#7C3AED', '#5B21B6']}
          />
        </View>

        <TouchableOpacity
          style={[styles.fullWidthCard, { backgroundColor: theme.colors.primary }]}
          onPress={() => onNavigate('RetiredToday')}
          activeOpacity={0.8}
        >
          <View style={styles.fullWidthContent}>
            <View style={styles.fullWidthIcon}>
              <HistoryIcon size={24} color="#fff" />
            </View>
            <View style={styles.fullWidthText}>
              <Text style={[styles.fullWidthTitle, { fontSize: scale(16) }]}>
                Retirados Hoy
              </Text>
              <Text style={[styles.fullWidthSubtitle, { fontSize: scale(11) }]}>
                Ver retiros del día por horario
              </Text>
            </View>
          </View>
        </TouchableOpacity>
      </View>

      <View style={{ height: scale(40) }} />

      {/* Custom Alert */}
      <CustomAlert
        visible={alertVisible}
        title={alertTitle}
        message={alertMessage}
        buttons={alertButtons}
        onDismiss={() => setAlertVisible(false)}
      />
    </ScrollView>
  );
};

const createStyles = (scale: (size: number) => number) => StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingVertical: scale(24),
    paddingHorizontal: scale(20),
    paddingTop: scale(48),
  },
  greeting: {
    fontWeight: '500',
    marginBottom: scale(4),
  },
  userName: {
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  headerButtons: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconButton: {
    width: scale(44),
    height: scale(44),
    borderRadius: scale(12),
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 3,
  },
  gridContainer: {
    paddingHorizontal: scale(16),
    paddingTop: scale(8),
  },
  row: {
    flexDirection: 'row',
    gap: scale(12),
    marginBottom: scale(12),
  },
  fullWidthCard: {
    borderRadius: scale(12),
    padding: scale(12),
    marginBottom: scale(12),
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  fullWidthContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  fullWidthIcon: {
    width: scale(40),
    height: scale(40),
    borderRadius: scale(10),
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: scale(12),
  },
  fullWidthText: {
    flex: 1,
  },
  fullWidthTitle: {
    fontWeight: '700',
    color: '#fff',
    letterSpacing: -0.3,
    marginBottom: scale(2),
  },
  fullWidthSubtitle: {
    fontWeight: '500',
    color: 'rgba(255, 255, 255, 0.85)',
    letterSpacing: -0.2,
    fontSize: scale(11),
  },
  logoutButton: {
    paddingHorizontal: scale(16),
    paddingVertical: scale(12),
    borderRadius: scale(8),
    alignItems: 'center',
  },
  logoutButtonText: {
    fontWeight: '600',
    color: '#fff',
  },
  errorText: {
    fontWeight: 'bold',
    textAlign: 'center',
    marginTop: scale(50),
  },
  errorDescription: {
    textAlign: 'center',
    marginTop: scale(10),
  },
});

const styles = createStyles((size) => size);

export default HomeScreen;
