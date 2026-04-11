import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatPhoneNumber(phone: string) {
  if (!phone) return '';
  // Remove non-digits
  const cleaned = phone.replace(/\D/g, '');
  
  if (!cleaned) return phone;

  // Basic Brazilian formatting
  // Handle 55 + DDD + 8 or 9 digits
  if (cleaned.startsWith('55') && (cleaned.length === 12 || cleaned.length === 13)) {
    const ddd = cleaned.substring(2, 4);
    const number = cleaned.substring(4);
    if (number.length === 9) {
      return `+55 (${ddd}) ${number.substring(0, 5)}-${number.substring(5)}`;
    } else if (number.length === 8) {
      return `+55 (${ddd}) ${number.substring(0, 4)}-${number.substring(4)}`;
    }
  }

  // If it's a LID (WhatsApp Linked ID) - usually very long (16+ digits)
  if (cleaned.length > 15) {
    return `ID: ${cleaned}`;
  }
  
  return `+${cleaned}`;
}
