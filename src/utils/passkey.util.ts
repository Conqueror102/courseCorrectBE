
/**
 * Generates a formatted passkey: [INITIALS]-[YEAR]-[RANDOM]
 * Example: JD-2025-X7K9P
 */
export const generatePasskey = (userName: string): string => {
  const date = new Date();
  const year = date.getFullYear();
  
  // Get Initials
  const cleanName = userName.replace(/[^a-zA-Z ]/g, "").trim();
  const parts = cleanName.split(' ').filter(p => p.length > 0);
  let initials = 'ST'; // Default
  
  if (parts.length === 0) {
      initials = 'ST';
  } else if (parts.length === 1) {
      initials = parts[0].substring(0, 2).toUpperCase();
  } else {
      initials = (parts[0][0] + parts[1][0]).toUpperCase();
  }

  // Generate Random Code (5 chars, uppercase alphanumeric avoiding confusing chars)
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let randomCode = '';
  for (let i = 0; i < 5; i++) {
    randomCode += chars.charAt(Math.floor(Math.random() * chars.length));
  }

  return `${initials}-${year}-${randomCode}`;
};
