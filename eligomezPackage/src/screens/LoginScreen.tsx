import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
  Alert,
} from 'react-native';
import { authService, Usuario } from '../services/authService';
import { useAppTheme } from '../context/ThemeContext';
import { useTheme } from '../context/ThemeContext';


interface LoginScreenProps {
  onLoginSuccess: (usuario: Usuario) => void;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({ onLoginSuccess }) => {
  const { theme, toggleTheme, setFontScale } = useTheme();
  const scale = (size: number) => theme.scale(size);
  const styles = createStyles(scale, theme);
  const [showSettings, setShowSettings] = useState(false);
  
  const [modo, setModo] = useState<'login' | 'registro'>('login');
  const [identificador, setIdentificador] = useState('');
  const [contrasena, setContrasena] = useState('');
  const [confirmContrasena, setConfirmContrasena] = useState('');
  const [nombre, setNombre] = useState('');
  const [apellido, setApellido] = useState('');
  const [correo, setCorreo] = useState('');
  const [usuario, setUsuario] = useState('');
  const [loading, setLoading] = useState(false);
  const [mostrarPassword, setMostrarPassword] = useState(false);

  const handleLogin = async () => {
    if (!identificador || !contrasena) {
      Alert.alert('Error', 'Completa todos los campos');
      return;
    }

    console.log('🔐 Intentando login con:', identificador);
    setLoading(true);
    const resultado = await authService.login(identificador, contrasena);
    setLoading(false);

    if (resultado.success && resultado.usuario) {
      console.log('✅ Login exitoso:', resultado.usuario);
      onLoginSuccess(resultado.usuario);
    } else {
      console.log('❌ Login fallido:', resultado.mensaje);
      Alert.alert('Error', resultado.mensaje || 'No se pudo iniciar sesión');
    }
  };

  const handleRegistro = async () => {
    if (
      !nombre ||
      !apellido ||
      !correo ||
      !usuario ||
      !contrasena ||
      !confirmContrasena
    ) {
      Alert.alert('Error', 'Completa todos los campos');
      return;
    }

    if (contrasena !== confirmContrasena) {
      Alert.alert('Error', 'Las contraseñas no coinciden');
      return;
    }

    if (contrasena.length < 6) {
      Alert.alert('Error', 'La contraseña debe tener al menos 6 caracteres');
      return;
    }

    setLoading(true);
    const resultado = await authService.registrar(
      nombre,
      apellido,
      correo,
      usuario,
      contrasena
    );
    setLoading(false);

    if (resultado.success) {
      Alert.alert('Éxito', 'Usuario registrado. Inicia sesión');
      setModo('login');
      setNombre('');
      setApellido('');
      setCorreo('');
      setUsuario('');
      setContrasena('');
      setConfirmContrasena('');
    } else {
      Alert.alert('Error', resultado.mensaje);
    }
  };

  return (
    <ScrollView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <View style={[styles.header, { backgroundColor: theme.colors.surface }] }>
        <Text style={[styles.logo, { fontSize: theme.fontScale * 48, color: theme.colors.primary }]}>🔐</Text>
        <Text style={[styles.title, { fontSize: theme.fontScale * 28, color: theme.colors.text }]}>Encomiendas</Text>
        <Text style={[styles.subtitle, { fontSize: theme.fontScale * 14, color: theme.colors.textSecondary }]}>Sistema de Gestión de Envíos</Text>
      </View>

      {/* Botón de Settings */}
      <View style={{ flexDirection: 'row', justifyContent: 'flex-end', padding: 16 }}>
        <TouchableOpacity
          style={{ backgroundColor: theme.colors.primary, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8 }}
          onPress={() => setShowSettings(true)}
        >
          <Text style={{ color: '#fff', fontSize: theme.fontScale * 14, fontWeight: 'bold' }}>⚙️ Settings</Text>
        </TouchableOpacity>
      </View>

      {/* Modal de Settings */}
      {showSettings && (
        <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: theme.colors.background + 'CC', justifyContent: 'center', alignItems: 'center', zIndex: 999 }}>
          <View style={{ backgroundColor: theme.colors.surface, borderRadius: 16, padding: 24, minWidth: 280, elevation: 4 }}>
            <Text style={{ fontSize: theme.fontScale * 18, fontWeight: 'bold', color: theme.colors.text, marginBottom: 16 }}>Configuración</Text>
            <TouchableOpacity
              style={{ marginBottom: 16, backgroundColor: theme.colors.primary, borderRadius: 8, padding: 10 }}
              onPress={toggleTheme}
            >
              <Text style={{ color: '#fff', fontSize: theme.fontScale * 14, textAlign: 'center' }}>
                {theme.isDark ? '🌞 Modo Claro' : '🌙 Modo Oscuro'}
              </Text>
            </TouchableOpacity>
            <Text style={{ color: theme.colors.textSecondary, marginBottom: 8, fontSize: theme.fontScale * 13 }}>Tamaño de fuente:</Text>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16 }}>
              {[1, 1.25, 1.5, 1.75, 2].map((fs) => (
                <TouchableOpacity
                  key={fs}
                  style={{ backgroundColor: theme.fontScale === fs ? theme.colors.primary : theme.colors.divider, borderRadius: 8, padding: 8, marginHorizontal: 2 }}
                  onPress={() => setFontScale(fs as any)}
                >
                  <Text style={{ color: theme.fontScale === fs ? '#fff' : theme.colors.text, fontSize: theme.fontScale * 13 }}>{fs}x</Text>
                </TouchableOpacity>
              ))}
            </View>
            <TouchableOpacity
              style={{ alignSelf: 'center', marginTop: 8 }}
              onPress={() => setShowSettings(false)}
            >
              <Text style={{ color: theme.colors.primary, fontSize: theme.fontScale * 14 }}>Cerrar</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      <View style={[styles.tabContainer, { backgroundColor: theme.colors.surface, borderBottomColor: theme.colors.divider }] }>
        <TouchableOpacity
          style={[styles.tab, modo === 'login' && [styles.tabActive, { borderBottomColor: theme.colors.primary }]]}
          onPress={() => setModo('login')}
        >
          <Text style={[styles.tabText, modo === 'login' && [styles.tabTextActive, { color: theme.colors.primary, fontSize: theme.fontScale * 15 }]]}>
            Iniciar Sesión
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, modo === 'registro' && [styles.tabActive, { borderBottomColor: theme.colors.primary }]]}
          onPress={() => setModo('registro')}
        >
          <Text style={[styles.tabText, modo === 'registro' && [styles.tabTextActive, { color: theme.colors.primary, fontSize: theme.fontScale * 15 }]]}>
            Registrarse
          </Text>
        </TouchableOpacity>
      </View>

      {modo === 'login' ? (
        <View style={[styles.form, { backgroundColor: theme.colors.surface }] }>
          <Text style={[styles.label, { fontSize: theme.fontScale * 14, color: theme.colors.text }]}>Usuario o Email</Text>
          <TextInput
            style={[styles.input, { fontSize: theme.fontScale * 14, color: theme.colors.text, backgroundColor: theme.colors.background, borderColor: theme.colors.border }]}
            placeholder="usuario o email@ejemplo.com"
            placeholderTextColor={theme.colors.textSecondary}
            value={identificador}
            onChangeText={setIdentificador}
            editable={!loading}
          />

          <Text style={[styles.label, { fontSize: theme.fontScale * 14, color: theme.colors.text }]}>Contraseña</Text>
          <View style={[styles.passwordContainer, { backgroundColor: theme.colors.background, borderColor: theme.colors.border }] }>
            <TextInput
              style={[styles.passwordInput, { fontSize: theme.fontScale * 14, color: theme.colors.text }]}
              placeholder="••••••••"
              placeholderTextColor={theme.colors.textSecondary}
              secureTextEntry={!mostrarPassword}
              value={contrasena}
              onChangeText={setContrasena}
              editable={!loading}
            />
            <TouchableOpacity onPress={() => setMostrarPassword(!mostrarPassword)}>
              <Text style={[styles.eyeIcon, { fontSize: theme.fontScale * 18, color: theme.colors.primary }]}>{mostrarPassword ? '👁' : '👁‍🗨'}</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={[styles.button, loading && styles.buttonDisabled, { backgroundColor: theme.colors.primary }]}
            onPress={handleLogin}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={[styles.buttonText, { fontSize: theme.fontScale * 16 }]}>🔓 Iniciar Sesión</Text>
            )}
          </TouchableOpacity>
        </View>
      ) : (
        <View style={[styles.form, { backgroundColor: theme.colors.surface }] }>
          <Text style={[styles.label, { fontSize: theme.fontScale * 14, color: theme.colors.text }]}>Nombre</Text>
          <TextInput
            style={[styles.input, { fontSize: theme.fontScale * 14, color: theme.colors.text, backgroundColor: theme.colors.background, borderColor: theme.colors.border }]}
            placeholder="Tu nombre"
            placeholderTextColor={theme.colors.textSecondary}
            value={nombre}
            onChangeText={setNombre}
            editable={!loading}
          />

          <Text style={[styles.label, { fontSize: theme.fontScale * 14, color: theme.colors.text }]}>Apellido</Text>
          <TextInput
            style={[styles.input, { fontSize: theme.fontScale * 14, color: theme.colors.text, backgroundColor: theme.colors.background, borderColor: theme.colors.border }]}
            placeholder="Tu apellido"
            placeholderTextColor={theme.colors.textSecondary}
            value={apellido}
            onChangeText={setApellido}
            editable={!loading}
          />

          <Text style={[styles.label, { fontSize: theme.fontScale * 14, color: theme.colors.text }]}>Correo</Text>
          <TextInput
            style={[styles.input, { fontSize: theme.fontScale * 14, color: theme.colors.text, backgroundColor: theme.colors.background, borderColor: theme.colors.border }]}
            placeholder="email@ejemplo.com"
            placeholderTextColor={theme.colors.textSecondary}
            value={correo}
            onChangeText={setCorreo}
            keyboardType="email-address"
            editable={!loading}
          />

          <Text style={[styles.label, { fontSize: theme.fontScale * 14, color: theme.colors.text }]}>Usuario</Text>
          <TextInput
            style={[styles.input, { fontSize: theme.fontScale * 14, color: theme.colors.text, backgroundColor: theme.colors.background, borderColor: theme.colors.border }]}
            placeholder="Tu usuario"
            placeholderTextColor={theme.colors.textSecondary}
            value={usuario}
            onChangeText={setUsuario}
            editable={!loading}
          />

          <Text style={[styles.label, { fontSize: theme.fontScale * 14, color: theme.colors.text }]}>Contraseña</Text>
          <View style={[styles.passwordContainer, { backgroundColor: theme.colors.background, borderColor: theme.colors.border }] }>
            <TextInput
              style={[styles.passwordInput, { fontSize: theme.fontScale * 14, color: theme.colors.text }]}
              placeholder="••••••••"
              placeholderTextColor={theme.colors.textSecondary}
              secureTextEntry={!mostrarPassword}
              value={contrasena}
              onChangeText={setContrasena}
              editable={!loading}
            />
            <TouchableOpacity onPress={() => setMostrarPassword(!mostrarPassword)}>
              <Text style={[styles.eyeIcon, { fontSize: theme.fontScale * 18, color: theme.colors.primary }]}>{mostrarPassword ? '👁' : '👁‍🗨'}</Text>
            </TouchableOpacity>
          </View>

          <Text style={[styles.label, { fontSize: theme.fontScale * 14, color: theme.colors.text }]}>Confirmar Contraseña</Text>
          <TextInput
            style={[styles.input, { fontSize: theme.fontScale * 14, color: theme.colors.text, backgroundColor: theme.colors.background, borderColor: theme.colors.border }]}
            placeholder="••••••••"
            placeholderTextColor={theme.colors.textSecondary}
            secureTextEntry={!mostrarPassword}
            value={confirmContrasena}
            onChangeText={setConfirmContrasena}
            editable={!loading}
          />

          <TouchableOpacity
            style={[styles.button, loading && styles.buttonDisabled, { backgroundColor: theme.colors.primary }]}
            onPress={handleRegistro}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={[styles.buttonText, { fontSize: theme.fontScale * 16 }]}>📝 Registrarse</Text>
            )}
          </TouchableOpacity>
        </View>
      )}
    </ScrollView>
  );
};

const createStyles = (scale: (size: number) => number, theme: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  header: {
    alignItems: 'center',
    paddingVertical: 40,
    backgroundColor: theme.colors.surface,
  },
  logo: {
    marginBottom: 12,
  },
  title: {
    fontWeight: 'bold',
    color: theme.colors.text,
  },
  subtitle: {
    marginTop: 4,
    color: theme.colors.textSecondary,
  },
  tabContainer: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
  },
  tabActive: {
    borderBottomWidth: 3,
    borderBottomColor: theme.colors.primary,
  },
  tabText: {
    fontWeight: '600',
    color: theme.colors.textSecondary,
  },
  tabTextActive: {
    color: theme.colors.primary,
  },
  form: {
    padding: 20,
    backgroundColor: theme.colors.background,
  },
  label: {
    fontWeight: '600',
    marginBottom: 8,
    marginTop: 12,
    color: theme.colors.text,
  },
  input: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: theme.colors.surface,
    color: theme.colors.text,
  },
  passwordContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 8,
    backgroundColor: theme.colors.surface,
  },
  passwordInput: {
    flex: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: theme.colors.text,
  },
  eyeIcon: {
    paddingHorizontal: 12,
  },
  button: {
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 20,
    backgroundColor: theme.colors.primary,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    fontWeight: 'bold',
    color: '#fff',
  },
});

