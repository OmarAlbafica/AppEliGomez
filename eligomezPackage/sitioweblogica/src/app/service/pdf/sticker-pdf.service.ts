import { Injectable } from '@angular/core';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import { Pedido } from '../pedidos/pedidos.service';

interface StickerData extends Pedido {
  cliente_nombre?: string;
  encomendista_nombre?: string;
}

@Injectable({
  providedIn: 'root'
})
export class StickerPdfService {
  
  private logoUrl = 'assets/images/logoeligomez.jpg';

  /**
   * Captura MÚLTIPLES PÁGINAS del modal y las convierte a PDF
   * Cada página se captura como una imagen completa (screenshot)
   */
  capturarTodasLasPaginasAPdf(
    elemento: HTMLElement,
    totalPaginas: number,
    onPaginaCambiada: (pagina: number) => void
  ): Promise<Blob> {
    return new Promise(async (resolve, reject) => {
      try {
        console.log('📸 Iniciando captura de páginas completas...');
        
        const imagenes: string[] = [];
        
        // Capturar cada página A4 COMPLETA
        for (let pagina = 1; pagina <= totalPaginas; pagina++) {
          console.log(`📄 Capturando página A4 ${pagina}/${totalPaginas}...`);
          
          // Cambiar a la página
          onPaginaCambiada(pagina);
          
          // Esperar a que Angular renderice
          await new Promise(resolve => setTimeout(resolve, 300));
          
          try {
            // Capturar LA PÁGINA A4 COMPLETA como screenshot con máxima calidad
            const canvas = await html2canvas(elemento, {
              scale: 5,
              logging: false,
              useCORS: true,
              backgroundColor: '#ffffff',
              allowTaint: true,
              removeContainer: false,
              imageTimeout: 0,
              windowHeight: elemento.scrollHeight,
              windowWidth: elemento.scrollWidth
            });
            
            const imgData = canvas.toDataURL('image/png');
            imagenes.push(imgData);
            console.log(`✅ Página ${pagina} capturada en máxima resolución (escala 5x)`);
          } catch (err) {
            console.warn(`⚠️ Error capturando página ${pagina}:`, err);
          }
        }
        
        if (imagenes.length === 0) {
          throw new Error('No se pudo capturar ninguna página');
        }
        
        // Crear PDF - CADA IMAGEN ES UNA PÁGINA COMPLETA
        const pdf = new jsPDF({
          orientation: 'portrait',
          unit: 'mm',
          format: 'a4'
        });
        
        const pageWidth = pdf.internal.pageSize.getWidth();
        const pageHeight = pdf.internal.pageSize.getHeight();
        
        // Añadir cada imagen como página completa
        imagenes.forEach((imgData, index) => {
          if (index > 0) {
            pdf.addPage();
          }
          
          // Imagen a pantalla completa del PDF (sin márgenes)
          pdf.addImage(imgData, 'PNG', 0, 0, pageWidth, pageHeight);
          console.log(`✅ Página ${index + 1} añadida al PDF`);
        });
        
        const blob = pdf.output('blob');
        resolve(blob);
        console.log(`✅ PDF generado con ${imagenes.length} páginas A4`);
        
      } catch (error) {
        console.error('❌ Error en capturarTodasLasPaginasAPdf:', error);
        reject(error);
      }
    });
  }

  /**
   * Captura un SCREENSHOT completo del elemento (método simplificado)
   */
  generarPdfStickersBon(pedidos: StickerData[], titulo: string = 'Stickers Control Eli Gómez'): Promise<Blob> {
    return new Promise((resolve, reject) => {
      try {
        console.log('🖨️ Generando PDF con', pedidos.length, 'stickers');
        
        // Crear documento PDF en tamaño A4
        const pdf = new jsPDF({
          orientation: 'portrait',
          unit: 'mm',
          format: 'a4'  // 210 x 297mm
        });

        // Cargar logo
        this.cargarLogo().then((logoDataUrl) => {
          const stickersPorPagina = 8; // 2 columnas x 4 filas
          let pagina = 0;
          let isFirstPage = true;

          for (let i = 0; i < pedidos.length; i++) {
            const posicionEnPagina = i % stickersPorPagina;
            
            if (posicionEnPagina === 0 && i !== 0) {
              pdf.addPage('a4');
              pagina++;
            }

            const fila = Math.floor(posicionEnPagina / 2);
            const columna = posicionEnPagina % 2;

            // Posición en mm (márgenes pequeños)
            const margenX = 5;
            const margenY = 5;
            const anchoSticker = 100; // ~127mm / 1.27 para caber en A4
            const altoSticker = 133;  // ~178mm / 1.27 para caber en A4

            const x = margenX + (columna * (anchoSticker + 5));
            const y = margenY + (fila * (altoSticker + 5));

            this.dibujarStickerMini(pdf, pedidos[i], x, y, anchoSticker, altoSticker, logoDataUrl);
          }

          const blob = pdf.output('blob');
          resolve(blob);
          console.log('✅ PDF generado con múltiples stickers');
        }).catch((error) => {
          console.warn('⚠️ Logo no disponible, generando sin logo:', error);
          // Generar sin logo si no está disponible
          const stickersPorPagina = 8;

          for (let i = 0; i < pedidos.length; i++) {
            const posicionEnPagina = i % stickersPorPagina;
            
            if (posicionEnPagina === 0 && i !== 0) {
              pdf.addPage('a4');
            }

            const fila = Math.floor(posicionEnPagina / 2);
            const columna = posicionEnPagina % 2;

            const margenX = 5;
            const margenY = 5;
            const anchoSticker = 100;
            const altoSticker = 133;

            const x = margenX + (columna * (anchoSticker + 5));
            const y = margenY + (fila * (altoSticker + 5));

            this.dibujarStickerMini(pdf, pedidos[i], x, y, anchoSticker, altoSticker, '');
          }

          const blob = pdf.output('blob');
          resolve(blob);
        });
      } catch (error) {
        console.error('❌ Error generando PDF:', error);
        reject(error);
      }
    });
  }

  /**
   * Dibuja un sticker miniatura con todos los datos
   */
  private dibujarStickerMini(
    pdf: jsPDF,
    pedido: StickerData,
    x: number,
    y: number,
    width: number,
    height: number,
    logoDataUrl: string
  ): void {
    const margin = 1.5;
    const contentWidth = width - (margin * 2);
    const contentHeight = height - (margin * 2);

    // Fondo blanco
    pdf.setFillColor(255, 255, 255);
    pdf.rect(x, y, width, height, 'F');

    // Borde rosa (3px) - decorativo superior
    pdf.setDrawColor(236, 72, 153); // color pink-500
    pdf.setLineWidth(1.2);
    pdf.line(x, y, x + width, y);

    // Borde rosa completo (más delgado)
    pdf.setLineWidth(0.8);
    pdf.rect(x, y, width, height);

    let currentY = y + margin + 0.5;
    const contentX = x + margin + 0.5;
    const fontSize = 6;

    // ===== ENCABEZADO =====
    pdf.setFont('Helvetica', 'bold');
    pdf.setFontSize(7);
    pdf.setTextColor(236, 72, 153); // Pink heading
    pdf.text('📍 Datos de Envío', contentX, currentY);

    // Logo en esquina derecha (si existe)
    if (logoDataUrl) {
      try {
        pdf.addImage(logoDataUrl, 'JPEG', x + width - 11, y + margin + 0.5, 8, 8);
      } catch (e) {
        console.warn('No se pudo cargar el logo');
      }
    }

    currentY += 2.5;

    // Línea separadora elegante
    pdf.setDrawColor(219, 112, 147); // pink-300
    pdf.setLineWidth(0.4);
    pdf.line(contentX, currentY, contentX + contentWidth - 1, currentY);
    currentY += 1;

    pdf.setFont('Helvetica', 'normal');
    pdf.setFontSize(fontSize);
    pdf.setTextColor(55, 65, 81); // gray-700

    // Fila: Vendedora
    pdf.setFont('Helvetica', 'bold');
    pdf.setTextColor(236, 72, 153);
    pdf.text('Vendedora:', contentX, currentY);
    pdf.setFont('Helvetica', 'normal');
    pdf.setTextColor(55, 65, 81);
    pdf.text('Eli Gómez', contentX + 15, currentY);
    pdf.text('#7851-8219', x + width - margin - 18, currentY);
    currentY += 1.8;

    // Línea separadora
    pdf.setDrawColor(219, 112, 147);
    pdf.setLineWidth(0.3);
    pdf.line(contentX, currentY, contentX + contentWidth - 1, currentY);
    currentY += 1;

    // Fila: Cliente
    pdf.setFont('Helvetica', 'bold');
    pdf.setTextColor(236, 72, 153);
    pdf.text('Cliente:', contentX, currentY);
    pdf.setFont('Helvetica', 'normal');
    pdf.setTextColor(55, 65, 81);
    const clienteName = (pedido.cliente_nombre || 'N/A').substring(0, 20);
    pdf.text(clienteName, contentX + 12, currentY);
    currentY += 1.8;

    // Fila: Destino
    pdf.setFont('Helvetica', 'bold');
    pdf.setTextColor(236, 72, 153);
    pdf.text('Destino:', contentX, currentY);
    pdf.setFont('Helvetica', 'normal');
    pdf.setTextColor(55, 65, 81);
    // Si tiene dirección personalizada, mostrar eso. Si no, mostrar destino. Si no hay nada, N/A
    let destino = 'N/A';
    if (pedido.direccion_personalizada && typeof pedido.direccion_personalizada === 'string' && pedido.direccion_personalizada.trim()) {
      destino = pedido.direccion_personalizada;
    } else if (pedido.destino_id && typeof pedido.destino_id === 'string') {
      destino = pedido.destino_id;
    }
    pdf.text(destino.substring(0, 30), contentX + 12, currentY);
    currentY += 1.8;

    // Separador
    pdf.setDrawColor(219, 112, 147);
    pdf.setLineWidth(0.3);
    pdf.line(contentX, currentY, contentX + contentWidth - 1, currentY);
    currentY += 1.5;

    // Fila: Día
    pdf.setFont('Helvetica', 'bold');
    pdf.setTextColor(236, 72, 153);
    pdf.text('Día:', contentX, currentY);
    pdf.setFont('Helvetica', 'normal');
    pdf.setTextColor(55, 65, 81);
    const dia = this.traducirDia(pedido.dia_entrega || '').substring(0, 10);
    pdf.text(dia, contentX + 7, currentY);
    
    pdf.setFont('Helvetica', 'bold');
    pdf.setTextColor(236, 72, 153);
    pdf.text('Fecha:', contentX + contentWidth / 2 - 3, currentY);
    pdf.setFont('Helvetica', 'normal');
    pdf.setTextColor(55, 65, 81);
    pdf.text(this.formatearFecha(pedido.fecha_entrega_programada), contentX + contentWidth / 2 + 7, currentY);
    currentY += 1.8;

    // Fila: Hora (solo para modo normal)
    if (pedido.modo !== 'personalizado') {
      pdf.setFont('Helvetica', 'bold');
      pdf.setTextColor(236, 72, 153);
      pdf.text('Hora:', contentX, currentY);
      pdf.setFont('Helvetica', 'normal');
      pdf.setTextColor(55, 65, 81);
      pdf.text(this.formatearHora(pedido.hora_inicio, pedido.hora_fin), contentX + 7, currentY);
      currentY += 1.8;
    }

    // Separador
    pdf.setDrawColor(219, 112, 147);
    pdf.setLineWidth(0.3);
    pdf.line(contentX, currentY, contentX + contentWidth - 1, currentY);
    currentY += 1.5;

    // Fila: Total con fondo destacado
    pdf.setFillColor(245, 232, 245); // pink-50
    pdf.rect(contentX - 0.5, currentY - 1, contentWidth, 3.5, 'F');
    
    pdf.setFont('Helvetica', 'bold');
    pdf.setTextColor(236, 72, 153);
    pdf.text('Total:', contentX, currentY);
    // Calcular total como suma de costo_prendas + monto_envio
    const costoP = parseFloat(pedido.costo_prendas?.toString() || '0');
    const montoE = parseFloat(pedido.monto_envio?.toString() || '0');
    const totalAmount = costoP + montoE;
    pdf.text(`$${totalAmount.toFixed(2)}`, contentX + 10, currentY);
    currentY += 2;

    // Separador
    pdf.setDrawColor(219, 112, 147);
    pdf.setLineWidth(0.3);
    pdf.line(contentX, currentY, contentX + contentWidth - 1, currentY);
    currentY += 0.8;

    // Fila: Encomienda
    pdf.setFont('Helvetica', 'bold');
    pdf.setTextColor(236, 72, 153);
    pdf.text('Encomienda:', contentX, currentY);
    pdf.setFont('Helvetica', 'normal');
    pdf.setTextColor(55, 65, 81);
    const encomienda = (pedido.encomendista_nombre || 'N/A').substring(0, 18);
    pdf.text(encomienda, contentX + 15, currentY);
    currentY += 2.5;

    // Fila: Códigos (si existen)
    if (pedido.productos_codigos && pedido.productos_codigos.length > 0) {
      pdf.setFont('Helvetica', 'bold');
      pdf.setFontSize(6);
      pdf.setTextColor(236, 72, 153);
      const codigos = pedido.productos_codigos.slice(0, 2).join(', ');
      pdf.text(`Códigos: ${codigos.substring(0, 25)}`, contentX, currentY);
    }

    // Decoración inferior (línea de color)
    pdf.setDrawColor(236, 72, 153);
    pdf.setLineWidth(1.2);
    pdf.line(x, y + height - 0.5, x + width, y + height - 0.5);
  }

  /**
   * Carga el logo de la carpeta de assets
   */
  private cargarLogo(): Promise<string> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0);
          const dataUrl = canvas.toDataURL('image/jpeg');
          resolve(dataUrl);
        } else {
          reject('No se pudo obtener contexto del canvas');
        }
      };
      
      img.onerror = () => {
        reject('No se pudo cargar el logo');
      };
      
      img.src = this.logoUrl;
    });
  }

  /**
   * Traduce el día de entrega al español
   */
  private traducirDia(dia: string): string {
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

  /**
   * Formatea la fecha de envío
   */
  private formatearFecha(fecha: any): string {
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

  /**
   * Descarga múltiples stickers (para compatibilidad)
   */
  generarPdfStickers(pedidos: StickerData[], titulo: string = 'Stickers de Envío'): void {
    this.generarPdfStickersBon(pedidos, titulo).then(blob => {
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      const fecha = new Date().toISOString().split('T')[0];
      link.download = `Stickers_Control_Eli_Gomez_${fecha}.pdf`;
      link.click();
      URL.revokeObjectURL(url);
    });
  }

  /**
   * Genera PDF para 3 columnas (compatible)
   */
  generarPdfStickers3Columnas(pedidos: StickerData[], titulo: string = 'Stickers de Envío'): void {
    this.generarPdfStickers(pedidos, titulo);
  }

  /**
   * Formatea hora de formato 24hrs (09:00) a 12hrs (9am)
   */
  private formatearHora(horaInicio: string | undefined, horaFin: string | undefined): string {
    if (!horaInicio || !horaFin) return 'N/A';
    
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
}
