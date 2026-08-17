export function generateUUID() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }

  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (char) => {
    const random = (Math.random() * 16) | 0;
    const value = char === 'x' ? random : (random & 0x3) | 0x8;
    return value.toString(16);
  });
}

export function generateFormNumber() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const random = String(Math.floor(Math.random() * 10000)).padStart(4, '0');
  return `EF-${year}${month}${day}-${random}`;
}

export function getToday() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function getCurrentMonth() {
  const now = new Date();
  const monthNames = [
    'January',
    'February',
    'March',
    'April',
    'May',
    'June',
    'July',
    'August',
    'September',
    'October',
    'November',
    'December',
  ];

  let monthIndex = now.getMonth();
  if (now.getDate() <= 10) {
    monthIndex = monthIndex === 0 ? 11 : monthIndex - 1;
  }

  return monthNames[monthIndex];
}

export function formatDateDisplay(dateStr) {
  if (!dateStr) return '';

  const [year, month, day] = dateStr.split('-');
  if (!year || !month || !day) return '';

  return `${day}/${month}/${year}`;
}

export function formatDateForSheets(dateStr) {
  if (!dateStr) return '';

  const [year, month, day] = dateStr.split('-');
  if (!year || !month || !day) return '';

  return `${Number(month)}/${Number(day)}/${year}`;
}

export function getPakistanTimestamp() {
  const now = new Date();
  const utc = now.getTime() + now.getTimezoneOffset() * 60000;
  const pakistanTime = new Date(utc + 5 * 60 * 60 * 1000);

  const month = pakistanTime.getMonth() + 1;
  const day = pakistanTime.getDate();
  const year = pakistanTime.getFullYear();
  const hours = pakistanTime.getHours();
  const minutes = String(pakistanTime.getMinutes()).padStart(2, '0');
  const seconds = String(pakistanTime.getSeconds()).padStart(2, '0');

  return `${month}/${day}/${year} ${hours}:${minutes}:${seconds}`;
}

export function titleCaseValue(str) {
  if (str == null) return '';

  return String(str)
    .split(' ')
    .map((word) => {
      if (!word) return word;

      if (word.length <= 2 && word === word.toUpperCase()) {
        return word;
      }

      if (/^[A-Z.]+$/.test(word) && word.includes('.')) {
        return word;
      }

      if (/^\d+$/.test(word) || /\//.test(word) || /^No\.\d+$/i.test(word)) {
        return word;
      }

      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    })
    .join(' ');
}

export function formatCNICDisplay(str) {
  if (!str) return '';

  const digits = String(str).replace(/\D/g, '').slice(0, 13);
  if (digits.length <= 5) return digits;
  if (digits.length <= 12) return `${digits.slice(0, 5)}-${digits.slice(5)}`;
  return `${digits.slice(0, 5)}-${digits.slice(5, 12)}-${digits.slice(12)}`;
}

export function formatPhoneNumber(str) {
  if (!str) return '';

  let digits = String(str).replace(/\D/g, '');

  if (digits.startsWith('3') && !digits.startsWith('0')) {
    digits = `0${digits}`;
  }

  return digits.slice(0, 11);
}

export function isEmpty(value) {
  if (value == null) return true;
  return String(value).trim() === '';
}

export function timeAgo(isoTimestamp) {
  if (!isoTimestamp) return '';

  const now = new Date();
  const then = new Date(isoTimestamp);
  const diffMs = now - then;
  const diffSeconds = Math.floor(diffMs / 1000);
  const diffMinutes = Math.floor(diffSeconds / 60);
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffSeconds < 60) return 'Just now';
  if (diffMinutes < 60) return `${diffMinutes} minute${diffMinutes === 1 ? '' : 's'} ago`;
  if (diffHours < 24) return `${diffHours} hour${diffHours === 1 ? '' : 's'} ago`;
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 2) return 'Yesterday';

  const day = String(then.getDate()).padStart(2, '0');
  const month = String(then.getMonth() + 1).padStart(2, '0');
  const year = then.getFullYear();
  return `${day}/${month}/${year}`;
}
