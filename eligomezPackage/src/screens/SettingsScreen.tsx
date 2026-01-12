import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Switch,
  Dimensions,
} from 'react-native';
import { useTheme } from '../context/ThemeContext';

interface SettingsScreenProps {
  onNavigate?: (screen: string) => void;
  onClose?: () => void;
}

const fontScales = [1, 1.25, 1.5, 1.75, 2, 2.5, 3, 4] as const;

export const SettingsScreen: React.FC<SettingsScreenProps> = ({ onNavigate, onClose }) => {
  const { theme, toggleTheme, setFontScale } = useTheme();
  const scale = (size: number) => theme.scale(size);
  const styles = createStyles(scale, theme);

  return (
    <ScrollView
      style={[
        styles.container,
        { backgroundColor: theme.colors.background }
      ]}
      contentContainerStyle={styles.contentContainer}
    >
      {/* Header */}
      <View style={[styles.header, { backgroundColor: theme.colors.surface }]}>
        <Text style={[
          styles.title,
          { 
            color: theme.colors.text,
            fontSize: scale(28),
          }
        ]}>
          ⚙️ Configuración
        </Text>
      </View>

      {/* Tema */}
      <View style={[styles.section, { backgroundColor: theme.colors.surface }]}>
        <View style={styles.sectionHeader}>
          <Text style={[
            styles.sectionTitle,
            { 
              color: theme.colors.text,
              fontSize: scale(18),
            }
          ]}>
            🌙 Modo Oscuro
          </Text>
          <Switch
            value={theme.isDark}
            onValueChange={toggleTheme}
            trackColor={{ false: '#ccc', true: '#667eea' }}
            thumbColor={theme.isDark ? '#fff' : '#f0f0f0'}
          />
        </View>
        <Text style={[
          styles.sectionDescription,
          {
            color: theme.colors.textSecondary,
            fontSize: scale(14),
          }
        ]}>
          {theme.isDark ? 'Modo oscuro activado' : 'Modo claro activado'}
        </Text>
      </View>

      {/* Tamaño de Texto */}
      <View style={[styles.section, { backgroundColor: theme.colors.surface }]}>
        <Text style={[
          styles.sectionTitle,
          {
            color: theme.colors.text,
            fontSize: scale(18),
          }
        ]}>
          📝 Tamaño de Texto
        </Text>
        <Text style={[
          styles.sectionDescription,
          {
            color: theme.colors.textSecondary,
            fontSize: scale(14),
            marginBottom: scale(12),
          }
        ]}>
          Escala actual: {Math.round(theme.fontScale * 100)}%
        </Text>

        {/* Preview de texto */}
        <View style={[
          styles.previewBox,
          { backgroundColor: theme.colors.background }
        ]}>
          <Text style={[
            styles.previewText,
            {
              color: theme.colors.text,
              fontSize: scale(16),
            }
          ]}>
            Ejemplo de texto
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
                    : theme.colors.divider,
                  borderWidth: scale(2),
                  borderColor: theme.fontScale === size 
                    ? theme.colors.primary 
                    : theme.colors.border,
                },
              ]}
              onPress={() => setFontScale(size)}
            >
              <Text style={[
                styles.scaleButtonText,
                {
                  color: theme.fontScale === size 
                    ? '#fff' 
                    : theme.colors.text,
                  fontSize: scale(14),
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
        <Text style={[
          styles.sectionTitle,
          {
            color: theme.colors.text,
            fontSize: scale(18),
          }
        ]}>
          ℹ️ Información
        </Text>
        <Text style={[
          styles.sectionDescription,
          {
            color: theme.colors.textSecondary,
            fontSize: scale(14),
          }
        ]}>
          Versión: 1.0.0{'\n'}
          © 2026 EliGomez - Todos los derechos reservados
        </Text>
      </View>

      {/* Botón Cerrar */}
      {onClose && (
        <TouchableOpacity
          style={[
            styles.closeButton,
            { backgroundColor: theme.colors.error }
          ]}
          onPress={onClose}
        >
          <Text style={[
            styles.closeButtonText,
            { fontSize: scale(16) }
          ]}>
            ✕ Cerrar
          </Text>
        </TouchableOpacity>
      )}
    </ScrollView>
  );
};

const createStyles = (scale: (size: number) => number, theme: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  contentContainer: {
    paddingBottom: 20,
  },
  header: {
    paddingVertical: 20,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
  },
  title: {
    fontWeight: 'bold',
    color: theme.colors.text,
  },
  section: {
    marginTop: 12,
    marginHorizontal: 8,
    marginBottom: 12,
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  sectionTitle: {
    fontWeight: '600',
    color: theme.colors.text,
  },
  sectionDescription: {
    marginTop: 4,
    color: theme.colors.textSecondary,
  },
  previewBox: {
    paddingHorizontal: 12,
    paddingVertical: 16,
    borderRadius: 8,
    marginBottom: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.background,
  },
  previewText: {
    fontWeight: '500',
    color: theme.colors.text,
  },
  scaleGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  scaleButton: {
    flex: 1,
    minWidth: '22%',
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scaleButtonText: {
    fontWeight: '600',
    color: theme.colors.text,
  },
  closeButton: {
    marginTop: 20,
    marginHorizontal: 16,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    backgroundColor: theme.colors.primary,
  },
  closeButtonText: {
    color: '#fff',
    fontWeight: 'bold',
  },
});
