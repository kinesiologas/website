import categories from '../data/categories.json';

import { supabase } from '../lib/supabaseClient.js';

const CATEGORY_COLUMNS = ['id', 'label', 'sort_order'].join(', ');

const categoriesTable = import.meta.env.VITE_SUPABASE_CATEGORIES_TABLE || 'categories';

function getLocalCategories() {
  return categories;
}

export async function getCategories() {
  if (!supabase) {
    return getLocalCategories();
  }

  try {
    const { data, error } = await supabase
      .from(categoriesTable)
      .select(CATEGORY_COLUMNS)
      .order('sort_order', { ascending: true, nullsFirst: false })
      .order('label', { ascending: true });

    if (error) {
      throw error;
    }

    return data?.length ? data.map(({ id, label }) => ({ id, label })) : getLocalCategories();
  } catch (error) {
    console.warn('Supabase categories unavailable. Using local data.', error);
    return getLocalCategories();
  }
}
