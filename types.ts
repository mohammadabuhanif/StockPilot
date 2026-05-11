import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { format } from 'date-fns';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatAppTime(dateIn: any, includeSeconds = true) {
  try {
    const date = dateIn instanceof Date ? dateIn : new Date(dateIn);
    if (isNaN(date.getTime())) return 'Unknown time';
    const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const isBangladesh = timeZone === 'Asia/Dhaka';
    
    const pattern = isBangladesh 
      ? (includeSeconds ? 'hh:mm:ss a' : 'hh:mm a')
      : (includeSeconds ? 'HH:mm:ss' : 'HH:mm');
      
    return format(date, pattern);
  } catch (e) {
    return 'Unknown time';
  }
}

export function formatAppDateTime(dateIn: any) {
  try {
    const date = dateIn instanceof Date ? dateIn : new Date(dateIn);
    if (isNaN(date.getTime())) return 'Unknown date/time';
    const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const isBangladesh = timeZone === 'Asia/Dhaka';
    
    const pattern = isBangladesh 
      ? 'MMM dd, yyyy • hh:mm a'
      : 'MMM dd, yyyy • HH:mm';
      
    return format(date, pattern);
  } catch(e) {
    return 'Unknown date/time';
  }
}
