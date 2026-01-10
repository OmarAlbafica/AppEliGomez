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

interface LoginScreenProps {
  onLoginSuccess: (usuario: Usuario) => void;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({ onLoginSuccess }) => {
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
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.logo}>🔐</Text>
        <Text style={styles.title}>Encomiendas</Text>
        <Text style={styles.subtitle}>Sistema de Gestión de Envíos</Text>
      </View>

      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[styles.tab, modo === 'login' && styles.tabActive]}
          onPress={() => setModo('login')}
        >
          <Text style={[styles.tabText, modo === 'login' && styles.tabTextActive]}>
            Iniciar Sesión
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, modo === 'registro' && styles.tabActive]}
          onPress={() => setModo('registro')}
        >
          <Text style={[styles.tabText, modo === 'registro' && styles.tabTextActive]}>
            Registrarse
          </Text>
        </TouchableOpacity>
      </View>

      {modo === 'login' ? (
        <View style={styles.form}>
          <Text style={styles.label}>Usuario o Email</Text>
          <TextInput
            style={styles.input}
            placeholder="usuario o email@ejemplo.com"
            value={identificador}
            onChangeText={setIdentificador}
            editable={!loading}
          />

          <Text style={styles.label}>Contraseña</Text>
          <View style={styles.passwordContainer}>
            <TextInput
              style={styles.passwordInput}
              placeholder="••••••••"
              secureTextEntry={!mostrarPassword}
              value={contrasena}
              onChangeText={setContrasena}
              editable={!loading}
            />
            <TouchableOpacity onPress={() => setMostrarPassword(!mostrarPassword)}>
              <Text style={styles.eyeIcon}>{mostrarPassword ? '👁' : '👁‍🗨'}</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={[styles.button, loading && styles.buttonDisabled]}
            onPress={handleLogin}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>🔓 Iniciar Sesión</Text>
            )}
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.form}>
          <Text style={styles.label}>Nombre</Text>
          <TextInput
            style={styles.input}
            placeholder="Tu nombre"
            value={nombre}
            onChangeText={setNombre}
            editable={!loading}
          />

          <Text style={styles.label}>Apellido</Text>
          <TextInput
            style={styles.input}
            placeholder="Tu apellido"
            value={apellido}
            onChangeText={setApellido}
            editable={!loading}
          />

          <Text style={styles.label}>Correo</Text>
          <TextInput
            style={styles.input}
            placeholder="email@ejemplo.com"
            value={correo}
            onChangeText={setCorreo}
            keyboardType="email-address"
            editable={!loading}
          />

          <Text style={styles.label}>Usuario</Text>
          <TextInput
            style={styles.input}
            placeholder="Tu usuario"
            value={usuario}
            onChangeText={setUsuario}
            editable={!loading}
          />

          <Text style={styles.label}>Contraseña</Text>
          <View style={styles.passwordContainer}>
            <TextInput
              style={styles.passwordInput}
              placeholder="••••••••"
              secureTextEntry={!mostrarPassword}
              value={contrasena}
              onChangeText={setContrasena}
              editable={!loading}
            />
            <TouchableOpacity onPress={() => setMostrarPassword(!mostrarPassword)}>
              <Text style={styles.eyeIcon}>{mostrarPassword ? '👁' : '👁‍🗨'}</Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.label}>Confirmar Contraseña</Text>
          <TextInput
            style={styles.input}
            placeholder="••••••••"
            secureTextEntry={!mostrarPassword}
            value={confirmContrasena}
            onChangeText={setConfirmContrasena}
            editable={!loading}
          />

          <TouchableOpacity
            style={[styles.button, loading && styles.buttonDisabled]}
            onPress={handleRegistro}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>📝 Registrarse</Text>
            )}
          </TouchableOpacity>
        </View>
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    alignItems: 'center',
    paddingVertical: 40,
    backgroundColor: '#fff',
  },
  logo: {
    fontSize: 48,
    marginBottom: 12,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#1a1a1a',
  },
  subtitle: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
  },
  tabActive: {
    borderBottomWidth: 3,
    borderBottomColor: '#667eea',
  },
  tabText: {
    color: '#999',
    fontWeight: '600',
  },
  tabTextActive: {
    color: '#667eea',
  },
  form: {
    padding: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
    marginTop: 12,
  },
  input: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
  },
  passwordContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
  },
  passwordInput: {
    flex: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
  },
  eyeIcon: {
    paddingHorizontal: 12,
    fontSize: 18,
  },
  button: {
    backgroundColor: '#667eea',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 20,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
});
