import React, { useRef, useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Switch,
  Animated,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTheme } from '../context/ThemeContext';
import { SettingsIcon } from '../components/icons';
import { BackButton } from '../components/BackButton';

interface SettingsScreenProps {
  onNavigate?: (screen: string) => void;
  onClose?: () => void;
}

const fontScales = [1, 1.25, 1.5, 1.75, 2, 2.5, 3, 4] as const;

export const SettingsScreen: React.FC<SettingsScreenProps> = ({ onNavigate, onClose }) => {
  const { theme, toggleTheme, setFontScale } = useTheme();
  const [vistaCompactaPorDefecto, setVistaCompactaPorDefecto] = useState(true);
  const scale = (size: number) => theme.scale(size);
  const styles = createStyles(scale, theme);

  // Cargar preferencia de vista compacta
  useEffect(() => {
    const cargarVistaCompacta = async () => {
      try {
        const vistaGuardada = await AsyncStorage.getItem('vistaCompactaDefecto');
        if (vistaGuardada !== null) {
          setVistaCompactaPorDefecto(vistaGuardada === 'true');
        }
      } catch (error) {
        console.error('Error cargando vista compacta:', error);
      }
    };
    cargarVistaCompacta();
  }, []);

  // Guardar preferencia de vista compacta
  const toggleVistaCompacta = async (value: boolean) => {
    setVistaCompactaPorDefecto(value);
    try {
      await AsyncStorage.setItem('vistaCompactaDefecto', value.toString());
    } catch (error) {
      console.error('Error guardando vista compacta:', error);
    }
  };

  // Animated header - efecto snap
  const scrollY = useRef(new Animated.Value(0)).current;
  const headerHeight = useRef(new Animated.Value(280)).current;
  const headerOpacity = useRef(new Animated.Value(1)).current;
  
  const handleScroll = Animated.event(
    [{ nativeEvent: { contentOffset: { y: scrollY } } }],
    { 
      useNativeDriver: false,
      listener: (event: any) => {
        const offsetY = event.nativeEvent.contentOffset.y;
        if (offsetY > 50) {
          Animated.parallel([
            Animated.timing(headerHeight, { toValue: 100, duration: 200, useNativeDriver: false }),
            Animated.timing(headerOpacity, { toValue: 0, duration: 150, useNativeDriver: false }),
          ]).start();
        } else {
          Animated.parallel([
            Animated.timing(headerHeight, { toValue: 280, duration: 200, useNativeDriver: false }),
            Animated.timing(headerOpacity, { toValue: 1, duration: 150, useNativeDriver: false }),
          ]).start();
        }
      },
    }
  );

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      {/* Header moderno con gradiente */}
      <Animated.View style={[styles.modernHeader, { backgroundColor: theme.colors.primary, height: headerHeight, overflow: 'hidden' }]}>
        <View style={styles.headerTop}>
          <BackButton onPress={() => onNavigate?.('home')} />
        </View>
        
        <Animated.View style={[styles.headerContent, { opacity: headerOpacity }]}>
          <View style={styles.iconCircle}>
            <SettingsIcon size={scale(48)} color="#fff" />
          </View>
          <Text style={styles.modernHeaderTitle}>Configuración</Text>
          <Text style={styles.headerSubtitle}>
            Personaliza tu experiencia
          </Text>
        </Animated.View>
      </Animated.View>

      {/* Contenido */}
      <Animated.ScrollView
        style={styles.contenido}
        contentContainerStyle={{ paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
        onScroll={handleScroll}
        scrollEventThrottle={16}
      >
        {/* Tema */}
        <View style={[styles.section, { backgroundColor: theme.colors.surface }]}>
          <View style={styles.sectionHeader}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.sectionTitle, { color: theme.colors.text, fontSize: scale(18) }]}>
                🌙 Modo Oscuro
              </Text>
              <Text style={[styles.sectionDescription, { color: theme.colors.textSecondary, fontSize: scale(12), marginTop: 4 }]}>
                {theme.isDark ? 'Modo oscuro activado' : 'Modo claro activado'}
              </Text>
            </View>
            <Switch
              value={theme.isDark}
              onValueChange={toggleTheme}
              trackColor={{ false: '#ccc', true: theme.colors.primary }}
              thumbColor={theme.isDark ? '#fff' : '#f0f0f0'}
            />
          </View>
        </View>

        {/* Vista Compacta */}
        <View style={[styles.section, { backgroundColor: theme.colors.surface }]}>
          <View style={styles.sectionHeader}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.sectionTitle, { color: theme.colors.text, fontSize: scale(18) }]}>
                ⊟ Vista Compacta
              </Text>
              <Text style={[styles.sectionDescription, { color: theme.colors.textSecondary, fontSize: scale(12), marginTop: 4 }]}>
                {vistaCompactaPorDefecto ? 'Vista compacta por defecto' : 'Vista normal por defecto'}
              </Text>
            </View>
            <Switch
              value={vistaCompactaPorDefecto}
              onValueChange={toggleVistaCompacta}
              trackColor={{ false: '#ccc', true: theme.colors.primary }}
              thumbColor={vistaCompactaPorDefecto ? '#fff' : '#f0f0f0'}
            />
          </View>
        </View>

        {/* Tamaño de Texto */}
        <View style={[styles.section, { backgroundColor: theme.colors.surface, paddingBottom: 24, marginBottom: 16 }]}>
          <Text style={[styles.sectionTitle, { color: theme.colors.text, fontSize: scale(18) }]}>
            📝 Tamaño de Texto
          </Text>
          <Text style={[styles.sectionDescription, { color: theme.colors.textSecondary, fontSize: scale(12), marginTop: 4, marginBottom: scale(12) }]}>
            Escala actual: <Text style={{ fontWeight: '700', color: theme.colors.primary }}>{Math.round(theme.fontScale * 100)}%</Text>
          </Text>

          {/* Preview de texto */}
          <View style={[styles.previewBox, { backgroundColor: theme.colors.background }]}>
            <Text style={[styles.previewText, { color: theme.colors.text, fontSize: scale(16) }]}>
              📱 Ejemplo de texto con esta escala
            </Text>
          </View>

          {/* Botones de escala */}
          <View style={styles.scaleGrid}>
            {fontScales.map((size) => (
              <TouchableOpacity
                key={size}
                style={[
                  styles.scaleButton,
                  {
                    backgroundColor: theme.fontScale === size 
                      ? theme.colors.primary 
                      : theme.colors.background,
                    borderWidth: 2,
                    borderColor: theme.fontScale === size 
                      ? theme.colors.primary 
                      : theme.colors.border,
                    shadowColor: theme.fontScale === size ? theme.colors.primary : '#000',
                    shadowOffset: { width: 0, height: theme.fontScale === size ? 4 : 2 },
                    shadowOpacity: theme.fontScale === size ? 0.3 : 0.1,
                    shadowRadius: theme.fontScale === size ? 6 : 3,
                    elevation: theme.fontScale === size ? 6 : 2,
                  },
                ]}
                onPress={() => setFontScale(size)}
                activeOpacity={0.7}
              >
                <Text style={[
                  styles.scaleButtonText,
                  {
                    color: theme.fontScale === size ? '#fff' : theme.colors.text,
                    fontSize: scale(13),
                    fontWeight: theme.fontScale === size ? 'bold' : '600',
                  }
                ]}>
                  {Math.round(size * 100)}%
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Info */}
        <View style={[styles.section, { backgroundColor: theme.colors.surface }]}>
          <Text style={[styles.sectionTitle, { color: theme.colors.text, fontSize: scale(18) }]}>
            ℹ️ Información
          </Text>
          <View style={{ marginTop: 5, gap: 8 }}>
            <View style={styles.infoRow}>
              <Text style={[styles.infoLabel, { color: theme.colors.textSecondary, fontSize: scale(13) }]}>📱 Versión:</Text>
              <Text style={[styles.infoValue, { color: theme.colors.text, fontSize: scale(13) }]}>1.0.0</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={[styles.infoLabel, { color: theme.colors.textSecondary, fontSize: scale(13) }]}>🏢 Empresa:</Text>
              <Text style={[styles.infoValue, { color: theme.colors.text, fontSize: scale(13) }]}>EliGomez</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={[styles.infoLabel, { color: theme.colors.textSecondary, fontSize: scale(13) }]}>📅 Año:</Text>
              <Text style={[styles.infoValue, { color: theme.colors.text, fontSize: scale(13) }]}>2026</Text>
            </View>
          </View>
          <Text style={[styles.copyrightText, { color: theme.colors.textSecondary, fontSize: scale(11), marginTop: 12, textAlign: 'center' }]}>
            © 2026 EliGomez - Todos los derechos reservados
          </Text>
        </View>

        {/* Espacio al final */}
        <View style={{ height: 20 }} />
      </Animated.ScrollView>
    </View>
  );
};

const createStyles = (scale: (size: number) => number, theme: any) => StyleSheet.create({
  container: {
    flex: 1,
  },
  modernHeader: {
    backgroundColor: theme.colors.primary,
    paddingBottom: 24,
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 10,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 48,
    marginBottom: 16,
  },
  headerContent: {
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  iconCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  modernHeaderTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: '#fff',
    letterSpacing: -1,
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 14,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.9)',
    letterSpacing: -0.3,
  },
  contenido: {
    flex: 1,
    paddingHorizontal: 12,
    paddingTop: 12,
  },
  section: {
    marginBottom: 12,
    paddingHorizontal: 18,
    paddingVertical: 18,
    paddingBottom: 20,
    borderRadius: 16,
    backgroundColor: theme.colors.surface,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sectionTitle: {
    fontWeight: '700',
    color: theme.colors.text,
    letterSpacing: -0.3,
    marginBottom: 4,
  },
  sectionDescription: {
    color: theme.colors.textSecondary,
  },
  previewBox: {
    paddingHorizontal: 20,
    paddingVertical: 20,
    borderRadius: 12,
    marginBottom: 18,
    alignItems: 'center',
    backgroundColor: theme.colors.background,
    borderWidth: 2,
    borderColor: theme.colors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  previewText: {
    fontWeight: '600',
    color: theme.colors.text,
  },
  scaleGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    justifyContent: 'space-between',
  },
  scaleButton: {
    width: '23%',
    paddingVertical: 8,
    paddingHorizontal: 8,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scaleButtonText: {
    fontWeight: '600',
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  infoLabel: {
    fontWeight: '500',
  },
  infoValue: {
    fontWeight: '600',
  },
  copyrightText: {
    fontStyle: 'italic',
  },
});
