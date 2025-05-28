import express from 'express';
import cors from 'cors';
import nodemailer from 'nodemailer';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5500;

// Enhanced CORS configuration
app.use(cors({
  origin: [
    'https://sanjaykumar-tech.github.io',
    'http://localhost:3000' // For local testing
  ],
  methods: ['POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type']
}));

// Security middleware
app.use(express.json({ limit: '10kb' })); // Limit payload size
app.disable('x-powered-by'); // Hide Express header

// Rate limiting (important for public APIs)
import rateLimit from 'express-rate-limit';
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 50 // limit each IP to 50 requests per windowMs
});
app.use('/send', limiter);

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
  
  next();
};

// POST route with validation
app.post('/send', validateContactInput, async (req, res) => {
  const { name, email, subject, phone, message } = req.body;

  // Configure transporter with better options
  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.MAIL_USER,
      pass: process.env.MAIL_PASS
    },
    pool: true, // Use connection pooling
    maxConnections: 5,
    maxMessages: 10
  });

  const mailOptions = {
    from: `"Portfolio Contact" <${process.env.MAIL_USER}>`,
    replyTo: email, // So you can reply directly to sender
    to: process.env.RECIPIENT_EMAIL || 'sanjaykumar.techdev@gmail.com',
    subject: `Portfolio Contact: ${subject}`,
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
    res.status(500).json({ 
      success: false,
      error: 'Failed to send message. Please try again later.' 
    });
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'healthy' });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});