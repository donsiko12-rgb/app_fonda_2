// Supabase Configuration
const SUPABASE_URL = 'https://tkcwicumhasoxivshwiq.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRrY3dpY3VtaGFzb3hpdnNod2lxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzEzNzY1MDIsImV4cCI6MjA4Njk1MjUwMn0.LGsO8hBLOvYFPa6O2Uj7Tf3O58YmQ9R3dcCF1vWAARM';

// Initialize Supabase client (using 'db' to avoid conflict with window.supabase)
const db = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

console.log('✅ Supabase initialized:', SUPABASE_URL);
console.log('🔍 Testing connection to database...');

// Test connection
db.from('tables').select('count').then(result => {
    console.log('📡 Connection test result:', result);
    if (result.error) {
        console.error('❌ Supabase connection error:', result.error);
        alert('Error de conexión a Supabase: ' + result.error.message);
    } else {
        console.log('✅ Supabase connected successfully!');
    }
}).catch(err => {
    console.error('❌ Connection test failed:', err);
    alert('Error probando conexión: ' + err.message);
});
