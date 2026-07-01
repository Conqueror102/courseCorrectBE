import { Request, Response } from 'express';
import { prisma } from '../lib/prisma.js';

export const SETTING_KEYS = {
  ACCESS_MODE: 'ACCESS_MODE', // 'PASSKEY' | 'DIRECT'
  PLATFORM_PRICE: 'PLATFORM_PRICE', // Naira amount for 30-day access
};

// Get Settings
export const getSettings = async (req: Request, res: Response) => {
  try {
    const settings = await prisma.systemSetting.findMany();
    
    // Format as object
    const config = settings.reduce((acc: any, curr: any) => {
      acc[curr.key] = curr.value;
      return acc;
    }, {} as Record<string, string>);

    // Defaults
    if (!config[SETTING_KEYS.ACCESS_MODE]) {
        config[SETTING_KEYS.ACCESS_MODE] = 'DIRECT'; // Default to Direct? Or Passkey? Let's say Passkey as per user insistence on implementing both.
    }
    if (!config[SETTING_KEYS.PLATFORM_PRICE]) {
        config[SETTING_KEYS.PLATFORM_PRICE] = '5000'; // Matches the payment controller fallback
    }

    res.json(config);
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch settings' });
  }
};

// Update Setting
export const updateSetting = async (req: Request, res: Response) => {
  if (!req.user || req.user.role !== 'ADMIN') {
    return res.status(403).json({ message: 'Unauthorized' });
  }
  const { key, value } = req.body;

  if (!Object.values(SETTING_KEYS).includes(key)) {
    return res.status(400).json({ message: 'Invalid setting key' });
  }

  if (key === SETTING_KEYS.PLATFORM_PRICE) {
    const price = parseFloat(value);
    if (isNaN(price) || price < 0) {
      return res.status(400).json({ message: 'Price must be a non-negative number' });
    }
  }

  try {
    const setting = await prisma.systemSetting.upsert({
      where: { key },
      update: { value },
      create: { key, value },
    });

    res.json(setting);
  } catch (error) {
    res.status(500).json({ message: 'Failed to update setting' });
  }
};
