import { UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { productImageUploadConfig } from '../config/upload.config';

// Custom decorator for product image upload
export const ProductImageUpload = () =>
  UseInterceptors(FileInterceptor('image', productImageUploadConfig));
