import { Component, Input, Output, EventEmitter, OnInit, OnChanges, SimpleChanges, ViewChild, ElementRef, ChangeDetectorRef, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Pedido } from '../../service/pedidos/pedidos.service';
import { StickerPdfService } from '../../service/pdf/sticker-pdf.service';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import * as QRCode from 'qrcode';

interface PedidoCompleto extends Pedido {
  cliente_nombre?: string;
  encomendista_nombre?: string;
}

@Component({
  selector: 'app-sticker-preview-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './sticker-preview-modal.component.html',
  styleUrls: ['./sticker-preview-modal.component.css']
})
export class StickerPreviewModalComponent implements OnInit, OnChanges, AfterViewInit {
  @Input() mostrar: boolean = false;
  @Input() pedidos: PedidoCompleto[] = [];
  @Input() fechaEnvio: Date | null = null;
  
  @ViewChild('contenidoPdf') contenidoPdf!: ElementRef<HTMLElement>;
  
  @Output() cerrarModal = new EventEmitter<void>();
  @Output() descargarPdfEvent = new EventEmitter<{ pedidos: PedidoCompleto[], todosPedidos: boolean }>();

  paginaActual: number = 1;
  totalPaginas: number = 0;
  stickersPorPagina: number = 8; // 1 columna x 8 filas, forzamos 8 por página
  qrImages: { [key: string]: string } = {}; // Almacenar QR como imágenes (data URLs)

  constructor(private pdfService: StickerPdfService, private cdr: ChangeDetectorRef) {}

  ngOnInit(): void {
    this.calcularTotalPaginas();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['pedidos']) {
      this.calcularTotalPaginas();
      if (this.paginaActual > this.totalPaginas) {
        this.paginaActual = 1;
      }
    }
    
    // Si el modal se abre (mostrar cambia a true), generar QRs
    if (changes['mostrar'] && changes['mostrar'].currentValue === true) {
      console.log('📺 Modal abierto, generando QRs...');
      this.cdr.detectChanges();
      this.generarQRs();
    }
  }

  ngAfterViewInit(): void {
    // Los QRs se generan en ngOnChanges cuando el modal se abre
  }

  generarQRs(): void {
    console.log('🚀 Generando QR como imágenes...');
    
    this.cdr.detectChanges();
    
    setTimeout(() => {
      const stickers = this.obtenerStickersPagina();
      console.log(`📦 Procesando ${stickers.length} stickers`);
      
      stickers.forEach((pedido, index) => {
        const datosQR = pedido.codigo_pedido || pedido.id || 'SIN_CODIGO';
        console.log(`[QR ${index + 1}] Generando para: "${datosQR}"`);
        
        // Crear un canvas temporal para generar el QR
        const canvasTemp = document.createElement('canvas');
        
        try {
          QRCode.toCanvas(canvasTemp, datosQR, {
            width: 200,
            margin: 1,
            scale: 1,
            errorCorrectionLevel: 'H',
            color: {
              dark: '#000000',
              light: '#FFFFFF'
            }
          }, (error: any) => {
            if (error) {
              console.error(`[QR ${index + 1}] ❌ Error:`, error);
            } else {
              // Convertir canvas a data URL (imagen)
              const qrDataUrl = canvasTemp.toDataURL('image/png');
              this.qrImages[pedido.id] = qrDataUrl;
              console.log(`[QR ${index + 1}] ✅ Imagen generada exitosamente`);
              this.cdr.detectChanges();
            }
          });
        } catch (error) {
          console.error(`[QR ${index + 1}] ❌ Exception:`, error);
        }
      });
    }, 300);
  }

  obtenerImagenQR(pedido: PedidoCompleto | undefined): string | undefined {
    if (!pedido || !pedido.id) return undefined;
    return this.qrImages[pedido.id];
  }

  calcularTotalPaginas(): void {
    this.totalPaginas = Math.ceil(this.pedidos.length / this.stickersPorPagina);
    if (this.totalPaginas === 0) this.totalPaginas = 1;
  }

  obtenerStickersPagina(): PedidoCompleto[] {
    // Solo permitir seleccionar 10 stickers para la página
    // Si hay más de 10, solo mostrar los primeros 10
    return this.pedidos.slice(0, this.stickersPorPagina);
  }

  obtenerPlaceholders(): number[] {
    const stickersEnPagina = this.obtenerStickersPagina().length;
    const faltantes = this.stickersPorPagina - stickersEnPagina;
    return Array(faltantes).fill(0).map((_, i) => i);
  }

  paginaSiguiente(): void {
    if (this.paginaActual < this.totalPaginas) {
      this.paginaActual++;
      this.cdr.detectChanges();
      this.generarQRs();
    }
  }

  paginaAnterior(): void {
    if (this.paginaActual > 1) {
      this.paginaActual--;
      this.cdr.detectChanges();
      this.generarQRs();
    }
  }

  async imprimir(): Promise<void> {
    const element = document.getElementById('stickers-print');
    
    if (!element) {
      alert('Error: No se puede capturar el contenido');
      return;
    }

    console.log('📸 Generando PDF con captura de pantalla...');
    
    const btnDescarga = Array.from(document.querySelectorAll('button')).find(btn => 
      btn.textContent?.includes('Descargar')
    ) as HTMLButtonElement | undefined;

    if (btnDescarga) {
      btnDescarga.disabled = true;
      btnDescarga.textContent = '⏳ Generando...';
    }

    try {
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
        compress: true
      });

      const pageWidth = 210;
      const paginaOriginal = this.paginaActual;

      for (let i = 1; i <= this.totalPaginas; i++) {
        this.paginaActual = i;
        this.cdr.detectChanges();
        
        await new Promise(resolve => setTimeout(resolve, 500));

        const canvas = await html2canvas(element, {
          scale: 3,
          useCORS: true,
          allowTaint: true,
          backgroundColor: '#ffffff',
          logging: false,
          windowHeight: element.scrollHeight,
          windowWidth: element.scrollWidth
        });

        const imgData = canvas.toDataURL('image/png');
        const imgWidth = pageWidth;
        const imgHeight = (canvas.height * pageWidth) / canvas.width;

        if (i > 1) {
          pdf.addPage();
        }

        pdf.addImage(imgData, 'PNG', 0, 0, imgWidth, imgHeight);
      }

      this.paginaActual = paginaOriginal;
      this.cdr.detectChanges();

      const fecha = new Date().toISOString().split('T')[0];
      pdf.save(`Stickers_Eli_Gomez_${fecha}.pdf`);

      console.log('✅ PDF generado correctamente');
      alert(`✅ PDF descargado: ${this.pedidos.length} stickers en ${this.totalPaginas} página(s)`);

      if (btnDescarga) {
        btnDescarga.disabled = false;
        btnDescarga.textContent = '📥 Descargar PDF';
      }
    } catch (error) {
      console.error('❌ Error al generar PDF:', error);
      alert('Error al generar PDF: ' + (error as any).message);
      
      if (btnDescarga) {
        btnDescarga.disabled = false;
        btnDescarga.textContent = '📥 Descargar PDF';
      }
    }
  }

  traducirDia(dia: string): string {
    const dias: { [key: string]: string } = {
      'Monday': 'Lunes',
      'Tuesday': 'Martes',
      'Wednesday': 'Miércoles',
      'Thursday': 'Jueves',
      'Friday': 'Viernes',
      'Saturday': 'Sábado',
      'Sunday': 'Domingo'
    };
    return dias[dia] || dia;
  }

  formatearFecha(fecha: any): string {
    if (!fecha) return '';
    
    try {
      let fechaObj: Date;
      
      if (fecha instanceof Date) {
        fechaObj = fecha;
      } else if (typeof fecha === 'string') {
        fechaObj = new Date(fecha);
      } else if (fecha.toDate && typeof fecha.toDate === 'function') {
        fechaObj = fecha.toDate();
      } else {
        fechaObj = new Date(fecha);
      }

      const dia = String(fechaObj.getDate()).padStart(2, '0');
      const mes = String(fechaObj.getMonth() + 1).padStart(2, '0');
      const año = fechaObj.getFullYear();
      
      return `${dia}-${mes}-${año}`;
    } catch {
      return '';
    }
  }

  formatearHora(horaInicio: string | undefined, horaFin: string | undefined): string {
    if (!horaInicio || !horaFin) return '';
    
    try {
      // Convertir "09:00" a "9am"
      const convertirHora = (hora: string): string => {
        const [horas, minutos] = hora.split(':');
        const h = parseInt(horas, 10);
        const periodo = h >= 12 ? 'pm' : 'am';
        const h12 = h > 12 ? h - 12 : h === 0 ? 12 : h;
        return `${h12}${periodo}`;
      };
      
      return `${convertirHora(horaInicio)} a ${convertirHora(horaFin)}`;
    } catch {
      return `${horaInicio} - ${horaFin}`;
    }
  }

  formatearFechaDisplay(fecha: Date | null | undefined): string {
    if (!fecha) return 'N/A';
    
    try {
      const f = fecha instanceof Date ? fecha : new Date(fecha);
      const opciones: Intl.DateTimeFormatOptions = { 
        weekday: 'short', 
        month: 'short', 
        day: 'numeric' 
      };
      return f.toLocaleDateString('es-ES', opciones);
    } catch {
      return 'N/A';
    }
  }

  // NUEVO: Métodos para datos dinámicos del sticker (POR CADA PEDIDO)
  obtenerNombreTienda(pedido?: PedidoCompleto): string {
    return pedido?.nombre_tienda || 'Eli Gomez';
  }

  obtenerWhatsAppTienda(pedido?: PedidoCompleto): string {
    return pedido?.whatsapp_tienda || '#7851-8219';
  }

  obtenerLogoTienda(pedido?: PedidoCompleto): string {
    return pedido?.logo_tienda || 'assets/images/logoeligomez.jpg';
  }

  /**
   * Determina si un color hex es claro o oscuro
   * Retorna true si es claro (se debe usar texto negro)
   */
  esColorClaro(color: string | undefined): boolean {
    if (!color || color === '#ec4899') return false;
    
    try {
      // Remover el # del color
      const hex = color.replace('#', '');
      
      // Convertir a RGB
      const r = parseInt(hex.substring(0, 2), 16);
      const g = parseInt(hex.substring(2, 4), 16);
      const b = parseInt(hex.substring(4, 6), 16);
      
      // Calcular luminancia usando la fórmula estándar WCAG
      const luminancia = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
      
      // Si la luminancia es mayor a 0.5, es un color claro
      return luminancia > 0.5;
    } catch {
      return false;
    }
  }

  /**
   * Retorna el color óptimo para el texto basado en el color de fondo
   * Si es color claro: usa color oscuro o amarillo oscuro
   * Si es color oscuro: usa el color mismo para contraste
   */
  obtenerColorTexto(colorFondo: string | undefined): string {
    if (!colorFondo) return '#ec4899';
    
    try {
      const hex = colorFondo.replace('#', '');
      const r = parseInt(hex.substring(0, 2), 16);
      const g = parseInt(hex.substring(2, 4), 16);
      const b = parseInt(hex.substring(4, 6), 16);
      
      const luminancia = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
      
      // Si es color muy claro (luminancia > 0.65), usar negro con negrita
      // Si es color claro pero tolerable (0.5 - 0.65), usar el color oscuro más similar
      // Si es color oscuro, usar el color mismo
      if (luminancia > 0.65) {
        return '#000000'; // Negro puro para máximo contraste
      } else if (luminancia > 0.5) {
        // Color claro: usar versión más oscura del mismo color
        // Reducir luminancia en 40%
        const factor = 0.6;
        const rOscuro = Math.floor(r * factor);
        const gOscuro = Math.floor(g * factor);
        const bOscuro = Math.floor(b * factor);
        return `#${rOscuro.toString(16).padStart(2, '0')}${gOscuro.toString(16).padStart(2, '0')}${bOscuro.toString(16).padStart(2, '0')}`;
      } else {
        // Color oscuro: usar el color mismo
        return colorFondo;
      }
    } catch {
      return colorFondo;
    }
  }

  /**
   * Formatea el estado del pedido
   */
  formatearEstado(estado: string | undefined): string {
    if (!estado) return '';
    const estados: { [key: string]: string } = {
      'pendiente': 'Pendiente',
      'empacada': 'Empacada',
      'enviado': 'Enviado',
      'retirado': 'Retirado',
      'no-retirado': 'No Retirado',
      'cancelado': 'Cancelado',
      'retirado-local': 'Retirado del Local',
      'liberado': 'Liberado'
    };
    return estados[estado] || estado;
  }

  /**
   * Obtiene el emoji/icono para cada estado
   */
  obtenerEmojiEstado(estado: string | undefined): string {
    if (!estado) return '•';
    const emojis: { [key: string]: string } = {
      'pendiente': '🟡',
      'empacada': '📦',
      'enviado': '✈️',
      'retirado': '✅',
      'no-retirado': '❌',
      'cancelado': '🚫',
      'retirado-local': '📍',
      'liberado': '🔓'
    };
    return emojis[estado] || '•';
  }
}