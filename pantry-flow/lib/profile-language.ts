import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from './supabase';
import { isLocale, type Locale } from './language';

const pendingKey = (userId: string) => `pending_language:${userId}`;

export async function fetchProfileLanguage(userId: string): Promise<Locale | null> {
  const { data, error } = await supabase.from('profiles').select('language').eq('id', userId).maybeSingle();
  if (error) throw error;
  const language = (data as { language?: unknown } | null)?.language;
  return isLocale(language) ? language : null;
}

export async function saveProfileLanguage(userId: string, locale: Locale): Promise<void> {
  const { error } = await supabase.from('profiles').update({ language: locale }).eq('id', userId);
  if (error) throw error;
}

export async function getPendingLanguage(userId: string): Promise<Locale | null> {
  const value = await AsyncStorage.getItem(pendingKey(userId));
  return isLocale(value) ? value : null;
}

export async function setPendingLanguage(userId: string, locale: Locale): Promise<void> {
  await AsyncStorage.setItem(pendingKey(userId), locale);
}

export async function clearPendingLanguage(userId: string): Promise<void> {
  await AsyncStorage.removeItem(pendingKey(userId));
}
