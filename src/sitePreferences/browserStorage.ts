export const guestLocaleKey = 'katana-site-locale';
export const guestThemeKey = 'katana-site-theme';

export function readGuestPreference(key: string) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function writeGuestPreference(key: string, value: string | null) {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {
    // 端末への保存が拒否されても、現在の画面には選択を適用する。
  }
}
