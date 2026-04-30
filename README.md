# Barbearia D'Ouro - Website with Booking System

## Summary of Changes

### 1. Portuguese Translation
All website content has been translated to Portuguese:
- Navigation menu items (Início, Serviços, Galeria, Sobre, Contacto, Marcar)
- Hero section tagline ("Onde a tradição encontra a excelência")
- Service descriptions
- About section text
- Contact information and hours
- All form labels and error messages
- Footer content

### 2. Opening Hours (Updated)
- **Segunda – Sexta (Mon-Fri):** 09:00 – 13:00 | 15:00 – 19:00
- **Sábado (Saturday):** 08:00 – 14:00
- **Domingo (Sunday):** Encerrado (Closed)

### 3. Smart Booking System
- Double-booking prevention: Cannot book same date/time slot twice
- Real-time availability checking via API
- Business hours enforcement (lunch break respected for Mon-Fri)
- Weekend hours respected for Saturday
- Sunday closure enforced

### 4. Admin Dashboard with Password Protection
- Access via `/admin.html` or `/admin`
- **Password:** `luis123`
- Login page at `/admin-login.html`
- View all appointments with details (name, email, phone, service, date, time, notes)
- Filter appointments by date or service type
- Delete/cancel appointments
- Statistics overview (total, today, this week, this month)
- Session-based authentication with token

## Files Created

```
website-project/
├── public/
│   ├── index.html          # Translated Portuguese website
│   ├── admin.html          # Admin dashboard (protected)
│   ├── admin-login.html    # Admin login page
│   ├── brand/              # Logo assets
│   └── images/             # Website images
└── server/
    ├── package.json        # Node.js dependencies
    └── server.js           # Express API server
```

## Deployment Instructions

1. Extract the tar.gz file
2. Navigate to `server` directory
3. Run `npm install`
4. Run `npm start`
5. Website will be available at `http://yourdomain.com:3000/`
6. Admin dashboard at `http://yourdomain.com:3000/admin.html`

## Cloud Readiness
- Uses `PORT` environment variable (defaults to 3000)
- No database required - JSON file storage
- Stateless token-based auth
- CORS enabled for cross-origin requests
- Binds to `0.0.0.0` for external access

## API Endpoints

Public:
- `GET /api/slots/:date` - Get available time slots for a date
- `POST /api/appointments` - Create new appointment

Admin (requires `x-admin-token` header):
- `POST /api/admin/login` - Admin login
- `POST /api/admin/logout` - Admin logout
- `GET /api/admin/status` - Check auth status
- `GET /api/appointments` - List all appointments
- `DELETE /api/appointments/:id` - Cancel appointment

## Notes
- Data stored in `server/bookings.json`
- Admin token stored in localStorage
- Token valid for server session (restart clears tokens)