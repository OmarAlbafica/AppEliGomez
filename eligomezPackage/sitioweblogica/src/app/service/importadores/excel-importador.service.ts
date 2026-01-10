import { Injectable } from '@angular/core';
import * as XLSX from 'xlsx';
import { Pedido } from '../pedidos/pedidos.service';
import { Cliente } from '../clientes/clientes.service';
import { Encomendista } from '../encomendistas/encomendistas.service';

export interface DatosExcelParsed {
  clientes: Cliente[];
  encomendistas: Encomendista[];
  destinos: string[];
  pedidos: any[];
}

@Injectable({
  providedIn: 'root'
})
export class ExcelImportadorService {

  constructor() { }

  /**
   * Parsea un archivo Excel leyendo celdas directamente
   */
  parsearExcel(file: File): Promise<DatosExcelParsed> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e: any) => {
        try {
          const datos = e.target.result;
          const workbook = XLSX.read(datos, { type: 'array' });
          const worksheet = workbook.Sheets[workbook.SheetNames[0]];
          
          // Leer como matriz de celdas para preservar estructura
          const range = XLSX.utils.decode_range(worksheet['!ref'] || 'A1');
          const filas: any[][] = [];
          
          // Extraer cada fila como array
          for (let row = range.s.r; row <= range.e.r; row++) {
            const fila: any[] = [];
            for (let col = range.s.c; col <= range.e.c; col++) {
              const cellAddress = XLSX.utils.encode_col(col) + XLSX.utils.encode_row(row);
              const cell = worksheet[cellAddress];
              fila.push(cell ? cell.v : '');
            }
            filas.push(fila);
          }

          console.log('Matriz de celdas:', filas.length, 'filas');
          const resultado = this.procesarMatrizExcel(filas);
          resolve(resultado);
        } catch (error) {
          reject(error);
        }
      };
      reader.readAsArrayBuffer(file);
    });
  }

  /**
   * Procesa una matriz de celdas del Excel
   */
  private procesarMatrizExcel(filas: any[][]): DatosExcelParsed {
    const clientes: Map<string, Cliente> = new Map();
    const encomendistas: Map<string, Encomendista> = new Map();
    const destinos: Set<string> = new Set();
    const pedidos: any[] = [];

    console.log('Procesando matriz con', filas.length, 'filas');
    console.log('Primeras 5 filas:', filas.slice(0, 5));
    console.log('Fila [0]:', filas[0]);
    console.log('Fila [1]:', filas[1]);

    let i = 0;
    let bloqueNum = 0;
    
    while (i < filas.length) {
      const fila = filas[i];

      if (!fila || fila.length === 0) {
        i++;
        continue;
      }

      // Detectar FECHA en la primera columna
      const primeraCol = fila[0];
      console.log(`Fila ${i}, primera columna:`, primeraCol);
      
      const fechaMatch = this.extraerFecha(primeraCol);
      
      if (fechaMatch) {
        bloqueNum++;
        console.log(`[BLOQUE ${bloqueNum}] Fecha encontrada en fila ${i}:`, fechaMatch);
        
        // Recolectar el bloque completo (fecha + encabezados + datos)
        const filasBloque = [fila];
        i++;

        // Recolectar hasta encontrar fila vacía o siguiente fecha
        while (i < filas.length) {
          const filaActual = filas[i];
          
          // Si fila está completamente vacía, es separador
          if (!filaActual || filaActual.every(c => !c || c.toString().trim() === '')) {
            console.log('Fila vacía encontrada en', i, ', fin del bloque');
            i++;
            break;
          }

          // Si hay otra fecha en primer a columna, fin del bloque
          if (this.extraerFecha(filaActual[0])) {
            console.log('Siguiente fecha encontrada, fin del bloque');
            break;
          }

          filasBloque.push(filaActual);
          i++;
        }

        console.log(`[BLOQUE ${bloqueNum}] Recolectadas ${filasBloque.length} filas`);
        if (filasBloque.length > 1) {
          console.log('Bloque fila 0:', filasBloque[0]);
          console.log('Bloque fila 1 (encabezados?):', filasBloque[1]);
        }
        
        this.procesarBloque(filasBloque, fechaMatch, clientes, encomendistas, destinos, pedidos);
        continue;
      }

      i++;
    }

    console.log('Resultados finales:', { 
      clientes: clientes.size, 
      encomendistas: encomendistas.size, 
      destinos: destinos.size, 
      pedidos: pedidos.length 
    });

    // Limpiar undefined de todos los datos antes de retornar
    const clientesLimpios = Array.from(clientes.values()).map(c => this.limpiarUndefined(c));
    const encomendistasLimpios = Array.from(encomendistas.values()).map(e => this.limpiarUndefined(e));
    const pedidosLimpios = pedidos.map(p => this.limpiarUndefined(p));

    // Agrupar similares y convertir a title case
    const clientesAgrupados = this.agruparClientes(clientesLimpios as Cliente[]);
    const encomendistasAgrupados = this.agruparEncomendistas(encomendistasLimpios as Encomendista[]);

    // También actualizar nombres en pedidos después de agrupar
    const pedidosActualizados = pedidosLimpios.map(p => {
      if (p.cliente_nombre) {
        p.cliente_nombre = this.aTitleCase(p.cliente_nombre);
      }
      if (p.encomendista_nombre) {
        p.encomendista_nombre = this.aTitleCase(p.encomendista_nombre);
      }
      return p;
    });

    return {
      clientes: clientesAgrupados,
      encomendistas: encomendistasAgrupados,
      destinos: Array.from(destinos),
      pedidos: pedidosActualizados
    };
  }

  /**
   * Procesa un bloque de datos (fecha + encabezados + pedidos)
   */
  private procesarBloque(
    filas: any[][],
    fecha: string,
    clientes: Map<string, Cliente>,
    encomendistas: Map<string, Encomendista>,
    destinos: Set<string>,
    pedidos: any[]
  ) {
    if (filas.length < 2) return; // Al menos fecha + encabezados

    // Primera fila contiene la fecha (y posiblemente algunos encabezados)
    const filEncabezados = filas[1];
    
    // Mapear posiciones de columnas
    const colMap = this.mapearEncabezados(filEncabezados);
    console.log('Mapa de columnas:', colMap);

    // Procesar filas de datos (desde fila 2 en adelante)
    for (let i = 2; i < filas.length; i++) {
      const filaPedido = filas[i];

      // Obtener valores por posición
      const nombreClienta = this.obtenerValorPos(filaPedido, colMap['clienta']);
      
      // Saltar si está vacía
      if (!nombreClienta) continue;

      console.log('Procesando:', nombreClienta);

      const telefono = this.obtenerValorPos(filaPedido, colMap['telefono']);
      const destino = this.obtenerValorPos(filaPedido, colMap['destino']);
      const encomendista = this.obtenerValorPos(filaPedido, colMap['encomendista']);
      const dia = this.obtenerValorPos(filaPedido, colMap['dia']);
      const hora = this.obtenerValorPos(filaPedido, colMap['hora']);
      const estado = (this.obtenerValorPos(filaPedido, colMap['estado']) || '').toLowerCase();
      const totalStr = this.obtenerValorPos(filaPedido, colMap['total']) || '0';
      const totalAPagar = this.extraerTotal(totalStr.toString());

      // Crear cliente
      if (nombreClienta && !clientes.has(nombreClienta)) {
        clientes.set(nombreClienta, {
          id: this.generarId(),
          usuario_id: '',
          nombre: nombreClienta,
          telefono: telefono?.toString() || '',
          direccion: destino?.toString() || '',
          activo: true,
          fecha_creacion: new Date()
        });
      }

      // Normalizar nombres
      const nombreEncomendistaNormalizado = encomendista ? this.normalizarNombre(encomendista.toString()) : '';
      const nombreClientaNormalizado = nombreClienta ? this.normalizarNombre(nombreClienta.toString()) : nombreClienta;
      const destinoNormalizado = destino ? this.normalizarNombre(destino.toString()) : '';

      // Actualizar cliente con nombre normalizado
      if (nombreClientaNormalizado && !clientes.has(nombreClientaNormalizado)) {
        clientes.set(nombreClientaNormalizado, {
          id: this.generarId(),
          usuario_id: '',
          nombre: nombreClientaNormalizado,
          telefono: telefono?.toString() || '',
          direccion: destinoNormalizado || '',
          activo: true,
          fecha_creacion: new Date()
        });
      }

      // Crear encomendista con horarios en destinos
      if (nombreEncomendistaNormalizado) {
        const [horaInicio, horaFin] = this.parsearHora(hora?.toString() || '');
        
        // Construir destino solo con campos que tengan valor
        const destinoConHorario: any = { nombre: destinoNormalizado };
        if (horaInicio) {
          destinoConHorario.horarios = [{
            dias: [dia?.toString() || ''],
            hora_inicio: horaInicio,
            hora_fin: horaFin
          }];
        }

        if (!encomendistas.has(nombreEncomendistaNormalizado)) {
          const nuevoEncomendista = {
            id: this.generarId(),
            nombre: nombreEncomendistaNormalizado,
            telefono: '',
            local: '',
            destinos: [destinoConHorario],
            activo: true,
            fecha_creacion: new Date()
          };
          
          // Limpiar undefined antes de guardar
          encomendistas.set(nombreEncomendistaNormalizado, this.limpiarUndefined(nuevoEncomendista));
        } else if (destinoNormalizado) {
          // Si ya existe, agregar el destino con horarios
          const enc = encomendistas.get(nombreEncomendistaNormalizado);
          if (enc) {
            const destinoExistente = enc.destinos.find(d => 
              this.normalizarNombre(typeof d === 'string' ? d : d.nombre) === destinoNormalizado
            );
            
            if (!destinoExistente) {
              enc.destinos.push(destinoConHorario);
            } else if (typeof destinoExistente === 'object' && horaInicio && destinoExistente.horarios) {
              // Agregar horario al destino existente
              const horarioExistente = destinoExistente.horarios.some(h => 
                h.hora_inicio === horaInicio && h.hora_fin === horaFin
              );
              if (!horarioExistente) {
                destinoExistente.horarios.push({
                  dias: [dia?.toString() || ''],
                  hora_inicio: horaInicio,
                  hora_fin: horaFin
                });
              }
            }
          }
        }
      }

      // Agregar destino
      if (destino) {
        destinos.add(destino.toString());
      }

      // Crear pedido con la fecha del bloque
      if (destino && fecha) {
        const fechaEntrega = dia ? this.construirFecha(fecha, dia.toString()) : new Date(fecha);
        const [horaInicio, horaFin] = this.parsearHora(hora?.toString() || '');

        const pedido = {
          id: this.generarId(),
          cliente_id: clientes.get(nombreClientaNormalizado)?.id,
          cliente_nombre: nombreClientaNormalizado,
          encomendista_id: nombreEncomendistaNormalizado ? encomendistas.get(nombreEncomendistaNormalizado)?.id : null,
          destino_id: destinoNormalizado,
          fecha_entrega_programada: fechaEntrega,
          hora_inicio: horaInicio,
          hora_fin: horaFin,
          total: totalAPagar,
          estado: this.normalizarEstado(estado),
          descripcion_prendas: '',
          cantidad_prendas: 0,
          modo: 'programado',
          createdAt: new Date(),
          updatedAt: new Date()
        };

        pedidos.push(pedido);
      }
    }
  }

  /**
   * Mapea las posiciones de columnas desde una fila de encabezados
   */
  private mapearEncabezados(fila: any[]): { [key: string]: number } {
    const mapeo: { [key: string]: number } = {};

    for (let i = 0; i < fila.length; i++) {
      const header = (fila[i] || '').toString().toLowerCase().trim();
      
      if (header === 'clienta' || header === 'cliente') mapeo['clienta'] = i;
      else if (header.includes('telefono') || header.includes('telef')) mapeo['telefono'] = i;
      else if (header === 'destino') mapeo['destino'] = i;
      else if (header === 'encomendista') mapeo['encomendista'] = i;
      else if (header === 'dia') mapeo['dia'] = i;
      else if (header === 'hora') mapeo['hora'] = i;
      else if (header === 'estado') mapeo['estado'] = i;
      else if (header.includes('monto') || header.includes('total')) mapeo['total'] = i;
    }

    return mapeo;
  }

  /**
   * Obtiene valor por posición en un array
   */
  private obtenerValorPos(fila: any[], pos: number | undefined): any {
    if (pos === undefined || pos < 0 || pos >= fila.length) return '';
    return fila[pos];
  }

  /**
   * Procesa los datos parseados del Excel
   */
  /**
   * Extrae el total de una cadena que puede contener múltiples valores (ej: "$21.50+$4.00")
   */
  private extraerTotal(str: string): number {
    if (!str) return 0;
    
    // Buscar todos los números con $ y sumarlos
    const regex = /\$?\s*([\d.]+)/g;
    let total = 0;
    let match;
    
    while ((match = regex.exec(str)) !== null) {
      total += parseFloat(match[1]);
    }
    
    return total;
  }

  /**
   * Extrae fecha del encabezado (ej: "20-12-2025")
   */
  private extraerFecha(valor: any): string | null {
    if (!valor) return null;
    
    // Si es un número, podría ser un timestamp de Excel
    if (typeof valor === 'number') {
      // Excel date serial number (1 = 1900-01-01)
      const excelEpoch = new Date(1900, 0, 1);
      const date = new Date(excelEpoch.getTime() + valor * 24 * 60 * 60 * 1000);
      const dd = String(date.getDate()).padStart(2, '0');
      const mm = String(date.getMonth() + 1).padStart(2, '0');
      const yyyy = date.getFullYear();
      const fechaStr = `${yyyy}-${mm}-${dd}`;
      console.log('Fecha convertida de número Excel', valor, 'a', fechaStr);
      return fechaStr;
    }
    
    const texto = valor.toString().trim();
    const regex = /(\d{2})-(\d{2})-(\d{4})/;
    const match = texto.match(regex);
    const result = match ? `${match[3]}-${match[2]}-${match[1]}` : null;
    if (result) {
      console.log('Fecha extraída del texto:', texto, '→', result);
    }
    return result; // Convertir a YYYY-MM-DD
  }

  /**
   * Construye la fecha de entrega combinando fecha base con día de semana
   */
  private construirFecha(fechaBase: string, dia: string): Date {
    if (!fechaBase) return new Date();

    const [year, month, day] = fechaBase.split('-').map(Number);
    const fecha = new Date(year, month - 1, day);

    // Mapeo de días a números (0=Domingo, 1=Lunes, etc.)
    const diasMap: { [key: string]: number } = {
      'domingo': 0,
      'lunes': 1,
      'martes': 2,
      'miércoles': 3,
      'miercoles': 3,
      'jueves': 4,
      'viernes': 5,
      'sábado': 6,
      'sabado': 6
    };

    const diaDeseado = diasMap[dia.toLowerCase()] ?? -1;
    if (diaDeseado === -1) return fecha;

    // Buscar el próximo día deseado a partir de la fecha base
    let fechaBuscada = new Date(fecha);
    while (fechaBuscada.getDay() !== diaDeseado) {
      fechaBuscada.setDate(fechaBuscada.getDate() + 1);
    }

    return fechaBuscada;
  }

  /**
   * Parsea la hora (ej: "11 a 11:30" o "9am a 3:30pm")
   */
  private parsearHora(hora: string): [string, string] {
    if (!hora) return ['', ''];

    // Limpiar y normalizar
    let texto = hora.toLowerCase().trim();
    texto = texto.replace(/\s+/g, ' ');

    // Intenta extraer formato "HH a HH:MM" o similar
    const match = texto.match(/(\d{1,2}):?(\d{0,2})\s*([ap]m)?\s*(?:a|-)\s*(\d{1,2}):?(\d{0,2})\s*([ap]m)?/i);
    
    if (match) {
      const [, h1, m1, ap1, h2, m2, ap2] = match;
      const horaInicio = this.formatearHora(parseInt(h1), parseInt(m1) || 0, ap1);
      const horaFin = this.formatearHora(parseInt(h2), parseInt(m2) || 0, ap2);
      return [horaInicio, horaFin];
    }

    return [texto, ''];
  }

  /**
   * Formatea hora al formato HH:MM
   */
  private formatearHora(hora: number, minutos: number, ampm?: string): string {
    let h = hora;

    if (ampm && ampm.toLowerCase() === 'pm' && h !== 12) {
      h += 12;
    } else if (ampm && ampm.toLowerCase() === 'am' && h === 12) {
      h = 0;
    }

    return `${h.toString().padStart(2, '0')}:${minutos.toString().padStart(2, '0')}`;
  }

  /**
   * Normaliza el estado
   */
  private normalizarEstado(estado: string): string {
    const estadoLower = estado.toLowerCase().trim();
    if (estadoLower.includes('cancel')) return 'cancelado';
    if (estadoLower.includes('confirm')) return 'confirmado';
    if (estadoLower.includes('pendie')) return 'pendiente';
    return 'pendiente';
  }

  /**
   * Cuenta las prendas en la descripción
   */
  private contarPrendas(descripcion: string): number {
    if (!descripcion) return 0;
    // Contar ocurrencias de líneas que contienen "$"
    const prendas = descripcion.split('\n').filter(l => l.includes('$'));
    return prendas.length || 1;
  }

  /**
   * Normaliza un nombre: trim, lowercase, múltiples espacios a uno
   */
  private normalizarNombre(nombre: string): string {
    if (!nombre) return '';
    return nombre
      .toString()
      .trim()
      .toLowerCase()
      .replace(/\s+/g, ' ');
  }

  /**
   * Limpia los campos undefined de un objeto (Firestore no acepta undefined)
   */
  private limpiarUndefined<T extends Record<string, any>>(obj: T): T {
    const resultado: any = {};
    for (const [key, value] of Object.entries(obj)) {
      if (value !== undefined && value !== null && value !== '') {
        if (Array.isArray(value)) {
          resultado[key] = value.map(item => 
            typeof item === 'object' ? this.limpiarUndefined(item) : item
          );
        } else if (typeof value === 'object') {
          resultado[key] = this.limpiarUndefined(value);
        } else {
          resultado[key] = value;
        }
      }
    }
    return resultado as T;
  }

  /**
   * Genera un ID único
   */
  private generarId(): string {
    return `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Convierte un nombre a PascalCase (Encomiendas Abraham)
   */
  private aTitleCase(nombre: string): string {
    if (!nombre) return '';
    return nombre
      .trim()
      .toLowerCase()
      .split(/\s+/)
      .map(palabra => palabra.charAt(0).toUpperCase() + palabra.slice(1))
      .join(' ');
  }

  /**
   * Encuentra el nombre principal de un grupo de encomiendas similares
   * Devuelve el nombre más largo (que contiene más información)
   * Por ejemplo: "abraham", "Encomiendas Abraham" -> "Encomiendas Abraham"
   */
  private encontrarNombrePrincipal(nombres: string[]): string {
    // Devolver el nombre más largo en camelCase
    const nombreMasLargo = nombres.reduce((max, actual) => {
      return actual.length > max.length ? actual : max;
    });
    
    return this.aTitleCase(nombreMasLargo);
  }

  /**
   * Agrupa encomendistas similares
   * Por ejemplo: "abraham", "Encomiendas Abraham" -> fusiona en una sola
   */
  private agruparEncomendistas(encomendistasArr: Encomendista[]): Encomendista[] {
    const procesados = new Set<number>();
    const resultado: Encomendista[] = [];

    for (let i = 0; i < encomendistasArr.length; i++) {
      if (procesados.has(i)) continue;

      const enc = encomendistasArr[i];
      const normI = this.normalizarNombre(enc.nombre);
      const grupo = [enc];
      procesados.add(i);

      // Buscar nombres similares o contenidos
      for (let j = i + 1; j < encomendistasArr.length; j++) {
        if (procesados.has(j)) continue;

        const encJ = encomendistasArr[j];
        const normJ = this.normalizarNombre(encJ.nombre);

        // Si uno contiene al otro o son similares, agrupar
        if (this.sonNombreSimilar(normI, normJ)) {
          grupo.push(encJ);
          procesados.add(j);
        }
      }

      // Obtener el nombre principal (más largo/descriptivo)
      const nombrePrincipal = this.aTitleCase(
        this.encontrarNombrePrincipal(grupo.map(e => e.nombre))
      );

      // Fusionar destinos
      const destinosFusionados = new Set<string>();
      grupo.forEach(enc => {
        if (Array.isArray(enc.destinos)) {
          enc.destinos.forEach(d => {
            const dest = typeof d === 'string' ? d : (d as any).nombre;
            if (dest) {
              destinosFusionados.add(this.aTitleCase(dest));
            }
          });
        }
      });

      resultado.push({
        id: grupo[0].id,
        nombre: nombrePrincipal,
        telefono: grupo[0].telefono || '',
        local: grupo[0].local || '',
        destinos: Array.from(destinosFusionados) as any[],
        activo: true,
        fecha_creacion: grupo[0].fecha_creacion
      });
    }

    return resultado;
  }

  /**
   * Agrupa clientes similares y convierte a title case
   */
  private agruparClientes(clientesArr: Cliente[]): Cliente[] {
    const procesados = new Set<number>();
    const resultado: Cliente[] = [];

    for (let i = 0; i < clientesArr.length; i++) {
      if (procesados.has(i)) continue;

      const cli = clientesArr[i];
      const normI = this.normalizarNombre(cli.nombre);
      const grupo = [cli];
      procesados.add(i);

      // Buscar nombres similares o contenidos
      for (let j = i + 1; j < clientesArr.length; j++) {
        if (procesados.has(j)) continue;

        const cliJ = clientesArr[j];
        const normJ = this.normalizarNombre(cliJ.nombre);

        // Si uno contiene al otro o son similares, agrupar
        if (this.sonNombreSimilar(normI, normJ)) {
          grupo.push(cliJ);
          procesados.add(j);
        }
      }

      // Obtener el nombre principal (más largo/descriptivo)
      const nombrePrincipal = this.aTitleCase(
        this.encontrarNombrePrincipal(grupo.map(c => c.nombre))
      );

      resultado.push({
        id: grupo[0].id,
        usuario_id: grupo[0].usuario_id,
        nombre: nombrePrincipal,
        telefono: grupo[0].telefono || '',
        direccion: grupo[0].direccion || '',
        activo: true,
        fecha_creacion: grupo[0].fecha_creacion
      });
    }

    return resultado;
  }

  /**
   * Detecta si dos nombres normalizados son similares
   */
  private sonNombreSimilar(nom1: string, nom2: string): boolean {
    // Solo agrupar si uno es substring del otro (contención directa)
    // Ejemplo: "abraham" está en "encomiendas abraham" -> agrupar
    // Pero: "encomiendas nacionales" NO contiene "encomiendas estrada" -> no agrupar
    
    const min = nom1.length < nom2.length ? nom1 : nom2;
    const max = nom1.length < nom2.length ? nom2 : nom1;

    // Verificar si el nombre más corto está completamente dentro del más largo
    // Pero verificar que no sea solo una palabra común como "encomiendas"
    if (max.includes(min)) {
      // Si el nombre corto tiene más de 2 palabras y está completamente contenido, agrupar
      const palabrasCortas = min.split(/\s+/).filter(p => p.length > 2);
      
      if (palabrasCortas.length === 1) {
        // Si es una sola palabra corta (como "abraham"), agrupar si está en el nombre largo
        return true;
      } else if (palabrasCortas.length > 1) {
        // Si tiene múltiples palabras, agrupar solo si todas están en el nombre largo
        return palabrasCortas.every(p => max.includes(p));
      }
    }

    return false;
  }
}
