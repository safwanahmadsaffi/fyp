# NewOrderForm UpdateVisit API Integration

## Overview

Updated the `NewOrderForm` component to call the `updateVisit` API (PUT request) instead of creating a standalone order. The order data is now sent as part of the visit update with the required format.

---

## Changes Made

### 1. Updated `visitApiService.ts`

**Added OrderItem Type:**
```typescript
export type OrderItem = {
  id: string;           // Product ID
  name: string;         // Product name
  quantity: number;     // Quantity ordered
  price: number;        // Current price
  newPrice: number;     // New/edited price
};
```

**Updated CreateVisitPayload:**
```typescript
export type CreateVisitPayload = {
  allocationId: string;
  visitDateTime: string;
  duration?: number;
  notes?: string;
  orders?: OrderItem[];  // ✅ Added orders field
};
```

### 2. Updated `NewOrderForm.tsx`

**Added visitId Prop:**
```typescript
interface NewOrderFormProps {
  visible: boolean;
  shopId: string;
  shopName: string;
  visitId: string;      // ✅ Required for updateVisit API
  onClose: () => void;
  onSuccess: () => void;
}
```

**Imported visitApiService:**
```typescript
import visitApiService from '../services/visits/visitApiService';
```

**Updated handleSubmit Function:**
```typescript
const handleSubmit = async () => {
  if (selectedProducts.size === 0) {
    Alert.alert('Error', 'Please select at least one product');
    return;
  }

  setSubmitting(true);

  try {
    // Format orders data according to API requirements
    const orders = Array.from(selectedProducts.values()).map(selected => ({
      id: selected.product._id,
      name: selected.product.name,
      quantity: selected.quantity,
      price: selected.currentPrice,
      newPrice: selected.newPrice,
    }));

    console.log('📤 [NewOrderForm] Submitting order to updateVisit API...');
    console.log('📦 [NewOrderForm] Visit ID:', visitId);
    console.log('📦 [NewOrderForm] Orders:', orders);
    console.log('📦 [NewOrderForm] Notes:', notes);

    // Call updateVisit API with orders and notes
    await visitApiService.updateVisit(visitId, {
      orders,
      notes,
    });

    console.log('✅ [NewOrderForm] Order submitted successfully!');

    Toast.show({
      type: 'success',
      text1: 'Order Submitted',
      text2: 'Visit updated with order details',
    });

    onSuccess();
    onClose();
  } catch (error: any) {
    console.error('Failed to create order:', error);
    Toast.show({
      type: 'error',
      text1: 'Failed to create order',
      text2: error?.message || 'Please try again',
    });
  } finally {
    setSubmitting(false);
  }
};
```

### 3. Updated `Dashboard.tsx`

**Updated selectedShop State:**
```typescript
const [selectedShop, setSelectedShop] = useState<{ 
  id: string; 
  name: string; 
  visitId: string  // ✅ Added visitId
} | null>(null);
```

**Updated onNewOrder Handler:**
```typescript
onNewOrder={async (id: string | number) => {
  const shop = shops.find(s => s.id === String(id));
  if (shop) {
    try {
      // Create a visit for this shop
      const today = new Date();
      const visitId = await VisitService.createPlanned({
        userId: 'current-user',
        shopId: String(id),
        allocationId: shop.allocationId || `alloc-${id}`,
        date: today,
      });
      
      console.log('✅ Visit created for order:', visitId);
      
      setSelectedShop({ id: String(id), name: shop.name, visitId });
      setOrderFormVisible(true);
    } catch (error) {
      console.error('❌ Failed to create visit:', error);
      Toast.show({
        type: 'error',
        text1: 'Failed to create visit',
        text2: 'Please try again',
      });
    }
  }
}}
```

**Updated NewOrderForm Component:**
```typescript
<NewOrderForm
  visible={orderFormVisible}
  shopId={selectedShop.id}
  shopName={selectedShop.name}
  visitId={selectedShop.visitId}  // ✅ Pass visitId
  onClose={() => {
    setOrderFormVisible(false);
    setSelectedShop(null);
  }}
  onSuccess={() => {
    // Mark shop as visited
    const updated = shops.map(s =>
      s.id === selectedShop.id
        ? { ...s, status: 'Visited' as const, lastVisited: new Date().toISOString() }
        : s
    );
    setShops(updated);
  }}
/>
```

### 4. Updated `Shops.tsx`

Same changes as Dashboard.tsx:
- Updated `selectedShop` state to include `visitId`
- Updated `onNewOrder` handler to create visit first
- Pass `visitId` to `NewOrderForm`

---

## API Request Format

### PUT `/visits/:visitId`

**Endpoint:**
```
PUT https://app.aeenium.com/soft/alfalah_trader/visits/{visitId}
```

**Request Body:**
```json
{
  "orders": [
    {
      "id": "13",
      "name": "Shield Jumbo XXL 30 x8",
      "quantity": 2,
      "price": 1000,
      "newPrice": 950
    },
    {
      "id": "15",
      "name": "Shield MEGA MEDIUM 62 x4",
      "quantity": 1,
      "price": 1500,
      "newPrice": 1500
    }
  ],
  "notes": "Urgent delivery needed"
}
```

**Headers:**
```json
{
  "Authorization": "Bearer <token>",
  "Content-Type": "application/json"
}
```

---

## Data Flow

```
1. User clicks "New Order" button on shop card
   ↓
2. System creates a visit for the shop
   - Calls VisitService.createPlanned()
   - Returns visitId
   ↓
3. NewOrderForm opens with visitId
   ↓
4. User selects products, quantities, and prices
   ↓
5. User clicks "Submit Order"
   ↓
6. System formats order data:
   {
     id: productId,
     name: productName,
     quantity: quantity,
     price: currentPrice,
     newPrice: newPrice (edited or default)
   }
   ↓
7. System calls visitApiService.updateVisit()
   - PUT /visits/:visitId
   - Body: { orders: [...], notes: "..." }
   ↓
8. API updates visit with order data
   ↓
9. Success toast shown
   ↓
10. Shop marked as "Visited"
```

---

## Order Data Format

Each order item includes:

| Field | Type | Description | Example |
|-------|------|-------------|---------|
| `id` | String | Product ID from API | `"13"` |
| `name` | String | Full product name | `"Shield Jumbo XXL 30 x8"` |
| `quantity` | Number | Quantity ordered | `2` |
| `price` | Number | Current/original price | `1000` |
| `newPrice` | Number | New/edited price (or same as price if not edited) | `950` |

---

## Example Scenarios

### Scenario 1: Order with Current Prices

**User Actions:**
1. Clicks "New Order" on "Al-Hadi Store"
2. Visit created with ID: `visit_123`
3. Selects 2 products without editing prices
4. Clicks "Submit Order"

**API Call:**
```typescript
PUT /visits/visit_123
{
  "orders": [
    {
      "id": "13",
      "name": "Shield Jumbo XXL 30 x8",
      "quantity": 2,
      "price": 1000,
      "newPrice": 1000  // Same as price (not edited)
    },
    {
      "id": "15",
      "name": "Shield MEGA MEDIUM 62 x4",
      "quantity": 1,
      "price": 1500,
      "newPrice": 1500  // Same as price (not edited)
    }
  ],
  "notes": ""
}
```

### Scenario 2: Order with Edited Prices

**User Actions:**
1. Clicks "New Order" on "Khan Grocers"
2. Visit created with ID: `visit_456`
3. Selects 1 product and edits new price to 950
4. Adds notes: "Urgent delivery"
5. Clicks "Submit Order"

**API Call:**
```typescript
PUT /visits/visit_456
{
  "orders": [
    {
      "id": "13",
      "name": "Shield Jumbo XXL 30 x8",
      "quantity": 3,
      "price": 1000,
      "newPrice": 950  // Edited by user
    }
  ],
  "notes": "Urgent delivery"
}
```

### Scenario 3: Mixed Prices

**User Actions:**
1. Clicks "New Order"
2. Visit created
3. Product 1: Uses current price (1000)
4. Product 2: Edits new price to 1400
5. Submits

**API Call:**
```typescript
PUT /visits/visit_789
{
  "orders": [
    {
      "id": "13",
      "name": "Shield Jumbo XXL 30 x8",
      "quantity": 2,
      "price": 1000,
      "newPrice": 1000  // Not edited
    },
    {
      "id": "15",
      "name": "Shield MEGA MEDIUM 62 x4",
      "quantity": 1,
      "price": 1500,
      "newPrice": 1400  // Edited
    }
  ],
  "notes": ""
}
```

---

## Console Logs

### Visit Creation:
```
✅ Visit created for order: visit_123
```

### Order Submission:
```
📤 [NewOrderForm] Submitting order to updateVisit API...
📦 [NewOrderForm] Visit ID: visit_123
📦 [NewOrderForm] Orders: [
  {
    id: "13",
    name: "Shield Jumbo XXL 30 x8",
    quantity: 2,
    price: 1000,
    newPrice: 950
  }
]
📦 [NewOrderForm] Notes: Urgent delivery needed
[visitApiService] updateVisit id: visit_123
[visitApiService] updateVisit payload: { orders: [...], notes: "..." }
[visitApiService] updateVisit status: 200
[visitApiService] updateVisit data: { success: true, ... }
✅ [NewOrderForm] Order submitted successfully!
```

---

## Error Handling

### Visit Creation Failed:
```typescript
try {
  const visitId = await VisitService.createPlanned(...);
} catch (error) {
  console.error('❌ Failed to create visit:', error);
  Toast.show({
    type: 'error',
    text1: 'Failed to create visit',
    text2: 'Please try again',
  });
}
```

### Order Submission Failed:
```typescript
try {
  await visitApiService.updateVisit(visitId, { orders, notes });
} catch (error) {
  console.error('Failed to create order:', error);
  Toast.show({
    type: 'error',
    text1: 'Failed to create order',
    text2: error?.message || 'Please try again',
  });
}
```

---

## Testing Checklist

### ✅ Visit Creation
- [ ] Visit is created when "New Order" button is clicked
- [ ] Visit ID is generated and stored
- [ ] Error shown if visit creation fails

### ✅ Order Submission
- [ ] Orders array formatted correctly
- [ ] All required fields present (id, name, quantity, price, newPrice)
- [ ] Notes included in request
- [ ] PUT request sent to correct endpoint
- [ ] Success toast shown on success
- [ ] Error toast shown on failure

### ✅ Data Format
- [ ] Product ID mapped correctly
- [ ] Product name included
- [ ] Quantity is a number
- [ ] Current price included
- [ ] New price included (edited or default)
- [ ] Notes string included (empty if none)

### ✅ Edge Cases
- [ ] No products selected - shows error
- [ ] Single product order
- [ ] Multiple products order
- [ ] Mixed current/new prices
- [ ] Empty notes field
- [ ] Network error handling

---

## Summary

The NewOrderForm now:

1. ✅ **Requires visitId** prop
2. ✅ **Calls updateVisit API** (PUT request)
3. ✅ **Sends orders in required format**:
   - `id`: Product ID
   - `name`: Product name
   - `quantity`: Quantity
   - `price`: Current price
   - `newPrice`: New/edited price
4. ✅ **Includes notes** in the request
5. ✅ **Creates visit automatically** when "New Order" is clicked
6. ✅ **Handles errors** gracefully with toast messages
7. ✅ **Logs all operations** for debugging

The integration is complete and ready for testing!
