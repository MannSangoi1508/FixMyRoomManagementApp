import { supabase } from '../supabaseClient';

export function getMonday(d = new Date()) {
  const date = new Date(d);
  const day = date.getDay();
  const diff = date.getDate() - day + (day === 0 ? -6 : 1);
  date.setDate(diff);
  date.setHours(0, 0, 0, 0);
  return date;
}

export async function checkAndPerformWeeklyReset() {
  try {
    const lastReset = localStorage.getItem('lastWeeklyReset');
    const thisMonday = getMonday().toISOString();

    if (!lastReset || lastReset < thisMonday) {
      await supabase.rpc('reset_weekly_counts');
      localStorage.setItem('lastWeeklyReset', thisMonday);
      console.log('Weekly reset performed');
    }
  } catch (error) {
    console.error('Error performing weekly reset:', error);
  }
}
