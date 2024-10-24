// server.js
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const { OAuth2Client } = require('google-auth-library');
const paypal = require('@paypal/checkout-server-sdk');
const jwt = require('jsonwebtoken');

const app = express();
app.use(cors());
app.use(express.json());

// MongoDB Schema
const userSchema = new mongoose.Schema({
    email: String,
    name: String,
    isPremium: Boolean,
    premiumUntil: Date,
    dailyMessageCount: Number,
    lastMessageDate: Date,
    messageHistory: [{
        content: String,
        timestamp: Date,
        isBot: Boolean
    }]
});

const User = mongoose.model('User', userSchema);

// Google Auth
const GOOGLE_CLIENT_ID = '483483995723-2mi2tvqltih1osrolfdcl4nj2ftfrpmj.apps.googleusercontent.com';
const client = new OAuth2Client(GOOGLE_CLIENT_ID);

// PayPal Configuration
const Environment = process.env.NODE_ENV === 'production'
    ? paypal.core.LiveEnvironment
    : paypal.core.SandboxEnvironment;

const paypalClient = new paypal.core.PayPalHttpClient(new Environment(
    'AT2zV8kwgwSoax9kxdfb14JTsvUaB9-qYw2TsPjE6vz4cM93lPXa6eEwcUDHZeUMLcL-JGp4YQLzTOSp',
    'EIwwmnkXwP2t0RxUNm0APtOqimw-hNm3agG4mXwFN4wLVizgpDNBmwPzz0pS_PRUtF_yrfahBm0cJ2hE'
));

// Middleware - Auth Check
const authMiddleware = async (req, res, next) => {
    try {
        const token = req.headers.authorization?.split(' ')[1];
        if (!token) throw new Error('No token provided');

        const decoded = jwt.verify(token, 'YOUR_JWT_SECRET');
        const user = await User.findById(decoded.userId);
        if (!user) throw new Error('User not found');

        req.user = user;
        next();
    } catch (error) {
        res.status(401).json({ error: 'Authentication failed' });
    }
};

// Routes

// Google Login
app.post('/auth/google', async (req, res) => {
    try {
        const { token } = req.body;
        const ticket = await client.verifyIdToken({
            idToken: token,
            audience: GOOGLE_CLIENT_ID
        });
        const payload = ticket.getPayload();

        let user = await User.findOne({ email: payload.email });
        if (!user) {
            user = new User({
                email: payload.email,
                name: payload.name,
                isPremium: false,
                dailyMessageCount: 0,
                lastMessageDate: new Date()
            });
            await user.save();
        }

        const jwtToken = jwt.sign({ userId: user._id }, 'YOUR_JWT_SECRET');
        res.json({ token: jwtToken, user });
    } catch (error) {
        res.status(400).json({ error: 'Authentication failed' });
    }
});

// Message Handling
app.post('/api/message', authMiddleware, async (req, res) => {
    try {
        const { content } = req.body;
        const user = req.user;

        // Check daily message limit for non-premium users
        if (!user.isPremium) {
            const today = new Date().setHours(0, 0, 0, 0);
            if (user.lastMessageDate.setHours(0, 0, 0, 0) !== today) {
                user.dailyMessageCount = 0;
            }

            if (user.dailyMessageCount >= 7) {
                return res.status(403).json({ error: 'Daily message limit reached' });
            }

            user.dailyMessageCount++;
        }

        // Process message and generate response
        let botResponse;
        if (content.startsWith('צור תמונה') && user.isPremium) {
            botResponse = await generateImage(content.substring(9));
        } else {
            botResponse = await generateBotResponse(content);
        }

        // Save message history
        user.messageHistory.push(
            { content, timestamp: new Date(), isBot: false },
            { content: botResponse, timestamp: new Date(), isBot: true }
        );
        user.lastMessageDate = new Date();
        await user.save();

        res.json({ response: botResponse });
    } catch (error) {
        res.status(500).json({ error: 'Failed to process message' });
    }
});

// Premium Subscription
app.post('/api/subscribe', authMiddleware, async (req, res) => {
    try {
        const { paypalOrderId } = req.body;
        const request = new paypal.orders.OrdersGetRequest(paypalOrderId);
        const order = await paypalClient.execute(request);

        if (order.result.status === 'COMPLETED') {
            req.user.isPremium = true;
            req.user.premiumUntil = null; // Unlimited
            await req.user.save();
            res.json({ success: true });
        } else {
            throw new Error('Payment not completed');
        }
    } catch (error) {
        res.status(400).json({ error: 'Payment verification failed' });
    }
});

// Promo Code
app.post('/api/promo', authMiddleware, async (req, res) => {
    try {
        const { code } = req.body;
        if (code === 'PREMIUM7DAYS') {
            const oneWeek = new Date();
            oneWeek.setDate(oneWeek.getDate() + 7);
            
            req.user.isPremium = true;
            req.user.premiumUntil = oneWeek;
            await req.user.save();
            
            res.json({ success: true, expiryDate: oneWeek });
        } else {
            res.status(400).json({ error: 'Invalid promo code' });
        }
    } catch (error) {
        res.status(500).json({ error: 'Failed to apply promo code' });
    }
});

// AI Response Generation
async function generateBotResponse(message) {
    // כאן תוכל להוסיף אינטגרציה עם מודל AI לפי בחירתך
    // לדוגמה: OpenAI API, Hugging Face, או כל מודל אחר
    const responses = {
        'שלום': 'היי! איך אני יכול לעזור?',
        'מה שלומך': 'מצוין! תודה ששאלת!',
        'default': 'זו תגובה מעניינת! ספר לי עוד...'
    };

    return responses[message.toLowerCase()] || responses['default'];
}

// Image Generation
async function generateImage(prompt) {
    // כאן תוכל להוסיף אינטגרציה עם API ליצירת תמונות
    // לדוגמה: DALL-E, Stable Diffusion, או כל שירות אחר
    return `תמונה נוצרה בהצלחה לפי התיאור: ${prompt}`;
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
