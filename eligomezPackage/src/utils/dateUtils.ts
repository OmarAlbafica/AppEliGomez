/**
 * Formatea una fecha al formato de 12 horas
 * @param date Fecha a formatear
 * @returns String con formato "DD/MM/YYYY hh:mm AM/PM"
 */
export const formatDate12Hours = (date: Date | string | null | undefined): string => {
  if (!date) return 'Sin fecha';
  
  const d = typeof date === 'string' ? new Date(date) : date;
  
  if (isNaN(d.getTime())) return 'Fecha inválida';
  
  const day = d.getDate().toString().padStart(2, '0');
  const month = (d.getMonth() + 1).toString().padStart(2, '0');
  const year = d.getFullYear();
  
  let hours = d.getHours();
  const minutes = d.getMinutes().toString().padStart(2, '0');
  const ampm = hours >= 12 ? 'PM' : 'AM';
  
  hours = hours % 12;
  hours = hours ? hours : 12; // La hora '0' debe ser '12'
  const hoursStr = hours.toString().padStart(2, '0');
  
  return `${day}/${month}/${year} ${hoursStr}:${minutes} ${ampm}`;
};

/**
 * Formatea solo la fecha sin hora
 * @param date Fecha a formatear
 * @returns String con formato "DD/MM/YYYY"
 */
export const formatDateOnly = (date: Date | string | null | undefined): string => {
  if (!date) return 'Sin fecha';
  
  const d = typeof date === 'string' ? new Date(date) : date;
  
  if (isNaN(d.getTime())) return 'Fecha inválida';
  
  const day = d.getDate().toString().padStart(2, '0');
  const month = (d.getMonth() + 1).toString().padStart(2, '0');
  const year = d.getFullYear();
  
  return `${day}/${month}/${year}`;
};

/**
 * Formatea solo la hora en formato 12 horas
 * @param date Fecha a formatear
 * @returns String con formato "hh:mm AM/PM"
 */
export const formatTimeOnly = (date: Date | string | null | undefined): string => {
  if (!date) return 'Sin hora';
  
  const d = typeof date === 'string' ? new Date(date) : date;
  
  if (isNaN(d.getTime())) return 'Hora inválida';
  
  let hours = d.getHours();
  const minutes = d.getMinutes().toString().padStart(2, '0');
  const ampm = hours >= 12 ? 'PM' : 'AM';
  
  hours = hours % 12;
  hours = hours ? hours : 12;
  const hoursStr = hours.toString().padStart(2, '0');
  
  return `${hoursStr}:${minutes} ${ampm}`;
};
