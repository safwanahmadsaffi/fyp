export type Product = {
  id: string;
  name: string;
  price: number;
  description?: string;
  category?: string;
  unit: string;
  inStock: boolean;
};

export type OrderItem = {
  id: string;
  productId: string;
  quantity: number;
  price: number;
  notes?: string;
};

export type Order = {
  id: string;
  shopId: string;
  visitId: string;
  userId: string;
  items: OrderItem[];
  totalAmount: number;
  status: 'pending' | 'confirmed' | 'cancelled';
  createdAt: string;
  updatedAt: string;
};