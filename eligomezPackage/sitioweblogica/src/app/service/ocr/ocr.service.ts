import { Injectable } from '@angular/core';
import Tesseract from 'tesseract.js';
import { BehaviorSubject, Observable } from 'rxjs';

export interface TextoExtraido {
  texto_bruto: string;
  destino?: string;
  hora?: string;
  dia?: string;
  confianza: number;
}

@Injectable({
  providedIn: 'root'
})
export class OcrService {
  private progreso = new BehaviorSubject<number>(0);
  public progreso$ = this.progreso.asObservable();

  private resultados = new BehaviorSubject<TextoExtraido[]>([]);
  public resultados$ = this.resultados.asObservable();

  // Palabras clave para detectar días
  private diasSemana = ['lunes', 'martes', 'miercoles', 'miércoles', 'jueves', 'viernes', 'sabado', 'sábado', 'domingo'];
  
  // Palabras clave para detectar horas
  private patronHora = /(\d{1,2}):(\d{2})\s*(?:am|pm|a\.m|p\.m|AM|PM|A\.M|P\.M)?/i;

  constructor() {}

  /**
   * Extrae texto de múltiples imágenes usando OCR - Retorna Observable
   */
  procesarImagenes(archivos: File[]): Observable<TextoExtraido[]> {
    return new Observable(observer => {
      this.procesarImagenesInterno(archivos, observer);
    });
  }

  /**
   * Procesamiento interno de imágenes
   */
  private async procesarImagenesInterno(archivos: File[], observer: any): Promise<void> {
    const resultados: TextoExtraido[] = [];
    const totalArchivos = archivos.length;

    for (let i = 0; i < totalArchivos; i++) {
      try {
        const imagen = archivos[i];
        const texto = await this.extraerTextoDeImagen(imagen);
        
        // Procesar y extraer información relevante
        const textoProcessado = this.procesarTexto(texto);
        resultados.push(textoProcessado);

        // Actualizar progreso
        const porcentaje = Math.round(((i + 1) / totalArchivos) * 100);
        this.progreso.next(porcentaje);
      } catch (error) {
        console.error('Error procesando imagen:', error);
      }
    }

    // Limpiar progreso y retornar resultados
    this.progreso.next(0);
    observer.next(resultados);
    observer.complete();
  }

  /**
   * Extrae texto de una sola imagen (público)
   */
  async extraerTexto(archivo: File): Promise<string> {
    return this.extraerTextoDeImagen(archivo);
  }

  /**
   * Extrae texto de una sola imagen (privado)
   */
  private async extraerTextoDeImagen(archivo: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();

      reader.onerror = () => {
        reject(new Error('Error al leer el archivo'));
      };

      reader.onload = async (e) => {
        try {
          const imagen = e.target?.result as string;

          if (!imagen) {
            reject(new Error('No se pudo cargar la imagen'));
            return;
          }

          console.log('Iniciando OCR para:', archivo.name);

          // Usar Tesseract para extraer texto
          const result = await Tesseract.recognize(imagen, 'spa+eng', {
            logger: (m) => {
              console.log('Estado OCR:', m.status, 'Progreso:', Math.round(m.progress * 100) + '%');
            }
          });

          const texto = result.data.text;
          console.log('Texto extraído:', texto.substring(0, 200));

          if (!texto || texto.trim().length === 0) {
            reject(new Error('No se extrajo texto de la imagen'));
          } else {
            resolve(texto);
          }
        } catch (error) {
          console.error('Error en OCR:', error);
          reject(error);
        }
      };

      reader.onerror = () => {
        reject(new Error('No se pudo leer el archivo'));
      };

      reader.readAsDataURL(archivo);
    });
  }

  /**
   * Procesa el texto extraído para encontrar destino, hora y día
   */
  private procesarTexto(texto: string): TextoExtraido {
    const textoLimpio = texto.trim();
    
    // Extraer hora
    const horaMatch = textoLimpio.match(this.patronHora);
    const hora = horaMatch ? `${horaMatch[1]}:${horaMatch[2]}` : undefined;

    // Extraer día
    let dia: string | undefined;
    for (const diaSemana of this.diasSemana) {
      if (textoLimpio.toLowerCase().includes(diaSemana)) {
        dia = this.normalizarDia(diaSemana);
        break;
      }
    }

    // Extraer destino (primera línea o línea con más caracteres)
    const lineas = textoLimpio.split('\n').filter(l => l.trim().length > 3);
    const destino = lineas.length > 0 ? lineas[0].substring(0, 50) : undefined;

    return {
      texto_bruto: textoLimpio,
      destino,
      hora,
      dia,
      confianza: this.calcularConfianza(horaMatch ? 1 : 0, dia ? 1 : 0)
    };
  }

  /**
   * Normaliza los nombres de los días
   */
  private normalizarDia(dia: string): string {
    const dias: { [key: string]: string } = {
      'lunes': 'Lunes',
      'martes': 'Martes',
      'miercoles': 'Miércoles',
      'miércoles': 'Miércoles',
      'jueves': 'Jueves',
      'viernes': 'Viernes',
      'sabado': 'Sábado',
      'sábado': 'Sábado',
      'domingo': 'Domingo'
    };
    return dias[dia.toLowerCase()] || dia;
  }

  /**
   * Calcula el nivel de confianza en la extracción
   */
  private calcularConfianza(tieneHora: number, tieneDia: number): number {
    return Math.min(100, 50 + (tieneHora * 25) + (tieneDia * 25));
  }

  /**
   * Extrae precio de una imagen usando OCR
   * Busca patrones de precio como $10.75, $50, etc.
   */
  async extraerPrecioDeImagen(imageFile: File): Promise<number | null> {
    try {
      const resultado = await Tesseract.recognize(imageFile, 'eng');
      const texto = resultado.data.text.toLowerCase();
      
      // Patrones de precio: $XX.XX, $XX, XX.XX, etc.
      const patronPrecio = /\$?\s*(\d+(?:[.,]\d{2})?)\s*(?:USD|CLP|$)?/gi;
      const precios: number[] = [];
      
      let match;
      while ((match = patronPrecio.exec(texto)) !== null) {
        const precioStr = match[1].replace(',', '.');
        const precio = parseFloat(precioStr);
        
        // Validar que sea un precio razonable (entre $1 y $10000)
        if (!isNaN(precio) && precio > 0.5 && precio < 10000) {
          precios.push(precio);
        }
      }
      
      // Retornar el precio encontrado o null
      return precios.length > 0 ? precios[0] : null;
    } catch (error) {
      console.error('Error al extraer precio:', error);
      return null;
    }
  }

  /**
   * Limpia el progreso
   */
  limpiarProgreso(): void {
    this.progreso.next(0);
    this.resultados.next([]);
  }
}
