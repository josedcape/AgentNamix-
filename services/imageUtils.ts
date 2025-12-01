
/**
 * Utility service to handle Image Processing for Multimodal inputs.
 */

import { AgentImage } from '../types';

export const processImageFile = (file: File): Promise<AgentImage> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = (e) => {
      const result = e.target?.result as string;
      // Extract Base64 data (remove "data:image/jpeg;base64," prefix)
      const base64Data = result.split(',')[1];
      
      resolve({
        name: file.name,
        mimeType: file.type,
        data: base64Data
      });
    };
    
    reader.onerror = (error) => reject(error);
    
    reader.readAsDataURL(file);
  });
};

export const isValidImageType = (file: File): boolean => {
    const validTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'];
    return validTypes.includes(file.type);
};
