import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Modal,
  FlatList,
  Alert,
  ActivityIndicator,
  Image,
  Animated,
} from 'react-native';
import { BackButton } from '../components/BackButton';
import { clientesService, Cliente } from '../services/clientesService';
import encomendistasService, { Encomendista, DestinoEncomendista } from '../services/encomendistasService';
import pedidosService from '../services/pedidosService';
import { pedidosServiceOptimizado } from '../services/pedidosServiceOptimizado';
import favoritosService, { FavoritoPedido } from '../services/favoritosService';
import tiendasService, { Tienda } from '../services/tiendasService';
import productosService, { Producto } from '../services/productosService';
import { normalizarTexto, generarCodigoPedido, formatearFecha, calcularProximasFechas } from '../utils/pedidoUtils';
import { useAppTheme, useTheme } from '../context/ThemeContext';
import { PackageIcon } from '../components/icons';

interface Props {
  onNavigate?: (screen: string) => void;
}

export const CrearPedidoScreen: React.FC<Props> = ({ onNavigate }) => {
  const { theme } = useTheme();
  const scale = (size: number) => theme.scale(size);
  const styles = createStyles(scale, theme);

  // Convertir hora de 24h (HH:MM) a 12h (hh:mm AM/PM)
  const convertirHora12 = (hora24: string): string => {
    if (!hora24) return '';
    // Si ya tiene AM/PM, devolverlo tal cual
    if (hora24.includes('AM') || hora24.includes('PM')) return hora24;
    
    const [horas, minutos] = hora24.split(':').map(Number);
    const ampm = horas >= 12 ? 'PM' : 'AM';
    let horas12 = horas % 12;
    horas12 = horas12 ? horas12 : 12;
    return `${String(horas12).padStart(2, '0')}:${String(minutos).padStart(2, '0')} ${ampm}`;
  };

  // Convertir de 12h (hh:mm AM/PM) a 24h (HH:MM)
  const convertirHora24 = (hora12: string): string => {
    if (!hora12) return '09:00';
    const match = hora12.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
    if (!match) return hora12; // Si no coincide con el formato, devolver como está
    
    let [, horas, minutos, periodo] = match;
    let horasNum = parseInt(horas);
    
    if (periodo.toUpperCase() === 'PM' && horasNum !== 12) {
      horasNum += 12;
    } else if (periodo.toUpperCase() === 'AM' && horasNum === 12) {
      horasNum = 0;
    }
    
    return `${String(horasNum).padStart(2, '0')}:${minutos}`;
  };
  
  // Estado general
  const [loading, setLoading] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [mensaje, setMensaje] = useState<{ tipo: 'éxito' | 'error'; texto: string } | null>(null);

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

  // Datos principales
  const [tiendas, setTiendas] = useState<Tienda[]>([]);
  const [tiendaSeleccionada, setTiendaSeleccionada] = useState<Tienda | null>(null);

  // Clientes
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [busquedaCliente, setBusquedaCliente] = useState('');
  const [clientesFiltrados, setClientesFiltrados] = useState<Cliente[]>([]);
  const [clienteSeleccionado, setClienteSeleccionado] = useState<Cliente | null>(null);
  const [modalNuevoCliente, setModalNuevoCliente] = useState(false);
  const [nuevoClienteForm, setNuevoClienteForm] = useState({ nombre: '', telefono: '', direccion: '' });

  const [favoritosPorCliente, setFavoritosPorCliente] = useState<FavoritoPedido[]>([]);

  // Encomendistas
  const [encomendistas, setEncomendistas] = useState<Encomendista[]>([]);
  const [busquedaEncomendista, setBusquedaEncomendista] = useState('');
  const [encomendistasFiltr, setEncomendistasFiltr] = useState<Encomendista[]>([]);
  const [encomendistaSel, setEncomendistaSel] = useState<Encomendista | null>(null);
  const [modalNuevoEncomendista, setModalNuevoEncomendista] = useState(false);
  const [modalNuevoDestino, setModalNuevoDestino] = useState(false);
  const [modalNuevoHorario, setModalNuevoHorario] = useState(false);
  const [nuevoEncomendForm, setNuevoEncomendForm] = useState({ nombre: '', telefono: '', local: '' });
  const [nuevoDestinoForm, setNuevoDestinoForm] = useState({ nombre: '', local: '' });
  const [diasSeleccionados, setDiasSeleccionados] = useState<string[]>([]);
  const [horaInicioNuevo, setHoraInicioNuevo] = useState('09:00 AM');
  const [horaFinNuevo, setHoraFinNuevo] = useState('05:00 PM');

  // Productos
  const [productos, setProductos] = useState<Producto[]>([]);
  const [productosSeleccionados, setProductosSeleccionados] = useState<{ id: string; cantidad: number; precio: number }[]>([]);
  const [modalProductos, setModalProductos] = useState(false);
  const [modalImagen, setModalImagen] = useState(false);
  const [imagenSeleccionada, setImagenSeleccionada] = useState<string | undefined>(undefined);


  // Modo y destino
  const [modo, setModo] = useState<'normal' | 'personalizado'>('normal');
  const [destinosDisponibles, setDestinos] = useState<DestinoEncomendista[]>([]);
  const [destinoSelec, setDestinoSelec] = useState<DestinoEncomendista | null>(null);
  const [direccionPersonalizada, setDireccionPersonalizada] = useState('');

  // Horario
  const [diaSelec, setDiaSelec] = useState('');
  const [diasProximos, setDiasProximos] = useState<{ dia: string; proximoHorario?: { hora_inicio: string; hora_fin: string } }[]>([]);
  const [horaInicio, setHoraInicio] = useState('09:00');
  const [horaFin, setHoraFin] = useState('17:00');
  const [fechasDisponibles, setFechasDisponibles] = useState<{ fecha: Date; fechaFormato: string }[]>([]);
  const [fechaSeleccionada, setFechaSeleccionada] = useState<Date | null>(null);

  // Detalles del pedido
  const [cantidadPrendas, setCantidadPrendas] = useState('0');
  const [costoPrendas, setCostoPrendas] = useState('0');
  const [montoEnvio, setMontoEnvio] = useState('0');
  const [notas, setNotas] = useState('');

  // Favorito
  const [guardarComoFavorito, setGuardarComoFavorito] = useState(false);
  const [descFavorito, setDescFavorito] = useState('');

  // Resumen antes de guardar
  const [modalResumen, setModalResumen] = useState(false);
  const [resumenMontoEnvio, setResumenMontoEnvio] = useState('0');

  // Cargar datos iniciales
  useEffect(() => {
    cargarDatos();
  }, []);

  // Monitorear cambios del modal de productos
  useEffect(() => {
    console.log('📱 [modalProductos] Estado cambió a:', modalProductos);
  }, [modalProductos]);

  useEffect(() => {
    const costo = calcularCostoPrendas();
    setCostoPrendas(costo.toString());
  }, [productosSeleccionados]);

  const cargarDatos = async () => {
    try {
      console.log('🚀 [CrearPedidoScreen] Iniciando cargarDatos...');
  
      
      setLoading(true);
      
      console.log('⏳ [CrearPedidoScreen] Ejecutando Promise.all para cargar todos los datos...');
      const [tiendasData, clientesData, encomendistasData, productosData] = await Promise.all([
        tiendasService.cargarTiendas(),
        clientesService.obtenerClientes(),
        encomendistasService.cargarEncomendistas(),
        productosService.cargarProductos(),
      ]);

      console.log('📊 [CrearPedidoScreen] Datos recibidos:');
      console.log(`  - Tiendas: ${tiendasData.length}`);
      console.log(`  - Clientes: ${clientesData.length}`);
      console.log(`  - Encomendistas: ${encomendistasData.length}`);
      console.log(`  - Productos: ${productosData.length}`);
      
      console.log('✍️ [CrearPedidoScreen] Asignando datos a estados...');
      setTiendas(tiendasData);
      setClientes(clientesData);
      setEncomendistas(encomendistasData);
      setProductos(productosData);
      console.log('✅ [CrearPedidoScreen] Productos almacenados en state:', productosData);

      // Auto-seleccionar primera tienda
      if (tiendasData.length > 0) {
        setTiendaSeleccionada(tiendasData[0]);
        console.log('🏬 [CrearPedidoScreen] Tienda auto-seleccionada:', tiendasData[0]);
      }
    } catch (error) {
      console.error('❌ [CrearPedidoScreen] Error cargando datos:', error);
      mostrarMensaje('error', 'Error cargando datos');
    } finally {
      setLoading(false);
    }
  };

  const mostrarMensaje = (tipo: 'éxito' | 'error', texto: string) => {
    setMensaje({ tipo, texto });
    setTimeout(() => setMensaje(null), 3000);
  };

  // ===== BÚSQUEDAS =====

  const buscarClientes = (texto: string) => {
    console.log('🔍 [buscarClientes] Buscando:', texto);
    setBusquedaCliente(texto);
    if (!texto.trim()) {
      setClientesFiltrados([]);
      return;
    }
    const textNormalizado = normalizarTexto(texto);
    const filtrados = clientes.filter((c) => normalizarTexto(c.nombre).includes(textNormalizado));
    console.log('✅ [buscarClientes] Encontrados:', filtrados.length);
    setClientesFiltrados(filtrados);
  };

  const buscarEncomendistas = (texto: string) => {
    setBusquedaEncomendista(texto);
    if (!texto.trim()) {
      setEncomendistasFiltr([]);
      return;
    }
    const textNormalizado = normalizarTexto(texto);
    const filtrados = encomendistas.filter((e) => normalizarTexto(e.nombre).includes(textNormalizado));
    setEncomendistasFiltr(filtrados);
  };

  // ===== CLIENTES =====

  const seleccionarCliente = async (cliente: Cliente) => {
    console.log('👤 [seleccionarCliente] Seleccionado:', cliente.nombre);
    setClienteSeleccionado(cliente);
    setBusquedaCliente(cliente.nombre);
    setClientesFiltrados([]);

    // Cargar favoritos del cliente
    try {
      console.log('⏳ [seleccionarCliente] Cargando favoritos para:', cliente.id);
      const favoritos = await favoritosService.obtenerFavoritosPorCliente(cliente.id || '');
      console.log('✅ [seleccionarCliente] Favoritos cargados:', favoritos.length);
      setFavoritosPorCliente(favoritos);
    } catch (error) {
      console.error('❌ [seleccionarCliente] Error cargando favoritos:', error);
      mostrarMensaje('error', 'Error cargando favoritos');
    }
  };

  const usarFavorito = async (favorito: FavoritoPedido) => {
    try {
      console.log('⭐ [usarFavorito] Cargando favorito:', favorito.descripcion);
      
      // Llenar el formulario con datos del favorito
      if (favorito.encomendista_id) {
        const enc = encomendistas.find(e => e.id === favorito.encomendista_id);
        if (enc) {
          console.log('🚚 [usarFavorito] Encomendista encontrado:', enc.nombre);
          setEncomendistaSel(enc);
          // Cargar los destinos disponibles del encomendista
          setDestinos(enc.destinos || []);
        }
      }
      
      setModo(favorito.modo);
      console.log('📍 [usarFavorito] Modo:', favorito.modo);
      
      if (favorito.modo === 'normal' && favorito.destino_id) {
        console.log('🏘️ [usarFavorito] Buscando destino para modo normal...');
        const encId = favorito.encomendista_id;
        const enc = encomendistas.find(e => e.id === encId);
        if (enc) {
          console.log('🏘️ [usarFavorito] Encomendista encontrado, destinos disponibles:', enc.destinos?.length || 0);
          const destino = enc.destinos.find(d => d.nombre === favorito.destino_nombre);
          if (destino) {
            console.log('✅ [usarFavorito] Destino seleccionado:', destino.nombre);
            // Usar seleccionarDestino en lugar de setDestinoSelec para calcular días disponibles
            seleccionarDestino(destino);
          } else {
            console.warn('⚠️ [usarFavorito] Destino no encontrado:', favorito.destino_nombre);
          }
        }
      } else if (favorito.modo === 'personalizado' && favorito.direccion_personalizada) {
        console.log('🏠 [usarFavorito] Modo personalizado, dirección:', favorito.direccion_personalizada);
        setDireccionPersonalizada(favorito.direccion_personalizada);
        // Cargar días de la semana para modo personalizado
        cargarDiasSemana();
      }

      // Seleccionar el día después de un pequeño delay para asegurar que diasProximos esté cargado
      if (favorito.dia_maximo) {
        setTimeout(() => {
          seleccionarDia(favorito.dia_maximo);
        }, 150);
      }
      
    } catch (error) {
      console.error('❌ [usarFavorito] Error usando favorito:', error);
      mostrarMensaje('error', 'Error usando favorito');
    }
  };

  const crearCliente = async () => {
    if (!nuevoClienteForm.nombre.trim()) {
      mostrarMensaje('error', 'Nombre obligatorio');
      return;
    }

    try {
      setLoading(true);
      const resultado = await clientesService.crearCliente(
        nuevoClienteForm.nombre,
        nuevoClienteForm.telefono,
        '',
        nuevoClienteForm.direccion
      );

      if (resultado.success && resultado.id) {
        const nuevoCliente: Cliente = {
          id: resultado.id,
          nombre: nuevoClienteForm.nombre,
          telefono: nuevoClienteForm.telefono,
          direccion: nuevoClienteForm.direccion,
          activo: true,
          fecha_creacion: new Date().toISOString(),
        };
        setClientes([...clientes, nuevoCliente]);
        setClienteSeleccionado(nuevoCliente);
        setBusquedaCliente(nuevoCliente.nombre);
      }

      setModalNuevoCliente(false);
      setNuevoClienteForm({ nombre: '', telefono: '', direccion: '' });
      mostrarMensaje('éxito', 'Cliente creado');
    } catch (error) {
      console.error('❌ Error creando cliente:', error);
      mostrarMensaje('error', 'Error creando cliente');
    } finally {
      setLoading(false);
    }
  };

  // ===== ENCOMENDISTAS =====

  const seleccionarEncomendista = (encomendista: Encomendista) => {
    console.log('🚚 [seleccionarEncomendista] Encomendista seleccionado:', encomendista.nombre);
    console.log('🏘️ [seleccionarEncomendista] Destinos disponibles:', encomendista.destinos?.length || 0);
    setEncomendistaSel(encomendista);
    setBusquedaEncomendista(encomendista.nombre);
    setEncomendistasFiltr([]);
    setDestinos(encomendista.destinos || []);
    setDiaSelec('');
    setDestinoSelec(null);
  };

  const crearEncomendista = async () => {
    if (!nuevoEncomendForm.nombre.trim()) {
      mostrarMensaje('error', 'Nombre obligatorio');
      return;
    }

    try {
      setLoading(true);
      const encomendistId = await encomendistasService.crearEncomendista(
        nuevoEncomendForm.nombre,
        [],
        nuevoEncomendForm.telefono,
        nuevoEncomendForm.local
      );

      const nuevoEnc = await encomendistasService.obtenerEncomendista(encomendistId);
      if (nuevoEnc) {
        setEncomendistas([...encomendistas, nuevoEnc]);
        setEncomendistaSel(nuevoEnc);
        setBusquedaEncomendista(nuevoEnc.nombre);
      }

      setModalNuevoEncomendista(false);
      setNuevoEncomendForm({ nombre: '', telefono: '', local: '' });
      mostrarMensaje('éxito', 'Encomendista creado');
    } catch (error) {
      console.error('❌ Error creando encomendista:', error);
      mostrarMensaje('error', 'Error creando encomendista');
    } finally {
      setLoading(false);
    }
  };

  const abrirModalNuevoDestino = () => {
    if (!encomendistaSel) {
      Alert.alert('Error', 'Selecciona una encomendista primero');
      return;
    }
    setNuevoDestinoForm({ nombre: '', local: '' });
    setDiasSeleccionados([]);
    setHoraInicioNuevo('09:00 AM');
    setHoraFinNuevo('05:00 PM');
    setModalNuevoDestino(true);
  };

  const toggleDiaSeleccionado = (dia: string) => {
    if (diasSeleccionados.includes(dia)) {
      setDiasSeleccionados(diasSeleccionados.filter(d => d !== dia));
    } else {
      setDiasSeleccionados([...diasSeleccionados, dia]);
    }
  };

  const crearDestino = async () => {
    if (!encomendistaSel || !nuevoDestinoForm.nombre.trim()) {
      Alert.alert('Error', 'El nombre del destino es obligatorio');
      return;
    }

    if (diasSeleccionados.length === 0) {
      Alert.alert('Error', 'Selecciona al menos un día');
      return;
    }

    try {
      setLoading(true);
      // Convertir de 12h a 24h para guardar en la base de datos
      const nuevoDestino: DestinoEncomendista = {
        nombre: nuevoDestinoForm.nombre,
        local: nuevoDestinoForm.local,
        horarios: [{
          dias: diasSeleccionados,
          hora_inicio: convertirHora24(horaInicioNuevo),
          hora_fin: convertirHora24(horaFinNuevo),
        }],
      };

      // Agregar al array de destinos existentes
      const destinosActualizados = [...(encomendistaSel.destinos || []), nuevoDestino];
      await encomendistasService.actualizarEncomendista(encomendistaSel.id!, {
        destinos: destinosActualizados,
      });
      
      // Recargar encomendista actualizada
      const encomActualizada = await encomendistasService.obtenerEncomendista(encomendistaSel.id!);
      if (encomActualizada) {
        setEncomendistaSel(encomActualizada);
        setDestinos(encomActualizada.destinos || []);
        // Actualizar en la lista
        setEncomendistas(encomendistas.map(e => e.id === encomActualizada.id ? encomActualizada : e));
      }

      setModalNuevoDestino(false);
      mostrarMensaje('éxito', 'Destino agregado correctamente');
    } catch (error) {
      console.error('❌ Error creando destino:', error);
      mostrarMensaje('error', 'Error creando destino');
    } finally {
      setLoading(false);
    }
  };

  const abrirModalNuevoHorario = () => {
    if (!destinoSelec) {
      Alert.alert('Error', 'Selecciona un destino primero');
      return;
    }
    setDiasSeleccionados([]);
    setHoraInicioNuevo('09:00 AM');
    setHoraFinNuevo('05:00 PM');
    setModalNuevoHorario(true);
  };

  const agregarHorarioADestino = async () => {
    if (!encomendistaSel || !destinoSelec) {
      Alert.alert('Error', 'Selecciona encomendista y destino primero');
      return;
    }

    if (diasSeleccionados.length === 0) {
      Alert.alert('Error', 'Selecciona al menos un día');
      return;
    }

    try {
      setLoading(true);
      
      // Encontrar índice del destino
      const destinos = encomendistaSel.destinos || [];
      const indexDestino = destinos.findIndex(d => d.nombre === destinoSelec.nombre);
      
      if (indexDestino === -1) {
        Alert.alert('Error', 'Destino no encontrado');
        return;
      }

      // Agregar nuevo horario con conversión de 12h a 24h
      const destinoActualizado = { ...destinos[indexDestino] };
      destinoActualizado.horarios = [
        ...(destinoActualizado.horarios || []),
        {
          dias: diasSeleccionados,
          hora_inicio: convertirHora24(horaInicioNuevo),
          hora_fin: convertirHora24(horaFinNuevo),
        },
      ];

      // Actualizar destinos
      const destinosActualizados = [...destinos];
      destinosActualizados[indexDestino] = destinoActualizado;

      await encomendistasService.actualizarEncomendista(encomendistaSel.id!, {
        destinos: destinosActualizados,
      });

      // Recargar encomendista
      const encomActualizada = await encomendistasService.obtenerEncomendista(encomendistaSel.id!);
      if (encomActualizada) {
        setEncomendistaSel(encomActualizada);
        setDestinos(encomActualizada.destinos || []);
        // Actualizar destino seleccionado
        const destinoActualizadoNuevo = encomActualizada.destinos?.find(d => d.nombre === destinoSelec.nombre);
        if (destinoActualizadoNuevo) {
          setDestinoSelec(destinoActualizadoNuevo);
          calcularDiasProximos(destinoActualizadoNuevo);
        }
        // Actualizar en la lista
        setEncomendistas(encomendistas.map(e => e.id === encomActualizada.id ? encomActualizada : e));
      }

      setModalNuevoHorario(false);
      mostrarMensaje('éxito', 'Horario agregado correctamente');
    } catch (error) {
      console.error('❌ Error agregando horario:', error);
      mostrarMensaje('error', 'Error agregando horario');
    } finally {
      setLoading(false);
    }
  };

  // ===== DESTINOS Y HORARIOS =====

  const seleccionarDestino = (destino: DestinoEncomendista) => {
    setDestinoSelec(destino);
    calcularDiasProximos(destino);
  };

  const calcularDiasProximos = (destino: DestinoEncomendista) => {
    const dias: { dia: string; proximoHorario?: { hora_inicio: string; hora_fin: string } }[] = [];

    if (destino.horarios && destino.horarios.length > 0) {
      destino.horarios.forEach((horario) => {
        horario.dias.forEach((dia) => {
          const existe = dias.find((d) => d.dia === dia);
          if (!existe) {
            dias.push({
              dia,
              proximoHorario: {
                hora_inicio: horario.hora_inicio,
                hora_fin: horario.hora_fin,
              },
            });
          }
        });
      });
    } else if (destino.dia) {
      dias.push({
        dia: destino.dia,
        proximoHorario: {
          hora_inicio: destino.hora_inicio || '09:00 AM',
          hora_fin: destino.hora_fin || '05:00 PM',
        },
      });
    }

    setDiasProximos(dias);
  };

  const cargarDiasSemana = () => {
    // Para modo personalizado, mostrar todos los días de la semana
    const diasSemana = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
    const dias = diasSemana.map(dia => ({
      dia,
      proximoHorario: {
        hora_inicio: '09:00 AM',
        hora_fin: '05:00 PM',
      },
    }));
    setDiasProximos(dias);
  };

  const seleccionarDia = (dia: string) => {
    setDiaSelec(dia);
    const fechas = calcularProximasFechas(dia, 4);
    setFechasDisponibles(fechas);
    setFechaSeleccionada(null);

    // Auto-actualizar horario si existe
    const diaData = diasProximos.find((d) => d.dia === dia);
    if (diaData?.proximoHorario) {
      setHoraInicio(diaData.proximoHorario.hora_inicio);
      setHoraFin(diaData.proximoHorario.hora_fin);
    }
  };

  // ===== CREAR PEDIDO =====

  const crearPedido = async () => {
    // Validaciones
    if (!clienteSeleccionado) {
      mostrarMensaje('error', 'Selecciona un cliente');
      return;
    }
    if (!tiendaSeleccionada) {
      mostrarMensaje('error', 'Selecciona una tienda');
      return;
    }
    if (!encomendistaSel) {
      mostrarMensaje('error', 'Selecciona un encomendista');
      return;
    }
    if (!diaSelec) {
      mostrarMensaje('error', 'Selecciona un día');
      return;
    }

    if (modo === 'normal' && !destinoSelec) {
      mostrarMensaje('error', 'Selecciona un destino');
      return;
    }
    if (modo === 'personalizado' && !direccionPersonalizada.trim()) {
      mostrarMensaje('error', 'Ingresa una dirección');
      return;
    }

    if (productosSeleccionados.length === 0) {
      mostrarMensaje('error', 'Selecciona al menos un producto');
      return;
    }

    try {
      setGuardando(true);

      const cantidadTotal = calcularCantidadPrendas();
      const costoTotal = parseFloat(costoPrendas) || 0;
      const envio = parseFloat(resumenMontoEnvio) || 0;
      const total = costoTotal + envio;

      // Obtener pedidos del día para generar código secuencial
      const pedidosDelDia = await pedidosService.obtenerPedidosDelDia();
      const codigoInicial = generarCodigoPedido(
        tiendaSeleccionada.nombre_pagina,
        pedidosDelDia
      );

      // 🔐 VALIDAR CÓDIGO CONTRA LA BD (evita duplicados por concurrencia)
      const codigoPedido = await pedidosServiceOptimizado.generarCodigoValidado(
        tiendaSeleccionada.nombre_pagina,
        codigoInicial
      );

      // Obtener IDs y códigos de los productos
      const productosIds = productosSeleccionados.map(p => p.id);
      const productosCodigos = productosSeleccionados
        .map(prodSelec => {
          const prod = productos.find(p => p.id === prodSelec.id);
          return prod?.codigo || '';
        })
        .filter(codigo => codigo.length > 0);

      const nuevoPedido = {
        codigo_pedido: codigoPedido,
        cliente_id: clienteSeleccionado.id,
        cliente_nombre: clienteSeleccionado.nombre,
        telefono_cliente: clienteSeleccionado.telefono || '',
        tienda_id: tiendaSeleccionada.id,
        nombre_tienda: tiendaSeleccionada.nombre_pagina,
        nombre_perfil: tiendaSeleccionada.nombre_perfil_reserva,
        encomendista_id: encomendistaSel.id,
        encomendista_nombre: encomendistaSel.nombre,
        cantidad_prendas: cantidadTotal,
        costo_prendas: costoTotal,
        monto_envio: envio,
        total,
        dia_entrega: diaSelec,
        // 🔴 FORMATO STRING: fecha_entrega_programada en formato YYYY-MM-DD
        fecha_entrega_programada: (() => {
          const fecha = fechaSeleccionada || new Date();
          const year = fecha.getFullYear();
          const month = String(fecha.getMonth() + 1).padStart(2, '0');
          const day = String(fecha.getDate()).padStart(2, '0');
          return `${year}-${month}-${day}`;
        })(),
        hora_inicio: horaInicio,
        hora_fin: horaFin,
        notas: notas || null,
        modo,
        ...(modo === 'normal' && {
          destino_id: destinoSelec?.nombre,
          destino_nombre: destinoSelec?.nombre,
        }),
        ...(modo === 'personalizado' && {
          direccion_personalizada: direccionPersonalizada,
        }),
        productos_id: productosIds,
        productos_codigos: productosCodigos,
        estado: 'pendiente',
        activo: true,
        created_on: 'APP',
      };

      console.log('💾 Creando pedido:', nuevoPedido);
      console.log('📦 [Productos IDs enviados]:', JSON.stringify(productosIds, null, 2));
      console.log('🔖 [Productos Códigos enviados]:', JSON.stringify(productosCodigos, null, 2));
      const pedidoId = await pedidosService.crearPedido(nuevoPedido as any);
      console.log('✅ Pedido creado:', pedidoId);
      
      // Recargar productos para actualizar estado de reservados
      console.log('🔄 Recargando productos...');
      const productosActualizados = await productosService.cargarProductos();
      setProductos(productosActualizados);
      console.log('✅ Productos recargados:', productosActualizados.length);
      
      // Guardar como favorito si está marcado
      if (guardarComoFavorito && descFavorito.trim()) {
        try {
          console.log('⭐ [crearPedido] Guardando favorito:', descFavorito);
          const favorito: FavoritoPedido = {
            usuario_id: '', // Se obtiene del auth en el servicio
            cliente_id: clienteSeleccionado.id || '',
            cliente_nombre: clienteSeleccionado.nombre,
            encomendista_id: encomendistaSel.id,
            encomendista_nombre: encomendistaSel.nombre,
            modo,
            descripcion: descFavorito,
            destino_id: modo === 'normal' ? destinoSelec?.nombre : undefined,
            destino_nombre: modo === 'normal' ? destinoSelec?.nombre : undefined,
            direccion_personalizada: modo === 'personalizado' ? direccionPersonalizada : undefined,
            dia_maximo: diaSelec,
            activo: true,
            fecha_creacion: new Date(),
          };
          await favoritosService.crearFavorito(favorito);
          console.log('⭐ Favorito guardado exitosamente');
        } catch (error) {
          console.warn('⚠️ Error guardando favorito:', error);
        }
      } else {
        console.log('⭐ [crearPedido] No se guarda favorito. guardarComoFavorito:', guardarComoFavorito, 'descFavorito:', descFavorito);
      }

      mostrarMensaje('éxito', 'Pedido creado exitosamente');
      limpiarFormulario();
    } catch (error) {
      console.error('❌ Error creando pedido:', error);
      mostrarMensaje('error', 'Error creando pedido');
    } finally {
      setGuardando(false);
    }
  };

  const limpiarFormulario = () => {
    setClienteSeleccionado(null);
    setBusquedaCliente('');
    setClientesFiltrados([]);
    setEncomendistaSel(null);
    setBusquedaEncomendista('');
    setEncomendistasFiltr([]);
    setModo('normal');
    setDestinoSelec(null);
    setDireccionPersonalizada('');
    setDiaSelec('');
    setCantidadPrendas('0');
    setCostoPrendas('0');
    setMontoEnvio('0');
    setResumenMontoEnvio('0');
    setNotas('');
    setGuardarComoFavorito(false);
    setDescFavorito('');
    setFechaSeleccionada(null);
    setProductosSeleccionados([]);
    setHoraInicio('09:00 AM');
    setHoraFin('05:00 PM');
  };

  const toggleProducto = (productoId: string, precio: number) => {
    setProductosSeleccionados(previos => {
      const yaSeleccionado = previos.find(p => p.id === productoId);
      if (yaSeleccionado) {
        return previos.filter(p => p.id !== productoId);
      } else {
        return [...previos, { id: productoId, cantidad: 1, precio }];
      }
    });
  };

  const actualizarCantidadProducto = (productoId: string, cantidad: number) => {
    if (cantidad <= 0) {
      setProductosSeleccionados(previos => previos.filter(p => p.id !== productoId));
    } else {
      setProductosSeleccionados(previos =>
        previos.map(p => (p.id === productoId ? { ...p, cantidad } : p))
      );
    }
  };

  const calcularCostoPrendas = () => {
    return productosSeleccionados.reduce((total, p) => total + (p.precio * p.cantidad), 0);
  };

  const calcularCantidadPrendas = () => {
    return productosSeleccionados.reduce((total, p) => total + p.cantidad, 0);
  };

  const esProductoSeleccionado = (productoId: string) => {
    return productosSeleccionados.some(p => p.id === productoId);
  };

  const obtenerProductosDisponibles = useCallback(() => {
    const disponibles = productos.filter(p => !p.reservado);
    return disponibles;
  }, [productos]);

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      {/* Header moderno con gradiente */}
      <Animated.View style={[styles.modernHeader, { backgroundColor: theme.colors.primary, height: headerHeight, overflow: 'hidden' }]}>
        <View style={styles.headerTop}>
          <BackButton onPress={() => onNavigate?.('home')} />
        </View>
        
        <Animated.View style={[styles.headerContent, { opacity: headerOpacity }]}>
          <View style={styles.iconCircle}>
            <Image 
              source={require('../assets/logo.png')} 
              style={{ width: scale(48), height: scale(48), tintColor: '#fff' }}
              resizeMode="contain"
            />
          </View>
          <Text style={styles.modernHeaderTitle}>Crear Pedido</Text>
          <Text style={styles.headerSubtitle}>Nuevo pedido para cliente</Text>
        </Animated.View>
      </Animated.View>

      {mensaje && (
        <View style={[styles.mensaje, { backgroundColor: mensaje.tipo === 'éxito' ? theme.colors.success : theme.colors.error }]}>
          <Text style={[styles.mensajeTexto, { color: '#fff', fontSize: scale(14), fontWeight: '600' }]}>{mensaje.texto}</Text>
        </View>
      )}

      <Animated.ScrollView
        style={[styles.content, { backgroundColor: theme.colors.background }]}
        contentContainerStyle={{ paddingBottom: 40 }}
        onScroll={handleScroll}
        scrollEventThrottle={16}
      >
        {/* TIENDA - SIEMPRE VISIBLE, ES OBLIGATORIA */}
        <View style={[styles.section, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
          <Text style={[styles.sectionTitle, { color: theme.colors.text, fontSize: scale(14) }]}>📦 Tienda <Text style={{ color: theme.colors.error }}>*</Text></Text>
          {tiendaSeleccionada ? (
            <View>
              <View style={[styles.selectedItem, { backgroundColor: theme.colors.primaryLight, borderLeftColor: theme.colors.primary }]}>
                <Text style={[styles.selectedText, { color: theme.colors.text }]}>{tiendaSeleccionada.nombre_pagina}</Text>
                <TouchableOpacity onPress={() => setTiendaSeleccionada(null)}>
                  <Text style={[styles.changeButton, { color: theme.colors.primary }]}>Cambiar</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <>
              <Text style={[styles.label, { color: theme.colors.textSecondary }]}>Selecciona una tienda para continuar</Text>
              <FlatList
                scrollEnabled={false}
                data={tiendas}
                keyExtractor={(item) => item.id || Math.random().toString()}
                renderItem={({ item }) => (
                  <TouchableOpacity 
                    style={[styles.listItem, { backgroundColor: theme.colors.background, borderBottomColor: theme.colors.border }]} 
                    onPress={() => {
                      setTiendaSeleccionada(item);
                      console.log('🏪 Tienda seleccionada:', item.nombre_pagina);
                    }}
                  >
                    <Text style={[styles.listItemText, { color: theme.colors.text, fontSize: scale(14) }]}>{item.nombre_pagina}</Text>
                    <Text style={[styles.listItemSubtext, { color: theme.colors.textSecondary, fontSize: scale(12) }]}>{item.nombre_perfil_reserva}</Text>
                  </TouchableOpacity>
                )}
              />
            </>

          )}
        </View>

        {/* CLIENTE - SOLO VISIBLE SI HAY TIENDA SELECCIONADA */}
        {tiendaSeleccionada && (
          <View style={[styles.section, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
            <Text style={[styles.sectionTitle, { color: theme.colors.text, fontSize: scale(14) }]}>👤 Cliente</Text>
            {clienteSeleccionado ? (
            <View>
              <View style={[styles.selectedItem, { backgroundColor: theme.colors.primaryLight, borderLeftColor: theme.colors.primary }]}>
                <Text style={[styles.selectedText, { color: theme.colors.text }]}>{clienteSeleccionado.nombre}</Text>
                <TouchableOpacity onPress={() => setClienteSeleccionado(null)}>
                  <Text style={[styles.changeButton, { color: theme.colors.primary }]}>Cambiar</Text>
                </TouchableOpacity>
              </View>
              {favoritosPorCliente.length > 0 && (
                <View style={[styles.favoritosContainer, { borderTopColor: theme.colors.border }]}>
                  <Text style={[styles.favoritosLabel, { color: theme.colors.text }]}>⭐ Favoritos Guardados:</Text>
                  {favoritosPorCliente.map((fav, idx) => (
                    <TouchableOpacity
                      key={idx}
                      style={styles.favoritoOptionItem}
                      onPress={() => {
                        usarFavorito(fav);
                      }}
                    >
                      <View style={{ flex: 1 }}>
                        <Text style={styles.favoritoOptionTitle}>{fav.descripcion}</Text>
                        <Text style={styles.favoritoOptionSubtext}>
                          {fav.modo === 'normal' ? `📦 ${fav.encomendista_nombre}` : '📍 Personalizado'} • 📅 {fav.dia_maximo}
                        </Text>
                      </View>
                      <Text style={styles.favoritoOptionArrow}>→</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>
          ) : (
            <>
              <TextInput
                style={[styles.input, { backgroundColor: theme.colors.background, color: theme.colors.text, borderColor: theme.colors.border }]}
                placeholder="Buscar cliente..."
                placeholderTextColor={theme.colors.textSecondary}
                value={busquedaCliente}
                onChangeText={buscarClientes}
              />
              {clientesFiltrados.length > 0 && (
                <FlatList
                  scrollEnabled={false}
                  data={clientesFiltrados}
                  keyExtractor={(item) => item.id || Math.random().toString()}
                  renderItem={({ item }) => (
                    <TouchableOpacity style={[styles.listItem, { backgroundColor: theme.colors.background, borderBottomColor: theme.colors.border }]} onPress={() => seleccionarCliente(item)}>
                      <Text style={[styles.listItemText, { color: theme.colors.text, fontSize: scale(14) }]}>{item.nombre}</Text>
                      <Text style={[styles.listItemSubtext, { color: theme.colors.textSecondary, fontSize: scale(12) }]}>{item.telefono}</Text>
                    </TouchableOpacity>
                  )}
                />
              )}
              <TouchableOpacity style={[styles.buttonSecondary, { backgroundColor: theme.colors.border }]} onPress={() => setModalNuevoCliente(true)}>
                <Text style={[styles.buttonText, { color: theme.colors.text }]}>+ Crear Cliente</Text>
              </TouchableOpacity>
            </>

          )}
          </View>
        )}

        {clienteSeleccionado && (
          <>
            {/* ENCOMENDISTA */}
            <View style={[styles.section, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
              <Text style={[styles.sectionTitle, { color: theme.colors.text, fontSize: scale(14) }]}>🚚 Encomendista</Text>
              {encomendistaSel ? (
                <View style={[styles.selectedItem, { backgroundColor: theme.colors.primaryLight, borderLeftColor: theme.colors.primary }]}>
                  <Text style={[styles.selectedText, { color: theme.colors.text }]}>{encomendistaSel.nombre}</Text>
                  <TouchableOpacity onPress={() => setEncomendistaSel(null)}>
                    <Text style={[styles.changeButton, { color: theme.colors.primary }]}>Cambiar</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <>
                  <TextInput
                    style={[styles.input, { backgroundColor: theme.colors.background, color: theme.colors.text, borderColor: theme.colors.border }]}
                    placeholder="Buscar encomendista..."
                    placeholderTextColor={theme.colors.textSecondary}
                    value={busquedaEncomendista}
                    onChangeText={buscarEncomendistas}
                  />
                  {encomendistasFiltr.length > 0 && (
                    <FlatList
                      scrollEnabled={false}
                      data={encomendistasFiltr}
                      keyExtractor={(item) => item.id}
                      renderItem={({ item }) => (
                        <TouchableOpacity style={[styles.listItem, { backgroundColor: theme.colors.background, borderBottomColor: theme.colors.border }]} onPress={() => seleccionarEncomendista(item)}>
                          <Text style={[styles.listItemText, { color: theme.colors.text, fontSize: scale(14) }]}>{item.nombre}</Text>
                          <Text style={[styles.listItemSubtext, { color: theme.colors.textSecondary, fontSize: scale(12) }]}>
                            {item.destinos?.length || 0} destinos
                          </Text>
                        </TouchableOpacity>
                      )}
                    />
                  )}
                  <TouchableOpacity style={[styles.buttonSecondary, { backgroundColor: theme.colors.border }]} onPress={() => setModalNuevoEncomendista(true)}>
                    <Text style={[styles.buttonText, { color: theme.colors.text }]}>+ Crear Encomendista</Text>
                  </TouchableOpacity>
                </>
              )}
            </View>

            {encomendistaSel && (
              <>
                {/* MODO */}
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>📍 Modo de Entrega</Text>
                  <View style={styles.radioGroup}>
                    <TouchableOpacity
                      style={[styles.radioButton, modo === 'normal' && styles.radioButtonSelected]}
                      onPress={() => {
                        setModo('normal');
                        setDireccionPersonalizada('');
                      }}
                    >
                      <Text style={styles.radioText}>Normal (Destino registrado)</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.radioButton, modo === 'personalizado' && styles.radioButtonSelected]}
                      onPress={() => {
                        setModo('personalizado');
                        setDestinoSelec(null);
                        cargarDiasSemana(); // Cargar días de la semana
                      }}
                    >
                      <Text style={styles.radioText}>Personalizado (Dirección custom)</Text>
                    </TouchableOpacity>
                  </View>
                </View>

                {/* DESTINO (si modo normal) */}
                {modo === 'normal' && (
                  <View style={styles.section}>
                    <Text style={styles.sectionTitle}>🏘️ Destino</Text>
                    {destinosDisponibles.length > 0 ? (
                      <>
                        <FlatList
                          scrollEnabled={false}
                          data={destinosDisponibles}
                          keyExtractor={(item) => item.nombre}
                          renderItem={({ item }) => (
                            <TouchableOpacity
                              style={[styles.destino, destinoSelec?.nombre === item.nombre && styles.destinoSelected]}
                              onPress={() => seleccionarDestino(item)}
                            >
                              <Text style={styles.destinoText}>{item.nombre}</Text>
                              {item.local && <Text style={styles.destinoSubtext}>{item.local}</Text>}
                            </TouchableOpacity>
                          )}
                        />
                        <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
                          <TouchableOpacity 
                            style={[styles.buttonSecondary, { flex: 1, backgroundColor: theme.colors.border }]} 
                            onPress={abrirModalNuevoDestino}
                          >
                            <Text style={[styles.buttonText, { color: theme.colors.text }]}>+ Nuevo Destino</Text>
                          </TouchableOpacity>
                          {destinoSelec && (
                            <TouchableOpacity 
                              style={[styles.buttonSecondary, { flex: 1, backgroundColor: theme.colors.primary }]} 
                              onPress={abrirModalNuevoHorario}
                            >
                              <Text style={[styles.buttonText, { color: '#fff' }]}>⏰ Agregar Horario</Text>
                            </TouchableOpacity>
                          )}
                        </View>
                      </>
                    ) : (
                      <>
                        <Text style={styles.emptyText}>No hay destinos registrados</Text>
                        <TouchableOpacity 
                          style={[styles.buttonSecondary, { backgroundColor: theme.colors.border, marginTop: 8 }]} 
                          onPress={abrirModalNuevoDestino}
                        >
                          <Text style={[styles.buttonText, { color: theme.colors.text }]}>+ Crear Primer Destino</Text>
                        </TouchableOpacity>
                      </>
                    )}
                  </View>
                )}

                {/* DIRECCIÓN PERSONALIZADA (si modo personalizado) */}
                {modo === 'personalizado' && (
                  <View style={styles.section}>
                    <Text style={styles.sectionTitle}>📮 Dirección</Text>
                    <TextInput
                      style={[styles.input, styles.textarea]}
                      placeholder="Ingresa la dirección..."
                      value={direccionPersonalizada}
                      onChangeText={setDireccionPersonalizada}
                      multiline
                    />
                  </View>
                )}

                {/* DÍA Y HORARIO */}
                {(modo === 'personalizado' || (modo === 'normal' && destinoSelec)) && (
                  <View style={styles.section}>
                    <Text style={styles.sectionTitle}>📅 Día de Entrega</Text>
                    <FlatList
                      scrollEnabled={false}
                      data={diasProximos}
                      keyExtractor={(item) => item.dia}
                      renderItem={({ item }) => (
                        <TouchableOpacity
                          style={[styles.diaButton, diaSelec === item.dia && styles.diaButtonSelected]}
                          onPress={() => seleccionarDia(item.dia)}
                        >
                          <Text style={styles.diaButtonText}>{item.dia}</Text>
                          {item.proximoHorario && (
                            <Text style={styles.diaButtonTime}>
                              {convertirHora12(item.proximoHorario.hora_inicio)} - {convertirHora12(item.proximoHorario.hora_fin)}
                            </Text>
                          )}
                        </TouchableOpacity>
                      )}
                    />

                    {diaSelec && fechasDisponibles.length > 0 && (
                      <View style={styles.subsection}>
                        <Text style={styles.subsectionTitle}>📆 Selecciona una fecha</Text>
                        <FlatList
                          scrollEnabled={false}
                          data={fechasDisponibles}
                          keyExtractor={(item) => item.fechaFormato}
                          renderItem={({ item }) => (
                            <TouchableOpacity
                              style={[styles.fechaButton, fechaSeleccionada === item.fecha && styles.fechaButtonSelected]}
                              onPress={() => setFechaSeleccionada(item.fecha)}
                            >
                              <Text style={styles.fechaButtonText}>{item.fechaFormato}</Text>
                            </TouchableOpacity>
                          )}
                        />
                      </View>
                    )}

                    {/* HORARIO ELIMINADO PARA PERSONALIZADO */}
                  </View>
                )}

                {/* PRODUCTOS */}
                {diaSelec && (
                  <View style={styles.section}>
                    <View style={styles.sectionHeader}>
                      <Text style={styles.sectionTitle}>📝 Productos</Text>
                      <TouchableOpacity 
                        style={styles.buttonPrimary}
                        onPress={() => {
                          console.log('🎯 [Botón Seleccionar] Presionado, abriendo modal de productos');
                          setModalProductos(true);
                        }}
                      >
                        <Text style={styles.buttonText}>
                          {productosSeleccionados.length > 0 ? `${productosSeleccionados.length} seleccionados` : 'Seleccionar'}
                        </Text>
                      </TouchableOpacity>
                    </View>

                    {productosSeleccionados.length > 0 && (
                      <View style={styles.productosListContainer}>
                        {productosSeleccionados.map((prodSel) => {
                          const producto = productos.find(p => p.id === prodSel.id);
                          return (
                            <View key={prodSel.id} style={styles.productItem}>
                              {/* Imagen del producto */}
                              {producto?.imagen_url && (
                                <View style={styles.productImageDisplay}>
                                  <Image
                                    source={{ uri: producto.imagen_url }}
                                    style={styles.productImageDisplayImg}
                                  />
                                  <TouchableOpacity 
                                    style={styles.eyeButton}
                                    onPress={() => {
                                      setImagenSeleccionada(producto.imagen_url);
                                      setModalImagen(true);
                                    }}
                                  >
                                    <Text style={styles.eyeButtonText}>👁️</Text>
                                  </TouchableOpacity>
                                  <TouchableOpacity 
                                    style={styles.removeImageButton}
                                    onPress={() => actualizarCantidadProducto(prodSel.id, 0)}
                                  >
                                    <Text style={styles.removeImageButtonText}>✕</Text>
                                  </TouchableOpacity>
                                </View>
                              )}

                              {/* Info en fila */}
                              <View style={styles.productItemContent}>
                                <View style={styles.productInfo}>
                                  <Text style={styles.productName}>{producto?.nombre}</Text>
                                  <Text style={styles.productPrice}>${prodSel.precio}</Text>
                                </View>
                                <Text style={styles.cantidadText}>{prodSel.cantidad}</Text>
                                <Text style={styles.productSubtotal}>
                                  ${(prodSel.precio * prodSel.cantidad).toFixed(2)}
                                </Text>
                              </View>
                            </View>
                          );
                        })}
                      </View>
                    )}
                  </View>
                )}

                {/* DETALLES DEL PEDIDO */}
                {diaSelec && (
                  <View style={styles.section}>
                    <Text style={styles.sectionTitle}>📦 Detalles del Pedido</Text>

                    <View style={styles.formGroup}>
                      <Text style={styles.label}>Cantidad de prendas</Text>
                      <Text style={styles.readOnlyValue}>{calcularCantidadPrendas()}</Text>
                    </View>

                    <View style={styles.formGroup}>
                      <Text style={styles.label}>Costo de prendas ($)</Text>
                      <TextInput
                        style={styles.input}
                        placeholder="0"
                        value={costoPrendas}
                        onChangeText={setCostoPrendas}
                        keyboardType="decimal-pad"
                      />
                    </View>

                    <View style={styles.formGroup}>
                      <Text style={styles.label}>Monto de envío ($)</Text>
                      <TextInput
                        style={styles.input}
                        placeholder="0"
                        value={resumenMontoEnvio}
                        onChangeText={setResumenMontoEnvio}
                        keyboardType="decimal-pad"
                      />
                    </View>

                    <View style={styles.totalBox}>
                      <Text style={styles.totalLabel}>Total:</Text>
                      <Text style={styles.totalValue}>
                        ${(parseFloat(costoPrendas) + parseFloat(resumenMontoEnvio)).toFixed(2)}
                      </Text>
                    </View>

                    <View style={styles.formGroup}>
                      <Text style={styles.label}>Notas (opcional)</Text>
                      <TextInput
                        style={[styles.input, styles.textarea]}
                        placeholder="Agregar notas..."
                        value={notas}
                        onChangeText={setNotas}
                        multiline
                      />
                    </View>

                    {/* GUARDAR COMO FAVORITO */}
                    <View style={styles.formGroup}>
                      <TouchableOpacity
                        style={styles.checkboxGroup}
                        onPress={() => setGuardarComoFavorito(!guardarComoFavorito)}
                      >
                        <View style={[styles.checkbox, guardarComoFavorito && styles.checkboxChecked]}>
                          {guardarComoFavorito && <Text style={styles.checkmark}>✓</Text>}
                        </View>
                        <Text style={styles.checkboxLabel}>Guardar como favorito</Text>
                      </TouchableOpacity>

                      {guardarComoFavorito && (
                        <TextInput
                          style={styles.input}
                          placeholder="Descripción del favorito..."
                          value={descFavorito}
                          onChangeText={setDescFavorito}
                        />
                      )}
                    </View>

                    {/* VER RESUMEN */}
                    <TouchableOpacity
                      style={[styles.buttonPrimary, (guardando || productosSeleccionados.length === 0) && styles.buttonDisabled]}
                      onPress={() => setModalResumen(true)}
                      disabled={guardando || productosSeleccionados.length === 0}
                    >
                      <Text style={styles.buttonPrimaryText}>Ver Resumen</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </>
            )}
          </>
        )}

        <View style={styles.spacer} />
      </Animated.ScrollView>

      {/* MODAL NUEVO CLIENTE */}
      <Modal visible={modalNuevoCliente} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Crear Cliente</Text>
            <TextInput
              style={styles.input}
              placeholder="Nombre *"
              value={nuevoClienteForm.nombre}
              onChangeText={(text) => setNuevoClienteForm({ ...nuevoClienteForm, nombre: text })}
            />
            <TextInput
              style={styles.input}
              placeholder="Teléfono"
              value={nuevoClienteForm.telefono}
              onChangeText={(text) => setNuevoClienteForm({ ...nuevoClienteForm, telefono: text })}
            />
            <TextInput
              style={[styles.input, styles.textarea]}
              placeholder="Dirección"
              value={nuevoClienteForm.direccion}
              onChangeText={(text) => setNuevoClienteForm({ ...nuevoClienteForm, direccion: text })}
              multiline
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity style={styles.buttonSecondary} onPress={() => setModalNuevoCliente(false)}>
                <Text style={styles.buttonText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.buttonPrimary, loading && styles.buttonDisabled]}
                onPress={crearCliente}
                disabled={loading}
              >
                <Text style={styles.buttonPrimaryText}>Crear</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* MODAL NUEVO ENCOMENDISTA */}
      <Modal visible={modalNuevoEncomendista} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Crear Encomendista</Text>
            <TextInput
              style={styles.input}
              placeholder="Nombre *"
              value={nuevoEncomendForm.nombre}
              onChangeText={(text) => setNuevoEncomendForm({ ...nuevoEncomendForm, nombre: text })}
            />
            <TextInput
              style={styles.input}
              placeholder="Teléfono"
              value={nuevoEncomendForm.telefono}
              onChangeText={(text) => setNuevoEncomendForm({ ...nuevoEncomendForm, telefono: text })}
            />
            <TextInput
              style={styles.input}
              placeholder="Local"
              value={nuevoEncomendForm.local}
              onChangeText={(text) => setNuevoEncomendForm({ ...nuevoEncomendForm, local: text })}
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity style={styles.buttonSecondary} onPress={() => setModalNuevoEncomendista(false)}>
                <Text style={styles.buttonText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.buttonPrimary, loading && styles.buttonDisabled]}
                onPress={crearEncomendista}
                disabled={loading}
              >
                <Text style={styles.buttonPrimaryText}>Crear</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* MODAL NUEVO DESTINO */}
      <Modal visible={modalNuevoDestino} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { maxHeight: '80%' }]}>
            <ScrollView>
              <Text style={styles.modalTitle}>Agregar Destino a {encomendistaSel?.nombre}</Text>
              <TextInput
                style={styles.input}
                placeholder="Nombre del destino *"
                value={nuevoDestinoForm.nombre}
                onChangeText={(text) => setNuevoDestinoForm({ ...nuevoDestinoForm, nombre: text })}
              />
              <TextInput
                style={styles.input}
                placeholder="Local (opcional)"
                value={nuevoDestinoForm.local}
                onChangeText={(text) => setNuevoDestinoForm({ ...nuevoDestinoForm, local: text })}
              />
              
              <Text style={[styles.sectionTitle, { marginTop: 12 }]}>Horario Inicial</Text>
              <View style={{ flexDirection: 'row', gap: 12 }}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.label}>Hora Inicio</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="09:00 AM"
                    value={horaInicioNuevo}
                    onChangeText={setHoraInicioNuevo}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.label}>Hora Fin</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="05:00 PM"
                    value={horaFinNuevo}
                    onChangeText={setHoraFinNuevo}
                  />
                </View>
              </View>

              <Text style={[styles.sectionTitle, { marginTop: 12 }]}>Días Disponibles *</Text>
              {['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'].map((dia) => (
                <TouchableOpacity
                  key={dia}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    paddingVertical: 8,
                    borderBottomWidth: 1,
                    borderBottomColor: '#e0e0e0',
                  }}
                  onPress={() => toggleDiaSeleccionado(dia)}
                >
                  <View
                    style={{
                      width: 20,
                      height: 20,
                      borderRadius: 4,
                      borderWidth: 2,
                      borderColor: theme.colors.primary,
                      justifyContent: 'center',
                      alignItems: 'center',
                      marginRight: 12,
                      backgroundColor: diasSeleccionados.includes(dia) ? theme.colors.primary : '#fff',
                    }}
                  >
                    {diasSeleccionados.includes(dia) && <Text style={{ color: '#fff', fontWeight: 'bold' }}>✓</Text>}
                  </View>
                  <Text>{dia}</Text>
                </TouchableOpacity>
              ))}

              <View style={styles.modalButtons}>
                <TouchableOpacity style={styles.buttonSecondary} onPress={() => setModalNuevoDestino(false)}>
                  <Text style={styles.buttonText}>Cancelar</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.buttonPrimary, loading && styles.buttonDisabled]}
                  onPress={crearDestino}
                  disabled={loading}
                >
                  <Text style={styles.buttonPrimaryText}>Agregar Destino</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* MODAL NUEVO HORARIO */}
      <Modal visible={modalNuevoHorario} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { maxHeight: '70%' }]}>
            <ScrollView>
              <Text style={styles.modalTitle}>Agregar Horario a {destinoSelec?.nombre}</Text>
              
              <View style={{ flexDirection: 'row', gap: 12 }}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.label}>Hora Inicio</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="09:00 AM"
                    value={horaInicioNuevo}
                    onChangeText={setHoraInicioNuevo}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.label}>Hora Fin</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="05:00 PM"
                    value={horaFinNuevo}
                    onChangeText={setHoraFinNuevo}
                  />
                </View>
              </View>

              <Text style={[styles.sectionTitle, { marginTop: 12 }]}>Días para este Horario *</Text>
              {['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'].map((dia) => (
                <TouchableOpacity
                  key={dia}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    paddingVertical: 8,
                    borderBottomWidth: 1,
                    borderBottomColor: '#e0e0e0',
                  }}
                  onPress={() => toggleDiaSeleccionado(dia)}
                >
                  <View
                    style={{
                      width: 20,
                      height: 20,
                      borderRadius: 4,
                      borderWidth: 2,
                      borderColor: theme.colors.primary,
                      justifyContent: 'center',
                      alignItems: 'center',
                      marginRight: 12,
                      backgroundColor: diasSeleccionados.includes(dia) ? theme.colors.primary : '#fff',
                    }}
                  >
                    {diasSeleccionados.includes(dia) && <Text style={{ color: '#fff', fontWeight: 'bold' }}>✓</Text>}
                  </View>
                  <Text>{dia}</Text>
                </TouchableOpacity>
              ))}

              <View style={styles.modalButtons}>
                <TouchableOpacity style={styles.buttonSecondary} onPress={() => setModalNuevoHorario(false)}>
                  <Text style={styles.buttonText}>Cancelar</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.buttonPrimary, loading && styles.buttonDisabled]}
                  onPress={agregarHorarioADestino}
                  disabled={loading}
                >
                  <Text style={styles.buttonPrimaryText}>Agregar Horario</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* MODAL PRODUCTOS */}
      <Modal visible={modalProductos} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, styles.modalProductosContent]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>📷 Seleccionar Productos</Text>
              <TouchableOpacity onPress={() => setModalProductos(false)}>
                <Text style={styles.closeButton}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.productosScrollView}>
              {obtenerProductosDisponibles().length === 0 ? (
                <View style={styles.emptyContainer}>
                  <Text style={styles.emptyText}>
                    {productos.length === 0 ? 'No hay productos' : 'Todos están reservados'}
                  </Text>
                </View>
              ) : (
                <View style={styles.productosGrid}>
                  {obtenerProductosDisponibles().map((producto, idx) => {
                    const seleccionado = esProductoSeleccionado(producto.id);
                    const seleccion = productosSeleccionados.find(p => p.id === producto.id);
                    
                    return (
                      <View
                        key={producto.id}
                        style={[
                          styles.productoCard,
                          seleccionado && styles.productoCardSelected,
                        ]}
                      >
                        {/* Imagen o placeholder con botón ojo */}
                        <View style={styles.productoImageContainer}>
                          {producto.imagen_url ? (
                            <>
                              <Image
                                source={{ uri: producto.imagen_url }}
                                style={styles.productoImage}
                              />
                              <TouchableOpacity 
                                style={styles.eyeButton}
                                onPress={() => {
                                  setImagenSeleccionada(producto.imagen_url);
                                  setModalImagen(true);
                                }}
                              >
                                <Text style={styles.eyeButtonText}>👁️</Text>
                              </TouchableOpacity>
                            </>
                          ) : (
                            <View style={styles.productoImagePlaceholder}>
                              <Text style={styles.placeholderText}>📦</Text>
                            </View>
                          )}
                          {seleccionado && (
                            <View style={styles.selectBadge}>
                              <Text style={styles.selectBadgeText}>✓</Text>
                            </View>
                          )}
                        </View>

                        {/* Info */}
                        <Text style={styles.productoCardName}>{producto.nombre}</Text>
                        <Text style={styles.productoCardPrice}>${producto.precio}</Text>

                        {/* Botón seleccionar - cantidad automática 1 */}
                        <TouchableOpacity
                          style={[
                            styles.selectButton,
                            seleccionado && styles.selectButtonActive,
                          ]}
                          onPress={() => toggleProducto(producto.id, producto.precio ?? 0)}
                        >
                          <Text style={styles.selectButtonText}>
                            {seleccionado ? '✓ Seleccionado' : 'Seleccionar'}
                          </Text>
                        </TouchableOpacity>
                      </View>
                    );
                  })}
                </View>
              )}
            </ScrollView>

            <TouchableOpacity
              style={styles.buttonPrimary}
              onPress={() => setModalProductos(false)}
            >
              <Text style={styles.buttonPrimaryText}>Listo</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* MODAL RESUMEN DEL PEDIDO */}
      <Modal visible={modalResumen} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalResumenContainer}>
            <View style={styles.modalResumenHeader}>
              <Text style={styles.modalTitle}>📋 Resumen del Pedido</Text>
              <TouchableOpacity onPress={() => setModalResumen(false)}>
                <Text style={styles.closeButton}>✕</Text>
              </TouchableOpacity>
            </View>
            
            <ScrollView style={styles.modalResumenBody}>
              {/* Cliente */}
              <View style={styles.resumenSection}>
                <Text style={styles.resumenLabel}>Cliente:</Text>
                <Text style={styles.resumenValue}>{clienteSeleccionado?.nombre}</Text>
              </View>

              {/* Tienda */}
              <View style={styles.resumenSection}>
                <Text style={styles.resumenLabel}>Tienda:</Text>
                <Text style={styles.resumenValue}>{tiendaSeleccionada?.nombre_pagina}</Text>
              </View>

              {/* Encomendista */}
              <View style={styles.resumenSection}>
                <Text style={styles.resumenLabel}>Encomendista:</Text>
                <Text style={styles.resumenValue}>{encomendistaSel?.nombre}</Text>
              </View>

              {/* Destino/Dirección */}
              <View style={styles.resumenSection}>
                <Text style={styles.resumenLabel}>{modo === 'normal' ? 'Destino:' : 'Dirección:'}</Text>
                <Text style={styles.resumenValue}>
                  {modo === 'normal' ? destinoSelec?.nombre : direccionPersonalizada}
                </Text>
              </View>

              {/* Día y Fecha */}
              <View style={styles.resumenSection}>
                <Text style={styles.resumenLabel}>Día de entrega:</Text>
                <Text style={styles.resumenValue}>{diaSelec}</Text>
              </View>

              {/* Productos */}
              <View style={styles.resumenSection}>
                <Text style={styles.resumenLabel}>Productos:</Text>
                {productosSeleccionados.map((prodSel) => {
                  const producto = productos.find(p => p.id === prodSel.id);
                  return (
                    <View key={prodSel.id} style={styles.resumenProducto}>
                      <Text style={styles.resumenProductoNombre}>
                        {producto?.nombre} x{prodSel.cantidad}
                      </Text>
                      <Text style={styles.resumenProductoPrecio}>
                        ${(prodSel.precio * prodSel.cantidad).toFixed(2)}
                      </Text>
                    </View>
                  );
                })}
              </View>

              {/* Totales */}
              <View style={styles.resumenSection}>
                <View style={styles.resumenTotalRow}>
                  <Text style={styles.resumenLabel}>Cantidad de prendas:</Text>
                  <Text style={styles.resumenValue}>{calcularCantidadPrendas()}</Text>
                </View>
                <View style={styles.resumenTotalRow}>
                  <Text style={styles.resumenLabel}>Costo prendas:</Text>
                  <Text style={styles.resumenValue}>${parseFloat(costoPrendas).toFixed(2)}</Text>
                </View>
                <View style={styles.resumenTotalRow}>
                  <Text style={styles.resumenLabel}>Monto de envío:</Text>
                  <Text style={styles.resumenValue}>${parseFloat(resumenMontoEnvio).toFixed(2)}</Text>
                </View>
                <View style={[styles.resumenTotalRow, styles.resumenFinalTotal]}>
                  <Text style={styles.resumenLabelBold}>TOTAL:</Text>
                  <Text style={styles.resumenValueBold}>
                    ${(parseFloat(costoPrendas) + parseFloat(resumenMontoEnvio)).toFixed(2)}
                  </Text>
                </View>
              </View>

              {/* Notas */}
              {notas && (
                <View style={styles.resumenSection}>
                  <Text style={styles.resumenLabel}>Notas:</Text>
                  <Text style={styles.resumenValue}>{notas}</Text>
                </View>
              )}
            </ScrollView>

            {/* Botones */}
            <View style={styles.modalResumenFooter}>
              <TouchableOpacity 
                style={styles.modalResumenFooter_buttonSecondary}
                onPress={() => setModalResumen(false)}
              >
                <Text style={styles.buttonText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalResumenFooter_buttonPrimary, guardando && styles.buttonDisabled]}
                onPress={() => {
                  setModalResumen(false);
                  crearPedido();
                }}
                disabled={guardando}
              >
                {guardando ? (
                  <ActivityIndicator color="#FFF" />
                ) : (
                  <Text style={styles.buttonPrimaryText}>Guardar Pedido</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* MODAL PARA VER IMAGEN AMPLIADA */}
      <Modal visible={modalImagen} transparent animationType="fade">
        <View style={styles.imagenModalOverlay}>
          <View style={styles.imagenModalContent}>
            <TouchableOpacity 
              style={styles.imagenCloseButton}
              onPress={() => setModalImagen(false)}
            >
              <Text style={styles.imagenCloseButtonText}>✕</Text>
            </TouchableOpacity>
            
            {imagenSeleccionada && (
              <Image
                source={{ uri: imagenSeleccionada }}
                style={styles.imagenAmpliada}
                resizeMode="contain"
              />
            )}
          </View>
        </View>
      </Modal>
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 12,
    backgroundColor: theme.colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  title: {
    flex: 1,
    fontSize: scale(24),
    fontWeight: 'bold',
    marginLeft: 12,
    color: theme.colors.text,
  },
  mensaje: {
    padding: 14,
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 4,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  mensajeTexto: {
    color: '#FFF',
    fontWeight: '600',
    textAlign: 'center',
  },
  content: {
    flex: 1,
    paddingVertical: 16,
  },
  section: {
    marginHorizontal: 16,
    marginBottom: 16,
    backgroundColor: theme.colors.surface,
    padding: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  sectionTitle: {
    fontSize: scale(16),
    fontWeight: '700',
    marginBottom: 12,
    color: theme.colors.text,
  },
  subsection: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
  },
  subsectionTitle: {
    fontSize: scale(12),
    fontWeight: '600',
    marginBottom: 8,
    color: theme.colors.textSecondary,
  },
  input: {
    backgroundColor: theme.colors.background,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: 10,
    borderWidth: 2,
    borderColor: theme.colors.border,
    color: theme.colors.text,
    fontSize: scale(15),
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  textarea: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  selectedItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: theme.colors.primary + '20',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 10,
    borderLeftWidth: 4,
    borderLeftColor: theme.colors.primary,
    marginBottom: 4,
  },
  selectedText: {
    color: theme.colors.text,
    fontWeight: '600',
    flex: 1,
  },
  changeButton: {
    color: theme.colors.primary,
    fontSize: scale(12),
    fontWeight: '600',
  },
  listItem: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: theme.colors.background,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
    marginBottom: 2,
  },
  listItemText: {
    color: theme.colors.text,
    fontWeight: '500',
    fontSize: scale(16),
  },
  listItemSubtext: {
    color: theme.colors.textSecondary,
    fontSize: scale(14),
    marginTop: 4,
  },
  buttonSecondary: {
    backgroundColor: theme.colors.border,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 6,
    marginTop: 8,
  },
  buttonText: {
    color: theme.colors.text,
    fontWeight: '600',
    textAlign: 'center',
  },
  radioGroup: {
    gap: 8,
  },
  radioButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: theme.colors.background,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  radioButtonSelected: {
    backgroundColor: theme.colors.primary + '20',
    borderColor: theme.colors.primary,
  },
  radioText: {
    color: theme.colors.text,
    fontSize: scale(16),
    marginLeft: 10,
  },
  destino: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: theme.colors.background,
    borderRadius: 6,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  destinoSelected: {
    backgroundColor: theme.colors.primary + '20',
    borderColor: theme.colors.primary,
  },
  destinoText: {
    color: theme.colors.text,
    fontWeight: '500',
    fontSize: scale(16),
  },
  destinoSubtext: {
    color: theme.colors.textSecondary,
    fontSize: scale(12),
    marginTop: 2,
  },
  diaButton: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: theme.colors.background,
    borderRadius: 6,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  diaButtonSelected: {
    backgroundColor: theme.colors.primary + '20',
    borderColor: theme.colors.primary,
  },
  diaButtonText: {
    color: theme.colors.text,
    fontWeight: '500',
  },
  diaButtonTime: {
    color: theme.colors.textSecondary,
    fontSize: scale(12),
    marginTop: 2,
  },
  fechaButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: theme.colors.background,
    borderRadius: 6,
    marginBottom: 4,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  fechaButtonSelected: {
    backgroundColor: theme.colors.primary + '20',
    borderColor: theme.colors.primary,
  },
  fechaButtonText: {
    color: theme.colors.text,
    fontSize: scale(13),
  },
  formGroup: {
    marginBottom: 12,
  },
  label: {
    color: theme.colors.text,
    fontWeight: '600',
    fontSize: scale(16),
    marginBottom: 8,
  },
  totalBox: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: theme.colors.success + '20',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 6,
    marginBottom: 12,
    borderLeftWidth: 4,
    borderLeftColor: theme.colors.success,
  },
  totalLabel: {
    color: theme.colors.text,
    fontWeight: '600',
  },
  totalValue: {
    color: theme.colors.success,
    fontSize: scale(18),
    fontWeight: 'bold',
  },
  checkboxGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderWidth: 2,
    borderColor: theme.colors.border,
    borderRadius: 4,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  checkboxChecked: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  checkmark: {
    color: '#FFF',
    fontWeight: 'bold',
  },
  checkboxLabel: {
    color: theme.colors.text,
    fontWeight: '500',
  },
  loadingContainer: {
    backgroundColor: theme.colors.background,
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  loadingText: {
    marginTop: 8,
    fontSize: scale(14),
    color: theme.colors.textSecondary,
    fontWeight: '500',
  },
  buttonPrimary: {
    backgroundColor: theme.colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderRadius: 6,
    marginTop: 12,
  },
  buttonPrimaryText: {
    color: '#FFF',
    fontWeight: 'bold',
    textAlign: 'center',
    fontSize: scale(14),
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  timeInputGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  timeInput: {
    flex: 1,
    backgroundColor: theme.colors.background,
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: theme.colors.border,
    color: theme.colors.text,
  },
  timeSeparator: {
    color: theme.colors.textSecondary,
    fontWeight: 'bold',
  },
  emptyText: {
    color: theme.colors.textSecondary,
    textAlign: 'center',
    fontSize: scale(13),
    paddingVertical: 12,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: theme.colors.surface,
    padding: 16,
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
    maxHeight: '90%',
    flexDirection: 'column',
  },
  modalTitle: {
    fontSize: scale(16),
    fontWeight: 'bold',
    marginBottom: 16,
    color: theme.colors.text,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 16,
    justifyContent: 'space-between',
  },
  spacer: {
    height: 20,
  },
  favoritoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.background,
    paddingHorizontal: 12,
    paddingVertical: 12,
    marginBottom: 8,
    borderRadius: 6,
    borderLeftWidth: 4,
    borderLeftColor: theme.colors.primary,
  },
  favoritoTitle: {
    fontSize: scale(14),
    fontWeight: '600',
    color: theme.colors.text,
  },
  favoritoSubtext: {
    fontSize: scale(12),
    color: theme.colors.textSecondary,
    marginTop: 2,
  },
  favoritosContainer: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
  },
  favoritosLabel: {
    fontSize: scale(13),
    fontWeight: '600',
    color: theme.colors.text,
    marginBottom: 8,
  },
  favoritoOptionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.warning + '20',
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 6,
    borderRadius: 6,
    borderLeftWidth: 3,
    borderLeftColor: theme.colors.warning,
  },
  favoritoOptionTitle: {
    fontSize: scale(13),
    fontWeight: '600',
    color: theme.colors.text,
  },
  favoritoOptionSubtext: {
    fontSize: scale(12),
    color: theme.colors.textSecondary,
    marginTop: 2,
  },
  favoritoOptionArrow: {
    color: theme.colors.warning,
    fontWeight: '600',
    fontSize: scale(16),
    marginLeft: 8,
  },
  usarButton: {
    color: theme.colors.primary,
    fontWeight: '600',
    fontSize: scale(14),
  },
  closeButton: {
    fontSize: scale(20),
    color: theme.colors.textSecondary,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  productosListContainer: {
    marginTop: 12,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
    paddingTop: 12,
  },
  productItem: {
    flexDirection: 'column',
    backgroundColor: theme.colors.background,
    padding: 12,
    marginBottom: 8,
    borderRadius: 6,
    borderLeftWidth: 3,
    borderLeftColor: theme.colors.success,
  },
  productImageDisplay: {
    position: 'relative',
    width: '100%',
    height: 150,
    borderRadius: 6,
    marginBottom: 12,
    overflow: 'hidden',
  },
  productImageDisplayImg: {
    width: '100%',
    height: '100%',
    borderRadius: 6,
  },
  removeImageButton: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: theme.colors.error,
    borderRadius: 50,
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: theme.colors.surface,
  },
  removeImageButtonText: {
    color: '#FFF',
    fontSize: scale(18),
    fontWeight: 'bold',
  },
  productItemContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
  },
  productInfo: {
    flex: 1,
    marginRight: 12,
  },
  productName: {
    fontSize: scale(13),
    fontWeight: '600',
    color: theme.colors.text,
  },
  productPrice: {
    fontSize: scale(12),
    color: theme.colors.textSecondary,
    marginTop: 2,
  },
  cantidadControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginHorizontal: 8,
  },
  cantidadButton: {
    width: 24,
    height: 24,
    borderRadius: 4,
    backgroundColor: theme.colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cantidadButtonText: {
    color: '#FFF',
    fontSize: scale(14),
    fontWeight: 'bold',
  },
  cantidadText: {
    fontSize: scale(12),
    fontWeight: '600',
    color: theme.colors.text,
    minWidth: 20,
    textAlign: 'center',
  },
  productSubtotal: {
    fontSize: scale(13),
    fontWeight: 'bold',
    color: theme.colors.success,
    minWidth: 50,
    textAlign: 'right',
  },
  productoModalItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
  },
  productoModalItemSelected: {
    backgroundColor: theme.colors.primary + '20',
    borderLeftWidth: 4,
    borderLeftColor: theme.colors.primary,
  },
  productoModalInfo: {
    flex: 1,
  },
  productoModalName: {
    fontSize: scale(14),
    fontWeight: '600',
    color: theme.colors.text,
  },
  productoModalPrice: {
    fontSize: scale(12),
    color: theme.colors.textSecondary,
    marginTop: 2,
  },
  productoCheckbox: {
    fontSize: scale(18),
    color: theme.colors.primary,
    marginLeft: 8,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  modalProductosContent: {
    flex: 1,
    flexDirection: 'column',
    maxHeight: '95%',
  },
  productosScrollView: {
    flex: 1,
    paddingHorizontal: 8,
    backgroundColor: theme.colors.surface,
  },
  emptyContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
    flex: 1,
  },
  productosGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    paddingVertical: 12,
  },
  productoCard: {
    width: '48%',
    backgroundColor: theme.colors.surface,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: theme.colors.border,
    padding: 12,
    marginBottom: 12,
    alignItems: 'center',
  },
  productoCardSelected: {
    borderColor: theme.colors.success,
    backgroundColor: theme.colors.success + '20',
  },
  productoImageContainer: {
    position: 'relative',
    width: '100%',
    aspectRatio: 1,
    marginBottom: 8,
  },
  productoImage: {
    width: '100%',
    height: '100%',
    borderRadius: 6,
  },
  eyeButton: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    backgroundColor: theme.colors.surface,
    borderRadius: 50,
    width: 36,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: theme.colors.primary,
  },
  eyeButtonText: {
    fontSize: scale(18),
  },
  productoImagePlaceholder: {
    width: '100%',
    height: '100%',
    backgroundColor: theme.colors.background,
    borderRadius: 6,
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeholderText: {
    fontSize: scale(48),
  },
  selectBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: theme.colors.success,
    borderRadius: 50,
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: theme.colors.surface,
  },
  selectBadgeText: {
    color: '#FFF',
    fontSize: scale(18),
    fontWeight: 'bold',
  },
  productoCardName: {
    fontSize: scale(13),
    fontWeight: 'bold',
    color: theme.colors.text,
    textAlign: 'center',
    marginBottom: 4,
  },
  productoCardPrice: {
    fontSize: scale(14),
    fontWeight: 'bold',
    color: theme.colors.success,
    marginBottom: 8,
  },
  cantidadControlsCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  cantidadButtonSmall: {
    width: 20,
    height: 20,
    borderRadius: 3,
    backgroundColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  cantidadButtonTextSmall: {
    color: '#FFF',
    fontSize: scale(12),
    fontWeight: 'bold',
  },
  cantidadTextCard: {
    fontSize: scale(12),
    fontWeight: '600',
    color: '#1F2937',
    minWidth: 18,
    textAlign: 'center',
  },
  selectButton: {
    width: '100%',
    backgroundColor: theme.colors.primary,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 6,
  },
  selectButtonActive: {
    backgroundColor: theme.colors.success,
  },
  selectButtonText: {
    color: '#FFF',
    fontWeight: 'bold',
    textAlign: 'center',
    fontSize: scale(12),
  },
  imagenModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.95)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  imagenModalContent: {
    width: '90%',
    height: '80%',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  imagenCloseButton: {
    position: 'absolute',
    top: -40,
    right: 0,
    zIndex: 10,
    width: 40,
    height: 40,
    borderRadius: 50,
    backgroundColor: theme.colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
  },
  imagenCloseButtonText: {
    fontSize: scale(24),
    color: theme.colors.text,
    fontWeight: 'bold',
  },
  imagenAmpliada: {
    width: '100%',
    height: '100%',
  },
  readOnlyValue: {
    fontSize: scale(14),
    color: theme.colors.text,
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: theme.colors.background,
    borderRadius: 6,
    fontWeight: '600',
  },
  resumenContent: {
    flex: 1,
    marginBottom: 12,
  },
  modalResumenContainer: {
    flex: 1,
    backgroundColor: theme.colors.surface,
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
    flexDirection: 'column',
    marginTop: 'auto',
    maxHeight: '90%',
  },
  modalResumenHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  modalResumenBody: {
    flex: 1,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  modalResumenFooter: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
    justifyContent: 'space-between',
  },
  modalResumenFooter_buttonSecondary: {
    flex: 1,
    backgroundColor: theme.colors.border,
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderRadius: 6,
  },
  modalResumenFooter_buttonPrimary: {
    flex: 1,
    backgroundColor: theme.colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderRadius: 6,
  },
  resumenSection: {
    marginBottom: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  resumenLabel: {
    fontSize: scale(12),
    fontWeight: '600',
    color: theme.colors.textSecondary,
    marginBottom: 4,
  },
  resumenLabelBold: {
    fontSize: scale(14),
    fontWeight: 'bold',
    color: theme.colors.text,
  },
  resumenValue: {
    fontSize: scale(14),
    color: theme.colors.text,
    fontWeight: '500',
  },
  resumenValueBold: {
    fontSize: scale(16),
    color: theme.colors.success,
    fontWeight: 'bold',
  },
  resumenProducto: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    paddingHorizontal: 8,
    backgroundColor: theme.colors.background,
    borderRadius: 6,
    marginBottom: 8,
  },
  resumenProductoNombre: {
    fontSize: scale(13),
    color: theme.colors.text,
    flex: 1,
  },
  resumenProductoPrecio: {
    fontSize: scale(13),
    color: theme.colors.success,
    fontWeight: '600',
  },
  resumenTotalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
    paddingVertical: 4,
  },
  resumenFinalTotal: {
    backgroundColor: theme.colors.success + '20',
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderRadius: 6,
    marginTop: 8,
    borderWidth: 2,
    borderColor: theme.colors.success,
  },
});