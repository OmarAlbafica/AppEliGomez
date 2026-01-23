import React, { useState, useEffect, useRef } from 'react';
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
  Animated,
} from 'react-native';
import { Picker as RNPicker } from '@react-native-picker/picker';
import { launchCamera, launchImageLibrary } from 'react-native-image-picker';
import { Camera, useCameraDevice, useCodeScanner } from 'react-native-vision-camera';

// 🔑 SERVICIO OPTIMIZADO
import { pedidosServiceOptimizado, PedidoCompleto } from '../services/pedidosServiceOptimizado';
import { BackButton } from '../components/BackButton';
import { useTheme } from '../context/ThemeContext';
import { formatDate12Hours } from '../utils/dateUtils';
import { ScanIcon, PackageIcon } from '../components/icons';
import { ImageViewer } from '../components/ImageViewer';

interface ScannerScreenVisionCameraProps {
  onNavigate?: (screen: string) => void;
}

const Picker = RNPicker as any;

const estadoLabels: { [key: string]: string } = {
  pendiente: '⏳ Pendiente',
  empacada: '📦 Empacada',
  enviado: '📮 Enviado',
  retirado: '✓ Retirado',
  'no-retirado': '✗ No Retirado',
  'retirado-local': '🏪 Retirado del Local',
  cancelado: '❌ Cancelado',
  liberado: '🔓 Liberado',
  remunero: '💰 Remunerado',
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
  
  // Visor de imágenes con zoom
  const [imageViewerVisible, setImageViewerVisible] = useState(false);
  const [currentImages, setCurrentImages] = useState<string[]>([]);
  const [imageTitle, setImageTitle] = useState('');
  
  // Notas
  const [notas, setNotas] = useState('');
  
  // Para escaneo QR con cámara Vision Camera
  const [modalQRVisible, setModalQRVisible] = useState(false);
  const [hasPermission, setHasPermission] = useState(false);
  const [isScanning, setIsScanning] = useState(false);

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
      console.log(`[🔄 ScannerScreen] Cambiando estado a: ${nuevoEstado}`);
      console.log(`[📸 ScannerScreen] Foto adjunta: ${foto_base64 ? '✅ SÍ' : '❌ NO'}`);
      if (foto_base64) {
        console.log(`[📸 ScannerScreen] Tamaño foto base64: ${(foto_base64.length / 1024).toFixed(2)} KB`);
        console.log(`[📸 ScannerScreen] Primeros 50 caracteres: ${foto_base64.substring(0, 50)}...`);
      }
      console.log(`[📝 ScannerScreen] Notas: ${notas || 'ninguna'}`);

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
        const base64Data = result.assets[0].base64;
        console.log(`[📸 Scanner] ✅ Foto capturada de cámara`);
        console.log(`[📸 Scanner] Tamaño: ${(base64Data.length / 1024).toFixed(2)} KB`);
        console.log(`[📸 Scanner] Primeros 50 chars: ${base64Data.substring(0, 50)}...`);
        setFoto_base64(base64Data);
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
        const base64Data = result.assets[0].base64;
        console.log(`[📸 Scanner] ✅ Foto seleccionada de galería`);
        console.log(`[📸 Scanner] Tamaño: ${(base64Data.length / 1024).toFixed(2)} KB`);
        console.log(`[📸 Scanner] Primeros 50 chars: ${base64Data.substring(0, 50)}...`);
        setFoto_base64(base64Data);
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
  };

  // ============================================================
  // 🎨 RENDER
  // ============================================================
  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      {/* Header moderno con gradiente */}
      <Animated.View style={[styles.modernHeader, { backgroundColor: theme.colors.primary, height: headerHeight, overflow: 'hidden' }]}>
        <View style={styles.headerTop}>
          <BackButton onPress={() => onNavigate?.('home')} />
        </View>
        
        <Animated.View style={[styles.headerContent, { opacity: headerOpacity }]}>
          <View style={styles.iconCircle}>
            <ScanIcon size={scale(48)} color="#fff" />
          </View>
          <Text style={styles.modernHeaderTitle}>Escanear</Text>
          <Text style={styles.headerSubtitle}>
            {pedidoEncontrado ? `Pedido ${pedidoEncontrado.codigo}` : 'Busca o escanea un código'}
          </Text>
        </Animated.View>
      </Animated.View>

      <Animated.ScrollView
        contentContainerStyle={{ padding: scale(16), paddingBottom: 40 }}
        onScroll={handleScroll}
        scrollEventThrottle={16}
      >
        {/* Input de código */}
        <Text style={[styles.label, { color: theme.colors.text }]}>Ingresa el código del pedido</Text>
        <View style={styles.searchRow}>
          <TextInput
            style={[styles.searchInput, { 
              flex: 1, 
              marginRight: scale(8),
              backgroundColor: theme.colors.surface,
              color: theme.colors.text,
              borderColor: theme.colors.border,
            }]}
            placeholder="Ej: EG20260109001"
            placeholderTextColor={theme.colors.textSecondary}
            value={codigo}
            onChangeText={setCodigo}
          />
          <TouchableOpacity style={[styles.iconButton, { backgroundColor: theme.colors.primary }]} onPress={handleBuscarPedido}>
            <Text style={{ fontSize: scale(20) }}>🔍</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.iconButton, { backgroundColor: theme.colors.primary, marginLeft: scale(8) }]} onPress={handleAbrirEscanerQR}>
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
            
            {/* FECHA DE ENTREGA PROGRAMADA - MÁS IMPORTANTE */}
            <View style={[styles.highlightBox, { backgroundColor: theme.colors.primaryLight, borderLeftColor: theme.colors.primary }]}>
              <Text style={[styles.highlightLabel, { color: theme.colors.primary }]}>📅 ENTREGA PROGRAMADA</Text>
              <Text style={[styles.highlightValue, { color: theme.colors.text }]}>
                {pedidoEncontrado.fecha_entrega_programada 
                  ? formatDate12Hours(pedidoEncontrado.fecha_entrega_programada)
                  : 'No programada'}
              </Text>
              {pedidoEncontrado.hora_inicio && pedidoEncontrado.hora_fin && (
                <Text style={[styles.highlightTime, { color: theme.colors.text }]}>
                  🕐 {pedidoEncontrado.hora_inicio} - {pedidoEncontrado.hora_fin}
                </Text>
              )}
              {pedidoEncontrado.dia_entrega && (
                <Text style={[styles.highlightDay, { color: theme.colors.textSecondary }]}>
                  {pedidoEncontrado.dia_entrega}
                </Text>
              )}
            </View>

            {/* CLIENTE */}
            <Text style={styles.pedidoInfo}>👤 Cliente: {pedidoEncontrado.cliente_nombre || pedidoEncontrado.cliente?.nombre || 'N/A'}</Text>
            
            {/* ENCOMENDISTA */}
            <Text style={styles.pedidoInfo}>🚚 Encomienda: {pedidoEncontrado.encomendista_nombre || pedidoEncontrado.encomendista?.nombre || 'N/A'}</Text>
            
            {/* TIENDA Y PERFIL DE RESERVA */}
            <Text style={styles.pedidoInfo}>🏪 Tienda: {pedidoEncontrado.nombre_tienda || 'N/A'}</Text>
            {pedidoEncontrado.nombre_perfil && (
              <Text style={styles.pedidoInfo}>📋 Perfil: {pedidoEncontrado.nombre_perfil}</Text>
            )}
            
            {/* ESTADO ACTUAL */}
            <Text style={styles.pedidoInfo}>📊 Estado actual: {estadoLabels[pedidoEncontrado.estado || 'pendiente']}</Text>
            
            {/* Foto del paquete si existe */}
            {pedidoEncontrado.foto_paquete_url && (
              <View style={{ marginTop: scale(12) }}>
                <Text style={styles.label}>📸 Foto del paquete:</Text>
                <TouchableOpacity onPress={() => {
                  setCurrentImages([pedidoEncontrado.foto_paquete_url!]);
                  setImageTitle(`Paquete - ${pedidoEncontrado.codigo_pedido}`);
                  setImageViewerVisible(true);
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

            {/* 📸 FOTO - SOLO SI ES "EMPACADA" (IGUAL QUE WEB) */}
            {nuevoEstado === 'empacada' && (
              <View style={[styles.fotoContainer, { marginTop: scale(12), marginBottom: scale(12) }]}>
                <Text style={styles.fotoLabel}>📸 Foto del Paquete Empacado</Text>
                <Text style={styles.fotoInfo}>
                  {foto_base64 ? '✓ Foto seleccionada (JPG, PNG)' : 'Carga una foto del paquete empacado'}
                </Text>

                {/* Botón para seleccionar foto */}
                <TouchableOpacity 
                  style={styles.fotoButtton}
                  onPress={handleSeleccionarFoto}
                >
                  <Text style={styles.fotoButttonText}>
                    {foto_base64 ? '🔄 Cambiar imagen' : '📁 Seleccionar Imagen'}
                  </Text>
                </TouchableOpacity>

                {/* Preview de la foto si se cargó */}
                {foto_base64 && (
                  <View style={{ marginTop: scale(8) }}>
                    <Text style={styles.fotoPreviewLabel}>✓ Foto seleccionada:</Text>
                    <Image
                      source={{ uri: `data:image/jpeg;base64,${foto_base64}` }}
                      style={{
                        width: '100%',
                        height: scale(120),
                        borderRadius: 8,
                        marginTop: scale(6),
                      }}
                      resizeMode="cover"
                    />
                  </View>
                )}
              </View>
            )}

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
      </Animated.ScrollView>

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

      {/* Visor de Imágenes con Zoom */}
      <ImageViewer
        visible={imageViewerVisible}
        images={currentImages}
        title={imageTitle}
        onClose={() => setImageViewerVisible(false)}
      />
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
    searchRow: {
      flexDirection: 'row',
      marginBottom: scale(16),
    },
    searchInput: {
      borderWidth: 2,
      borderRadius: 12,
      paddingHorizontal: 16,
      paddingVertical: 14,
      fontSize: scale(14),
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.05,
      shadowRadius: 4,
      elevation: 2,
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
      padding: scale(14),
      borderRadius: 12,
      justifyContent: 'center',
      alignItems: 'center',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 3,
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
      marginBottom: scale(12),
    },
    highlightBox: {
      backgroundColor: theme.colors.primaryLight,
      borderLeftWidth: 4,
      borderLeftColor: theme.colors.primary,
      borderRadius: 8,
      padding: scale(12),
      marginBottom: scale(12),
    },
    highlightLabel: {
      fontSize: scale(12),
      fontWeight: '700',
      color: theme.colors.primary,
      marginBottom: scale(4),
      letterSpacing: 0.5,
    },
    highlightValue: {
      fontSize: scale(18),
      fontWeight: 'bold',
      color: theme.colors.text,
      marginBottom: scale(2),
    },
    highlightTime: {
      fontSize: scale(16),
      fontWeight: '600',
      color: theme.colors.text,
      marginTop: scale(4),
    },
    highlightDay: {
      fontSize: scale(13),
      fontWeight: '500',
      color: theme.colors.textSecondary,
      marginTop: scale(2),
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
    // 📸 ESTILOS PARA FOTO (IGUAL QUE WEB)
    fotoContainer: {
      backgroundColor: '#F0FDE4',
      borderRadius: 8,
      padding: scale(12),
      borderWidth: 1,
      borderColor: '#BBCD3F',
    },
    fotoLabel: {
      fontSize: scale(13),
      fontWeight: '700',
      color: '#156C00',
      marginBottom: scale(6),
    },
    fotoInfo: {
      fontSize: scale(12),
      color: '#4B9C20',
      marginBottom: scale(8),
    },
    fotoButtton: {
      borderWidth: 2,
      borderStyle: 'dashed',
      borderColor: '#A8D66E',
      borderRadius: 8,
      paddingVertical: scale(10),
      paddingHorizontal: scale(12),
      alignItems: 'center',
      marginBottom: scale(8),
    },
    fotoButttonText: {
      fontSize: scale(12),
      color: '#4B9C20',
      fontWeight: '600',
    },
    fotoPreviewLabel: {
      fontSize: scale(12),
      fontWeight: '600',
      color: '#156C00',
      marginBottom: scale(4),
    },
    emptyText: {
      textAlign: 'center',
      fontSize: scale(16),
      color: theme.colors.textSecondary,
      marginTop: scale(32),
    },
  });
};
