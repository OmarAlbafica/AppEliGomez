import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Modal,
  ScrollView,
  Image,
  StyleSheet,
} from 'react-native';
import { Picker as RNPicker } from '@react-native-picker/picker';
import { launchCamera, launchImageLibrary } from 'react-native-image-picker';
import { Camera, useCameraDevice, useCodeScanner } from 'react-native-vision-camera';

// 🔑 SERVICIO OPTIMIZADO
import { pedidosServiceOptimizado, PedidoCompleto } from '../services/pedidosServiceOptimizado';
import { BackButton } from '../components/BackButton';
import { useTheme } from '../context/ThemeContext';
import { formatDate12Hours, formatDateOnly, formatTimeOnly } from '../utils/dateUtils';

interface ScannerScreenVisionCameraProps {
  onNavigate?: (screen: string) => void;
}

const Picker = RNPicker as any;

const estadoLabels: { [key: string]: string } = {
  pendiente: '⏳ Pendiente',
  empacada: '📦 Empacada',
  enviado: '📮 Enviado',
  retirado: '✓ Retirado',
  'no retirado': '✗ No Retirado',
  'retirado del local': '🏪 Retirado del Local',
  cancelado: '💵 Cancelado (Pagado)',
  liberado: '🔓 Liberado',
};

export const ScannerScreenVisionCamera: React.FC<ScannerScreenVisionCameraProps> = ({
  onNavigate,
}) => {
  const { theme } = useTheme();
  const scale = (size: number) => theme.scale(size);
  const styles = createStyles(scale, theme);

  // Estados
  const [codigo, setCodigo] = useState('');
  const [pedidoEncontrado, setPedidoEncontrado] = useState<PedidoCompleto | null>(null);
  const [loading, setLoading] = useState(false);
  const [nuevoEstado, setNuevoEstado] = useState('pendiente');
  const [guardando, setGuardando] = useState(false);
  
  // Para foto
  const [foto_base64, setFoto_base64] = useState<string | null>(null);
  
  // Galería de productos
  const [mostrarGaleria, setMostrarGaleria] = useState(false);
  const [productoSeleccionado, setProductoSeleccionado] = useState(0);
  
  // Modal Zoom de Producto
  const [modalZoom, setModalZoom] = useState(false);
  const [imagenZoom, setImagenZoom] = useState<string>('');
  
  // Modal Foto Paquete
  const [modalFotoPaquete, setModalFotoPaquete] = useState(false);
  
  // Notas
  const [notas, setNotas] = useState('');
  
  // Para escaneo QR con cámara Vision Camera
  const [modalQRVisible, setModalQRVisible] = useState(false);
  const [hasPermission, setHasPermission] = useState(false);
  const [isScanning, setIsScanning] = useState(false);

  const device = useCameraDevice('back');

  const estados = Object.keys(estadoLabels);

  // Solicitar permisos de cámara
  useEffect(() => {
    (async () => {
      const status = await Camera.requestCameraPermission();
      setHasPermission(status === 'granted');
    })();
  }, []);

  // Code Scanner
  const codeScanner = useCodeScanner({
    codeTypes: ['qr', 'ean-13', 'ean-8', 'code-128'],
    onCodeScanned: (codes) => {
      if (isScanning && codes.length > 0) {
        const codigoEscaneado = codes[0].value;
        console.log(`[VisionCamera] ✅ Código escaneado: ${codigoEscaneado}`);
        setIsScanning(false);
        handleQRScanned(codigoEscaneado);
      }
    },
  });

  // ============================================================
  // 📷 ESCANEO QR - VISION CAMERA
  // ============================================================
  const handleAbrirEscanerQR = async () => {
    if (!hasPermission) {
      Alert.alert('❌', 'No tienes permisos de cámara');
      return;
    }

    console.log('[VisionCamera] 📱 Abriendo cámara para escanear');
    setIsScanning(true);
    setModalQRVisible(true);
  };

  const handleQRScanned = async (codigoEscaneado: string | undefined) => {
    if (!codigoEscaneado) return;
    
    setModalQRVisible(false);
    setIsScanning(false);
    setCodigo(codigoEscaneado);
    
    // Buscar automáticamente
    setTimeout(async () => {
      try {
        setLoading(true);
        const pedido = await pedidosServiceOptimizado.obtenerPedidoPorCodigo(codigoEscaneado);
        
        if (!pedido) {
          Alert.alert('❌', `Pedido ${codigoEscaneado} no encontrado`);
          setPedidoEncontrado(null);
        } else {
          console.log(`[VisionCamera] ✅ Pedido encontrado:`, pedido);
          setPedidoEncontrado(pedido);
          setNuevoEstado(pedido.estado || 'pendiente');
          setFoto_base64(null);
          setNotas('');
        }
      } catch (error) {
        console.error('[VisionCamera] Error buscando pedido:', error);
        Alert.alert('Error', 'No se pudo buscar el pedido');
      } finally {
        setLoading(false);
      }
    }, 300);
  };

  const handleCerrarEscanerQR = () => {
    setModalQRVisible(false);
    setIsScanning(false);
  };

  // ============================================================
  // 🔍 BUSCAR PEDIDO POR CÓDIGO
  // ============================================================
  const handleBuscarPedido = async () => {
    if (!codigo.trim()) {
      Alert.alert('⚠️', 'Ingresa un código de pedido');
      return;
    }

    try {
      setLoading(true);
      console.log(`[VisionCamera] 🔍 Buscando pedido: ${codigo}`);

      const pedido = await pedidosServiceOptimizado.obtenerPedidoPorCodigo(codigo);

      if (!pedido) {
        Alert.alert('❌', `Pedido ${codigo} no encontrado`);
        setPedidoEncontrado(null);
        return;
      }

      console.log(`✅ Pedido encontrado:`, pedido);
      setPedidoEncontrado(pedido);
      
      setNuevoEstado(pedido.estado || 'pendiente');
      setFoto_base64(null);
      setNotas('');
      
    } catch (error) {
      console.error('❌ Error buscando pedido:', error);
      Alert.alert('❌', 'Error al buscar el pedido');
    } finally {
      setLoading(false);
    }
  };

  // ============================================================
  // 🔄 CAMBIAR ESTADO
  // ============================================================
  const handleCambiarEstado = async () => {
    if (!pedidoEncontrado) {
      Alert.alert('⚠️', 'Primero debes buscar un pedido');
      return;
    }

    if (nuevoEstado === pedidoEncontrado.estado) {
      Alert.alert('ℹ️', 'El nuevo estado es igual al actual');
      return;
    }

    try {
      setGuardando(true);
      console.log(`[VisionCamera] 🔄 Cambiando estado a: ${nuevoEstado}`);

      const exito = await pedidosServiceOptimizado.cambiarEstadoPedido(
        pedidoEncontrado.id!,
        nuevoEstado,
        foto_base64 || undefined,
        notas || undefined
      );

      if (exito) {
        Alert.alert(
          '✅ Éxito',
          `Pedido actualizado a ${nuevoEstado}`,
          [
            {
              text: 'OK',
              onPress: () => {
                handleLimpiar();
              },
            },
          ]
        );
      } else {
        Alert.alert('❌', 'No se pudo actualizar el pedido');
      }

    } catch (error) {
      console.error('❌ Error cambiando estado:', error);
      Alert.alert('❌', 'Error al cambiar el estado');
    } finally {
      setGuardando(false);
    }
  };

  // ============================================================
  // 📸 SELECCIONAR FOTO
  // ============================================================
  const handleSeleccionarFoto = async () => {
    Alert.alert('📸 Seleccionar Foto', 'Elige una opción:', [
      {
        text: '📷 Capturar con cámara',
        onPress: () => handleCapturarConCamara(),
      },
      {
        text: '🖼️ Seleccionar de galería',
        onPress: () => handleSeleccionarDeGaleria(),
      },
      {
        text: '❌ Cancelar',
        style: 'cancel',
      },
    ]);
  };

  const handleCapturarConCamara = async () => {
    try {
      const result = await launchCamera({
        mediaType: 'photo',
        includeBase64: true,
        maxWidth: 800,
        maxHeight: 800,
        quality: 0.7,
      });

      if (result.assets && result.assets[0].base64) {
        setFoto_base64(result.assets[0].base64);
        console.log('✅ Foto capturada con la cámara');
      }
    } catch (error) {
      console.error('Error al capturar foto:', error);
      Alert.alert('Error', 'No se pudo capturar la foto');
    }
  };

  const handleSeleccionarDeGaleria = async () => {
    try {
      const result = await launchImageLibrary({
        mediaType: 'photo',
        includeBase64: true,
        maxWidth: 800,
        maxHeight: 800,
        quality: 0.7,
      });

      if (result.assets && result.assets[0].base64) {
        setFoto_base64(result.assets[0].base64);
        console.log('✅ Foto seleccionada de la galería');
      }
    } catch (error) {
      console.error('Error al seleccionar foto:', error);
      Alert.alert('Error', 'No se pudo seleccionar la foto');
    }
  };

  const handleLimpiar = () => {
    setCodigo('');
    setPedidoEncontrado(null);
    setNuevoEstado('pendiente');
    setFoto_base64(null);
    setNotas('');
    setMostrarGaleria(false);
  };

  // ============================================================
  // 🎨 RENDER
  // ============================================================
  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <BackButton onPress={() => onNavigate?.('home')} />
        <Text style={styles.headerTitle}>🔍 Escanear Pedido</Text>
      </View>

      <ScrollView contentContainerStyle={{ padding: scale(16) }}>
        {/* Input de código */}
        <Text style={styles.label}>Ingresa el código del pedido</Text>
        <View style={{ flexDirection: 'row', marginBottom: scale(16) }}>
          <TextInput
            style={[styles.input, { flex: 1, marginRight: scale(8) }]}
            placeholder="Ej: EG20260109001"
            placeholderTextColor={theme.colors.textSecondary}
            value={codigo}
            onChangeText={setCodigo}
          />
          <TouchableOpacity style={styles.iconButton} onPress={handleBuscarPedido}>
            <Text style={{ fontSize: scale(20) }}>🔍</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.iconButton} onPress={handleAbrirEscanerQR}>
            <Text style={{ fontSize: scale(20) }}>📷</Text>
          </TouchableOpacity>
        </View>

        {/* Loading */}
        {loading && (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={theme.colors.primary} />
            <Text style={styles.loadingText}>Buscando pedido...</Text>
          </View>
        )}

        {/* Información del pedido */}
        {pedidoEncontrado && (
          <View style={styles.pedidoCard}>
            <Text style={styles.pedidoTitle}>📦 Pedido: {pedidoEncontrado.codigo}</Text>
            <Text style={styles.pedidoInfo}>Cliente: {pedidoEncontrado.cliente?.nombre || 'N/A'}</Text>
            <Text style={styles.pedidoInfo}>Estado actual: {estadoLabels[pedidoEncontrado.estado || 'pendiente']}</Text>
            <Text style={styles.pedidoInfo}>Fecha: {formatDate12Hours(pedidoEncontrado.fecha_creacion)}</Text>
            
            {/* Foto del paquete si existe */}
            {pedidoEncontrado.foto_paquete_url && (
              <View style={{ marginTop: scale(12) }}>
                <Text style={styles.label}>📸 Foto del paquete:</Text>
                <TouchableOpacity onPress={() => {
                  setImagenZoom(pedidoEncontrado.foto_paquete_url!);
                  setModalFotoPaquete(true);
                }}>
                  <Image
                    source={{ uri: pedidoEncontrado.foto_paquete_url }}
                    style={{
                      width: '100%',
                      height: scale(200),
                      borderRadius: 8,
                      marginTop: scale(8),
                    }}
                    resizeMode="cover"
                  />
                </TouchableOpacity>
              </View>
            )}
            
            {/* Cambiar estado */}
            <Text style={[styles.label, { marginTop: scale(16) }]}>Cambiar estado:</Text>
            <View style={styles.pickerContainer}>
              <Picker
                selectedValue={nuevoEstado}
                onValueChange={setNuevoEstado}
                style={styles.picker}
                dropdownIconColor={theme.colors.text}
                mode="dropdown"
              >
                {estados.map((estado) => (
                  <Picker.Item 
                    key={estado} 
                    label={estadoLabels[estado]} 
                    value={estado}
                    color={theme.colors.text}
                  />
                ))}
              </Picker>
            </View>

            {/* Foto */}
            <TouchableOpacity style={styles.button} onPress={handleSeleccionarFoto}>
              <Text style={styles.buttonText}>
                {foto_base64 ? '✓ Foto agregada' : '📸 Agregar foto'}
              </Text>
            </TouchableOpacity>

            {/* Notas */}
            <Text style={styles.label}>Notas (opcional):</Text>
            <TextInput
              style={[styles.input, { height: scale(80), textAlignVertical: 'top' }]}
              placeholder="Agrega notas aquí..."
              placeholderTextColor={theme.colors.textSecondary}
              value={notas}
              onChangeText={setNotas}
              multiline
            />

            {/* Guardar */}
            <TouchableOpacity
              style={[styles.button, styles.primaryButton]}
              onPress={handleCambiarEstado}
              disabled={guardando}
            >
              {guardando ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.buttonText}>💾 Guardar Cambios</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity style={[styles.button, styles.secondaryButton]} onPress={handleLimpiar}>
              <Text style={styles.buttonText}>🔄 Limpiar</Text>
            </TouchableOpacity>
          </View>
        )}

        {!loading && !pedidoEncontrado && (
          <Text style={styles.emptyText}>👆 Busca un pedido para comenzar</Text>
        )}
      </ScrollView>

      {/* Modal para escaneo QR - Vision Camera */}
      {modalQRVisible && device && hasPermission && (
        <Modal
          visible={modalQRVisible}
          animationType="slide"
          transparent={false}
          onRequestClose={handleCerrarEscanerQR}
        >
          <View style={{ flex: 1, backgroundColor: '#000' }}>
            <Camera
              style={StyleSheet.absoluteFill}
              device={device}
              isActive={modalQRVisible && isScanning}
              codeScanner={codeScanner}
            />
            
            {/* Overlay superior con título */}
            <View style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              backgroundColor: 'rgba(0,0,0,0.8)',
              paddingTop: 50,
              paddingBottom: 20,
              paddingHorizontal: 16,
            }}>
              <Text style={{
                fontSize: scale(20),
                fontWeight: 'bold',
                color: '#fff',
                textAlign: 'center',
                marginBottom: 8,
              }}>
                📷 Escanear Código
              </Text>
              <Text style={{
                fontSize: scale(14),
                color: '#fff',
                textAlign: 'center',
              }}>
                Apunta al código de barras o QR
              </Text>
            </View>
            
            {/* Marco de escaneo */}
            <View style={{
              position: 'absolute',
              top: '35%',
              left: '10%',
              right: '10%',
              height: 250,
              borderWidth: 2,
              borderColor: '#00FF00',
              borderRadius: 12,
              backgroundColor: 'transparent',
            }} />
            
            {/* Botón cerrar */}
            <TouchableOpacity
              style={{
                position: 'absolute',
                bottom: 40,
                left: 16,
                right: 16,
                backgroundColor: theme.colors.primary,
                paddingVertical: 16,
                borderRadius: 12,
                elevation: 5,
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.3,
                shadowRadius: 4,
              }}
              onPress={handleCerrarEscanerQR}
            >
              <Text style={{ color: '#fff', fontSize: scale(16), fontWeight: 'bold', textAlign: 'center' }}>
                ✕ Cerrar Escáner
              </Text>
            </TouchableOpacity>
          </View>
        </Modal>
      )}

      {/* Modal para ver foto del paquete */}
      <Modal
        visible={modalFotoPaquete}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setModalFotoPaquete(false)}
      >
        <View style={{
          flex: 1,
          backgroundColor: 'rgba(0,0,0,0.9)',
          justifyContent: 'center',
          alignItems: 'center',
        }}>
          <TouchableOpacity
            style={{
              position: 'absolute',
              top: 40,
              right: 20,
              backgroundColor: theme.colors.primary,
              paddingHorizontal: 16,
              paddingVertical: 8,
              borderRadius: 8,
              zIndex: 10,
            }}
            onPress={() => setModalFotoPaquete(false)}
          >
            <Text style={{ color: '#fff', fontSize: scale(16), fontWeight: 'bold' }}>✕ Cerrar</Text>
          </TouchableOpacity>
          <Image
            source={{ uri: imagenZoom }}
            style={{ width: '90%', height: '80%' }}
            resizeMode="contain"
          />
        </View>
      </Modal>
    </View>
  );
};

const getEstadoColor = (estado: string): string => {
  const colors: { [key: string]: string } = {
    pendiente: '#FFC107',
    empacada: '#FF6F00',
    enviado: '#9C27B0',
    entregado: '#4CAF50',
    cancelado: '#F44336',
    retirado: '#00BCD4',
    'no-retirado': '#FF9800',
    remunero: '#4CAF50',
  };
  return colors[estado] || '#757575';
};

const createStyles = (scale: (size: number) => number, theme: any) => {
  const { StyleSheet } = require('react-native');
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: scale(16),
      backgroundColor: theme.colors.primary,
    },
    headerTitle: {
      fontSize: scale(20),
      fontWeight: 'bold',
      color: '#fff',
      marginLeft: scale(8),
    },
    label: {
      fontSize: scale(14),
      fontWeight: '600',
      color: theme.colors.text,
      marginBottom: scale(8),
    },
    input: {
      borderWidth: 1,
      borderColor: theme.colors.border,
      borderRadius: 8,
      padding: scale(12),
      fontSize: scale(14),
      backgroundColor: theme.colors.surface,
      color: theme.colors.text,
    },
    iconButton: {
      backgroundColor: theme.colors.primary,
      padding: scale(12),
      borderRadius: 8,
      marginLeft: scale(4),
      justifyContent: 'center',
      alignItems: 'center',
    },
    loadingContainer: {
      alignItems: 'center',
      marginVertical: scale(32),
    },
    loadingText: {
      marginTop: scale(8),
      fontSize: scale(14),
      color: theme.colors.textSecondary,
    },
    pedidoCard: {
      backgroundColor: theme.colors.surface,
      borderRadius: 12,
      padding: scale(16),
      marginBottom: scale(16),
    },
    pedidoTitle: {
      fontSize: scale(18),
      fontWeight: 'bold',
      color: theme.colors.text,
      marginBottom: scale(8),
    },
    pedidoInfo: {
      fontSize: scale(14),
      color: theme.colors.textSecondary,
      marginBottom: scale(4),
    },
    pickerContainer: {
      borderWidth: 1,
      borderColor: theme.colors.border,
      borderRadius: 8,
      marginBottom: scale(12),
      backgroundColor: theme.colors.surface,
    },
    picker: {
      color: theme.colors.text,
    },
    button: {
      backgroundColor: theme.colors.textSecondary,
      padding: scale(14),
      borderRadius: 8,
      marginTop: scale(12),
      alignItems: 'center',
    },
    primaryButton: {
      backgroundColor: theme.colors.primary,
    },
    secondaryButton: {
      backgroundColor: theme.colors.textSecondary,
    },
    buttonText: {
      color: '#fff',
      fontSize: scale(14),
      fontWeight: 'bold',
    },
    emptyText: {
      textAlign: 'center',
      fontSize: scale(16),
      color: theme.colors.textSecondary,
      marginTop: scale(32),
    },
  });
};
