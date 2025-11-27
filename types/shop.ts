export type OrderItem = {
  id: string;
  name: string;
  quantity: number;
  price: number;
  newPrice: number;
};

export type Shop = {
  id: string;
  name: string;
  address: string;
  owner: string;
  phone?: string;
  status: 'Pending' | 'Visited';
  lastVisited?: string;
  location?: { lat: number; lng: number };
  allocationId?: string; // Allocation ID for visit tracking
  visitId?: string; // Today's visit ID if visited today
  orders?: OrderItem[]; // Orders associated with the visit
  notes?: string; // Visit notes
  duration?: number; // Visit duration in minutes
  frequency?: string; // Allocation frequency (daily, weekly, monthly)
  assignedDays?: string; // JSON string of assigned days for weekly allocations
};