// types.ts
interface User {
    _id: string;
    email: string;
    name: string;
    isPremium: boolean;
    premiumUntil: Date | null;
    dailyMessageCount: number;
    lastMessageDate: Date;
    messageHistory: Message[];
}

interface Message {
    content: string;
    timestamp: Date;
    isBot: boolean;
}

interface PremiumSubscription {
    userId: string;
    startDate: Date;
    endDate: Date | null;
    type: 'weekly' | 'monthly' | 'unlimited';
    paymentId: string;
}

// Validation schemas
const messageSchema = {
    content: {
        type: String,
        required: true,
        maxLength: 1000
    },
    timestamp: {
        type: Date,
        default: Date.now
    },
    isBot: {
        type: Boolean,
        required: true
    }
};

const subscriptionSchema = {
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    startDate: {
        type: Date,
        required: true
    },
    endDate: {
        type: Date
    },
    type: {
        type: String,
        enum: ['weekly', 'monthly', 'unlimited'],
        required: true
    },
    paymentId: {
        type: String,
        required: true
    }
};
