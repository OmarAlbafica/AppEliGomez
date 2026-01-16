import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
  Image,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { authService, Usuario } from '../services/authService';
import { useAppTheme } from '../context/ThemeContext';
import { useTheme } from '../context/ThemeContext';
import { SettingsIcon } from '../components/icons';
import { CustomAlert } from '../components/CustomAlert';
import { useLoginStorage } from '../hooks/useLoginStorage';


interface LoginScreenProps {
  onLoginSuccess: (usuario: Usuario) => void;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({ onLoginSuccess }) => {
  const { theme, toggleTheme, setFontScale } = useTheme();
  const scale = (size: number) => theme.scale(size);
  const styles = createStyles(scale, theme);
  const [showSettings, setShowSettings] = useState(false);
  
  // Hook para guardar datos de login
  const { loginData, isLoading: storageLoading, saveLoginData, clearLoginData, saveCurrentUserEmail } = useLoginStorage();
  
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
  const [recordarDatos, setRecordarDatos] = useState(false);
  
  // Estados para CustomAlert
  const [alertVisible, setAlertVisible] = useState(false);
  const [alertTitle, setAlertTitle] = useState('');
  const [alertMessage, setAlertMessage] = useState('');
  const [alertButtons, setAlertButtons] = useState<any[]>([]);

  // Cargar datos guardados al montar
  useEffect(() => {
    if (!storageLoading && loginData.rememberMe && loginData.email) {
      setIdentificador(loginData.email);
      setRecordarDatos(true);
    }
  }, [storageLoading]);

  const showAlert = (title: string, message: string, buttons?: any[]) => {
    setAlertTitle(title);
    setAlertMessage(message);
    setAlertButtons(buttons || [{ text: 'OK', style: 'default' }]);
    setAlertVisible(true);
  };

  const handleLogin = async () => {
    if (!identificador || !contrasena) {
      showAlert('Error', 'Completa todos los campos');
      return;
    }

    console.log('🔐 Intentando login con:', identificador);
    setLoading(true);
    const resultado = await authService.login(identificador, contrasena);
    setLoading(false);

    if (resultado.success && resultado.usuario) {
      console.log('✅ Login exitoso:', resultado.usuario);
      
      // 🔴 Guardar email del usuario actual
      await saveCurrentUserEmail(resultado.usuario.correo);
      
      // Guardar datos si está marcado "Recordarme"
      if (recordarDatos) {
        await saveLoginData(identificador, true);
      } else {
        await clearLoginData();
      }
      
      onLoginSuccess(resultado.usuario);
    } else {
      console.log('❌ Login fallido:', resultado.mensaje);
      showAlert('Error', resultado.mensaje || 'No se pudo iniciar sesión');
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
      showAlert('Error', 'Completa todos los campos');
      return;
    }

    if (contrasena !== confirmContrasena) {
      showAlert('Error', 'Las contraseñas no coinciden');
      return;
    }

    if (contrasena.length < 6) {
      showAlert('Error', 'La contraseña debe tener al menos 6 caracteres');
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
      showAlert('Éxito', 'Usuario registrado. Inicia sesión');
      setModo('login');
      setNombre('');
      setApellido('');
      setCorreo('');
      setUsuario('');
      setContrasena('');
      setConfirmContrasena('');
    } else {
      showAlert('Error', resultado.mensaje);
    }
  };

  return (
    <KeyboardAvoidingView 
      style={{ flex: 1, backgroundColor: theme.colors.background }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={0}
    >
      <ScrollView 
        style={[styles.container, { backgroundColor: theme.colors.background }]}
        contentContainerStyle={{ paddingBottom: 40 }}
        keyboardShouldPersistTaps="handled"
      >
      <View style={[styles.header, { backgroundColor: theme.colors.primary }]}>
        <View style={styles.logoCircle}>
          <Image 
            source={require('../assets/logo.png')} 
            style={{ width: scale(100), height: scale(100) }}
            resizeMode="contain"
          />
        </View>
        <Text style={[styles.title, { fontSize: scale(32) }]}>Eli Gómez</Text>
        <Text style={[styles.subtitle, { fontSize: scale(16) }]}>Gestión de Pedidos</Text>
      </View>

      {/* Botón de Settings */}
      <View style={{ flexDirection: 'row', justifyContent: 'flex-end', padding: 16 }}>
        <TouchableOpacity
          style={[
            styles.settingsButton,
            { backgroundColor: theme.colors.surface }
          ]}
          onPress={() => setShowSettings(true)}
        >
          <SettingsIcon size={22} color={theme.colors.text} />
        </TouchableOpacity>
      </View>

      {/* Modal de Settings */}
      {showSettings && (
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.colors.surface }]}>
            <Text style={[styles.modalTitle, { color: theme.colors.text, fontSize: scale(20) }]}>Configuración</Text>
            <TouchableOpacity
              style={[styles.themeButton, { backgroundColor: theme.colors.primary }]}
              onPress={toggleTheme}
            >
              <Text style={[styles.themeButtonText, { fontSize: scale(14) }]}>
                {theme.isDark ? 'Modo Claro' : 'Modo Oscuro'}
              </Text>
            </TouchableOpacity>
            <Text style={[styles.fontLabel, { color: theme.colors.text, fontSize: scale(13) }]}>Tamaño de fuente:</Text>
            <View style={styles.fontSizeRow}>
              {[1, 1.25, 1.5, 1.75, 2].map((fs) => (
                <TouchableOpacity
                  key={fs}
                  style={[
                    styles.fontSizeButton,
                    { backgroundColor: theme.fontScale === fs ? theme.colors.primary : theme.colors.border }
                  ]}
                  onPress={() => setFontScale(fs as any)}
                >
                  <Text style={{ color: theme.fontScale === fs ? '#fff' : theme.colors.text, fontSize: scale(12), fontWeight: '600' }}>{fs}x</Text>
                </TouchableOpacity>
              ))}
            </View>
            <TouchableOpacity
              style={[styles.closeModalButton, { backgroundColor: theme.colors.border }]}
              onPress={() => setShowSettings(false)}
            >
              <Text style={{ color: theme.colors.text, fontSize: scale(14), fontWeight: '700' }}>Cerrar</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      <View style={[styles.tabContainer, { backgroundColor: theme.colors.surface }]}>
        <TouchableOpacity
          style={[styles.tab, modo === 'login' && [styles.tabActive, { backgroundColor: theme.colors.primary }]]}
          onPress={() => setModo('login')}
        >
          <Text style={[styles.tabText, { color: modo === 'login' ? '#fff' : theme.colors.text, fontSize: scale(15) }]}>
            Iniciar Sesión
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, modo === 'registro' && [styles.tabActive, { backgroundColor: theme.colors.primary }]]}
          onPress={() => setModo('registro')}
        >
          <Text style={[styles.tabText, { color: modo === 'registro' ? '#fff' : theme.colors.text, fontSize: scale(15) }]}>
            Registrarse
          </Text>
        </TouchableOpacity>
      </View>

      {modo === 'login' ? (
        <View style={styles.form}>
          <Text style={[styles.label, { fontSize: scale(14), color: theme.colors.text }]}>Usuario o Email</Text>
          <TextInput
            style={[styles.input, { color: theme.colors.text, backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}
            placeholder="usuario o email@ejemplo.com"
            placeholderTextColor={theme.colors.textSecondary}
            value={identificador}
            onChangeText={setIdentificador}
            editable={!loading}
            autoCapitalize="none"
          />

          <Text style={[styles.label, { fontSize: scale(14), color: theme.colors.text }]}>Contraseña</Text>
          <View style={[styles.passwordContainer, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
            <TextInput
              style={[styles.passwordInput, { fontSize: scale(15), color: theme.colors.text }]}
              placeholder="••••••••"
              placeholderTextColor={theme.colors.textSecondary}
              secureTextEntry={!mostrarPassword}
              value={contrasena}
              onChangeText={setContrasena}
              editable={!loading}
            />
            <TouchableOpacity 
              onPress={() => setMostrarPassword(!mostrarPassword)}
              style={styles.eyeButton}
            >
              <Text style={{ fontSize: scale(20) }}>{mostrarPassword ? '👁️' : '👁️‍🗨️'}</Text>
            </TouchableOpacity>
          </View>

          {/* Checkbox Recordarme */}
          <TouchableOpacity
            style={[styles.rememberMeContainer, { borderColor: theme.colors.border }]}
            onPress={() => setRecordarDatos(!recordarDatos)}
          >
            <View style={[
              styles.checkbox,
              recordarDatos && { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary }
            ]}>
              {recordarDatos && <Text style={{ color: '#fff', fontSize: scale(14), fontWeight: 'bold' }}>✓</Text>}
            </View>
            <Text style={[styles.rememberMeText, { color: theme.colors.text, fontSize: scale(13) }]}>
              Recordar mis datos
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.button, loading && styles.buttonDisabled, { backgroundColor: theme.colors.primary }]}
            onPress={handleLogin}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>Iniciar Sesión</Text>
            )}
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.form}>
          <Text style={[styles.label, { fontSize: scale(14), color: theme.colors.text }]}>Nombre</Text>
          <TextInput
            style={[styles.input, { color: theme.colors.text, backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}
            placeholder="Tu nombre"
            placeholderTextColor={theme.colors.textSecondary}
            value={nombre}
            onChangeText={setNombre}
            editable={!loading}
          />

          <Text style={[styles.label, { fontSize: scale(14), color: theme.colors.text }]}>Apellido</Text>
          <TextInput
            style={[styles.input, { color: theme.colors.text, backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}
            placeholder="Tu apellido"
            placeholderTextColor={theme.colors.textSecondary}
            value={apellido}
            onChangeText={setApellido}
            editable={!loading}
          />

          <Text style={[styles.label, { fontSize: scale(14), color: theme.colors.text }]}>Correo</Text>
          <TextInput
            style={[styles.input, { color: theme.colors.text, backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}
            placeholder="email@ejemplo.com"
            placeholderTextColor={theme.colors.textSecondary}
            value={correo}
            onChangeText={setCorreo}
            keyboardType="email-address"
            autoCapitalize="none"
            editable={!loading}
          />

          <Text style={[styles.label, { fontSize: scale(14), color: theme.colors.text }]}>Usuario</Text>
          <TextInput
            style={[styles.input, { color: theme.colors.text, backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}
            placeholder="Tu usuario"
            placeholderTextColor={theme.colors.textSecondary}
            value={usuario}
            onChangeText={setUsuario}
            autoCapitalize="none"
            editable={!loading}
          />

          <Text style={[styles.label, { fontSize: scale(14), color: theme.colors.text }]}>Contraseña</Text>
          <View style={[styles.passwordContainer, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
            <TextInput
              style={[styles.passwordInput, { fontSize: scale(15), color: theme.colors.text }]}
              placeholder="••••••••"
              placeholderTextColor={theme.colors.textSecondary}
              secureTextEntry={!mostrarPassword}
              value={contrasena}
              onChangeText={setContrasena}
              editable={!loading}
            />
            <TouchableOpacity 
              onPress={() => setMostrarPassword(!mostrarPassword)}
              style={styles.eyeButton}
            >
              <Text style={{ fontSize: scale(20) }}>{mostrarPassword ? '👁️' : '👁️‍🗨️'}</Text>
            </TouchableOpacity>
          </View>

          <Text style={[styles.label, { fontSize: scale(14), color: theme.colors.text }]}>Confirmar Contraseña</Text>
          <View style={[styles.passwordContainer, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
            <TextInput
              style={[styles.passwordInput, { fontSize: scale(15), color: theme.colors.text }]}
              placeholder="••••••••"
              placeholderTextColor={theme.colors.textSecondary}
              secureTextEntry={!mostrarPassword}
              value={confirmContrasena}
              onChangeText={setConfirmContrasena}
              editable={!loading}
            />
          </View>

          <TouchableOpacity
            style={[styles.button, loading && styles.buttonDisabled, { backgroundColor: theme.colors.primary }]}
            onPress={handleRegistro}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>Registrarse</Text>
            )}
          </TouchableOpacity>
        </View>
      )}

      {/* Custom Alert */}
      <CustomAlert
        visible={alertVisible}
        title={alertTitle}
        message={alertMessage}
        buttons={alertButtons}
        onDismiss={() => setAlertVisible(false)}
      />
    </ScrollView>
    </KeyboardAvoidingView>
  );
};

const createStyles = (scale: (size: number) => number, theme: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  header: {
    alignItems: 'center',
    paddingVertical: 60,
    paddingTop: 80,
    backgroundColor: theme.colors.primary,
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 10,
  },
  logoCircle: {
    width: scale(120),
    height: scale(120),
    borderRadius: scale(60),
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 5,
  },
  title: {
    fontWeight: '800',
    color: '#fff',
    letterSpacing: -1,
    marginBottom: 8,
  },
  subtitle: {
    fontWeight: '600',
    color: 'rgba(255,255,255,0.9)',
    letterSpacing: -0.3,
  },
  tabContainer: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginTop: 20,
    marginBottom: 8,
    backgroundColor: theme.colors.surface,
    borderRadius: 12,
    padding: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: 8,
  },
  tabActive: {
    backgroundColor: theme.colors.primary,
  },
  tabText: {
    fontWeight: '700',
    color: theme.colors.textSecondary,
  },
  tabTextActive: {
    color: '#fff',
  },
  form: {
    padding: 24,
    backgroundColor: theme.colors.background,
  },
  label: {
    fontWeight: '600',
    marginBottom: 8,
    marginTop: 12,
    color: theme.colors.text,
  },
  input: {
    borderWidth: 2,
    borderColor: theme.colors.border,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: theme.colors.surface,
    color: theme.colors.text,
    fontSize: scale(15),
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  passwordContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: theme.colors.border,
    borderRadius: 12,
    backgroundColor: theme.colors.surface,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  passwordInput: {
    flex: 1,
    paddingHorizontal: 16,
    paddingVertical: 14,
    color: theme.colors.text,
  },
  eyeButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  settingsButton: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  modalOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 999,
  },
  modalContent: {
    borderRadius: 20,
    padding: 28,
    minWidth: 300,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 10,
  },
  modalTitle: {
    fontWeight: '800',
    marginBottom: 20,
    textAlign: 'center',
  },
  themeButton: {
    marginBottom: 20,
    borderRadius: 12,
    paddingVertical: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  themeButtonText: {
    color: '#fff',
    textAlign: 'center',
    fontWeight: '700',
  },
  fontLabel: {
    fontWeight: '600',
    marginBottom: 12,
  },
  fontSizeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
    gap: 8,
  },
  fontSizeButton: {
    flex: 1,
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  closeModalButton: {
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 8,
  },
  button: {
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 24,
    backgroundColor: theme.colors.primary,
    shadowColor: theme.colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    fontWeight: '800',
    color: '#fff',
    fontSize: scale(16),
    letterSpacing: 0.5,
  },
  rememberMeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    paddingVertical: 8,
    paddingHorizontal: 4,
    borderRadius: 8,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: theme.colors.textSecondary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  rememberMeText: {
    fontWeight: '600',
    letterSpacing: 0.3,
  },
});

