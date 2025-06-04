// Updated and improved backend code
import express from 'express';
import cors from 'cors';
import nodemailer from 'nodemailer';
import dotenv from 'dotenv';
import { rateLimit } from 'express-rate-limit';
import helmet from 'helmet';

dotenv.config();

// Enhanced environment validation
const requiredEnvVars = ['MAIL_USER', 'MAIL_PASS', 'ALLOWED_ORIGINS'];
const missingVars = requiredEnvVars.filter(v => !process.env[v]);
if (missingVars.length) {
  console.error('Missing required environment variables:', missingVars.join(', '));
  process.exit(1);
}

const app = express();
const PORT = process.env.PORT || 5500;

// Security middleware with updated CSP
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'", "https://sanjaykumar-tech.github.io/portfolio_frontend/"],
      scriptSrc: ["'self'", "https://sanjaykumar-tech.github.io/portfolio_frontend/"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:"],
      connectSrc: ["'self'", process.env.ALLOWED_ORIGINS]
    }
  }
}));
app.disable('x-powered-by');

// Enhanced CORS configuration
const allowedOrigins = process.env.ALLOWED_ORIGINS.split(',').map(o => o.trim());
app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      console.warn(`Blocked by CORS: ${origin}`);
      callback(new Error('Not allowed by CORS'));
    }
  },
  methods: ['POST'],
  allowedHeaders: ['Content-Type']
}));

// Body parsing with better error handling
app.use(express.json({ 
  limit: '10kb',
  verify: (req, res, buf) => {
    try {
      JSON.parse(buf.toString());
    } catch (e) {
      throw new Error('Invalid JSON');
    }
  }
}));

// Rate limiting with IP tracking
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30, // Reduced from 50 to prevent abuse
  handler: (req, res) => {
    res.status(429).json({
      error: 'Too many requests',
      retryAfter: req.rateLimit.resetTime
    });
  }
});
app.use('/send', limiter);

// Enhanced email transporter with debugging
const transporter = nodemailer.createTransport({
  service: 'gmail',
  host: 'smtp.gmail.com',
  port: 587,
  secure: false, // true for 465, false for other ports
  auth: {
    user: process.env.MAIL_USER,
    pass: process.env.MAIL_PASS
  },
  tls: {
    rejectUnauthorized: false
  },
  logger: true, // Enable logging
  debug: true // Include SMTP traffic in logs
});

// Verify connection with retry logic
const verifyTransporter = async () => {
  try {
    await transporter.verify();
    console.log('SMTP connection verified');
  } catch (error) {
    console.error('SMTP verification failed:', error);
    setTimeout(verifyTransporter, 5000); // Retry after 5 seconds
  }
};
verifyTransporter();

// Enhanced contact endpoint
app.post('/send', async (req, res) => {
  try {
    const { name, email, subject = 'General Inquiry', phone = '', message } = req.body;

    // Validate input
    if (!name || !email || !message) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ error: 'Invalid email format' });
    }

    const mailOptions = {
      from: `"Portfolio Contact" <${process.env.MAIL_USER}>`,
      replyTo: email,
      to: process.env.MAIL_USER,
      subject: `New Message: ${subject.substring(0, 78)}`, // Gmail subject limit
      text: `Name: ${name}\nEmail: ${email}\nPhone: ${phone || 'N/A'}\n\n${message}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px;">
          <h2 style="color: #333;">New Contact Form Submission</h2>
          <p><strong>Name:</strong> ${name}</p>
          <p><strong>Email:</strong> <a href="mailto:${email}">${email}</a></p>
          ${phone ? `<p><strong>Phone:</strong> ${phone}</p>` : ''}
          <p><strong>Subject:</strong> ${subject}</p>
          <h3 style="color: #444;">Message:</h3>
          <p style="white-space: pre-line;">${message}</p>
        </div>
      `,
      headers: {
        'X-Priority': '1',
        'X-Mailer': 'Nodemailer'
      }
    };

    const info = await transporter.sendMail(mailOptions);
    console.log('Message sent:', info.messageId, '| Response:', info.response);

    res.status(200).json({ 
      success: true,
      messageId: info.messageId
    });

  } catch (error) {
    console.error('Full send error:', {
      error: error.message,
      stack: error.stack,
      response: error.response
    });
    
    res.status(500).json({ 
      success: false,
      error: 'Failed to send message',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Enhanced health check
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    env: process.env.NODE_ENV
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Server error:', {
    path: req.path,
    method: req.method,
    error: err.stack
  });
  res.status(500).json({ 
    error: 'Internal server error',
    requestId: req.id
  });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log('Allowed origins:', allowedOrigins);
});