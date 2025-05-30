import express from 'express';
import cors from 'cors';
import nodemailer from 'nodemailer';
import dotenv from 'dotenv';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet'; // Additional security headers

dotenv.config();

// Validate required environment variables
const requiredEnvVars = ['MAIL_USER', 'MAIL_PASS'];
for (const envVar of requiredEnvVars) {
  if (!process.env[envVar]) {
    console.error(`Missing required environment variable: ${envVar}`);
    process.exit(1);
  }
}

const app = express();
const PORT = process.env.PORT || 5500;

// Security middleware
app.use(helmet()); // Adds various security headers
app.disable('x-powered-by');

// Enhanced CORS configuration
const corsOptions = {
  origin: [
    'https://sanjaykumar-tech.github.io',
    'http://localhost:3000' // For local testing
  ],
  methods: ['POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type'],
  optionsSuccessStatus: 200 // For legacy browser support
};
app.use(cors(corsOptions));

// Body parsing with size limit
app.use(express.json({ limit: '10kb' }));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 50,
  message: 'Too many requests from this IP, please try again later',
  standardHeaders: true,
  legacyHeaders: false
});
app.use('/send', limiter);

// Basic request sanitization
const sanitizeInput = (req, res, next) => {
  for (const [key, value] of Object.entries(req.body)) {
    if (typeof value === 'string') {
      req.body[key] = value.replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }
  }
  next();
};

// Input validation middleware
const validateContactInput = (req, res, next) => {
  const { name, email, subject, phone, message } = req.body;
  
  if (!name || !email || !subject || !phone || !message) {
    return res.status(400).json({ error: 'All fields are required' });
  }
  
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: 'Invalid email format' });
  }
  
  if (message.length > 1000) {
    return res.status(400).json({ error: 'Message too long (max 1000 chars)' });
  }
  
  if (phone.length > 20) {
    return res.status(400).json({ error: 'Phone number too long' });
  }
  
  next();
};

// POST route with validation and sanitization
app.post('/send', sanitizeInput, validateContactInput, async (req, res) => {
  const { name, email, subject, phone, message } = req.body;

  // Configure transporter with better options
  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.MAIL_USER,
      pass: process.env.MAIL_PASS
    },
    pool: true,
    maxConnections: 5,
    maxMessages: 10
  });

  const mailOptions = {
    from: `"Portfolio Contact" <${process.env.MAIL_USER}>`,
    replyTo: email,
    to: process.env.RECIPIENT_EMAIL || 'sanjaykumar.techdev@gmail.com',
    subject: `Portfolio Contact: ${subject.substring(0, 100)}`, // Limit subject length
    text: `Name: ${name}\nEmail: ${email}\nPhone: ${phone}\n\nMessage:\n${message}`,
    html: `
      <h2>New Contact Form Submission</h2>
      <p><strong>Name:</strong> ${name}</p>
      <p><strong>Email:</strong> ${email}</p>
      <p><strong>Phone:</strong> ${phone}</p>
      <p><strong>Subject:</strong> ${subject}</p>
      <h3>Message:</h3>
      <p>${message.replace(/\n/g, '<br>')}</p>
    `
  };

  try {
    await transporter.sendMail(mailOptions);
    res.status(200).json({ 
      success: true,
      message: 'Message sent successfully' 
    });
  } catch (error) {
    console.error('Email send error:', error);
    
    let errorMessage = 'Failed to send message. Please try again later.';
    if (error.code === 'EAUTH') {
      errorMessage = 'Authentication failed. Please check email settings.';
    } else if (error.code === 'EENVELOPE') {
      errorMessage = 'Invalid email parameters.';
    }
    
    res.status(500).json({ 
      success: false,
      error: errorMessage 
    });
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ 
    status: 'healthy',
    timestamp: new Date().toISOString()
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ 
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  if (process.env.NODE_ENV === 'production') {
    console.log('Running in production mode');
  }
});