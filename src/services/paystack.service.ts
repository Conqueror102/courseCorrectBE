import crypto from 'crypto';
import { env } from '../config/env.js';

const PAYSTACK_BASE_URL = 'https://api.paystack.co';

interface PaystackInitResponse {
    authorization_url: string;
    access_code: string;
    reference: string;
}

interface PaystackVerifyResponse {
    status: boolean;
    data: {
        status: string;
        reference: string;
        amount: number;
        customer: {
            email: string;
        };
    };
}

/**
 * Initialize a Paystack payment transaction
 */
export const initializePayment = async (
    email: string, 
    amount: number,
    metadata?: Record<string, any>
): Promise<PaystackInitResponse> => {
    const response = await fetch(`${PAYSTACK_BASE_URL}/transaction/initialize`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${env.PAYSTACK_SECRET_KEY}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            email,
            amount, // Amount in kobo
            metadata,
            channels: ['card', 'bank', 'ussd', 'bank_transfer'],
        }),
    });

    const data = await response.json();

    if (!response.ok || !data.status) {
        throw new Error(data.message || 'Failed to initialize payment');
    }

    return {
        authorization_url: data.data.authorization_url,
        access_code: data.data.access_code,
        reference: data.data.reference,
    };
};

/**
 * Verify a Paystack payment transaction
 */
export const verifyPayment = async (reference: string): Promise<PaystackVerifyResponse> => {
    const response = await fetch(`${PAYSTACK_BASE_URL}/transaction/verify/${reference}`, {
        method: 'GET',
        headers: {
            'Authorization': `Bearer ${env.PAYSTACK_SECRET_KEY}`,
        },
    });

    const data = await response.json();

    if (!response.ok) {
        throw new Error(data.message || 'Failed to verify payment');
    }

    return {
        status: data.status,
        data: {
            status: data.data.status,
            reference: data.data.reference,
            amount: data.data.amount,
            customer: {
                email: data.data.customer.email,
            },
        },
    };
};

/**
 * Validate Paystack webhook signature
 */
export const validateWebhookSignature = (payload: string, signature: string): boolean => {
    const hash = crypto
        .createHmac('sha512', env.PAYSTACK_SECRET_KEY)
        .update(payload)
        .digest('hex');
    
    return hash === signature;
};
