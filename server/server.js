const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

// Twilio SDK - installed via npm install twilio
let twilioClient = null;
try {
  if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN) {
    const twilio = require('twilio');
    twilioClient = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
    console.log('Twilio client initialized');
  }
} catch (e) {
  console.log('Twilio not available:', e.message);
}

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_FILE = path.join(__dirname, 'bookings.json');
const MESSAGES_FILE = path.join(__dirname, 'messages.json');
const BARBERS_FILE = path.join(__dirname, 'barbers.json');
const ADMIN_PASSWORD = 'luis123';

// FIXED SMS template - managed service, not editable
const SMS_TEMPLATE = 'Olá! Vimos que nos ligou. Pode marcar o seu corte diretamente no nosso site: https://barbearia-douro.onrender.com';

// ============ Data Storage ============

function loadBarbers() {
  try {
    if (fs.existsSync(BARBERS_FILE)) {
      return JSON.parse(fs.readFileSync(BARBERS_FILE, 'utf8'));
    }
  } catch (error) {
    console.error('Error loading barbers:', error);
  }
  const defaultBarbers = [
    { id: 'miranda', name: 'Miranda', active: true, holidays: [] },
    { id: 'ricardo', name: 'Ricardo', active: true, holidays: [] },
    { id: 'duarte', name: 'Duarte', active: true, holidays: [] },
    { id: 'eduardo', name: 'Eduardo', active: true, holidays: [] },
    { id: 'joao', name: 'João', active: true, holidays: [] },
    { id: 'alex', name: 'Alex', active: true, holidays: [] }
  ];
  return defaultBarbers;
}

function saveBarbers(barbers) {
  fs.writeFileSync(BARBERS_FILE, JSON.stringify(barbers, null, 2));
}

// Middleware
app.use(cors());
app.use(express.json());

// Simple session token
let adminToken = null;

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

// ============ Data Storage ============

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

function loadMessages() {
  try {
    if (fs.existsSync(MESSAGES_FILE)) {
      return JSON.parse(fs.readFileSync(MESSAGES_FILE, 'utf8'));
    }
  } catch (error) {
    console.error('Error loading messages:', error);
  }
  return [];
}

function saveMessages(messages) {
  fs.writeFileSync(MESSAGES_FILE, JSON.stringify(messages, null, 2));
}

// ============ Twilio SMS Helper ============

async function sendSms(to, message) {
  if (!twilioClient) {
    console.log('Twilio not configured. SMS would be sent to:', to);
    return { success: false, error: 'Twilio not configured' };
  }

  try {
    const from = process.env.TWILIO_FROM_NUMBER || 'BDOURO';
    
    const result = await twilioClient.messages.create({
      body: message,
      from: from,
      to: to
    });
    
    return { success: true, sid: result.sid, status: result.status };
  } catch (error) {
    console.error('Error sending SMS:', error);
    return { success: false, error: error.message };
  }
}

// ============ Business Hours ============

const BUSINESS_HOURS = {
  mon_fri: { morning: '09:00', lunch_start: '13:00', lunch_end: '15:00', evening: '19:00' },
  saturday: { morning: '08:00', evening: '14:00' },
  sunday: null
};

const SERVICES = {
  'classic-haircut': { name: 'Corte Clássico', price: 25, duration: 60 },
  'beard-shave': { name: 'Barba e Barbear', price: 30, duration: 45 },
  'complete-package': { name: 'Pacote Completo', price: 45, duration: 90 },
  'kids-haircut': { name: 'Corte Infantil', price: 18, duration: 30 }
};

function isSlotAvailable(date, time) {
  const dayOfWeek = new Date(date).getDay();
  const timeSlot = time;
  
  if (dayOfWeek === 0) return { available: false, reason: 'Encerrado aos domingos' };
  
  let validHours;
  if (dayOfWeek === 6) {
    validHours = BUSINESS_HOURS.saturday;
  } else {
    validHours = BUSINESS_HOURS.mon_fri;
  }
  
  if (timeSlot >= validHours.morning && timeSlot < validHours.lunch_start) {
    return { available: true };
  }
  
  if (dayOfWeek !== 6 && timeSlot >= validHours.lunch_end && timeSlot <= validHours.evening) {
    return { available: true };
  }
  
  return { available: false, reason: 'Fora do horário de funcionamento' };
}

// Check for conflicting booking - now checks by barber
function hasConflictingBooking(date, time, barber) {
  const bookings = loadBookings();
  return bookings.some(b => 
    b.date === date && b.time === time && b.barber === barber && !b.cancelled
  );
}

// ============ API Routes ============

// Admin login
app.post('/api/admin/login', (req, res) => {
  const { password } = req.body;
  
  if (password === ADMIN_PASSWORD) {
    adminToken = generateToken();
    return res.json({ success: true, token: adminToken, message: 'Login realizado com sucesso!' });
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

// Get barbers list
app.get('/api/barbers', (req, res) => {
  const barbers = loadBarbers();
  // If admin token provided, return all. Otherwise only active.
  const token = req.headers['x-admin-token'];
  if (token && token === adminToken) {
    return res.json(barbers);
  }
  res.json(barbers.filter(b => b.active));
});

// Update barber status or holidays (admin only)
app.patch('/api/barbers/:id', verifyToken, (req, res) => {
  const { id } = req.params;
  const { active, holidays } = req.body;
  
  const barbers = loadBarbers();
  const index = barbers.findIndex(b => b.id === id);
  
  if (index === -1) {
    return res.status(404).json({ error: 'Barbeiro não encontrado' });
  }
  
  if (active !== undefined) barbers[index].active = active;
  if (holidays !== undefined) barbers[index].holidays = holidays;
  
  saveBarbers(barbers);
  
  res.json({ success: true, barber: barbers[index] });
});

// Get all appointments
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

function isBarberOnHoliday(barber, date) {
  if (!barber.holidays || !Array.isArray(barber.holidays)) return false;
  
  const checkDate = new Date(date + 'T00:00:00');
  return barber.holidays.some(h => {
    const start = new Date(h.start + 'T00:00:00');
    const end = new Date(h.end + 'T00:00:00');
    return checkDate >= start && checkDate <= end;
  });
}

// Get available slots - updated to accept barber parameter
app.get('/api/slots/:date', (req, res) => {
  const { date } = req.params;
  const { barber } = req.query; // Optional barber filter
  
  const barbers = loadBarbers();
  if (barber) {
    const b = barbers.find(x => x.id === barber);
    if (b && (b.active === false || isBarberOnHoliday(b, date))) {
      return res.json({ slots: [], message: 'O barbeiro selecionado está de férias ou indisponível nesta data.' });
    }
  }

  const dayOfWeek = new Date(date).getUTCDay();
  
  let timeSlots = [];
  
  if (dayOfWeek === 0) {
    return res.json({ slots: [], message: 'Encerrado aos domingos' });
  }
  
  if (dayOfWeek === 6) {
    for (let h = 8; h < 14; h++) {
      const time = `${h.toString().padStart(2, '0')}:00`;
      const timeHalf = `${h.toString().padStart(2, '0')}:30`;
      const barberCheck = barber || null;
      timeSlots.push({ time, available: !hasConflictingBooking(date, time, barberCheck) });
      timeSlots.push({ time: timeHalf, available: !hasConflictingBooking(date, timeHalf, barberCheck) });
    }
  } else {
    for (let h = 9; h < 13; h++) {
      const time = `${h.toString().padStart(2, '0')}:00`;
      const timeHalf = `${h.toString().padStart(2, '0')}:30`;
      const barberCheck = barber || null;
      timeSlots.push({ time, available: !hasConflictingBooking(date, time, barberCheck) });
      timeSlots.push({ time: timeHalf, available: !hasConflictingBooking(date, timeHalf, barberCheck) });
    }
    for (let h = 15; h < 19; h++) {
      const time = `${h.toString().padStart(2, '0')}:00`;
      const timeHalf = `${h.toString().padStart(2, '0')}:30`;
      const barberCheck = barber || null;
      timeSlots.push({ time, available: !hasConflictingBooking(date, time, barberCheck) });
      timeSlots.push({ time: timeHalf, available: !hasConflictingBooking(date, timeHalf, barberCheck) });
    }
  }
  
  res.json({ slots: timeSlots });
});

// Create new appointment - updated to include barber
app.post('/api/appointments', (req, res) => {
  const { name, email, phone, service, date, time, notes, barber } = req.body;
  
  if (!name || !email || !phone || !service || !date || !time) {
    return res.status(400).json({ error: 'Por favor, preencha todos os campos obrigatórios' });
  }
  
  if (!SERVICES[service]) {
    return res.status(400).json({ error: 'Serviço inválido' });
  }
  
  // Validate barber if provided
  const barbers = loadBarbers();
  const barberId = barber || (barbers.find(b => b.active) || barbers[0]).id; // Default to first active barber
  const barberInfo = barbers.find(b => b.id === barberId);
  
  if (!barberInfo || !barberInfo.active || isBarberOnHoliday(barberInfo, date)) {
    return res.status(400).json({ error: 'Barbeiro indisponível nesta data (férias ou inativo)' });
  }
  
  const slotCheck = isSlotAvailable(date, time);
  if (!slotCheck.available) {
    return res.status(400).json({ error: slotCheck.reason });
  }
  
  if (hasConflictingBooking(date, time, barberId)) {
    return res.status(400).json({ error: 'Este horário já está reservado para este barbeiro.', conflict: true });
  }
  
  try {
    const bookings = loadBookings();
    const newBooking = {
      id: bookings.length > 0 ? Math.max(...bookings.map(b => b.id)) + 1 : 1,
      name, email, phone, service, date, time,
      notes: notes || '',
      barber: barberId,
      barberName: barberInfo.name,
      created_at: new Date().toISOString(),
      cancelled: false
    };
    
    bookings.push(newBooking);
    saveBookings(bookings);
    
    res.json({ success: true, id: newBooking.id, message: 'Marcação confirmada com sucesso!' });
  } catch (error) {
    console.error('Error creating appointment:', error);
    res.status(500).json({ error: 'Erro ao criar marcação' });
  }
});

// Delete appointment
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

// ============ SMS / Messages Routes ============

// Get messages history (admin only)
app.get('/api/messages', verifyToken, (req, res) => {
  try {
    const messages = loadMessages();
    res.json(messages.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)));
  } catch (error) {
    console.error('Error loading messages:', error);
    res.status(500).json({ error: 'Erro ao carregar mensagens' });
  }
});

// Get Twilio status (admin only)
app.get('/api/twilio/status', verifyToken, (req, res) => {
  res.json({ 
    configured: !!twilioClient,
    template: SMS_TEMPLATE
  });
});

// Missed call endpoint - triggers SMS auto-reply (no auth for MacroDroid)
app.post('/api/missed-call', async (req, res) => {
  const { phone, callerName } = req.body;
  
  if (!phone) {
    return res.status(400).json({ error: 'Número de telefone é obrigatório' });
  }
  
  const messages = loadMessages();
  
  // Log the missed call
  const msgRecord = {
    id: messages.length > 0 ? Math.max(...messages.map(m => m.id)) + 1 : 1,
    phone,
    callerName: callerName || 'Unknown',
    timestamp: new Date().toISOString(),
    smsSent: false,
    smsSid: null,
    smsStatus: null,
    smsError: null
  };
  
  // Send SMS using the FIXED managed template
  const result = await sendSms(phone, SMS_TEMPLATE);
  
  msgRecord.smsSent = result.success;
  msgRecord.smsSid = result.sid || null;
  msgRecord.smsStatus = result.status || null;
  msgRecord.smsError = result.error || null;
  
  messages.push(msgRecord);
  saveMessages(messages);
  
  res.json({ 
    success: true, 
    smsSent: msgRecord.smsSent,
    message: msgRecord.smsSent ? 'SMS enviado com sucesso' : 'Erro ao enviar SMS'
  });
});

// ============ Admin Dashboard Routes ============

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

// Catch-all route
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Barbearia D'Ouro server running on port ${PORT}`);
  console.log(`Website: http://localhost:${PORT}/`);
  console.log(`Admin dashboard: http://localhost:${PORT}/admin.html`);
  console.log(`Admin password: luis123`);
  console.log(`Twilio configured: ${twilioClient ? 'Yes' : 'No'}`);
  console.log(`Barbers: ${loadBarbers().map(b => b.name).join(', ')}`);
});// Force redeploy comment
// Triggering redeploy at Fri May  1 00:34:08 UTC 2026
