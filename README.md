# Barbearia D'Ouro - Website with Booking System

## Summary

### Features
1. **Portuguese Translation** - Full website in Portuguese
2. **Opening Hours** - Mon-Fri (09:00-13:00, 15:00-19:00), Sat (08:00-14:00), Sun (Closed)
3. **Smart Booking** - Double-booking prevention, real-time availability
4. **Admin Dashboard** - Password protected, appointment management
5. **SMS Auto-reply** - Twilio integration for missed calls (managed service)

### Admin Access
- **URL:** `/admin.html`
- **Password:** `luis123`

## Deployment

### Local
```bash
cd server
npm install
npm start
```

### Cloud (Render, Railway, etc.)
Set environment variables in your cloud dashboard:
- `PORT` - (optional, defaults to 3000)
- `TWILIO_ACCOUNT_SID` - Your Twilio Account SID
- `TWILIO_AUTH_TOKEN` - Your Twilio Auth Token
- `TWILIO_FROM_NUMBER` - Alphanumeric Sender ID (e.g., 'BDOURO')

## ⚠️ IMPORTANT: Twilio Configuration

**You must set the following environment variables for SMS to work:**

| Variable | Description | Example |
|----------|-------------|---------|
| `TWILIO_ACCOUNT_SID` | Twilio Account SID | `ACxxxxxxxxxx` |
| `TWILIO_AUTH_TOKEN` | Twilio Auth Token | `xxxxxxxxxx` |
| `TWILIO_FROM_NUMBER` | Alphanumeric Sender ID | `BDOURO` |

Without these variables, the server will log SMS messages but not actually send them.

## SMS Auto-reply (Managed Service)

The SMS feature is a **managed service**. The barber (client) only has read-only access to the message history via the "Histórico de Mensagens" tab in the admin dashboard. They CANNOT:
- Enable/disable the feature
- Change the SMS template

This ensures the business owner retains full control over the service.

### SMS Endpoint
- `POST /api/missed-call` - Called by MacroDroid to trigger SMS
  - Body: `{ phone: "+351900000000", callerName: "Optional" }`

### SMS Template
Default message (managed, not editable via UI):
```
Olá! Vimos que nos ligou. Pode marcar o seu corte diretamente no nosso site: https://barbearia-douro.onrender.com
```

## API Endpoints

### Public
- `GET /api/slots/:date` - Available time slots
- `POST /api/appointments` - Book appointment
- `POST /api/missed-call` - Trigger SMS auto-reply (MacroDroid)

### Admin (requires token)
- `POST /api/admin/login` - Login
- `GET /api/appointments` - List appointments
- `DELETE /api/appointments/:id` - Cancel appointment
- `GET /api/messages` - Message history

## Files
```
website-project/
├── public/
│   ├── index.html          # Website
│   ├── admin.html          # Admin dashboard
│   ├── admin-login.html    # Login page
│   ├── brand/              # Logo
│   └── images/             # Images
└── server/
    ├── package.json
    ├── server.js
    ├── bookings.json        # Appointment data
    └── messages.json       # SMS log
```