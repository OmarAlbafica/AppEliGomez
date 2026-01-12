import React, { useState, useRef } from 'react';
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
  Linking,
  PermissionsAndroid,
} from 'react-native';
import { Picker as RNPicker } from '@react-native-picker/picker';
import { launchCamera, launchImageLibrary } from 'react-native-image-picker';
import { Camera, useCameraDevice, useCodeScanner } from 'react-native-vision-camera';

// 🔑 SERVICIO OPTIMIZADO
import { pedidosServiceOptimizado, PedidoCompleto } from '../services/pedidosServiceOptimizado';
import { BackButton } from '../components/BackButton';
import { useTheme } from '../context/ThemeContext';

interface ScannerScreenOptimizadoProps {
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

export const ScannerScreenOptimizado: React.FC<ScannerScreenOptimizadoProps> = ({
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
  
  // Para escaneo QR con cámara
  const [modalQRVisible, setModalQRVisible] = useState(false);
  const [hasPermission, setHasPermission] = useState(false);
  const device = useCameraDevice('back');

  const codeScanner = useCodeScanner({
    codeTypes: ['qr', 'ean-13', 'code-128', 'code-39', 'ean-8'],
    onCodeScanned: (codes) => {
      if (codes.length > 0 && codes[0].value) {
        const codigoEscaneado = codes[0].value.trim();
        handleQRScanned({ data: codigoEscaneado });
      }
    }
  });

  const estados = Object.keys(estadoLabels);

  // ============================================================
  // 📷 ESCANEO QR - VISION CAMERA
  // ============================================================
  const handleAbrirEscanerQR = async () => {
    try {
      const permission = await Camera.requestCameraPermission();
      
      if (permission === 'denied') {
        Alert.alert(
          '📷 Permiso de Cámara',
          'Necesitamos acceso a la cámara. Ve a Configuración para habilitarla.',
          [
            { text: 'Cancelar', style: 'cancel' },
            { text: 'Abrir Configuración', onPress: () => Linking.openSettings() }
          ]
        );
        return;
      }

      setHasPermission(true);
      setModalQRVisible(true);
    } catch (error) {
      console.error('Error al abrir cámara:', error);
      Alert.alert('❌', 'Error al abrir la cámara');
    }
  };

  const handleQRScanned = async (e: any) => {
    const codigoEscaneado = e.data?.trim();
    
    if (codigoEscaneado) {
      console.log(`[ScannerScreenOptimizado] ✅ Código Escaneado: ${codigoEscaneado}`);
      
      setModalQRVisible(false);
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
            console.log(`[ScannerScreenOptimizado] ✅ Pedido encontrado:`, pedido);
            setPedidoEncontrado(pedido);
            setNuevoEstado(pedido.estado || 'pendiente');
            setFoto_base64(null);
            setNotas('');
          }
        } catch (error) {
          console.error('[ScannerScreenOptimizado] Error buscando pedido:', error);
          Alert.alert('Error', 'No se pudo buscar el pedido');
        } finally {
          setLoading(false);
        }
      }, 300);
    }
  };

  const handleCerrarEscanerQR = () => {
    setModalQRVisible(false);
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
      console.log(`[ScannerScreenOptimizado] 🔍 Buscando pedido: ${codigo}`);

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
      console.log(`[ScannerScreenOptimizado] 🔄 Cambiando estado a: ${nuevoEstado}`);

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
        text: 'Cancelar',
        onPress: () => {},
        style: 'cancel',
      },
    ]);
  };

  // Capturar foto con cámara
  const handleCapturarConCamara = async () => {
    try {
      const permission = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.CAMERA,
        {
          title: '🎥 Permiso de Cámara',
          message: 'Necesitamos acceso a la cámara para capturar la foto del paquete',
          buttonPositive: 'Aceptar',
          buttonNegative: 'Cancelar',
        }
      );

      if (permission !== PermissionsAndroid.RESULTS.GRANTED) {
        Alert.alert('❌', 'Permiso de cámara denegado');
        return;
      }

      const result = await launchCamera({
        mediaType: 'photo',
        includeBase64: true,
        quality: 0.8,
      });

      if (result.assets && result.assets[0]) {
        const asset = result.assets[0];
        const base64 = asset.base64;
        
        if (base64) {
          const fotoBase64 = `data:image/jpeg;base64,${base64}`;
          setFoto_base64(fotoBase64);
          Alert.alert('✅', 'Foto capturada correctamente');
        }
      }
    } catch (error) {
      console.error('Error al capturar foto:', error);
      Alert.alert('❌', 'Error al capturar la foto');
    }
  };

  // Seleccionar foto de galería
  const handleSeleccionarDeGaleria = async () => {
    try {
      const permission = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.READ_EXTERNAL_STORAGE,
        {
          title: '📁 Permiso de Almacenamiento',
          message: 'Necesitamos acceso al almacenamiento para seleccionar una foto',
          buttonPositive: 'Aceptar',
          buttonNegative: 'Cancelar',
        }
      );

      if (permission !== PermissionsAndroid.RESULTS.GRANTED) {
        Alert.alert('❌', 'Permiso de almacenamiento denegado');
        return;
      }

      const result = await launchImageLibrary({
        mediaType: 'photo',
        includeBase64: true,
        quality: 0.8,
      });

      if (result.assets && result.assets[0]) {
        const asset = result.assets[0];
        const base64 = asset.base64;
        
        if (base64) {
          const fotoBase64 = `data:image/jpeg;base64,${base64}`;
          setFoto_base64(fotoBase64);
          Alert.alert('✅', 'Foto seleccionada correctamente');
        }
      }
    } catch (error) {
      console.error('Error al seleccionar foto:', error);
      Alert.alert('❌', 'Error al seleccionar la foto');
    }
  };

  // ============================================================
  // 🗑️ LIMPIAR FORMULARIO
  // ============================================================
  const handleLimpiar = () => {
    setCodigo('');
    setPedidoEncontrado(null);
    setNuevoEstado('pendiente');
    setFoto_base64(null);
    setNotas('');
  };

  // ============================================================
  // 🎨 RENDERIZAR GALERÍA DE PRODUCTOS
  // ============================================================
  const renderGaleriaProductos = () => {
    if (!pedidoEncontrado?.productos_datos || pedidoEncontrado.productos_datos.length === 0) {
      return null;
    }

    if (!mostrarGaleria) {
      return null;
    }

    const productos = pedidoEncontrado.productos_datos;

    return (
      <Modal
        visible={true}
        animationType="slide"
        transparent={false}
        onRequestClose={() => {
          setMostrarGaleria(false);
        }}
      >
        <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
          <View style={{
            backgroundColor: theme.colors.primary,
            paddingTop: 16,
            paddingHorizontal: 16,
            paddingBottom: 12,
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}>
            <Text style={{ color: '#fff', fontSize: scale(16), fontWeight: 'bold' }}>📸 Productos</Text>
            <TouchableOpacity
              onPress={() => setMostrarGaleria(false)}
              style={{ padding: 8 }}
            >
              <Text style={{ color: '#fff', fontSize: scale(28), fontWeight: 'bold' }}>✕</Text>
            </TouchableOpacity>
          </View>

          {productos && productos.length > 0 ? (
            <ScrollView style={{ flex: 1, padding: 16 }} showsVerticalScrollIndicator={false}>
              <View style={{
                backgroundColor: theme.colors.surface,
                borderRadius: 12,
                padding: 12,
                marginBottom: 8,
                height: 300,
                justifyContent: 'center',
                alignItems: 'center',
              }}>
                {productos[productoSeleccionado]?.url_imagen ? (
                  <Image
                    source={{ uri: productos[productoSeleccionado].url_imagen }}
                    style={{ width: '100%', height: '100%', resizeMode: 'contain', borderRadius: 8 }}
                  />
                ) : (
                  <Text style={{ color: theme.colors.textSecondary, fontSize: scale(14) }}>Sin imagen</Text>
                )}
              </View>

              {productos[productoSeleccionado]?.url_imagen && (
                <TouchableOpacity
                  style={{
                    backgroundColor: theme.colors.primary,
                    paddingVertical: 12,
                    borderRadius: 8,
                    alignItems: 'center',
                    marginBottom: 16,
                  }}
                  onPress={() => {
                    const urlImagen = productos?.[productoSeleccionado]?.url_imagen;
                    if (urlImagen) {
                      setImagenZoom(urlImagen);
                      setModalZoom(true);
                    }
                  }}
                >
                  <Text style={{ color: '#fff', fontSize: scale(14), fontWeight: 'bold' }}>👁️ Ampliar</Text>
                </TouchableOpacity>
              )}

              <View style={{
                backgroundColor: theme.colors.surface,
                borderRadius: 8,
                padding: 12,
                marginBottom: 16,
              }}>
                <Text style={{ fontSize: scale(14), fontWeight: 'bold', color: theme.colors.text, marginBottom: 4 }}>
                  {productos[productoSeleccionado]?.nombre || 'Producto'}
                </Text>
                <Text style={{ fontSize: scale(12), color: theme.colors.textSecondary, marginBottom: 2 }}>
                  Código: {productos[productoSeleccionado]?.codigo}
                </Text>
              </View>

              {productos.length > 1 && (
                <View>
                  <Text style={{ fontSize: scale(12), fontWeight: '600', color: theme.colors.textSecondary, marginBottom: 8 }}>
                    Selecciona un producto:
                  </Text>
                  <View style={{
                    flexDirection: 'row',
                    flexWrap: 'wrap',
                    gap: 8,
                  }}>
                    {productos.map((producto, idx) => (
                      <TouchableOpacity
                        key={idx}
                        onPress={() => setProductoSeleccionado(idx)}
                        style={{
                          width: '48%',
                          aspectRatio: 1,
                          borderRadius: 8,
                          overflow: 'hidden',
                          borderWidth: 3,
                          borderColor: productoSeleccionado === idx ? theme.colors.primary : theme.colors.border,
                        }}
                      >
                        {producto.url_imagen ? (
                          <Image
                            source={{ uri: producto.url_imagen }}
                            style={{ width: '100%', height: '100%', resizeMode: 'cover' }}
                          />
                        ) : (
                          <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: theme.colors.border }}>
                            <Text style={{ color: theme.colors.textSecondary, fontSize: scale(12) }}>No imagen</Text>
                          </View>
                        )}
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              )}
            </ScrollView>
          ) : (
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
              <Text style={{ color: theme.colors.text, fontSize: scale(16) }}>Sin productos</Text>
            </View>
          )}
        </View>
      </Modal>
    );
  };

  // ============================================================
  // 🎨 RENDERIZAR DETALLES DEL PEDIDO
  // ============================================================
  const renderDetallePedido = () => {
    if (!pedidoEncontrado) return null;

    const clienteNombre = pedidoEncontrado.cliente_datos?.nombre || 'Desconocido';
    const encomendistaNombre = pedidoEncontrado.encomendista_datos?.nombre || 'Desconocido';
    const destinoNombre = pedidoEncontrado.destino_datos?.nombre || 'Personalizado';

    return (
      <View style={styles.detailsContainer}>
        <View style={styles.detailHeader}>
          <Text style={styles.detailCode}>{pedidoEncontrado.codigo_pedido}</Text>
          <View style={[styles.estadoBox, { backgroundColor: getEstadoColor(pedidoEncontrado.estado) }]}>
            <Text style={styles.estadoText}>{estadoLabels[pedidoEncontrado.estado]}</Text>
          </View>
        </View>

        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>👤 Cliente:</Text>
          <Text style={styles.detailValue}>{clienteNombre}</Text>
        </View>

        {pedidoEncontrado.cliente_datos?.telefono && (
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>📞 Teléfono:</Text>
            <Text style={styles.detailValue}>{pedidoEncontrado.cliente_datos.telefono}</Text>
          </View>
        )}

        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>🚚 Encomendista:</Text>
          <Text style={styles.detailValue}>{encomendistaNombre}</Text>
        </View>

        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>📍 Destino:</Text>
          <Text style={styles.detailValue}>{destinoNombre}</Text>
        </View>

        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>📅 Día:</Text>
          <Text style={styles.detailValue}>{pedidoEncontrado.dia_entrega}</Text>
        </View>

        {pedidoEncontrado.productos_datos && pedidoEncontrado.productos_datos.length > 0 && (
          <>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>📦 Productos:</Text>
              <Text style={styles.detailValue}>
                {pedidoEncontrado.productos_datos.map((p) => p.nombre || p.codigo).join(', ')}
              </Text>
            </View>

            <TouchableOpacity
              style={styles.verProductosButton}
              onPress={() => {
                setProductoSeleccionado(0);
                setMostrarGaleria(true);
              }}
            >
              <Text style={styles.verProductosButtonText}>
                📸 Ver productos ({pedidoEncontrado.productos_datos.length})
              </Text>
            </TouchableOpacity>
          </>
        )}

        {pedidoEncontrado.foto_paquete && pedidoEncontrado.foto_paquete.trim() && (
          <TouchableOpacity
            style={[styles.verProductosButton, { backgroundColor: '#FF6F00', marginTop: 8 }]}
            onPress={() => setModalFotoPaquete(true)}
          >
            <Text style={styles.verProductosButtonText}>📦 Ver foto del paquete</Text>
          </TouchableOpacity>
        )}

        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>💰 Total:</Text>
          <Text style={[styles.detailValue, { color: theme.colors.success, fontWeight: 'bold' }]}>
            ${pedidoEncontrado.total}
          </Text>
        </View>
      </View>
    );
  };

  // ============================================================
  // 🎨 RENDERIZAR SELECTOR DE ESTADO
  // ============================================================
  const renderSelectorEstado = () => {
    if (!pedidoEncontrado) return null;

    return (
      <View style={styles.estadoSelectorContainer}>
        <Text style={styles.estadoLabel}>Cambiar a:</Text>
        <Picker
          selectedValue={nuevoEstado}
          onValueChange={setNuevoEstado}
          style={styles.picker}
        >
          {estados.map((estado) => (
            <Picker.Item key={estado} label={estadoLabels[estado]} value={estado} />
          ))}
        </Picker>

        {nuevoEstado === 'empacada' && (
          <View style={styles.fotoRequiredWarning}>
            <Text style={styles.warningText}>
              ⚠️ Es recomendable adjuntar foto del paquete
            </Text>
            <TouchableOpacity
              style={[styles.button, !foto_base64 && styles.buttonWarning]}
              onPress={handleSeleccionarFoto}
            >
              <Text style={styles.buttonText}>
                {foto_base64 ? '✅ Foto seleccionada' : '📸 Seleccionar foto'}
              </Text>
            </TouchableOpacity>
          </View>
        )}

        <View style={styles.notasContainer}>
          <Text style={styles.notasLabel}>Notas (opcional):</Text>
          <TextInput
            style={styles.notasInput}
            placeholder="Ej: Empacado sin problemas"
            value={notas}
            onChangeText={setNotas}
            multiline
            numberOfLines={3}
            textAlignVertical="top"
            placeholderTextColor={theme.colors.textSecondary}
          />
        </View>
      </View>
    );
  };

  // ============================================================
  // 🎨 PANTALLA PRINCIPAL
  // ============================================================
  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      {renderGaleriaProductos()}

      <View style={[styles.header, { backgroundColor: theme.colors.primary }]}>
        <BackButton onPress={() => onNavigate?.('home')} color="#fff" />
        <Text style={[styles.headerTitle, { color: '#fff', fontSize: scale(18) }]}>🔍 Escanear Pedido</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView style={[styles.content, { paddingBottom: scale(40) }]} showsVerticalScrollIndicator={false}>
        <View style={styles.searchSection}>
          <Text style={[styles.sectionTitle, { color: theme.colors.text, fontSize: scale(16) }]}>Ingresa el código del pedido</Text>
          <View style={[styles.searchContainer, { borderColor: theme.colors.border }]}>
            <TextInput
              style={[styles.searchInput, { color: theme.colors.text, borderColor: theme.colors.border }]}
              placeholder="Ej: EG20260109001"
              value={codigo}
              onChangeText={setCodigo}
              editable={!loading}
              placeholderTextColor={theme.colors.textSecondary}
            />
            <TouchableOpacity
              style={[styles.searchButton, loading && styles.buttonDisabled, { backgroundColor: theme.colors.primary }]}
              onPress={handleBuscarPedido}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text style={styles.searchButtonText}>🔍</Text>
              )}
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.qrButton, { backgroundColor: theme.colors.success }]}
              onPress={handleAbrirEscanerQR}
              disabled={loading}
            >
              <Text style={styles.searchButtonText}>📷</Text>
            </TouchableOpacity>
          </View>
        </View>

        {renderDetallePedido()}

        {renderSelectorEstado()}

        {pedidoEncontrado && (
          <View style={styles.actionButtons}>
            <TouchableOpacity
              style={[styles.button, styles.buttonPrimary, guardando && styles.buttonDisabled]}
              onPress={handleCambiarEstado}
              disabled={guardando}
            >
              {guardando ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.buttonText}>✅ Actualizar estado</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.button, styles.buttonSecondary]}
              onPress={handleLimpiar}
              disabled={guardando}
            >
              <Text style={styles.buttonSecondaryText}>🗑️ Limpiar</Text>
            </TouchableOpacity>
          </View>
        )}

        {!pedidoEncontrado && !loading && (
          <View style={styles.emptyState}>
            <Text style={styles.emptyStateText}>👉 Busca un pedido para comenzar</Text>
          </View>
        )}
      </ScrollView>

      <Modal
        visible={modalZoom}
        animationType="slide"
        transparent={false}
        onRequestClose={() => setModalZoom(false)}
      >
        <View style={{ flex: 1, backgroundColor: '#000' }}>
          <View style={{
            backgroundColor: '#000',
            paddingTop: 16,
            paddingHorizontal: 16,
            paddingBottom: 8,
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}>
            <Text style={{ color: '#fff', fontSize: scale(16), fontWeight: 'bold' }}>🔍 Zoom Producto</Text>
            <TouchableOpacity
              onPress={() => setModalZoom(false)}
              style={{ padding: 8 }}
            >
              <Text style={{ color: '#fff', fontSize: scale(28), fontWeight: 'bold' }}>✕</Text>
            </TouchableOpacity>
          </View>

          {imagenZoom ? (
            <Image
              source={{ uri: imagenZoom }}
              style={{ flex: 1, resizeMode: 'contain', backgroundColor: '#000' }}
            />
          ) : (
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
              <Text style={{ color: '#fff', fontSize: scale(16) }}>Sin imagen disponible</Text>
            </View>
          )}
        </View>
      </Modal>

      <Modal
        visible={modalFotoPaquete}
        animationType="slide"
        transparent={false}
        onRequestClose={() => setModalFotoPaquete(false)}
      >
        <View style={{ flex: 1, backgroundColor: '#000' }}>
          <View style={{
            backgroundColor: '#000',
            paddingTop: 16,
            paddingHorizontal: 16,
            paddingBottom: 8,
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}>
            <Text style={{ color: '#fff', fontSize: scale(16), fontWeight: 'bold' }}>📦 Foto del Paquete</Text>
            <TouchableOpacity
              onPress={() => setModalFotoPaquete(false)}
              style={{ padding: 8 }}
            >
              <Text style={{ color: '#fff', fontSize: scale(28), fontWeight: 'bold' }}>✕</Text>
            </TouchableOpacity>
          </View>

          {pedidoEncontrado?.foto_paquete ? (
            <Image
              source={{ uri: pedidoEncontrado.foto_paquete }}
              style={{ flex: 1, resizeMode: 'contain', backgroundColor: '#000' }}
            />
          ) : (
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
              <Text style={{ color: '#fff', fontSize: scale(16) }}>Sin foto disponible</Text>
            </View>
          )}
        </View>
      </Modal>

      {/* Modal para escaneo con Vision Camera */}
      {modalQRVisible && device && (
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
              isActive={modalQRVisible}
              codeScanner={codeScanner}
            />
            
            <View style={{ 
              position: 'absolute', 
              top: 40, 
              left: 0, 
              right: 0, 
              alignItems: 'center' 
            }}>
              <Text style={{
                fontSize: scale(18),
                fontWeight: 'bold',
                color: '#fff',
                backgroundColor: 'rgba(0,0,0,0.6)',
                paddingHorizontal: 20,
                paddingVertical: 10,
                borderRadius: 8,
              }}>
                📷 Apunta al código de barras o QR
              </Text>
            </View>
            
            <View style={{ 
              position: 'absolute', 
              bottom: 40, 
              left: 0, 
              right: 0, 
              alignItems: 'center' 
            }}>
              <TouchableOpacity
                style={{
                  backgroundColor: theme.colors.primary,
                  paddingHorizontal: 40,
                  paddingVertical: 16,
                  borderRadius: 8,
                }}
                onPress={handleCerrarEscanerQR}
              >
                <Text style={{ color: '#fff', fontSize: scale(16), fontWeight: 'bold' }}>
                  ✕ Cerrar cámara
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      )}
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
  return colors[estado] || '#999';
};

const createStyles = (scale: (size: number) => number, theme: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  header: {
    backgroundColor: theme.colors.primary,
    paddingVertical: 16,
    paddingHorizontal: 16,
    paddingTop: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    flex: 1,
    textAlign: 'center',
  },
  content: {
    padding: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: theme.colors.text,
    marginBottom: 12,
  },
  searchSection: {
    marginBottom: 24,
  },
  searchContainer: {
    flexDirection: 'row',
    gap: 8,
  },
  searchInput: {
    flex: 1,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: theme.colors.text,
  },
  searchButton: {
    backgroundColor: theme.colors.primary,
    paddingHorizontal: 16,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  qrButton: {
    paddingHorizontal: 16,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  searchButtonText: {
    fontSize: 18,
  },
  detailsContainer: {
    backgroundColor: theme.colors.surface,
    borderRadius: 8,
    padding: 12,
    marginBottom: 20,
    elevation: 2,
  },
  detailHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  detailCode: {
    fontSize: 16,
    fontWeight: 'bold',
    color: theme.colors.text,
  },
  estadoBox: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 4,
  },
  estadoText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 12,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  detailLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: theme.colors.textSecondary,
  },
  detailValue: {
    fontSize: 12,
    color: theme.colors.text,
    fontWeight: '500',
    flex: 1,
    textAlign: 'right',
  },
  estadoSelectorContainer: {
    backgroundColor: theme.colors.surface,
    borderRadius: 8,
    padding: 12,
    marginBottom: 20,
    elevation: 2,
  },
  estadoLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: theme.colors.text,
    marginBottom: 8,
  },
  picker: {
    backgroundColor: theme.colors.background,
    borderRadius: 6,
    marginBottom: 12,
  },
  fotoRequiredWarning: {
    backgroundColor: '#fff3cd',
    padding: 10,
    borderRadius: 6,
    marginBottom: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#FFC107',
  },
  warningText: {
    fontSize: 12,
    color: '#856404',
    marginBottom: 8,
    fontWeight: '500',
  },
  notasContainer: {
    marginTop: 12,
  },
  notasLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: theme.colors.text,
    marginBottom: 6,
  },
  notasInput: {
    backgroundColor: theme.colors.background,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 12,
    color: theme.colors.text,
  },
  actionButtons: {
    gap: 8,
    marginTop: 20,
    marginBottom: 20,
  },
  button: {
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonPrimary: {
    backgroundColor: theme.colors.primary,
  },
  buttonSecondary: {
    backgroundColor: theme.colors.background,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  buttonSecondaryText: {
    color: theme.colors.textSecondary,
    fontWeight: '600',
    fontSize: 14,
  },
  buttonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonWarning: {
    backgroundColor: '#FFC107',
  },
  emptyState: {
    marginTop: 40,
    alignItems: 'center',
  },
  emptyStateText: {
    fontSize: 16,
    color: theme.colors.textSecondary,
  },
  verProductosButton: {
    marginTop: 12,
    backgroundColor: theme.colors.primary,
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: 'center',
    elevation: 2,
  },
  verProductosButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },
});
