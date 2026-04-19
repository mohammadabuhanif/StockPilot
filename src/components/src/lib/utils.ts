import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { format } from 'date-fns';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatAppTime(date: Date, includeSeconds = true) {
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  // Bangladesh uses 12-hour format (12:00 PM then 01:00 PM)
  const isBangladesh = timeZone === 'Asia/Dhaka';
  
  const pattern = isBangladesh 
    ? (includeSeconds ? 'hh:mm:ss a' : 'hh:mm a')
    : (includeSeconds ? 'HH:mm:ss' : 'HH:mm');
    
  return format(date, pattern);
}

export function formatAppDateTime(date: Date) {
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const isBangladesh = timeZone === 'Asia/Dhaka';
  
  const pattern = isBangladesh 
    ? 'MMM dd, yyyy • hh:mm a'
    : 'MMM dd, yyyy • HH:mm';
    
  return format(date, pattern);
}
