import categories from '../data/categories.json';
import { supabase } from '../lib/supabaseClient.js';
import { runSupabaseQuery } from '../lib/supabaseQuery.js';

const CATEGORY_COLUMNS = ['id', 'label', 'sort_order', 'active'].join(', ');

const categoriesTable = import.meta.env.VITE_SUPABASE_CATEGORIES_TABLE || 'categories';

function getLocalCategories() {
  return categories;
}

export async function getCategories() {
  if (!supabase) {
    return getLocalCategories();
  }

  try {
    const { data, error } = await runSupabaseQuery(
      supabase
        .from(categoriesTable)
        .select(CATEGORY_COLUMNS)
        .order('sort_order', { ascending: true, nullsFirst: false })
        .order('label', { ascending: true }),
      'Supabase categories',
    );

    if (error) {
      throw error;
    }

    return data?.length
      ? data
          .filter((category) => category.active !== false)
          .map(({ id, label }) => ({ id, label }))
      : getLocalCategories();
  } catch (error) {
    console.warn('Supabase categories unavailable. Using local data.', error);
    return getLocalCategories();
  }
}
