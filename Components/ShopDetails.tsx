import React, { useState } from 'react';
import {
  View,
  StyleSheet,
  Alert,
  FlatList,
  TouchableOpacity,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../types/navigation';
import Container from '../Abstracts/Container';
import TextInputs from '../Abstracts/TextInputs';
import Button from '../Abstracts/Button';
import ValidText from '../Abstracts/ValidText';
import HeaderBar from '../Abstracts/HeaderBar';
import { Colors, FontSize } from '../Theme';
import { Shop } from '../types/shop';

type Props = NativeStackScreenProps<RootStackParamList, 'ShopDetails'>;

interface Product {
  id: string;
  name: string;
  quantity: number;
}

type ShopWithProducts = Shop & {
  products?: Product[];
};

const ShopDetails: React.FC<Props> = ({ route, navigation }) => {
  const { shop, shopId, onUpdate } = route.params;

  if (!shop && !shopId) {
    console.error('Either shop or shopId must be provided');
    navigation.goBack();
    return null;
  }

  const initial: ShopWithProducts = shop || {
    id: shopId!,
    name: '',
    address: '',
    owner: '',
    status: 'Pending',
    products: [],
  };

  const [name, setName] = useState(initial.name);
  const [owner, setOwner] = useState(initial.owner);
  const [address, setAddress] = useState(initial.address);
  const [phone, setPhone] = useState((initial as any).phone || '');

  // Initialize products from shop or use default list
  const [products, setProducts] = useState<Product[]>(
    (shop as ShopWithProducts)?.products || [
      { id: '1', name: 'Pepsi', quantity: 0 },
      { id: '2', name: 'Coke', quantity: 0 },
      { id: '3', name: '7Up', quantity: 0 },
    ]
  );

  const updateQuantity = (id: string, value: number) => {
    setProducts(prev =>
      prev.map(p => (p.id === id ? { ...p, quantity: value } : p))
    );
  };

  const handleSave = async () => {
    try {
      if (!name.trim()) {
        Alert.alert('Validation', 'Shop name is required');
        return;
      }

      if (!owner.trim()) {
        Alert.alert('Validation', 'Owner name is required');
        return;
      }

      const updated: ShopWithProducts = {
        ...initial,
        name: name.trim(),
        owner: owner.trim(),
        address: address.trim(),
        phone: phone.trim() || undefined,
        products,
      };

      if (onUpdate) {
        try {
          await Promise.resolve(onUpdate(updated));
        } catch (error) {
          console.error('Failed to update shop:', error);
          Alert.alert('Error', 'Failed to save shop details. Please try again.');
          return;
        }
      }

      navigation.goBack();
    } catch (error) {
      console.error('Error in handleSave:', error);
      Alert.alert('Error', 'An unexpected error occurred. Please try again.');
    }
  };

  const renderProduct = ({ item }: { item: Product }) => (
    <View style={styles.productCard}>
      <ValidText text={item.name} style={styles.productName} />
      <View style={styles.quantityRow}>
        {[5, 10, 20, 30].map(q => (
          <TouchableOpacity
            key={q}
            style={[
              styles.quantityButton,
              item.quantity === q && styles.selectedButton,
            ]}
            onPress={() => updateQuantity(item.id, q)}
          >
            <ValidText
              text={`${q}`}
              style={[
                styles.quantityText,
                item.quantity === q && styles.selectedText,
              ]}
            />
          </TouchableOpacity>
        ))}
      </View>
      <TextInputs
        value={item.quantity ? String(item.quantity) : ''}
        onChangeText={text => {
          const val = parseInt(text) || 0;
          updateQuantity(item.id, val);
        }}
        placeholder="Enter custom qty"
        keyboardType="numeric"
        style={styles.quantityInput}
      />
    </View>
  );

  return (
    <Container>
      <HeaderBar title="Edit Shop" showBack />
      <ValidText text="Shop Details" style={styles.title} />

      <TextInputs value={name} onChangeText={setName} placeholder="Shop name" />
      <TextInputs value={owner} onChangeText={setOwner} placeholder="Owner" />
      <TextInputs value={address} onChangeText={setAddress} placeholder="Address" />
      <TextInputs value={phone} onChangeText={setPhone} placeholder="Phone" keyboardType="phone-pad" />

      <ValidText text="Product List" style={styles.subTitle} />

      <FlatList
        data={products}
        renderItem={renderProduct}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.productList}
      />

      <Button
        text="Save"
        onPress={handleSave}
        backgroundColor={Colors.primaryblue}
        color={Colors.white}
        style={styles.saveButton}
      />
    </Container>
  );
};

const styles = StyleSheet.create({
  title: {
    fontSize: FontSize.H3,
    fontWeight: '700',
    marginBottom: 12,
  },
  subTitle: {
    fontSize: FontSize.H4,
    fontWeight: '600',
    marginTop: 20,
    marginBottom: 10,
    alignSelf: 'center',
  },
  productList: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  productCard: {
    width: '90%',
    backgroundColor: '#f7faff',
    borderRadius: 10,
    padding: 12,
    marginBottom: 12,
    alignItems: 'center',
    elevation: 2,
  },
  productName: {
    fontSize: FontSize.Subhead,
    fontWeight: '700',
    color: Colors.black,
    marginBottom: 8,
  },
  quantityRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: 8,
  },
  quantityButton: {
    borderWidth: 1,
    borderColor: Colors.primaryblue,
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 12,
    marginHorizontal: 5,
  },
  selectedButton: {
    backgroundColor: Colors.primaryblue,
  },
  quantityText: {
    color: Colors.primaryblue,
    fontWeight: '600',
  },
  selectedText: {
    color: Colors.white,
  },
  quantityInput: {
    width: '60%',
    textAlign: 'center',
  },
  saveButton: {
    marginTop: 20,
  },
});

export default ShopDetails;
