import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  Modal,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  TextInput,
  ActivityIndicator,
  Alert,
  ScrollView,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import Toast from 'react-native-toast-message';
import orderApiService, { Product, OrderItem } from '../services/orders/orderApiService';
import { OrderService } from '../services/orders/OrderService';
import visitApiService from '../services/visits/visitApiService';
import { Colors, FontSize } from '../Theme';
import ProductSyncService from '../services/products/ProductSyncService';
import { NetworkUtils } from '../services/utils/NetworkUtils';

interface NewOrderFormProps {
  visible: boolean;
  shopId: string;
  shopName: string;
  visitId?: string; // Optional - will be created if not provided
  allocationId?: string; // Required if visitId not provided
  existingOrders?: any[]; // Existing orders if any
  onClose: () => void;
  onSuccess: () => void;
}

interface SelectedProduct {
  product: Product;
  quantity: number;
  currentPrice: number;
  newPrice: number; // User can edit this
  useNewPrice: boolean; // true if user edited new price
}

const NewOrderForm: React.FC<NewOrderFormProps> = ({
  visible,
  shopId,
  shopName,
  visitId,
  allocationId,
  existingOrders,
  onClose,
  onSuccess,
}) => {
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedProducts, setSelectedProducts] = useState<Map<string, SelectedProduct>>(new Map());
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [notes, setNotes] = useState('');
  const [searchTimeout, setSearchTimeout] = useState<any>(null);
  const [showDropdown, setShowDropdown] = useState(false);
  const [hasExistingOrders, setHasExistingOrders] = useState(false);

  // Check if visit already has orders
  useEffect(() => {
    if (existingOrders && existingOrders.length > 0) {
      setHasExistingOrders(true);
      console.log('[NewOrderForm] ⚠️ Visit already has orders. Form will be read-only.');
    } else {
      setHasExistingOrders(false);
    }
  }, [existingOrders]);

  // Load products with pagination and search
  const loadProducts = useCallback(async (pageNum: number, append: boolean = false, search: string = '') => {
    console.log('[NewOrderForm] 🔄 Starting loadProducts:', { page: pageNum, append, search, visible });
    
    if (pageNum === 1) {
      setLoading(true);
    } else {
      setLoadingMore(true);
    }

    try {
      // Check network connectivity
      const isOnline = await NetworkUtils.checkConnection();
      console.log('[NewOrderForm] 🌐 Network status:', isOnline ? 'ONLINE' : 'OFFLINE');
      console.log('[NewOrderForm] 📊 Current state:', { 
        currentProducts: products.length, 
        page: pageNum, 
        append, 
        search 
      });
      
      let newProducts: Product[] = [];
      
      if (isOnline) {
        console.log('[NewOrderForm] 📥 Loading from API (online mode)...');
        
        try {
          // Load from API
          const response = await orderApiService.getProducts({
            page: pageNum,
            limit: 15,
            search: search || undefined
          });
          
          console.log('[NewOrderForm] 📦 API Response:', {
            hasData: !!response?.data,
            hasProducts: !!response?.data?.products,
            productsLength: response?.data?.products?.length || 0,
            responseKeys: response ? Object.keys(response) : []
          });
          
          newProducts = response?.data?.products || [];
          console.log('[NewOrderForm] ✅ Loaded', newProducts.length, 'products from API');
          
          // Sync these products to local database immediately
          // Store products so they're available offline
          if (newProducts.length > 0) {
            try {
              await ProductSyncService.storeProducts(newProducts);
              console.log('[NewOrderForm] ✅ Stored', newProducts.length, 'products in local database');
            } catch (storeError) {
              console.warn('[NewOrderForm] ⚠️ Failed to store products:', storeError);
            }
          }
          
        } catch (apiError: any) {
          console.error('[NewOrderForm] ❌ API failed, falling back to local DB:', apiError?.message || apiError);
          // If API fails, fall back to local database
          const localProducts = await ProductSyncService.getLocalProducts({
            search: search || undefined,
            limit: 20,
            offset: (pageNum - 1) * 20
          });
          newProducts = localProducts || [];
          console.log('[NewOrderForm] 📦 Loaded', newProducts.length, 'products from local DB (API fallback)');
        }
      } else {
        console.log('[NewOrderForm] 📦 Loading from local database (offline mode)...');
        
        // Load from local database
        const localProducts = await ProductSyncService.getLocalProducts({
          search: search || undefined,
          limit: 20,
          offset: (pageNum - 1) * 20
        });
        
        newProducts = localProducts || [];
        console.log('[NewOrderForm] ✅ Loaded', newProducts.length, 'products from local DB');
      }
      
      console.log('[NewOrderForm] ✅ Loaded', newProducts.length, 'products');
      console.log('[NewOrderForm] 📋 First 3 products:', newProducts.slice(0, 3));
      
      // Show dropdown after loading products
      if (newProducts.length > 0) {
        setShowDropdown(true);
      }
      
      // Show message if no products found
      if (newProducts.length === 0) {
        if (search) {
          Toast.show({
            type: 'info',
            text1: 'No products found',
            text2: `No results for "${search}"`,
            position: 'top',
            visibilityTime: 2000,
          });
        } else if (!isOnline) {
          Toast.show({
            type: 'warning',
            text1: 'No products cached',
            text2: 'Please connect to internet to load products',
            position: 'top',
            visibilityTime: 4000,
          });
        }
      }
      
      if (append) {
        setProducts(prev => {
          const updated = [...prev, ...newProducts];
          console.log('[NewOrderForm] 📝 Appending products. Total now:', updated.length);
          return updated;
        });
      } else {
        console.log('[NewOrderForm] 📝 Setting products:', newProducts.length);
        setProducts(newProducts);
      }

      // Check if there are more pages based on local results
      const hasMorePages = newProducts.length >= 20; // If we got full page, might be more
      setHasMore(hasMorePages);
      
      console.log('[NewOrderForm] 📄 Pagination:', { 
        page: pageNum, 
        loaded: newProducts.length, 
        hasMore: hasMorePages 
      });
    } catch (error: any) {
      console.error('[NewOrderForm] ❌ Failed to load products:', error);
      console.error('[NewOrderForm] ❌ Error details:', {
        message: error?.message,
        response: error?.response?.data,
        status: error?.response?.status,
      });
      
      Toast.show({
        type: 'error',
        text1: 'Failed to load products',
        text2: error?.message || 'Please try again',
        position: 'top',
        visibilityTime: 4000,
      });
    } finally {
      console.log('[NewOrderForm] 🏁 Finished loading. Setting loading states to false');
      setLoading(false);
      setLoadingMore(false);
    }
  }, []);

  // Initial load
  useEffect(() => {
    if (visible) {
      loadProducts(1, false, '');
      setPage(1);
      setSelectedProducts(new Map());
      setNotes('');
      setSearchQuery('');
      setShowDropdown(true); // Auto-show dropdown with products
    }
  }, [visible, loadProducts]);

  // Handle search with debounce
  useEffect(() => {
    if (searchTimeout) {
      clearTimeout(searchTimeout);
    }

    const timeout = setTimeout(() => {
      console.log('[NewOrderForm] Searching for:', searchQuery);
      setPage(1);
      loadProducts(1, false, searchQuery);
      
      // Keep dropdown open when searching
      if (searchQuery.length > 0) {
        setShowDropdown(true);
      }
    }, 500); // 500ms debounce

    setSearchTimeout(timeout);

    return () => {
      if (timeout) clearTimeout(timeout);
    };
  }, [searchQuery]);

  // Load more on scroll
  const handleLoadMore = () => {
    if (!loadingMore && hasMore) {
      const nextPage = page + 1;
      setPage(nextPage);
      loadProducts(nextPage, true, searchQuery);
    }
  };

  // Toggle product checkbox
  const handleToggleProduct = (product: Product) => {
    const newSelected = new Map(selectedProducts);
    
    if (newSelected.has(product._id)) {
      // Uncheck - remove product
      newSelected.delete(product._id);
    } else {
      // Check - add product with default values
      const currentPrice = product.currentPrice || product.price || 0;
      const newPrice = product.newPrice || product.price || currentPrice;
      
      newSelected.set(product._id, {
        product,
        quantity: 1,
        currentPrice: currentPrice,
        newPrice: currentPrice, // Default to current price
        useNewPrice: false, // Default to current price
      });
    }
    
    setSelectedProducts(newSelected);
    setShowDropdown(false); // Hide dropdown after selection
  };

  // Update quantity
  const handleQuantityChange = (productId: string, quantity: number) => {
    const newSelected = new Map(selectedProducts);
    const product = newSelected.get(productId);
    
    if (product && quantity > 0) {
      newSelected.set(productId, { ...product, quantity });
      setSelectedProducts(newSelected);
    }
  };

  // Update new price (user can manually edit)
  const handleNewPriceChange = (productId: string, newPrice: number) => {
    const newSelected = new Map(selectedProducts);
    const selected = newSelected.get(productId);
    
    if (selected) {
      const validPrice = newPrice > 0 ? newPrice : selected.currentPrice;
      newSelected.set(productId, {
        ...selected,
        newPrice: validPrice,
        useNewPrice: true, // Automatically switch to new price when edited
      });
      setSelectedProducts(newSelected);
    }
  };

  // Calculate total
  const calculateTotal = () => {
    let total = 0;
    selectedProducts.forEach(selected => {
      const price = selected.useNewPrice ? selected.newPrice : selected.currentPrice;
      total += price * selected.quantity;
    });
    return total;
  };

  // Submit order
  const handleSubmit = async () => {
    // Prevent submission if orders already exist
    if (hasExistingOrders) {
      Alert.alert(
        'Orders Already Submitted',
        'This visit already has orders. Orders cannot be edited or replaced once submitted.',
        [{ text: 'OK' }]
      );
      return;
    }

    if (selectedProducts.size === 0) {
      Alert.alert('Error', 'Please select at least one product');
      return;
    }

    setSubmitting(true);

    try {
      // Check network connectivity first
      const isOnline = await NetworkUtils.checkConnection();
      console.log('[NewOrderForm] 🌐 Network status:', isOnline ? 'ONLINE' : 'OFFLINE');

      let finalVisitId = visitId;
      
      // Step 1: Create visit if visitId doesn't exist
      if (!finalVisitId) {
        if (!allocationId) {
          console.error('❌ [NewOrderForm] No visitId and no allocationId provided!');
          Alert.alert('Error', 'Cannot create visit. Missing allocation information.');
          return;
        }
        
        console.log('📝 [NewOrderForm] No visitId provided, creating visit first...');
        const today = new Date();
        
        if (isOnline) {
          try {
            const createVisitResponse = await visitApiService.createVisit({
              allocationId: allocationId,
              visitDateTime: today.toISOString(),
              duration: 60,
              notes: notes || '',
            });
            
            console.log('📦 [NewOrderForm] Create visit response:', createVisitResponse);
            
            // Try multiple paths to extract visit ID
            finalVisitId = createVisitResponse?.data?.visit?._id || 
                          createVisitResponse?.data?._id || 
                          createVisitResponse?.visit?._id ||
                          createVisitResponse?._id;
            
            console.log('✅ [NewOrderForm] Visit created with ID:', finalVisitId);
            
            if (!finalVisitId) {
              console.error('❌ [NewOrderForm] Failed to get visit ID from response:', createVisitResponse);
              
              // Check if it's a validation error
              if (createVisitResponse?.success === false) {
                const errorMsg = createVisitResponse?.message || 'Failed to create visit';
                Alert.alert(
                  'Cannot Create Visit',
                  errorMsg + '\n\nPlease mark the shop as visited first, then create an order.',
                  [{ text: 'OK' }]
                );
                return;
              }
              
              throw new Error('Failed to create visit - no visit ID in response');
            }
          } catch (createError: any) {
            console.error('❌ [NewOrderForm] Create visit error:', createError);
            const errorMessage = createError?.response?.data?.message || 
                                createError?.message || 
                                'Failed to create visit';
            Alert.alert(
              'Cannot Create Visit',
              errorMessage + '\n\nPlease mark the shop as visited first, then create an order.',
              [{ text: 'OK' }]
            );
            return;
          }
        } else {
          // Offline: Generate temporary visit ID
          finalVisitId = `offline_visit_${Date.now()}`;
          console.log('📦 [NewOrderForm] Generated offline visit ID:', finalVisitId);
        }
      }

      // Step 2: Format orders data
      const orders = Array.from(selectedProducts.values()).map(selected => ({
        id: String(selected.product._id),
        name: selected.product.name,
        quantity: selected.quantity,
        price: selected.currentPrice,
        newPrice: selected.newPrice,
      }));

      // Step 3: Submit order with offline fallback
      console.log('📦 [NewOrderForm] Is online:', isOnline);
      if (isOnline) {
        try {
          // Try API call when online
          const payload = {
            duration: 60,
            notes: notes || '',
            orders,
          };

          console.log('📤 [NewOrderForm] Updating visit with orders via PUT...');
          console.log('📦 [NewOrderForm] Visit ID:', finalVisitId);
          console.log('📦 [NewOrderForm] Payload:', JSON.stringify(payload, null, 2));

          const updateVisitResponse = await visitApiService.updateVisit(finalVisitId, payload);

          console.log('✅ [NewOrderForm] ========================================');
          console.log('✅ [NewOrderForm] ORDER SUBMITTED SUCCESSFULLY!');
          console.log('✅ [NewOrderForm] ========================================');
          console.log('✅ [NewOrderForm] Full Response:', JSON.stringify(updateVisitResponse, null, 2));
          console.log('✅ [NewOrderForm] Orders Count:', updateVisitResponse?.data?.visit?.orders?.length || 0);
          console.log('✅ [NewOrderForm] ========================================');

          Toast.show({
            type: 'success',
            text1: 'Order Submitted',
            text2: `${orders.length} products added to order`,
          });

          onSuccess();
          onClose();
        } catch (apiError: any) {
          // API failed, fall back to offline mode
          console.error('❌ [NewOrderForm] API failed, saving offline:', apiError?.message);
          await saveOrderOffline(finalVisitId, orders);
        }
      } else {
        // Offline mode: Save locally
        await saveOrderOffline(finalVisitId, orders);
      }
    } catch (error: any) {
      console.error('❌ [NewOrderForm] Failed to submit order:', error);
      Toast.show({
        type: 'error',
        text1: 'Failed to submit order',
        text2: error?.message || 'Please try again',
      });
    } finally {
      setSubmitting(false);
    }
  };

  // Helper function to save order offline
  const saveOrderOffline = async (visitId: string, orders: any[]) => {
    try {
      console.log('💾 [NewOrderForm] Saving order offline...');
      
      // Queue the order update for sync
      const { enqueueSync } = require('../services/sync/enqueue');
      await enqueueSync(
        'visits',
        visitId,
        visitId.startsWith('offline_') ? 'INSERT' : 'UPDATE',
        {
          visit_id: visitId,
          allocation_id: allocationId,
          shop_id: shopId,
          shop_name: shopName,
          orders: orders,
          notes: notes || '',
          duration: 60,
          visit_date: new Date().toISOString(),
        }
      );

      console.log('✅ [NewOrderForm] Order saved offline and queued for sync');
      
      Toast.show({
        type: 'info',
        text1: 'Order Saved Offline',
        text2: `${orders.length} products will sync when online`,
        position: 'top',
        visibilityTime: 4000,
      });

      onSuccess();
      onClose();
    } catch (offlineError: any) {
      console.error('❌ [NewOrderForm] Failed to save offline:', offlineError);
      throw offlineError;
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent={false}>
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>{hasExistingOrders ? 'View Orders' : 'New Order'}</Text>
          <Text style={styles.shopName}>{shopName}</Text>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Icon name="close" size={28} color="#fff" />
          </TouchableOpacity>
        </View>

        {/* Warning Banner for Existing Orders */}
        {hasExistingOrders && (
          <View style={styles.warningBanner}>
            <Icon name="info" size={20} color="#ff9800" />
            <Text style={styles.warningText}>
              Orders have already been submitted for this visit and cannot be edited.
            </Text>
          </View>
        )}

        {/* Search with Dropdown */}
        <View style={styles.searchSection}>
          <View style={styles.searchInputRow}>
            <Icon name="search" size={20} color="#999" style={styles.searchIcon} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search products..."
              value={searchQuery}
              onChangeText={(text) => {
                setSearchQuery(text);
                // Dropdown will show automatically via useEffect when typing
              }}
              onFocus={() => {
                // Show dropdown when user clicks/focuses on search
                console.log('[NewOrderForm] Search input focused - showing dropdown');
                setShowDropdown(true);
                // Load products if not already loaded
                if (products.length === 0) {
                  loadProducts(1, false, '');
                }
              }}
            />
            {/* Clear button */}
            {searchQuery.length > 0 && (
              <TouchableOpacity
                onPress={() => {
                  setSearchQuery('');
                  setShowDropdown(true); // Keep dropdown open, show all products
                  loadProducts(1, false, ''); // Reload all products
                }}
                style={styles.clearButton}
              >
                <Icon name="clear" size={20} color="#999" />
              </TouchableOpacity>
            )}
          </View>
          
          {/* Dropdown for search results */}
          {showDropdown && (
            <View style={styles.dropdown}>
              <View style={styles.dropdownHeader}>
                <Text style={styles.dropdownTitle}>
                  {searchQuery ? `Search results for "${searchQuery}"` : 'All Products'}
                </Text>
                <TouchableOpacity
                  onPress={() => setShowDropdown(false)}
                  style={styles.dropdownCloseButton}
                >
                  <Icon name="close" size={20} color="#666" />
                </TouchableOpacity>
              </View>
              
              {loading ? (
                <ActivityIndicator size="small" color={Colors.primaryblue} style={{ padding: 20 }} />
              ) : products.length === 0 ? (
                <View style={styles.dropdownEmptyContainer}>
                  <Icon name="search-off" size={40} color="#ccc" />
                  <Text style={styles.dropdownEmptyText}>
                    {searchQuery ? `No products found for "${searchQuery}"` : 'No products available'}
                  </Text>
                  {searchQuery && (
                    <TouchableOpacity
                      onPress={() => {
                        setSearchQuery('');
                        loadProducts(1, false, '');
                      }}
                      style={styles.showAllButton}
                    >
                      <Text style={styles.showAllButtonText}>Show All Products</Text>
                    </TouchableOpacity>
                  )}
                </View>
              ) : (
                <>
                  <ScrollView
                    style={styles.dropdownList}
                    nestedScrollEnabled={true}
                    showsVerticalScrollIndicator={true}
                    bounces={false}
                  >
                    {products.map((item, index) => (
                      <TouchableOpacity
                        key={item._id || `product-${index}`}
                        style={styles.dropdownItem}
                        onPress={() => handleToggleProduct(item)}
                      >
                        <Icon
                          name={selectedProducts.has(item._id) ? "check-box" : "check-box-outline-blank"}
                          size={24}
                          color={selectedProducts.has(item._id) ? Colors.primaryblue : "#999"}
                        />
                        <View style={styles.dropdownItemContent}>
                          <Text style={styles.dropdownItemName}>{item.name}</Text>
                          <Text style={styles.dropdownItemPrice}>₨{item.price || 0}</Text>
                        </View>
                      </TouchableOpacity>
                    ))}
                    
                    {hasMore && (
                      <TouchableOpacity
                        onPress={handleLoadMore}
                        style={styles.loadMoreButton}
                        disabled={loadingMore}
                      >
                        {loadingMore ? (
                          <ActivityIndicator size="small" color={Colors.primaryblue} />
                        ) : (
                          <Text style={styles.loadMoreText}>Load More Products</Text>
                        )}
                      </TouchableOpacity>
                    )}
                  </ScrollView>
                  
                  {/* Scroll indicator - shows there are more items below */}
                  {products.length > 4 && (
                    <View style={styles.scrollIndicator}>
                      <Icon name="keyboard-arrow-down" size={20} color="#999" />
                      <Text style={styles.scrollIndicatorText}>Scroll for more products</Text>
                    </View>
                  )}
                </>
              )}
            </View>
          )}
        </View>

        {/* Scrollable Content Area */}
        <ScrollView 
          style={styles.contentArea} 
          showsVerticalScrollIndicator={false}
          scrollEnabled={!showDropdown}
          keyboardShouldPersistTaps="handled"
        >
          {/* Selected Products List */}
          <View style={styles.productSection}>
            <Text style={styles.sectionTitle}>
              Selected Products ({selectedProducts.size})
            </Text>
            
            {selectedProducts.size === 0 ? (
              <View style={styles.emptyContainer}>
                <Icon name="shopping-cart" size={48} color="#ccc" />
                <Text style={styles.emptyText}>No products selected</Text>
                <Text style={styles.emptySubText}>Search and select products above</Text>
              </View>
            ) : (
              Array.from(selectedProducts.values()).map((selectedItem) => {
                const item = selectedItem.product;
                
                return (
                    <View key={item._id} style={styles.productItem}>
                      {/* Product Header with Remove Button */}
                      <View style={styles.productHeader}>
                        <View style={styles.productNameRow}>
                          <Icon name="check-circle" size={24} color={Colors.primaryblue} />
                          <Text style={styles.productName}>{item.name}</Text>
                        </View>
                        <TouchableOpacity
                          onPress={() => handleToggleProduct(item)}
                          style={styles.removeButton}
                        >
                          <Icon name="close" size={20} color="#ff4444" />
                        </TouchableOpacity>
                      </View>

                      <View style={styles.productDetails}>
                        {/* Quantity Controls */}
                        <View style={styles.quantitySection}>
                          <Text style={styles.label}>Quantity:</Text>
                          <View style={styles.quantityControls}>
                            <TouchableOpacity
                              onPress={() => handleQuantityChange(item._id, selectedItem.quantity - 1)}
                              style={styles.quantityButton}
                              disabled={selectedItem.quantity <= 1}
                            >
                              <Icon name="remove" size={18} color="#fff" />
                            </TouchableOpacity>
                            
                            <TextInput
                              style={styles.quantityInput}
                              value={String(selectedItem.quantity)}
                              keyboardType="numeric"
                              onChangeText={text => {
                                const qty = parseInt(text) || 1;
                                handleQuantityChange(item._id, qty);
                              }}
                            />
                            
                            <TouchableOpacity
                              onPress={() => handleQuantityChange(item._id, selectedItem.quantity + 1)}
                              style={styles.quantityButton}
                            >
                              <Icon name="add" size={18} color="#fff" />
                            </TouchableOpacity>
                          </View>
                        </View>

                        {/* Price Section */}
                        <View style={styles.priceSection}>
                          <View style={styles.priceRow}>
                            <Text style={styles.label}>Current Price:</Text>
                            <Text style={styles.priceValue}>₨{selectedItem.currentPrice.toFixed(2)}</Text>
                          </View>
                          
                          <View style={styles.priceRow}>
                            <Text style={styles.label}>New Price:</Text>
                            <TextInput
                              style={styles.priceInput}
                              value={String(selectedItem.newPrice)}
                              keyboardType="numeric"
                              onChangeText={text => {
                                const price = parseFloat(text) || selectedItem.currentPrice;
                                handleNewPriceChange(item._id, price);
                              }}
                              placeholder="Enter new price"
                            />
                          </View>
                        </View>

                        {/* Price Info - Show which price is being used */}
                        <View style={styles.priceInfoSection}>
                          <Text style={styles.priceInfoText}>
                            {selectedItem.useNewPrice 
                              ? `Using New Price: ₨${selectedItem.newPrice.toFixed(2)}`
                              : `Using Current Price: ₨${selectedItem.currentPrice.toFixed(2)}`
                            }
                          </Text>
                        </View>

                        {/* Subtotal */}
                        <View style={styles.subtotalSection}>
                          <Text style={styles.subtotalLabel}>Subtotal:</Text>
                          <Text style={styles.subtotalAmount}>
                            ₨{((selectedItem.useNewPrice ? selectedItem.newPrice : selectedItem.currentPrice) * selectedItem.quantity).toFixed(2)}
                          </Text>
                        </View>
                      </View>
                    </View>
                  );
                })
            )}
          </View>

          {/* Notes */}
          <View style={styles.notesSection}>
          <Text style={styles.sectionTitle}>Notes (Optional)</Text>
          <TextInput
            style={styles.notesInput}
            placeholder="Add order notes..."
            value={notes}
            onChangeText={setNotes}
            multiline
            numberOfLines={3}
          />
        </View>
        </ScrollView>

        {/* Total & Submit */}
        <View style={styles.footer}>
          <View style={styles.totalSection}>
            <Text style={styles.totalLabel}>Total Amount:</Text>
            <Text style={styles.totalAmount}>${calculateTotal().toFixed(2)}</Text>
          </View>

          <TouchableOpacity
            style={[
              styles.submitButton, 
              (submitting || hasExistingOrders || selectedProducts.size === 0) && styles.submitButtonDisabled
            ]}
            onPress={handleSubmit}
            disabled={submitting || hasExistingOrders || selectedProducts.size === 0}
          >
            {submitting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.submitButtonText}>
                {hasExistingOrders ? 'Orders Already Submitted' : 'Submit Order'}
              </Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.offwhite,
  },
  header: {
    backgroundColor: Colors.primaryblue,
    padding: 20,
    paddingTop: 50,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: {
    fontSize: FontSize.H1,
    fontWeight: 'bold',
    color: Colors.white,
  },
  shopName: {
    fontSize: FontSize.Body,
    color: Colors.white,
    marginTop: 5,
    opacity: 0.9,
  },
  closeButton: {
    padding: 5,
  },
  warningBanner: {
    backgroundColor: '#fff3cd',
    borderLeftWidth: 4,
    borderLeftColor: '#ff9800',
    padding: 15,
    marginHorizontal: 15,
    marginTop: 10,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
  warningText: {
    flex: 1,
    marginLeft: 10,
    fontSize: FontSize.Body,
    color: '#856404',
    lineHeight: 20,
  },
  scrollView: {
    flex: 1,
  },
  contentArea: {
    flex: 1,
  },
  searchSection: {
    backgroundColor: Colors.white,
    margin: 15,
    borderRadius: 8,
    elevation: 2,
    position: 'relative',
    zIndex: 1000,
  },
  searchInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    padding: 12,
    fontSize: FontSize.Body,
  },
  dropdown: {
    position: 'absolute',
    top: 50,
    left: 0,
    right: 0,
    backgroundColor: Colors.white,
    borderRadius: 8,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    // maxHeight: 280,
    zIndex: 1001,
  },
  dropdownList: {
    maxHeight: 420,
  },
  dropdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  dropdownItemContent: {
    flex: 1,
    marginLeft: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  dropdownItemName: {
    fontSize: FontSize.Body,
    color: Colors.black,
    flex: 1,
  },
  dropdownItemPrice: {
    fontSize: FontSize.Body,
    fontWeight: '600',
    color: Colors.primaryblue,
  },
  dropdownEmptyText: {
    padding: 20,
    textAlign: 'center',
    color: Colors.grey,
    fontSize: FontSize.Body,
  },
  productSection: {
    backgroundColor: Colors.white,
    marginHorizontal: 15,
    marginBottom: 10,
    borderRadius: 8,
    padding: 15,
    elevation: 2,
  },
  sectionTitle: {
    fontSize: FontSize.H3,
    fontWeight: '600',
    marginBottom: 15,
    color: Colors.black,
  },
  loader: {
    marginVertical: 20,
  },
  productItem: {
    backgroundColor: Colors.offwhite,
    marginBottom: 10,
    borderRadius: 8,
    padding: 12,
    elevation: 1,
  },
  productHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  productNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  removeButton: {
    padding: 5,
  },
  checkboxContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  productName: {
    fontSize: FontSize.Body,
    fontWeight: '500',
    marginLeft: 10,
    flex: 1,
    color: Colors.black,
  },
  productDetails: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  quantitySection: {
    marginBottom: 12,
  },
  label: {
    fontSize: FontSize.Caption,
    fontWeight: '600',
    marginBottom: 8,
    color: Colors.grey,
  },
  quantityControls: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  quantityButton: {
    width: 36,
    height: 36,
    backgroundColor: Colors.primaryblue,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  quantityInput: {
    width: 60,
    height: 36,
    borderWidth: 1,
    borderColor: Colors.grey,
    borderRadius: 6,
    textAlign: 'center',
    marginHorizontal: 10,
    fontSize: FontSize.Body,
  },
  priceSection: {
    marginBottom: 12,
  },
  priceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  priceValue: {
    fontSize: FontSize.Body,
    fontWeight: '600',
    color: Colors.black,
  },
  priceInput: {
    borderWidth: 1,
    borderColor: Colors.grey,
    borderRadius: 6,
    padding: 8,
    fontSize: FontSize.Body,
    minWidth: 100,
    textAlign: 'right',
  },
  priceInfoSection: {
    marginBottom: 12,
    padding: 8,
    backgroundColor: Colors.primaryblue + '10',
    borderRadius: 6,
  },
  priceInfoText: {
    fontSize: FontSize.Caption,
    fontWeight: '600',
    color: Colors.primaryblue,
    textAlign: 'center',
  },
  subtotalSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  subtotalLabel: {
    fontSize: FontSize.Body,
    fontWeight: '600',
    color: Colors.grey,
  },
  subtotalAmount: {
    fontSize: FontSize.H3,
    fontWeight: 'bold',
    color: Colors.primaryblue,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
  },
  emptyText: {
    fontSize: FontSize.Body,
    fontWeight: '600',
    color: Colors.grey,
    marginTop: 12,
    textAlign: 'center',
  },
  emptySubText: {
    fontSize: FontSize.Caption,
    color: '#999',
    marginTop: 4,
    textAlign: 'center',
  },
  notesSection: {
    backgroundColor: '#fff',
    padding: 15,
    marginHorizontal: 15,
    marginBottom: 10,
    borderRadius: 8,
  },
  notesInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 10,
    minHeight: 80,
    textAlignVertical: 'top',
  },
  footer: {
    backgroundColor: '#fff',
    padding: 15,
    marginTop: 'auto',
  },
  totalSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },
  totalLabel: {
    fontSize: 18,
    fontWeight: '600',
  },
  totalAmount: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#007AFF',
  },
  submitButton: {
    backgroundColor: '#34C759',
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
  },
  submitButtonDisabled: {
    backgroundColor: '#ccc',
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  clearButton: {
    padding: 8,
    marginRight: 5,
  },
  dropdownHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    backgroundColor: '#f8f8f8',
  },
  dropdownTitle: {
    fontSize: FontSize.Body,
    fontWeight: '600',
    color: Colors.black,
    flex: 1,
  },
  dropdownCloseButton: {
    padding: 4,
  },
  dropdownEmptyContainer: {
    padding: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  showAllButton: {
    marginTop: 15,
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: Colors.primaryblue,
    borderRadius: 6,
  },
  showAllButtonText: {
    color: Colors.white,
    fontSize: FontSize.Body,
    fontWeight: '600',
  },
  loadMoreButton: {
    padding: 15,
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  loadMoreText: {
    color: Colors.primaryblue,
    fontSize: FontSize.Body,
    fontWeight: '600',
  },
  scrollIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 8,
    backgroundColor: '#f8f8f8',
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  scrollIndicatorText: {
    fontSize: 12,
    color: '#999',
    marginLeft: 4,
  },
});

export default NewOrderForm;
