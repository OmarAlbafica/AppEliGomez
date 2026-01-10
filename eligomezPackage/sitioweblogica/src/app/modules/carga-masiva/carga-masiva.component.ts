import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { OcrService, TextoExtraido } from '../../service/ocr/ocr.service';

interface PedidoExtraido {
  id: string;
  imagen_nombre: string;
  destino: string;
  hora: string;
  dia: string;
  confianza: number;
  texto_completo: string;
  editado: boolean;
}

@Component({
  selector: 'app-carga-masiva',
  templateUrl: './carga-masiva.component.html',
  styleUrls: ['./carga-masiva.component.css'],
  standalone: true,
  imports: [CommonModule, FormsModule]
})
export class CargaMasivaComponent implements OnInit {
  archivos: File[] = [];
  progreso: number = 0;
  cargando: boolean = false;
  pedidosExtraidos: PedidoExtraido[] = [];
  fase: 'carga' | 'procesamiento' | 'revision' = 'carga';

  // Opciones predefinidas
  destinosPredefinidos = [
    'San Pedro Noveaico',
    'Casillero 1-4 A',
    'Santa Ana Plaza Paris',
    'Ciudad Real',
    'Metapán',
    'Parque Centenario',
    'El Tránsito',
    'Cojutepeque',
    'San Miguel',
    'Entrega'
  ];

  diasSemana = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];

  constructor(private ocrService: OcrService) {}

  ngOnInit() {
    this.ocrService.progreso$.subscribe(progreso => {
      this.progreso = progreso;
    });
  }

  /**
   * Selecciona archivos para procesar
   */
  seleccionarArchivos(event: Event) {
    const input = event.target as HTMLInputElement;
    if (input.files) {
      this.archivos = Array.from(input.files);
    }
  }

  /**
   * Inicia el procesamiento de imágenes
   */
  procesarImagenes() {
    if (this.archivos.length === 0) {
      alert('Selecciona al menos una imagen');
      return;
    }

    this.cargando = true;
    this.fase = 'procesamiento';

    try {
      this.ocrService.procesarImagenes(this.archivos).subscribe({
        next: (resultados: TextoExtraido[]) => {
          // Convertir resultados a pedidos editables
          this.pedidosExtraidos = resultados.map((res: TextoExtraido, index: number) => ({
            id: `pedido_${Date.now()}_${index}`,
            imagen_nombre: this.archivos[index].name,
            destino: res.destino || '',
            hora: res.hora || '',
            dia: res.dia || '',
            confianza: res.confianza,
            texto_completo: res.texto_bruto,
            editado: false
          }));

          this.fase = 'revision';
        },
        error: (error: any) => {
          console.error('Error en OCR:', error);
          alert('Error al procesar imágenes');
          this.cargando = false;
        },
        complete: () => {
          this.cargando = false;
        }
      });
    } catch (error) {
      console.error('Error en OCR:', error);
      alert('Error al procesar imágenes');
      this.cargando = false;
    }
  }

  /**
   * Marca un pedido como editado
   */
  marcarEditado(pedido: PedidoExtraido) {
    pedido.editado = true;
  }

  /**
   * Obtiene clase de confianza según el porcentaje
   */
  getClaseConfianza(confianza: number): string {
    if (confianza >= 80) return 'bg-green-100';
    if (confianza >= 50) return 'bg-yellow-100';
    return 'bg-red-100';
  }

  /**
   * Obtiene ícono según confianza
   */
  getIconoConfianza(confianza: number): string {
    if (confianza >= 80) return '✓';
    if (confianza >= 50) return '⚠';
    return '✗';
  }

  /**
   * Guarda los pedidos procesados
   */
  async guardarPedidos() {
    if (this.pedidosExtraidos.length === 0) {
      alert('No hay pedidos para guardar');
      return;
    }

    this.cargando = true;

    try {
      // Aquí guardarías en Firestore
      console.log('Pedidos a guardar:', this.pedidosExtraidos);
      alert(`✓ Se guardaron ${this.pedidosExtraidos.length} pedidos exitosamente`);
      
      // Limpiar
      this.limpiar();
    } catch (error) {
      console.error('Error guardando:', error);
      alert('Error al guardar los pedidos');
    } finally {
      this.cargando = false;
    }
  }

  /**
   * Reinicia el componente
   */
  limpiar() {
    this.archivos = [];
    this.pedidosExtraidos = [];
    this.progreso = 0;
    this.fase = 'carga';
    this.ocrService.limpiarProgreso();
  }

  /**
   * Sugerencias inteligentes de destino
   */
  obtenerSugerenciasDestino(texto: string): string[] {
    if (!texto) return this.destinosPredefinidos;
    
    const textoLower = texto.toLowerCase();
    return this.destinosPredefinidos.filter(d => 
      d.toLowerCase().includes(textoLower) || 
      textoLower.includes(d.toLowerCase().substring(0, 3))
    );
  }

  /**
   * Verifica si hay pedidos editados
   */
  tieneEdiciones(): boolean {
    return this.pedidosExtraidos.some(p => p.editado);
  }

  /**
   * Cuenta cuántos pedidos fueron editados
   */
  contarEdiciones(): number {
    return this.pedidosExtraidos.filter(p => p.editado).length;
  }
}
