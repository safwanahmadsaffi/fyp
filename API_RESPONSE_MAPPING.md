# API Response Mapping - Alfalah Trader Items

## Actual API Response Format

### Endpoint
```
GET https://app.aeenium.com/soft/alfalah_trader/items/list?search=shield&limit=10
```

### Response Structure
```json
{
  "items": [
    {
      "item_id": 13,
      "full_item_name": "Shield Jumbo XXL 30 x8",
      "item_rate": 1000
    },
    {
      "item_id": 15,
      "full_item_name": "Shield MEGA MEDIUM 62 x4",
      "item_rate": 1500
    }
  ],
  "first": {
    "$ref": "https://app.aeenium.com/soft/alfalah_trader/items/list?search=shield&limit=10"
  },
  "prev": {
    "$ref": "https://app.aeenium.com/soft/alfalah_trader/items/list?search=shield"
  }
}
```

## Field Mapping

### API Response → App Product Interface

| API Field | App Field | Type | Notes |
|-----------|-----------|------|-------|
| `item_id` | `_id` | string | Converted to string |
| `full_item_name` | `name` | string | Product display name |
| `item_rate` | `price` | number | Base price |
| `item_rate` | `currentPrice` | number | Same as price |
| `item_rate` | `newPrice` | number | Default to same price |

### Mapping Code

```typescript
// In orderApiService.ts
if (response.data?.items && Array.isArray(response.data.items)) {
  products = response.data.items.map((item: any) => ({
    _id: String(item.item_id),           // 13 → "13"
    name: item.full_item_name,           // "Shield Jumbo XXL 30 x8"
    price: item.item_rate,               // 1000
    currentPrice: item.item_rate,        // 1000
    newPrice: item.item_rate,            // 1000 (can be different if API provides)
    description: item.description || '', // Optional
    category: item.category || '',       // Optional
    stock: item.stock || 0,              // Optional
  }));
}
```

## Example Transformation

### Input (API Response)
```json
{
  "item_id": 13,
  "full_item_name": "Shield Jumbo XXL 30 x8",
  "item_rate": 1000
}
```

### Output (App Product)
```typescript
{
  _id: "13",
  name: "Shield Jumbo XXL 30 x8",
  price: 1000,
  currentPrice: 1000,
  newPrice: 1000,
  description: "",
  category: "",
  stock: 0
}
```

## Complete Product List from API

Based on your API response, these products will be displayed:

1. **Shield Jumbo XXL 30 x8** - ₨1000
2. **Shield MEGA MEDIUM 62 x4** - ₨1500
3. **Shield MEGA LARGE 54 x4** - ₨1500
4. **Shield MEGA EXTRA LARGE 46 x4** - ₨1500
5. **Shield Bachat SMALL 48 x8** - ₨1000
6. **SHIELD Jumbo 24 WIPES x24** - ₨150
7. **SHIELD Bachat FEEDER 250ML x96** - ₨100
8. **SHIELD Mega SHIELD 250ML SADA x84** - ₨100
9. **SHIELD Bachat SHIELD 125ML x96** - ₨100
10. **SHIELD Bachat XL 50 x8** - ₨1000

## How It Works

### Step 1: API Call
```typescript
const response = await axios.get(
  'https://app.aeenium.com/soft/alfalah_trader/items/list',
  { params: { search: 'shield', limit: 10 } }
);
```

### Step 2: Response Received
```javascript
{
  items: [
    { item_id: 13, full_item_name: "Shield Jumbo XXL 30 x8", item_rate: 1000 },
    // ... more items
  ]
}
```

### Step 3: Mapping to Product Format
```typescript
const products = response.data.items.map(item => ({
  _id: String(item.item_id),
  name: item.full_item_name,
  price: item.item_rate,
  currentPrice: item.item_rate,
  newPrice: item.item_rate,
}));
```

### Step 4: Display in UI
```tsx
<FlatList
  data={products}
  renderItem={({ item }) => (
    <View>
      <Text>{item.name}</Text>
      <Text>₨{item.price}</Text>
    </View>
  )}
/>
```

## Console Logs You'll See

### When API is Called
```
[OrderApiService] Fetching products: { page: 1, limit: 50, search: 'shield' }
[OrderApiService] API URL: https://app.aeenium.com/soft/alfalah_trader/items/list
```

### When Response is Received
```
[OrderApiService] Response structure: {
  hasData: true,
  hasItems: true,
  hasDataProperty: false,
  hasProducts: false,
  itemsLength: 10,
  topLevelKeys: ['items', 'first', 'prev']
}
```

### When Mapping Happens
```
[OrderApiService] Found items array, mapping to Product format...
[OrderApiService] Parsed products count: 10
[OrderApiService] First product: {
  _id: "13",
  name: "Shield Jumbo XXL 30 x8",
  price: 1000,
  currentPrice: 1000,
  newPrice: 1000
}
[OrderApiService] Sample products: [
  { _id: "13", name: "Shield Jumbo XXL 30 x8", price: 1000 },
  { _id: "15", name: "Shield MEGA MEDIUM 62 x4", price: 1500 },
  { _id: "16", name: "Shield MEGA LARGE 54 x4", price: 1500 }
]
```

### In NewOrderForm
```
[NewOrderForm] 📦 Response received: {
  hasResponse: true,
  hasData: true,
  hasProducts: true,
  productsLength: 10
}
[NewOrderForm] ✅ Loaded 10 products
[NewOrderForm] 📝 Setting products: 10
```

## UI Display

### Product Card in NewOrderForm
```
┌─────────────────────────────────────────┐
│ ☐ Shield Jumbo XXL 30 x8               │
└─────────────────────────────────────────┘

When checked:
┌─────────────────────────────────────────┐
│ ☑ Shield Jumbo XXL 30 x8               │
│                                         │
│ Quantity: [-] 1 [+]                     │
│                                         │
│ Select Price:                           │
│ [Current: ₨1000] [New: ₨1000]          │
│                                         │
│ Subtotal: ₨1000.00                      │
└─────────────────────────────────────────┘
```

## Pagination Handling

Since the API response doesn't include pagination metadata, we calculate it:

```typescript
const totalItems = response.data.items.length;
pagination = {
  page: page,           // Current page (from request)
  limit: limit,         // Items per page (from request)
  total: totalItems,    // Total items in response
  pages: Math.ceil(totalItems / limit), // Calculated pages
};
```

## Search Functionality

### Without Search
```
GET /items/list?page=1&limit=50
→ Returns all items
```

### With Search
```
GET /items/list?page=1&limit=50&search=shield
→ Returns only items matching "shield"
```

## Error Handling

### If API Returns Empty
```json
{
  "items": []
}
```
**Result:** Empty state shown in UI
```
No products available
Try a different search term
```

### If API Returns Error
```json
{
  "error": "Not found"
}
```
**Result:** Error toast shown
```
Failed to load products
Please try again
```

## Testing the Mapping

### Test 1: Load All Products
```typescript
// In NewOrderForm, when opened
loadProducts(1, false, '');

// Expected: All products loaded
// Console: "Loaded X products"
// UI: Products displayed in list
```

### Test 2: Search for "Shield"
```typescript
// User types "shield" in search box
setSearchQuery('shield');

// After 500ms debounce
loadProducts(1, false, 'shield');

// Expected: Only Shield products shown
// Console: "Loaded 10 products"
// UI: 10 Shield products displayed
```

### Test 3: Select Product
```typescript
// User clicks checkbox on "Shield Jumbo XXL 30 x8"
handleToggleProduct(product);

// Expected:
selectedProducts = Map {
  "13" => {
    product: { _id: "13", name: "Shield Jumbo XXL 30 x8", price: 1000 },
    quantity: 1,
    selectedPrice: 1000,
    priceType: 'current'
  }
}
```

## Order Submission

When user submits order, the data is sent as:

```json
{
  "shopId": "shop123",
  "shopName": "ABC Store",
  "items": [
    {
      "productId": "13",
      "productName": "Shield Jumbo XXL 30 x8",
      "quantity": 2,
      "price": 1000
    }
  ],
  "totalAmount": 2000,
  "notes": "Urgent delivery",
  "orderDate": "2024-11-07T11:09:00.000Z"
}
```

## Summary

✅ **API Response Format Identified**
- Uses `items` array
- Fields: `item_id`, `full_item_name`, `item_rate`

✅ **Mapping Implemented**
- `item_id` → `_id` (as string)
- `full_item_name` → `name`
- `item_rate` → `price`, `currentPrice`, `newPrice`

✅ **Products Will Display**
- All 10 Shield products from API
- With correct names and prices
- Selectable with checkboxes
- Quantity and price controls

✅ **Search Works**
- Server-side filtering
- Debounced input
- Real-time results

The products from the API will now display correctly in the NewOrderForm!
