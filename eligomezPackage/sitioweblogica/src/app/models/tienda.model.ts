export interface Tienda {
  id?: string;
  usuario_id?: string;                // ID del usuario propietario de la tienda
  nombre_pagina: string;              // "ELI GOMEZ", "BETTYS" - Nombre que aparece en página
  nombre_perfil_reserva: string;      // "eli 1", "eli 2", "bettys" - Nombre del perfil de reserva
  nombre_perfil?: string;             // Compatibilidad: "eli 1", "eli 2", "bettys", "omar garcia"
  nombre_tienda?: string;             // Compatibilidad: "ELI GOMEZ", "BETTYS"
  imagen_url?: string;                // URL de la imagen de la página
  logo_tienda?: string;               // URL de la imagen del logo (compatibilidad)
  color_sticker: string;              // Hex color: #FF6B6B
  whatsapp_tienda?: string;           // Número de WhatsApp
  pagina_web_tienda?: string;         // URL de página web
  email?: string;
  direccion?: string;
  telefono?: string;
  activa?: boolean;
  fecha_creacion?: Date;
}
