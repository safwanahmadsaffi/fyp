import { Product } from '../../../../types/product';

// Sample products for seeding
export const sampleProducts: Omit<Product, 'inStock'>[] = [
  {
    id: 'prod-1',
    name: 'Rice - Premium Basmati',
    price: 150.00,
    description: 'High quality basmati rice',
    category: 'Grains',
    unit: 'kg'
  },
  {
    id: 'prod-2',
    name: 'Cooking Oil',
    price: 450.00,
    description: 'Pure vegetable cooking oil',
    category: 'Oils',
    unit: 'liter'
  },
  {
    id: 'prod-3',
    name: 'Sugar',
    price: 95.00,
    description: 'Refined white sugar',
    category: 'Essentials',
    unit: 'kg'
  },
  {
    id: 'prod-4',
    name: 'Milk Pack',
    price: 180.00,
    description: 'Fresh dairy milk',
    category: 'Dairy',
    unit: 'liter'
  },
  {
    id: 'prod-5',
    name: 'Wheat Flour',
    price: 85.00,
    description: 'Fine wheat flour',
    category: 'Grains',
    unit: 'kg'
  }
];