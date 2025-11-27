import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Alert } from 'react-native';
import { Product, Order, OrderItem } from '../types/product';
import { ProductService } from '../services/ProductService';
import { VisitService } from '../services/visits/VisitService';
import { AuthStorageService } from '../services/auth/AuthStorageService';
import Container from '../Abstracts/Container';
import Button from '../Abstracts/Button';
import TextInputs from '../Abstracts/TextInputs';

import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../types/navigation';

type ShopVisitProps = NativeStackScreenProps<RootStackParamList, 'ShopVisit'>;

export const ShopVisit: React.FC<ShopVisitProps> = ({ route, navigation }) => {
  const { shopId, visitId, onComplete } = route.params;
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedProducts, setSelectedProducts] = useState<Map<string, number>>(new Map());
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadProducts();
  }, []);

  const loadProducts = async () => {
    try {
      const productService = ProductService.getInstance();
      const shopProducts = await productService.getShopProducts(shopId);
      setProducts(shopProducts);
    } catch (error) {
      Alert.alert('Error', 'Failed to load products');
    }
  };

  const handleQuantityChange = (productId: string, quantity: number) => {
    const newSelected = new Map(selectedProducts);
    if (quantity > 0) {
      newSelected.set(productId, quantity);
    } else {
      newSelected.delete(productId);
    }
    setSelectedProducts(newSelected);
  };

  const handleSubmit = async () => {
    try {
      setLoading(true);
      const user = await AuthStorageService.getInstance().getCurrentUser();
      if (!user) throw new Error('No user logged in');

      // Create order items from selected products
      const items = Array.from(selectedProducts.entries())
        .map(([productId, quantity]) => {
          const product = products.find(p => p.id === productId);
          if (!product) return null;
          const item: Omit<OrderItem, 'id'> = {
            productId,
            quantity,
            price: product.price,
            notes: undefined
          };
          return item;
        })
        .filter((item): item is Omit<OrderItem, 'id'> => item !== null);

      if (items.length > 0) {
        // Create order
        const productService = ProductService.getInstance();
        await productService.createOrder({
          shopId,
          visitId,
          userId: user.id,
          items
        });
      }

      // Complete visit
      await VisitService.completeVisit({
        visitId,
        notes: notes.trim() || undefined
      });

      onComplete();
      navigation.goBack();
    } catch (error) {
      Alert.alert('Error', 'Failed to submit visit and order');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Container>
      <Text style={styles.title}>Place Order</Text>
      <FlatList
        data={products}
        keyExtractor={item => item.id}
        renderItem={({ item }) => (
          <View style={styles.productRow}>
            <View style={styles.productInfo}>
              <Text style={styles.productName}>{item.name}</Text>
              <Text style={styles.productPrice}>${item.price.toFixed(2)} / {item.unit}</Text>
              {!item.inStock && <Text style={styles.outOfStock}>Out of Stock</Text>}
            </View>
            <View style={styles.quantityControls}>
              <TouchableOpacity
                onPress={() => handleQuantityChange(item.id, (selectedProducts.get(item.id) || 0) - 1)}
                disabled={!selectedProducts.has(item.id)}
                style={[styles.quantityButton, !selectedProducts.has(item.id) && styles.quantityButtonDisabled]}
              >
                <Text>-</Text>
              </TouchableOpacity>
              <Text style={styles.quantity}>{selectedProducts.get(item.id) || 0}</Text>
              <TouchableOpacity
                onPress={() => handleQuantityChange(item.id, (selectedProducts.get(item.id) || 0) + 1)}
                disabled={!item.inStock}
                style={[styles.quantityButton, !item.inStock && styles.quantityButtonDisabled]}
              >
                <Text>+</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      />
      <TextInputs
        value={notes}
        onChangeText={setNotes}
        placeholder="Add visit notes (optional)"
        multiline
        style={styles.notes}
      />
      <Button
        text={loading ? 'Submitting...' : 'Complete Visit & Submit Order'}
        onPress={handleSubmit}
        backgroundColor={loading ? '#ccc' : undefined}
      />
    </Container>
  );
};

const styles = StyleSheet.create({
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  productRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  productInfo: {
    flex: 1,
  },
  productName: {
    fontSize: 16,
    fontWeight: '500',
  },
  productPrice: {
    fontSize: 14,
    color: '#666',
  },
  outOfStock: {
    color: 'red',
    fontSize: 12,
  },
  quantityControls: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  quantityButton: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#e0e0e0',
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: 8,
  },
  quantityButtonDisabled: {
    opacity: 0.5,
  },
  quantity: {
    fontSize: 16,
    minWidth: 30,
    textAlign: 'center',
  },
  notes: {
    height: 80,
    marginVertical: 16,
  },
});