import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://eubrvlzkvzevidivsfha.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV1YnJ2bHprdnpldmlkaXZzZmhhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTgwNjA4NTgsImV4cCI6MjA3MzYzNjg1OH0.ni7Ogq-dKLvnCDzi8KvUVG2c1P7s0qY4xdF4AuvKwKk';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function fixItemNumbers() {
  console.log('Fetching Section A Materials items...\n');

  const { data: items, error: fetchError } = await supabase
    .from('lcl_template_items')
    .select('id, description, item_number, sort_order')
    .eq('section_id', 'section_a')
    .eq('subsection_id', 'section_a_materials')
    .order('sort_order', { ascending: true });

  if (fetchError) {
    console.error('Error fetching items:', fetchError.message);
    process.exit(1);
  }

  console.log('Current items (ordered by sort_order):');
  items.forEach((item, index) => {
    console.log(`  ${index}: item_number="${item.item_number}", description="${item.description}", sort_order=${item.sort_order}`);
  });
  console.log();

  console.log('Generating SQL to fix item_numbers sequentially:\n');
  let sqlStatements = [];
  
  items.forEach((item, index) => {
    const newItemNumber = (index + 1).toString();
    sqlStatements.push(`UPDATE lcl_template_items SET item_number = '${newItemNumber}' WHERE id = '${item.id}'; -- ${item.description}`);
  });

  sqlStatements.forEach(stmt => console.log(stmt));
  
  console.log('\n✅ SQL statements above will fix item numbers to be sequential 1-' + items.length);
}

fixItemNumbers().catch((error) => {
  console.error('Script failed:', error);
  process.exit(1);
});
