import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  Animated,
  Image,
  useColorScheme,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { pedidosServiceOptimizado, PedidoCompleto } from '../services/pedidosServiceOptimizado';
import { auth, db } from '../services/firebase';
import { collection, query, where, getDocs, doc, getDoc } from 'firebase/firestore';
import { BackButton } from '../components/BackButton';
import { useTheme } from '../context/ThemeContext';
import { ImageViewer } from '../components/ImageViewer';
import { CustomAlert } from '../components/CustomAlert';

interface EncomendaAgrupada {
  encomendista_nombre: string;
  pedidos: PedidoCompleto[];
  conteo: number;
  total: number;
}

interface PorRemunerarScreenProps {
  onNavigate?: (screen: string) => void;
}

export const PorRemunerarScreen: React.FC<PorRemunerarScreenProps> = ({ onNavigate }) => {
  const { theme } = useTheme();
  const scale = (size: number) => theme.scale(size);
  const styles = createStyles(scale, theme);

  const [encomiendas, setEncomiendas] = useState<EncomendaAgrupada[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalPedidos, setTotalPedidos] = useState(0);
  const [totalRemuneracion, setTotalRemuneracion] = useState(0);
  const [totalRemunerado, setTotalRemunerado] = useState(0);
  const [totalNoRetirado, setTotalNoRetirado] = useState(0);
  const [pedidosFinalizados, setPedidosFinalizados] = useState<Map<string, 'remunerado' | 'no-retirado'>>(new Map());
  const [quienMarco, setQuienMarco] = useState<Map<string, string>>(new Map()); // Almacenar quién marcó cada pedido
  const [expandedIds, setExpandedIds] = useState<string[]>([]);
  const [imageViewerVisible, setImageViewerVisible] = useState(false);
  const [currentImages, setCurrentImages] = useState<string[]>([]);
  const [imageTitle, setImageTitle] = useState('');
  const [vistaCompacta, setVistaCompacta] = useState(true);

  // 📊 Remuneraciones en tiempo real
  const [remuneracionesHoy, setRemuneracionesHoy] = useState<any[]>([]);
  const [usuarioActual, setUsuarioActual] = useState<string>('Usuario');
  const unsubscribeRef = useRef<(() => void) | null>(null);

  const [alertVisible, setAlertVisible] = useState(false);
  const [alertTitle, setAlertTitle] = useState('');
  const [alertMessage, setAlertMessage] = useState('');
  const [alertButtons, setAlertButtons] = useState<any[]>([]);

  const showAlert = (title: string, message: string, buttons?: any[]) => {
    setAlertTitle(title);
    setAlertMessage(message);
    setAlertButtons(buttons || [{ text: 'OK', style: 'default' }]);
    setAlertVisible(true);
  };

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

  useEffect(() => {
    cargarPedidos();
    cargarVistaCompactaPreferencia();
    cargarNombreUsuario();

    // Escuchar remuneraciones en tiempo real
    const unsubscribe = pedidosServiceOptimizado.escucharRemuneracionesDiarias(
      (remuneraciones) => {
        // Obtener UID del usuario actual
        const currentUser = auth.currentUser;
        const currentUserId = currentUser?.uid || '';
        
        // Ordenar por timestamp descendente (más recientes primero)
        const ordenadas = remuneraciones.sort((a, b) => {
          const timeA = new Date(a.timestamp).getTime();
          const timeB = new Date(b.timestamp).getTime();
          return timeB - timeA;
        });
        
        // Crear mapas: quién marcó y estado de cada pedido
        const quienMarcoMap = new Map<string, string>();
        const estadoPedidosMap = new Map<string, 'remunerado' | 'no-retirado'>();
        
        // Sumar TODAS las remuneraciones (independientemente de quién las marcó)
        let totalRemuneradoTodos = 0;
        let totalNoRetiradoTodos = 0;
        
        // Procesar TODAS las remuneraciones
        ordenadas.forEach((rem) => {
          // Mapear quién marcó y estado (para TODOS los usuarios)
          quienMarcoMap.set(rem.pedido_id, rem.usuario_nombre);
          estadoPedidosMap.set(rem.pedido_id, rem.tipo === 'retirado' ? 'remunerado' : rem.tipo);
          
          // Contar TODAS las remuneraciones
          if (rem.tipo === 'retirado') {
            totalRemuneradoTodos += rem.monto || 0;
          } else if (rem.tipo === 'no-retirado') {
            totalNoRetiradoTodos += rem.monto || 0;
          }
        });
        
        // Actualizar estado
        setRemuneracionesHoy(ordenadas);
        setQuienMarco(quienMarcoMap);
        setPedidosFinalizados(estadoPedidosMap);
        setTotalRemunerado(totalRemuneradoTodos);
        setTotalNoRetirado(totalNoRetiradoTodos);
      }
    );

    unsubscribeRef.current = unsubscribe;

    // Cleanup
    return () => {
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
      }
    };
  }, []); // ✅ DEPENDENCIAS VACÍAS - Solo ejecutar UNA VEZ al montar

  const cargarPedidos = async () => {
    try {
      setLoading(true);
      const pedidosPorRemunerar = await pedidosServiceOptimizado.obtenerPedidosPorRemunerar();
      
      if (pedidosPorRemunerar && pedidosPorRemunerar.length > 0) {
        // Ordenar por fecha_entrega_programada ascendente
        pedidosPorRemunerar.sort((a, b) => {
          const fechaA = new Date(a.fecha_entrega_programada || '').getTime();
          const fechaB = new Date(b.fecha_entrega_programada || '').getTime();
          return fechaA - fechaB;
        });
        const grupos = new Map<string, PedidoCompleto[]>();
        pedidosPorRemunerar.forEach(p => {
          const encomienda = p.encomendista_nombre || 'Sin Encomienda';
          if (!grupos.has(encomienda)) {
            grupos.set(encomienda, []);
          }
          grupos.get(encomienda)!.push(p);
        });
        const resultado = Array.from(grupos.entries()).map(([nombre, pedidosGrupo]) => ({
          encomendista_nombre: nombre,
          pedidos: pedidosGrupo,
          conteo: pedidosGrupo.length,
          total: pedidosGrupo.reduce((sum, p) => sum + (p.total || 0), 0)
        }));
        resultado.sort((a, b) => a.encomendista_nombre.localeCompare(b.encomendista_nombre));
        setEncomiendas(resultado);
        // 📌 EXPANDIR TODAS LAS ENCOMIENDAS POR DEFECTO
        setExpandedIds(resultado.map(enc => enc.encomendista_nombre));
        setTotalPedidos(pedidosPorRemunerar.length);
        setTotalRemuneracion(pedidosPorRemunerar.reduce((sum, p) => sum + (p.total || 0), 0));
      } else {
        setEncomiendas([]);
        setExpandedIds([]);
        setTotalPedidos(0);
        setTotalRemuneracion(0);
      }
      
      console.log(`[PorRemunerar] Cargados ${pedidosPorRemunerar?.length || 0} pedidos por remunerar`);
    } catch (error) {
      console.error('Error cargando pedidos:', error);
      setEncomiendas([]);
      setExpandedIds([]);
      setTotalPedidos(0);
      setTotalRemuneracion(0);
    } finally {
      setLoading(false);
    }
  };

  const cargarVistaCompactaPreferencia = async () => {
    try {
      const vistaGuardada = await AsyncStorage.getItem('vistaCompactaDefecto');
      if (vistaGuardada !== null) {
        setVistaCompacta(vistaGuardada === 'true');
      }
    } catch (error) {
      console.error('Error cargando vista compacta:', error);
    }
  };

  const cargarNombreUsuario = async () => {
    try {
      // Obtener UID del usuario autenticado
      const currentUser = auth.currentUser;
      
      if (currentUser) {
        console.log(`[👤 Buscando usuario UID: ${currentUser.uid}]`);
        
        // Buscar documento del usuario en Firestore (colección: usuarios)
        const docRef = doc(db, 'usuarios', currentUser.uid);
        const docSnap = await getDoc(docRef);
        
        if (docSnap.exists()) {
          const userData = docSnap.data();
          console.log(`[📄 Datos usuario encontrados:`, userData);
          
          const nombre = userData.nombre || '';
          const apellido = userData.apellido || '';
          const nombreCompleto = `${nombre} ${apellido}`.trim().toUpperCase();
          
          setUsuarioActual(nombreCompleto);
          console.log(`[✅ Usuario actual]: ${nombreCompleto}`);
          return;
        } else {
          console.log(`[⚠️ Documento del usuario no existe en Firestore]`);
        }
      } else {
        console.log(`[⚠️ No hay usuario autenticado]`);
      }
      
      // Fallback: intentar obtener del email si no hay en Firestore
      const email = await AsyncStorage.getItem('@eli_gomez_current_user');
      if (email) {
        const nombre = email.split('@')[0].toUpperCase();
        setUsuarioActual(nombre);
        console.log(`[✅ Usuario actual (fallback email)]: ${nombre}`);
        return;
      }
      
      // Fallback final
      setUsuarioActual('Usuario');
      console.log(`[⚠️ Usuario actual (fallback)]: Usuario`);
    } catch (error) {
      console.error('❌ Error cargando nombre usuario:', error);
      setUsuarioActual('Usuario');
    }
  };

  const toggleExpand = (nombre: string) => {
    if (expandedIds.includes(nombre)) {
      setExpandedIds(expandedIds.filter(id => id !== nombre));
    } else {
      setExpandedIds([...expandedIds, nombre]);
    }
  };

  const obtenerColorEstado = (estado: string) => {
    const colores: { [key: string]: { bg: string; border: string; badge: string } } = {
      'enviado': { bg: '#F3E5FF', border: '#9C27B0', badge: '#9C27B0' },
      'retirado': { bg: '#E8F5E9', border: '#4CAF50', badge: '#4CAF50' },
      'no-retirado': { bg: '#FFF3E0', border: '#FF9800', badge: '#FF9800' },
    };
    return colores[estado] || { bg: '#F5F5F5', border: '#9E9E9E', badge: '#9E9E9E' };
  };

  const obtenerEmojiEstado = (estado: string) => {
    const emojis: { [key: string]: string } = {
      'enviado': '✈️',
      'retirado': '🎯',
      'no-retirado': '❌',
    };
    return emojis[estado] || '📦';
  };

  const formatearFecha = (fecha: string | Date | undefined): string => {
    if (!fecha) return 'Sin fecha';
    
    // Si es un STRING tipo YYYY-MM-DD, no convertir a Date (evita problemas de zona horaria)
    if (typeof fecha === 'string') {
      const match = fecha.match(/^(\d{4})-(\d{2})-(\d{2})/);
      if (match) {
        const [, year, month, day] = match;
        const dateObj = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
        const diasSemana = ['Dom', 'Lun', 'Mar', 'Mie', 'Jue', 'Vie', 'Sab'];
        return `${diasSemana[dateObj.getDay()]} ${dateObj.getDate()}/${dateObj.getMonth() + 1}`;
      }
    }
    
    // Si es Date o ISO string, convertir normalmente
    const date = new Date(fecha);
    const diasSemana = ['Dom', 'Lun', 'Mar', 'Mie', 'Jue', 'Vie', 'Sab'];
    return `${diasSemana[date.getDay()]} ${date.getDate()}/${date.getMonth() + 1}`;
  };

  const verFotoPaquete = (encomienda: EncomendaAgrupada) => {
    const fotos: string[] = [];
    encomienda.pedidos.forEach((pedido: PedidoCompleto) => {
      if (pedido.foto_paquete && !fotos.includes(pedido.foto_paquete)) {
        fotos.push(pedido.foto_paquete);
      }
    });
    
    if (fotos.length > 0) {
      setCurrentImages(fotos);
      setImageTitle('📦 Paquetes');
      setImageViewerVisible(true);
    } else {
      showAlert('Sin fotos', 'Esta encomienda no tiene fotos de paquetes');
    }
  };

  const verFotosProductos = (encomienda: EncomendaAgrupada) => {
    const fotos: string[] = [];
    encomienda.pedidos.forEach((pedido: PedidoCompleto) => {
      pedido.productos_datos?.forEach((producto: any) => {
        const foto = producto.url_imagen || producto.imagen_url;
        if (foto) {
          const fotoUrl = foto.startsWith('http') ? foto : `https://us-central1-eli-gomez-web.cloudfunctions.net/apiV2/api/obtenerProducto${foto}`;
          if (!fotos.includes(fotoUrl)) {
            fotos.push(fotoUrl);
          }
        }
      });
    });
    
    if (fotos.length > 0) {
      setCurrentImages(fotos);
      setImageTitle('📸 Productos');
      setImageViewerVisible(true);
    } else {
      showAlert('Sin fotos', 'Esta encomienda no tiene fotos de productos');
    }
  };

  const marcarRemunerado = async (pedido: PedidoCompleto) => {
    const nuevoMapa = new Map(pedidosFinalizados);
    if (nuevoMapa.get(pedido.id) === 'remunerado') {
      nuevoMapa.delete(pedido.id);
      setTotalRemunerado(totalRemunerado - (pedido.total || 0));
    } else {
      // Si ya estaba como no-retirado, restar de ese total
      if (nuevoMapa.get(pedido.id) === 'no-retirado') {
        setTotalNoRetirado(totalNoRetirado - (pedido.total || 0));
      }
      nuevoMapa.set(pedido.id, 'remunerado');
      setTotalRemunerado(totalRemunerado + (pedido.total || 0));

      // 📊 Grabar en remuneraciones_diarias
      await pedidosServiceOptimizado.grabarRemuneracionDiaria(
        pedido.id,
        'retirado',
        pedido.total || 0,
        usuarioActual,
        pedido.encomendista_nombre || 'Sin Encomienda'
      );
    }
    setPedidosFinalizados(nuevoMapa);
  };

  const marcarRemuneradoPedido = async (pedido: PedidoCompleto) => {
    try {
      console.log(`\n[👆 marcarRemuneradoPedido iniciado para pedido: ${pedido.id}]`);
      
      const result = await pedidosServiceOptimizado.toggleRemuneracionDiaria(
        pedido.id,
        'retirado',
        pedido.total || 0,
        usuarioActual,
        pedido.encomendista_nombre || 'Sin Encomienda'
      );

      console.log(`[📊 Resultado del toggle:`, result);

      if (result.resultado) {
        console.log(`[✅ Toggle ejecutado exitosamente]`);
        console.log(`[📋 Acción realizada: ${result.accion}]`);
        console.log(`[⏳ Esperando actualización desde listener de Firestore...]`);
      } else {
        console.log(`[❌ Toggle falló]`);
        showAlert('Error', 'No se pudo actualizar el estado');
      }
    } catch (error) {
      console.error('[❌ Error en marcarRemuneradoPedido]:', error);
      showAlert('Error', 'Ocurrió un error al procesar');
    }
  };

  const marcarNoRetirado = async (pedido: PedidoCompleto) => {
    try {
      console.log(`\n[👆 marcarNoRetirado iniciado para pedido: ${pedido.id}]`);
      
      const result = await pedidosServiceOptimizado.toggleRemuneracionDiaria(
        pedido.id,
        'no-retirado',
        pedido.total || 0,
        usuarioActual,
        pedido.encomendista_nombre || 'Sin Encomienda'
      );

      console.log(`[📊 Resultado del toggle:`, result);

      if (result.resultado) {
        console.log(`[✅ Toggle ejecutado exitosamente]`);
        console.log(`[📋 Acción realizada: ${result.accion}]`);
        
        // No necesitamos actualizar el estado local porque
        // el listener de onSnapshot() lo hará automáticamente
        // cuando Firestore cambios se detecten
        console.log(`[⏳ Esperando actualización desde listener de Firestore...]`);
      } else {
        console.log(`[❌ Toggle falló]`);
        showAlert('Error', 'No se pudo actualizar el estado');
      }
    } catch (error) {
      console.error('[❌ Error en marcarNoRetirado]:', error);
      showAlert('Error', 'Ocurrió un error al procesar');
    }
  };

  const marcarComoRemunerado = (encomienda: EncomendaAgrupada) => {
    // Detectar si ya están marcados
    const todosYaMarcados = encomienda.pedidos.every(p => pedidosFinalizados.has(p.id));
    const textoAccion = todosYaMarcados ? 'Desmarcar' : 'Marcar';
    const textoConfirmacion = todosYaMarcados 
      ? `Desmarcar ${encomienda.conteo} pedido(s) de ${encomienda.encomendista_nombre}?`
      : `Marcar ${encomienda.conteo} pedido(s) de ${encomienda.encomendista_nombre} como remunerados? Total: $${encomienda.total.toLocaleString()}`;

    showAlert(
      `${textoAccion} como Remunerado`,
      textoConfirmacion,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: `Sí, ${textoAccion.toLowerCase()}`,
          onPress: async () => {
            try {
              console.log(`\n[👆 marcarRemunerado iniciado: ${textoAccion}]`);
              let contadosExitosos = 0;
              
              for (const pedido of encomienda.pedidos) {
                console.log(`[📌 Procesando pedido: ${pedido.id}]`);
                const result = await pedidosServiceOptimizado.toggleRemuneracionDiaria(
                  pedido.id,
                  'retirado',
                  pedido.monto,
                  usuarioActual,
                  encomienda.encomendista_nombre
                );
                
                if (result.resultado) {
                  contadosExitosos++;
                  console.log(`[✅ Toggle completado: ${result.accion}]`);
                } else {
                  console.log(`[❌ Toggle falló para pedido ${pedido.id}]`);
                }
              }
              
              console.log(`[📊 Resumen: ${contadosExitosos}/${encomienda.conteo} exitosos]`);
              
              if (contadosExitosos === encomienda.conteo) {
                const mensajeAccion = todosYaMarcados ? 'desmarcados' : 'marcados como remunerados';
                showAlert('Éxito', `${encomienda.conteo} pedido(s) ${mensajeAccion}`);
              } else {
                showAlert('Parcial', `Solo ${contadosExitosos} de ${encomienda.conteo} se actualizaron`);
              }
              
              console.log(`[⏳ Esperando actualización desde listener de Firestore...]`);
            } catch (error) {
              console.error('[❌ Error en marcarRemunerado]:', error);
              showAlert('Error', 'No se pudieron actualizar los pedidos');
            }
          }
        }
      ]
    );
  };

  // Componentes de botones con scale animations
  const BotonRemunerado = ({ estaFinalizado, estadoFinal, onPress }: any) => {
    const scaleValue = useRef(new Animated.Value(1)).current;
    const textColor = '#fff';

    const handlePressIn = () => {
      Animated.spring(scaleValue, {
        toValue: 0.95,
        useNativeDriver: true,
      }).start();
    };

    const handlePressOut = () => {
      Animated.spring(scaleValue, {
        toValue: 1,
        useNativeDriver: true,
      }).start();
    };

    return (
      <TouchableOpacity 
        style={{ flex: 1 }} 
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        activeOpacity={0.8}
      >
        <Animated.View style={{
          transform: [{ scale: scaleValue }],
          backgroundColor: estaFinalizado && estadoFinal === 'remunerado' ? '#1565C0' : '#2196F3',
          borderRadius: scale(6),
          paddingVertical: scale(10),
          justifyContent: 'center',
          alignItems: 'center',
        }}>
          <Text 
            numberOfLines={1}
            ellipsizeMode="tail"
            style={{ color: textColor, fontWeight: 'bold', fontSize: scale(12) }}>
            {estaFinalizado && estadoFinal === 'remunerado' ? '↩' : '✅ Remunerado'}
          </Text>
        </Animated.View>
      </TouchableOpacity>
    );
  };

  const BotonNoRetirado = ({ estaFinalizado, estadoFinal, onPress }: any) => {
    const scaleValue = useRef(new Animated.Value(1)).current;
    const textColor = '#fff';

    const handlePressIn = () => {
      Animated.spring(scaleValue, {
        toValue: 0.95,
        useNativeDriver: true,
      }).start();
    };

    const handlePressOut = () => {
      Animated.spring(scaleValue, {
        toValue: 1,
        useNativeDriver: true,
      }).start();
    };

    return (
      <TouchableOpacity 
        style={{ flex: 1 }} 
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        activeOpacity={0.8}
      >
        <Animated.View style={{
          transform: [{ scale: scaleValue }],
          backgroundColor: estaFinalizado && estadoFinal === 'no-retirado' ? '#E65100' : '#FF9800',
          borderRadius: scale(6),
          paddingVertical: scale(10),
          justifyContent: 'center',
          alignItems: 'center',
        }}>
          <Text 
            numberOfLines={1}
            ellipsizeMode="tail"
            style={{ color: textColor, fontWeight: 'bold', fontSize: scale(12) }}>
            {estaFinalizado && estadoFinal === 'no-retirado' ? '↩' : '❌ No retirado'}
          </Text>
        </Animated.View>
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <Animated.View 
        style={[
          styles.header, 
          { 
            backgroundColor: '#D946EF',
            height: headerHeight,
            overflow: 'hidden',
          }
        ]}
      >
        <View style={styles.headerTop}>
          <BackButton onPress={() => onNavigate?.('home')} />
        </View>
        
        <Animated.View style={[styles.headerContent, { opacity: headerOpacity }]}>
          <View style={styles.iconCircle}>
            <Text style={{ fontSize: 48 }}>💰</Text>
          </View>
          <Text style={styles.headerTitle}>Por Remunerar</Text>
          <Text style={styles.headerSubtitle}>Paquetes enviados y retirados</Text>
        </Animated.View>
      </Animated.View>

      <Animated.ScrollView 
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: 40 }}
        onScroll={handleScroll}
        scrollEventThrottle={16}
      >
        <View style={[styles.statsBox, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
          <View style={styles.statItem}>
            <Text style={[styles.statNumber, { color: '#66BB6A' }]}>
              ${totalRemunerado.toLocaleString()}
            </Text>
            <Text style={[styles.statLabel, { color: theme.colors.textSecondary }]}>Retirado</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={[styles.statNumber, { color: '#F44336' }]}>
              ${totalNoRetirado.toLocaleString()}
            </Text>
            <Text style={[styles.statLabel, { color: theme.colors.textSecondary }]}>No Retirado</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={[styles.statNumber, { color: '#F59E0B' }]}>
              ${(totalRemuneracion - totalRemunerado - totalNoRetirado).toLocaleString()}
            </Text>
            <Text style={[styles.statLabel, { color: theme.colors.textSecondary }]}>Pendiente</Text>
          </View>
        </View>

        {encomiendas.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={{ fontSize: 64 }}>💸</Text>
            <Text style={[styles.emptyText, { color: theme.colors.textSecondary }]}>
              No hay paquetes por remunerar en este momento
            </Text>
          </View>
        ) : (
          <View style={{ padding: 16 }}>
            {encomiendas.sort((a, b) => {
              // Primero: incompletos alfabéticamente, luego: completos alfabéticamente
              const aCompleta = a.pedidos.every(p => pedidosFinalizados.has(p.id));
              const bCompleta = b.pedidos.every(p => pedidosFinalizados.has(p.id));
              
              // Si uno está completo y el otro no, el incompleto va primero
              if (aCompleta !== bCompleta) {
                return aCompleta ? 1 : -1; // Incompleto primero (1 = después, -1 = antes)
              }
              
              // Si ambos están en el mismo estado (completo o incompleto), ordenar alfabéticamente
              return a.encomendista_nombre.localeCompare(b.encomendista_nombre);
            }).map((encomienda) => {
              const encomiendaCompleta = encomienda.pedidos.every(p => pedidosFinalizados.has(p.id));
              const isExpanded = expandedIds.includes(encomienda.encomendista_nombre);
              
              return (
                <View
                  key={encomienda.encomendista_nombre}
                  style={[styles.encomiendaCard, { 
                    backgroundColor: encomiendaCompleta ? '#F5F5F5' : theme.colors.surface, 
                    borderColor: encomiendaCompleta ? '#BDBDBD' : theme.colors.border,
                  }]}
                >
                  <TouchableOpacity
                    style={styles.encomiendaHeader}
                    onPress={() => toggleExpand(encomienda.encomendista_nombre)}
                    activeOpacity={0.7}
                  >
                    <View style={{ flex: 1 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        <Text style={[styles.encomiendaTitle, { color: encomiendaCompleta ? '#9E9E9E' : theme.colors.text }]}>
                          🚚 {encomienda.encomendista_nombre}
                        </Text>
                        {encomiendaCompleta && (
                          <Text style={{ fontSize: 32, color: '#4CAF50', fontWeight: '900', marginLeft: 8 }}>✓</Text>
                        )}
                      </View>
                      <Text style={[styles.encomiendaSubtitle, { color: encomiendaCompleta ? 'rgba(0, 0, 0, 0.4)' : '#000', fontSize: 18, fontWeight: '700', backgroundColor: encomiendaCompleta ? 'rgba(252, 211, 77, 0.4)' : '#FCD34D', paddingHorizontal: 10, paddingVertical: 8, borderRadius: 8, alignSelf: 'flex-start', marginBottom: 8 }]}>
                        {encomienda.conteo} {encomienda.conteo === 1 ? 'paquete' : 'paquetes'} · ${encomienda.total.toFixed(2)}
                      </Text>
                    </View>
                    <Text style={{ fontSize: 24, color: theme.colors.textSecondary }}>
                      {isExpanded ? '▼' : '▶'}
                    </Text>
                  </TouchableOpacity>

                  {isExpanded && (
                    <View style={[styles.pedidosList, { marginTop: 4 }]}>
                      {encomienda.pedidos.sort((a, b) => {
                        const aFinalizado = pedidosFinalizados.has(a.id);
                        const bFinalizado = pedidosFinalizados.has(b.id);
                        if (aFinalizado === bFinalizado) return 0;
                        return aFinalizado ? 1 : -1; // Los pendientes primero, finalizados al final
                      }).map((pedido, index, sortedPedidos) => {
                        const estaFinalizado = pedidosFinalizados.has(pedido.id);
                        const estadoFinal = pedidosFinalizados.get(pedido.id);
                        
                        // Color del badge según estado (NO colorear todo el fondo)
                        let badgeColor = '#FFC107';
                        let badgeText = 'Pendiente';
                        let badgeEmoji = '⏳';
                        
                        // Si está finalizado, mostrar estado final
                        if (estaFinalizado) {
                          if (estadoFinal === 'remunerado') {
                            badgeColor = '#2E7D32'; // verde oscuro
                            badgeText = 'Retirado';
                            badgeEmoji = '✅';
                          } else if (estadoFinal === 'no-retirado') {
                            badgeColor = '#D32F2F'; // rojo
                            badgeText = 'No Retirado';
                            badgeEmoji = '❌';
                          }
                        } else if (pedido.estado === 'no-retirado') {
                          badgeColor = '#D32F2F';
                          badgeText = 'No Retirado';
                          badgeEmoji = '❌';
                        } else if (pedido.estado === 'retirado') {
                          badgeColor = '#2E7D32';
                          badgeText = 'Retirado';
                          badgeEmoji = '✅';
                        } else if (pedido.estado === 'enviado') {
                          badgeColor = '#9C27B0';
                          badgeText = 'Enviado';
                          badgeEmoji = '✈️';
                        } else if (pedido.estado === 'empacada') {
                          badgeColor = '#FF6F00';
                          badgeText = 'Empacada';
                          badgeEmoji = '📦';
                        }
                        
                        return (
                          <View
                            key={pedido.id}
                            style={[
                              styles.pedidoItem,
                              {
                                borderColor: theme.colors.border,
                                borderWidth: scale(1),
                                backgroundColor: estaFinalizado 
                                  ? (estadoFinal === 'remunerado' ? 'rgba(46, 125, 50, 0.08)' : 'rgba(211, 47, 47, 0.08)')
                                  : theme.colors.surface,
                              },
                              index < sortedPedidos.length - 1 && { marginBottom: scale(6) }
                            ]}
                          >
                            {/* Badge de estado pequeño (opaco cuando está finalizado) */}
                            <View style={{
                              position: 'absolute',
                              top: 8,
                              right: 8,
                              backgroundColor: estaFinalizado ? `${badgeColor}40` : badgeColor,
                              paddingHorizontal: scale(10),
                              paddingVertical: scale(6),
                              borderRadius: scale(4),
                              flexDirection: 'row',
                              alignItems: 'center',
                              gap: scale(4),
                              shadowColor: '#000',
                              shadowOffset: { width: 0, height: 2 },
                              shadowOpacity: estaFinalizado ? 0.1 : 0.3,
                              shadowRadius: 4,
                              elevation: estaFinalizado ? 2 : 5,
                            }}>
                              <Text style={{ fontSize: scale(13), fontWeight: '700' }}>{badgeEmoji}</Text>
                              <Text style={{ color: estaFinalizado ? '#999' : '#fff', fontSize: scale(11), fontWeight: '700' }}>{badgeText}</Text>
                            </View>

                            {/* Checkmark enorme cuando está finalizado */}
                            {estaFinalizado && (
                              <View style={{
                                position: 'absolute',
                                top: 5,
                                right: 10,
                                zIndex: 10,
                              }}>
                                <Text style={{ fontSize: 40, fontWeight: 'bold', color: 'rgba(255,255,255,0.8)' }}>
                                  ✓
                                </Text>
                              </View>
                            )}

                            {/* Contenedor VERTICAL: Info arriba, botones abajo */}
                            <View style={{ flexDirection: 'column', gap: scale(8), opacity: estaFinalizado ? 0.5 : 1 }}>
                              {/* SECCIÓN SUPERIOR: Código y Nombre con SOLO BORDE */}
                              <View style={{
                                borderColor: estaFinalizado ? `${badgeColor}60` : badgeColor,
                                borderWidth: scale(2),
                                borderRadius: scale(6),
                                padding: scale(12),
                                justifyContent: 'center',
                              }}>
                                {/* Línea 1: Código con emoji */}
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: scale(6), marginBottom: scale(6) }}>
                                  <Text style={{ fontSize: scale(14) }}>📦</Text>
                                  <Text 
                                    numberOfLines={1} 
                                    ellipsizeMode="tail"
                                    style={{
                                      color: estaFinalizado ? '#1a1a1a' : badgeColor,
                                      fontWeight: '700',
                                      fontSize: scale(14),
                                      flex: 1,
                                      textDecorationLine: estaFinalizado ? 'line-through' : 'none'
                                    }}>
                                    {pedido.codigo_pedido}
                                  </Text>
                                </View>
                                {/* Línea 2: Nombre + Precio */}
                                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: scale(8) }}>
                                  <Text 
                                    numberOfLines={1} 
                                    ellipsizeMode="tail"
                                    style={{
                                      color: estaFinalizado ? '#1a1a1a' : theme.colors.text,
                                      fontWeight: '600',
                                      fontSize: scale(13),
                                      flex: 1,
                                      textDecorationLine: estaFinalizado ? 'line-through' : 'none'
                                    }}>
                                    {pedido.cliente_nombre || 'Cliente'}
                                  </Text>
                                  <Text style={{ color: estaFinalizado ? '#1a1a1a' : badgeColor, fontWeight: 'bold', fontSize: scale(13), minWidth: scale(50), textAlign: 'right' }}>
                                    ${Number(pedido.total || 0).toFixed(2)}
                                  </Text>
                                </View>
                                {/* Mostrar quién lo marcó */}
                                {estaFinalizado && quienMarco.get(pedido.id) && (
                                  <Text style={{ color: estaFinalizado ? '#1a1a1a' : badgeColor, fontSize: scale(11), fontWeight: '600', marginTop: scale(6), fontStyle: 'italic' }}>
                                    💰 {quienMarco.get(pedido.id)}
                                  </Text>
                                )}
                              </View>

                              {/* SECCIÓN INFERIOR: Botones - en vertical */}
                              <View style={{ gap: scale(6) }}>
                                {/* Botón Ver Foto - si existe */}
                                {pedido.foto_paquete && (
                                  <TouchableOpacity onPress={() => verFotoPaquete(encomienda)}>
                                    <View style={{
                                      backgroundColor: '#536DFE',
                                      borderRadius: scale(6),
                                      paddingVertical: scale(8),
                                      justifyContent: 'center',
                                      alignItems: 'center',
                                    }}>
                                      <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: scale(12) }}>📸 FOTO</Text>
                                    </View>
                                  </TouchableOpacity>
                                )}

                                {/* Botones de estado RETIRADO / NO RETIRADO en un row */}
                                <View style={{ flexDirection: 'row', gap: scale(6) }}>
                                  {/* Botón REMUNERADO - Verde claro */}
                                  {!estaFinalizado || estadoFinal === 'remunerado' ? (
                                    <BotonRemunerado 
                                      estaFinalizado={estaFinalizado} 
                                      estadoFinal={estadoFinal}
                                      onPress={() => marcarRemuneradoPedido(pedido)}
                                    />
                                  ) : null}
                                  
                                  {/* Botón NO RETIRADO - Rojo más claro */}
                                  {!estaFinalizado || estadoFinal === 'no-retirado' ? (
                                    <BotonNoRetirado 
                                      estaFinalizado={estaFinalizado} 
                                      estadoFinal={estadoFinal}
                                      onPress={() => marcarNoRetirado(pedido)}
                                    />
                                  ) : null}
                                </View>
                              </View>
                            </View>
                          </View>
                        );
                      })}
                    </View>
                  )}
                </View>
              );
            })}
          </View>
        )}

        {/* 📊 SECCIÓN DE REMUNERACIONES EN TIEMPO REAL */}
        {remuneracionesHoy.length > 0 && (
          <View style={{ padding: 16, marginTop: 24 }}>
            <View style={[styles.encomiendaCard, { backgroundColor: '#F0F9FF', borderColor: '#0EA5E9' }]}>
              <View style={[styles.encomiendaHeader, { backgroundColor: '#0EA5E9' }]}>
                <Text style={[styles.encomiendaTitle, { color: '#fff' }]}>
                  📊 Remuneraciones de Hoy
                </Text>
              </View>
              <View style={{ padding: 16, gap: 8 }}>
                {remuneracionesHoy.map((rem, index) => (
                  <View
                    key={index}
                    style={[
                      {
                        backgroundColor: rem.tipo === 'retirado' ? '#E8F5E9' : '#FFF3E0',
                        borderLeftColor: rem.tipo === 'retirado' ? '#66BB6A' : '#FF9800',
                        borderLeftWidth: 4,
                        padding: 12,
                        borderRadius: 8,
                        flexDirection: 'row',
                        justifyContent: 'space-between',
                        alignItems: 'center'
                      }
                    ]}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontWeight: '700', fontSize: 14, marginBottom: 4 }}>
                        {rem.usuario_nombre}
                      </Text>
                      <Text style={{ fontSize: 12, color: theme.colors.textSecondary, marginBottom: 2 }}>
                        {rem.encomiendista_nombre}
                      </Text>
                      <Text style={{ fontSize: 11, color: theme.colors.textSecondary }}>
                        {new Date(rem.timestamp).toLocaleTimeString('es-VE', { 
                          hour: '2-digit', 
                          minute: '2-digit',
                          second: '2-digit'
                        })}
                      </Text>
                    </View>
                    <View style={{ alignItems: 'flex-end' }}>
                      <Text style={{
                        fontWeight: '700',
                        fontSize: 16,
                        color: rem.tipo === 'retirado' ? '#66BB6A' : '#FF9800',
                        marginBottom: 4
                      }}>
                        {rem.tipo === 'retirado' ? '✅' : '❌'}
                      </Text>
                      <Text style={{ fontWeight: '700', fontSize: 14 }}>
                        ${Number(rem.monto || 0).toFixed(2)}
                      </Text>
                    </View>
                  </View>
                ))}
              </View>
            </View>
          </View>
        )}
      </Animated.ScrollView>

      <ImageViewer
        visible={imageViewerVisible}
        images={currentImages}
        title={imageTitle}
        onClose={() => setImageViewerVisible(false)}
      />

      <CustomAlert
        visible={alertVisible}
        title={alertTitle}
        message={alertMessage}
        buttons={alertButtons}
        onDismiss={() => setAlertVisible(false)}
      />
    </View>
  );
};

const createStyles = (scale: (size: number) => number, theme: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  header: {
    paddingTop: scale(6),
    paddingBottom: scale(8),
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: scale(8),
  },
  headerTop: {
    width: '100%',
    justifyContent: 'flex-start',
  },
  headerContent: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: scale(2),
  },
  iconCircle: {
    height: scale(45),
    borderRadius: scale(22),
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: scale(2),
  },
  headerTitle: {
    fontWeight: '800',
    color: '#fff',
    fontSize: scale(18),
    letterSpacing: -1,
    marginBottom: scale(1),
  },
  headerSubtitle: {
    fontWeight: '600',
    color: 'rgba(255,255,255,0.9)',
    fontSize: scale(10),
    letterSpacing: -0.3,
  },
  statsBox: {
    marginHorizontal: scale(8),
    marginTop: scale(6),
    borderRadius: scale(8),
    paddingHorizontal: scale(10),
    paddingVertical: scale(8),
    flexDirection: 'row',
    justifyContent: 'space-around',
    borderWidth: 1,
  },
  statItem: {
    alignItems: 'center',
  },
  statNumber: {
    fontSize: scale(14),
    fontWeight: '700',
    letterSpacing: -0.5,
  },
  statLabel: {
    fontSize: scale(9),
    fontWeight: '500',
    marginTop: scale(1),
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: scale(20),
  },
  emptyText: {
    fontSize: scale(12),
    fontWeight: '600',
    marginTop: scale(6),
    textAlign: 'center',
    paddingHorizontal: scale(16),
  },
  encomiendaCard: {
    borderRadius: scale(8),
    marginBottom: scale(6),
    marginHorizontal: scale(8),
    borderWidth: 1,
    overflow: 'hidden',
  },
  encomiendaHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: scale(10),
    paddingVertical: scale(7),
  },
  encomiendaTitle: {
    fontSize: scale(13),
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  encomiendaSubtitle: {
    fontSize: scale(10),
    fontWeight: '500',
    marginTop: scale(1),
  },
  pedidosList: {
    paddingHorizontal: scale(8),
    paddingVertical: scale(6),
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.05)',
  },
  pedidoItem: {
    borderRadius: scale(8),
    padding: scale(12),
    marginBottom: scale(8),
  },
  pedidoHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: scale(4),
  },
  pedidoCode: {
    fontSize: scale(12),
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  pedidoCliente: {
    fontSize: scale(10),
    fontWeight: '500',
    marginTop: scale(2),
  },
  estadoBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: scale(7),
    paddingVertical: scale(5),
    borderRadius: scale(5),
    gap: scale(3),
  },
  estadoEmoji: {
    fontSize: scale(12),
  },
  estadoLabel: {
    color: '#fff',
    fontSize: scale(9),
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  pedidoDetails: {
    marginBottom: scale(8),
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: scale(5),
  },
  detailLabel: {
    fontSize: scale(10),
    fontWeight: '500',
  },
  detailValue: {
    fontSize: scale(11),
    fontWeight: '600',
  },
  buttonRow: {
    flexDirection: 'row',
    gap: scale(6),
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: scale(7),
    borderRadius: scale(5),
    gap: scale(3),
  },
  buttonText: {
    fontSize: scale(10),
    fontWeight: '600',
    letterSpacing: -0.2,
  },
  markButton: {
    marginTop: scale(10),
    paddingVertical: scale(10),
    borderRadius: scale(7),
    justifyContent: 'center',
    alignItems: 'center',
  },
  markButtonText: {
    color: '#fff',
    fontSize: scale(12),
    fontWeight: '700',
    letterSpacing: -0.3,
  },
});
