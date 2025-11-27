# Order Form Update - Checkbox-Based Product Selection

## Changes Implemented

### 1. **UI/UX Redesign**
- **Removed**: Dropdown with "Add Products" button
- **Added**: Full product list with checkboxes displayed directly
- **Layout**: All products shown in scrollable list with search at top

### 2. **Product Selection Flow**
```
1. User sees all products in a list
2. Each product has a checkbox
3. When checked → Quantity controls and price selection appear
4. When unchecked → Product is removed from order
```

### 3. **Price Selection Feature**
Each selected product now has **TWO price options**:
- **Current Price**: `product.currentPrice` or `product.price`
- **New Price**: `product.newPrice` or `product.price`

User must select one price type for each product.

### 4. **Product Interface Updated**
```typescript
export interface Product {
  _id: string;
  name: string;
  price?: number;          // Current price (fallback)
  newPrice?: number;       // New price option
  currentPrice?: number;   // Current price option
  description?: string;
  category?: string;
  stock?: number;
  image?: string;
}
```

### 5. **Selected Product Structure**
```typescript
interface SelectedProduct {
  product: Product;
  quantity: number;
  selectedPrice: number;      // The price user selected
  priceType: 'new' | 'current'; // Which price type was selected
}
```

## User Flow

### Step 1: View All Products
- Products load automatically (50 per page)
- Search bar at top for filtering
- Each product shows checkbox + name

### Step 2: Select Products
- Click checkbox to select product
- Quantity controls appear (-, input, +)
- Price selection buttons appear:
  - **Current: $X.XX**
  - **New: $Y.YY**

### Step 3: Configure Each Product
- **Quantity**: Use +/- buttons or type manually
- **Price**: Tap "Current" or "New" button
- **Subtotal**: Automatically calculated and displayed

### Step 4: Review & Submit
- All selected products shown with their configurations
- Total amount calculated at bottom
- Optional notes field
- Submit button sends order

## API Integration

### Product List API
```
GET https://app.aeenium.com/soft/alfalah_trader/salesperson/list
Query: page=1&limit=50
Response: {
  data: {
    products: [
      {
        _id: "...",
        name: "Product Name",
        price: 100,           // Current price
        newPrice: 90,         // New price
        currentPrice: 100     // Alternative current price field
      }
    ]
  }
}
```

### Order Creation API
```
POST https://app.aeenium.com/soft/alfalah_trader/orders
Body: {
  shopId: "...",
  shopName: "...",
  items: [
    {
      productId: "...",
      productName: "...",
      quantity: 5,
      price: 90  // The selected price (new or current)
    }
  ],
  totalAmount: 450,
  notes: "...",
  orderDate: "2024-11-07T..."
}
```

## Offline-First Behavior

### Online Mode
1. User selects products and prices
2. Submits order
3. **Immediately** sent to backend API
4. Stored locally with `synced=1`
5. Success toast shown

### Offline Mode
1. User selects products and prices
2. Submits order
3. Stored locally with `synced=0`
4. Added to sync queue
5. Toast: "Order will sync when online"

### Background Sync
- Runs every 15 seconds
- Checks for pending orders (`synced=0`)
- Sends to API when connection available
- Updates `synced=1` on success

## Visual Layout

```
┌─────────────────────────────────┐
│  New Order - Shop Name      [X] │
├─────────────────────────────────┤
│  🔍 Search products...          │
├─────────────────────────────────┤
│  All Products (25)              │
│                                 │
│  ☐ Product 1                    │
│                                 │
│  ☑ Product 2                    │
│  ├─ Quantity: [-] 3 [+]         │
│  ├─ Price: [Current: $10] [New: $8] │
│  └─ Subtotal: $24.00            │
│                                 │
│  ☑ Product 3                    │
│  ├─ Quantity: [-] 1 [+]         │
│  ├─ Price: [Current: $15] [New: $12] │
│  └─ Subtotal: $12.00            │
│                                 │
│  ☐ Product 4                    │
│  ...                            │
├─────────────────────────────────┤
│  Notes (Optional)               │
│  [Text area...]                 │
├─────────────────────────────────┤
│  Total Amount: $36.00           │
│  [Submit Order]                 │
└─────────────────────────────────┘
```

## Key Features

### ✅ Checkbox Selection
- Visual feedback (checked/unchecked)
- Instant show/hide of controls
- No separate "add" button needed

### ✅ Dual Price System
- Current price vs New price
- Visual selection (highlighted button)
- Affects subtotal calculation

### ✅ Real-time Calculations
- Subtotal per product
- Grand total at bottom
- Updates on quantity/price change

### ✅ Search & Filter
- Client-side search
- Instant results
- Case-insensitive

### ✅ Infinite Scroll
- Auto-loads all products
- 50 products per page
- Loading indicator

### ✅ Offline Support
- Local storage
- Sync queue
- Background sync

## Testing Checklist

### Product Display
- [ ] All products load
- [ ] Search filters correctly
- [ ] Checkboxes work
- [ ] Infinite scroll loads more

### Selection & Configuration
- [ ] Checkbox toggles selection
- [ ] Quantity controls work (+, -, input)
- [ ] Price buttons toggle correctly
- [ ] Selected price highlights
- [ ] Subtotal calculates correctly

### Order Submission
- [ ] Can't submit with 0 products
- [ ] Total calculates correctly
- [ ] Notes field works
- [ ] Online: Sends to API immediately
- [ ] Offline: Stores locally
- [ ] Toast shows correct message

### Sync Behavior
- [ ] Offline orders queue
- [ ] Sync when connection restored
- [ ] Synced flag updates
- [ ] Retry logic works

## Database Schema

```sql
CREATE TABLE orders (
  id TEXT PRIMARY KEY,
  shop_id TEXT NOT NULL,
  shop_name TEXT NOT NULL,
  items TEXT NOT NULL,        -- JSON: [{productId, productName, quantity, price}]
  total_amount REAL NOT NULL,
  notes TEXT,
  order_date TEXT NOT NULL,
  synced INTEGER DEFAULT 0,   -- 0=pending, 1=synced
  created_at TEXT NOT NULL,
  updated_at TEXT,
  FOREIGN KEY (shop_id) REFERENCES shops(id)
)
```

## Files Modified

1. **`services/orders/orderApiService.ts`**
   - Added `newPrice` and `currentPrice` to Product interface

2. **`Components/NewOrderForm.tsx`**
   - Complete UI rewrite
   - Checkbox-based selection
   - Dual price selection
   - New styles for layout

## Benefits

1. **Faster Selection**: See all products at once
2. **Clear Pricing**: Both prices visible, user chooses
3. **Better UX**: No dropdown, direct interaction
4. **Flexible**: Each product can have different price
5. **Transparent**: Subtotals shown per product
6. **Offline-Ready**: Works without internet

## Future Enhancements

1. **Product Images**: Show thumbnails
2. **Categories**: Group products by category
3. **Favorites**: Quick access to frequent products
4. **Bulk Actions**: Select all, clear all
5. **Price History**: Show price trends
6. **Discounts**: Apply percentage/fixed discounts
7. **Order Templates**: Save common orders
8. **Barcode Scanner**: Quick product lookup
