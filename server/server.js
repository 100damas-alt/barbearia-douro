const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_FILE = path.join(__dirname, 'bookings.json');
const ADMIN_PASSWORD = 'luis123'; // Admin password

// Middleware
app.use(cors());
app.use(express.json());

// Simple session token (in production, use proper JWT or session management)
let adminToken = null;
const TOKEN_EXPIRY = 24 * 60 * 60 * 1000; // 24 hours

// Generate a simple token
function generateToken() {
  return crypto.randomBytes(32).toString('hex');
}

// Verify admin token
function verifyToken(req, res, next) {
  const token = req.headers['x-admin-token'];
  
  if (!token || token !== adminToken) {
    return res.status(401).json({ error: 'Não autorizado. Faça login primeiro.' });
  }
  
  next();
}

// Serve static files
app.use(express.static(path.join(__dirname, '../public')));

// Fallback for SPA routing if needed (though not really needed for this simple project)
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Barbearia D'Ouro server running on port ${PORT}`);
  console.log(`Website: http://localhost:${PORT}/`);
  console.log(`Admin dashboard: http://localhost:${PORT}/admin.html`);
  console.log(`Admin password: luis123`);
});

// Initialize data file
function loadBookings() {
  try {
    if (fs.existsSync(DATA_FILE)) {
      return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
    }
  } catch (error) {
    console.error('Error loading bookings:', error);
  }
  return [];
}

function saveBookings(bookings) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(bookings, null, 2));
}

// Business hours configuration
const BUSINESS_HOURS = {
  mon_fri: { morning: '09:00', lunch_start: '13:00', lunch_end: '15:00', evening: '19:00' },
  saturday: { morning: '08:00', evening: '14:00' },
  sunday: null // Closed
};

const SERVICES = {
  'classic-haircut': { name: 'Corte Clássico', price: 25, duration: 60 },
  'beard-shave': { name: 'Barba e Barbear', price: 30, duration: 45 },
  'complete-package': { name: 'Pacote Completo', price: 45, duration: 90 },
  'kids-haircut': { name: 'Corte Infantil', price: 18, duration: 30 }
};

// Check if a time slot is available (implements smart booking)
function isSlotAvailable(date, time) {
  const dayOfWeek = new Date(date).getDay();
  const timeSlot = time;
  
  // Check if business is open
  if (dayOfWeek === 0) return { available: false, reason: 'Encerrado aos domingos' };
  
  let validHours;
  if (dayOfWeek === 6) { // Saturday
    validHours = BUSINESS_HOURS.saturday;
  } else { // Monday-Friday
    validHours = BUSINESS_HOURS.mon_fri;
  }
  
  // Check morning slot
  if (timeSlot >= validHours.morning && timeSlot < validHours.lunch_start) {
    return { available: true };
  }
  
  // Check afternoon slot (Mon-Fri only)
  if (dayOfWeek !== 6 && timeSlot >= validHours.lunch_end && timeSlot <= validHours.evening) {
    return { available: true };
  }
  
  return { available: false, reason: 'Fora do horário de funcionamento' };
}

// Check for existing bookings at the same time (prevent double booking)
function hasConflictingBooking(date, time) {
  const bookings = loadBookings();
  return bookings.some(b => b.date === date && b.time === time && !b.cancelled);
}

// API Routes

// Admin login
app.post('/api/admin/login', (req, res) => {
  const { password } = req.body;
  
  if (password === ADMIN_PASSWORD) {
    adminToken = generateToken();
    return res.json({ 
      success: true, 
      token: adminToken,
      message: 'Login realizado com sucesso!'
    });
  }
  
  res.status(401).json({ error: 'Palavra-passe incorreta' });
});

// Admin logout
app.post('/api/admin/logout', (req, res) => {
  adminToken = null;
  res.json({ success: true, message: 'Logout realizado' });
});

// Check admin auth status
app.get('/api/admin/status', (req, res) => {
  const token = req.headers['x-admin-token'];
  res.json({ authenticated: token === adminToken && adminToken !== null });
});

// Get all appointments (for admin - requires auth)
app.get('/api/appointments', verifyToken, (req, res) => {
  try {
    const bookings = loadBookings();
    res.json(bookings.filter(b => !b.cancelled).sort((a, b) => 
      new Date(b.date + 'T' + b.time) - new Date(a.date + 'T' + a.time)
    ));
  } catch (error) {
    console.error('Error fetching appointments:', error);
    res.status(500).json({ error: 'Erro ao carregar marcações' });
  }
});

// Get available slots for a specific date (public - no auth needed)
app.get('/api/slots/:date', (req, res) => {
  const { date } = req.params;
  const dayOfWeek = new Date(date).getUTCDay(); // Use UTC to avoid timezone issues
  
  let timeSlots = [];
  
  if (dayOfWeek === 0) {
    return res.json({ slots: [], message: 'Encerrado aos domingos' });
  }
  
  if (dayOfWeek === 6) {
    // Saturday: 08:00-14:00
    for (let h = 8; h < 14; h++) {
      const time = `${h.toString().padStart(2, '0')}:00`;
      const timeHalf = `${h.toString().padStart(2, '0')}:30`;
      timeSlots.push({ time, available: !hasConflictingBooking(date, time) });
      timeSlots.push({ time: timeHalf, available: !hasConflictingBooking(date, timeHalf) });
    }
  } else {
    // Mon-Fri: 09:00-13:00 and 15:00-19:00
    for (let h = 9; h < 13; h++) {
      const time = `${h.toString().padStart(2, '0')}:00`;
      const timeHalf = `${h.toString().padStart(2, '0')}:30`;
      timeSlots.push({ time, available: !hasConflictingBooking(date, time) });
      timeSlots.push({ time: timeHalf, available: !hasConflictingBooking(date, timeHalf) });
    }
    for (let h = 15; h < 19; h++) {
      const time = `${h.toString().padStart(2, '0')}:00`;
      const timeHalf = `${h.toString().padStart(2, '0')}:30`;
      timeSlots.push({ time, available: !hasConflictingBooking(date, time) });
      timeSlots.push({ time: timeHalf, available: !hasConflictingBooking(date, timeHalf) });
    }
  }
  
  res.json({ slots: timeSlots });
});

// Create new appointment (public - no auth needed)
app.post('/api/appointments', (req, res) => {
  const { name, email, phone, service, date, time, notes } = req.body;
  
  // Validate required fields
  if (!name || !email || !phone || !service || !date || !time) {
    return res.status(400).json({ error: 'Por favor, preencha todos os campos obrigatórios' });
  }
  
  // Validate service
  if (!SERVICES[service]) {
    return res.status(400).json({ error: 'Serviço inválido' });
  }
  
  // Check slot availability (business hours)
  const slotCheck = isSlotAvailable(date, time);
  if (!slotCheck.available) {
    return res.status(400).json({ error: slotCheck.reason });
  }
  
  // Check for double booking
  if (hasConflictingBooking(date, time)) {
    return res.status(400).json({ 
      error: 'Este horário já está reservado. Por favor, escolha outro horário.',
      conflict: true 
    });
  }
  
  try {
    const bookings = loadBookings();
    const newBooking = {
      id: bookings.length > 0 ? Math.max(...bookings.map(b => b.id)) + 1 : 1,
      name,
      email,
      phone,
      service,
      date,
      time,
      notes: notes || '',
      created_at: new Date().toISOString(),
      cancelled: false
    };
    
    bookings.push(newBooking);
    saveBookings(bookings);
    
    res.json({ 
      success: true, 
      id: newBooking.id,
      message: 'Marcação confirmada com sucesso!'
    });
  } catch (error) {
    console.error('Error creating appointment:', error);
    res.status(500).json({ error: 'Erro ao criar marcação' });
  }
});

// Delete appointment (admin - requires auth)
app.delete('/api/appointments/:id', verifyToken, (req, res) => {
  const { id } = req.params;
  
  try {
    const bookings = loadBookings();
    const index = bookings.findIndex(b => b.id === parseInt(id));
    
    if (index === -1) {
      return res.status(404).json({ error: 'Marcação não encontrada' });
    }
    
    bookings[index].cancelled = true;
    bookings[index].cancelled_at = new Date().toISOString();
    saveBookings(bookings);
    
    res.json({ success: true, message: 'Marcação cancelada' });
  } catch (error) {
    console.error('Error deleting appointment:', error);
    res.status(500).json({ error: 'Erro ao cancelar marcação' });
  }
});

// Serve admin dashboard (requires auth)
app.get('/admin.html', (req, res) => {
  const token = req.headers['x-admin-token'];
  if (token !== adminToken) {
    return res.status(401).sendFile(path.join(__dirname, '../public/admin-login.html'));
  }
  res.sendFile(path.join(__dirname, '../public/admin.html'));
});

app.get('/admin', (req, res) => {
  const token = req.headers['x-admin-token'];
  if (token !== adminToken) {
    return res.status(401).sendFile(path.join(__dirname, '../public/admin-login.html'));
  }
  res.sendFile(path.join(__dirname, '../public/admin.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Barbearia D'Ouro server running on port ${PORT}`);
  console.log(`Website: http://localhost:${PORT}/`);
  console.log(`Admin dashboard: http://localhost:${PORT}/admin.html`);
  console.log(`Admin password: luis123`);
});