// import React, { useState } from 'react';
// import {
//   StyleSheet,
//   View,
//   ViewStyle,
//   Modal,
//   TouchableOpacity,
//   FlatList,
// } from 'react-native';
// import Button from '../Abstracts/Button';
// import ValidText from '../Abstracts/ValidText';
// import Container from '../Abstracts/Container';
// import { Colors, FontSize } from '../Theme';
// import { Shop } from '../types/shop';
// import Icon from 'react-native-vector-icons/MaterialIcons';

// interface ShopCardProps {
//   shop: Shop;
//   onMarkVisited?: (shopId: string) => void;
//   onEdit?: (shopId: string) => void;
//   style?: ViewStyle;
// }

// const ShopCard: React.FC<ShopCardProps> = ({ shop, onMarkVisited, onEdit, style }) => {
//   const [modalVisible, setModalVisible] = useState(false);
//   const visited = shop.status === 'Visited';

//   const handleEdit = () => {
//     setModalVisible(false);
//     if (onEdit) {
//       onEdit(shop.id);
//     }
//   };

//   return (
//     <>
//       <Container
//         style={[styles.card, visited ? styles.visited : styles.pending, style]}
//         paddingHorizontal={16}
//         paddingVertical={16}
//       >
//         <View style={styles.header}>
//           <ValidText text={shop.name} style={styles.shopName} />
//           <View
//             style={[
//               styles.statusPill,
//               visited ? styles.visitedPill : styles.pendingPill,
//             ]}
//           >
//             <ValidText
//               text={visited ? 'Visited' : 'Pending'}
//               style={[
//                 styles.statusText,
//                 { color: visited ? Colors.green : Colors.primaryblue },
//               ]}
//             />
//           </View>
//         </View>

//         <ValidText text={`Owner: ${shop.owner}`} style={styles.shopDetail} />
//         {/* <ValidText
//           text={`Address: ${shop.address}`}
//           style={styles.shopDetail}
//         />
//         <ValidText
//           text={`Phone: ${shop.phone ?? '-'}`}
//           style={styles.shopDetail}
//         />
//         {visited && (
//           <ValidText
//             text={`Last Visited: ${shop.lastVisited ?? '-'}`}
//             style={styles.visitedText}
//           />
//         )} */}

//         <View style={styles.footer}>
//           <Button
//             text="Details"
//             onPress={() => setModalVisible(true)}
//             backgroundColor={visited ? '#f3faf5' : '#faf3ff'}
//             color={visited ? Colors.green : Colors.primaryblue}
//             width="48%"
//             height={42}
//             borderRadius={10}
//             elevation={2}
//             fontSize={FontSize.Button}
//           />
//           {onMarkVisited && !visited && (
//             <Button
//               text="Mark Visit"
//               onPress={() => onMarkVisited(shop.id)}
//               backgroundColor={Colors.primaryblue}
//               color={Colors.white}
//               width="48%"
//               height={42}
//               borderRadius={10}
//               elevation={2}
//               fontSize={FontSize.Button}
//             />
//           )}
//           {visited && (
//             <Button
//               text="Visited"
//               onPress={() => {}}
//               backgroundColor="#f0f0f0"
//               color={Colors.grey}
//               width="48%"
//               height={42}
//               borderRadius={10}
//               elevation={2}
//               fontSize={FontSize.Button}
//               disabled={true}
//             />
//           )}
//         </View>
//       </Container>

//       <Modal
//         visible={modalVisible}
//         transparent
//         animationType="fade"
//         onRequestClose={() => setModalVisible(false)}
//       >
//         <View style={styles.modalOverlay}>
//           <View
//             style={[
//               styles.modalCard,
//               visited ? styles.visited : styles.pending,
//             ]}
//           >
//             <View style={styles.modalHeader}>
//               <ValidText text="Shop Details" style={styles.modalTitle} />
//               <View style={styles.modalHeaderActions}>
//                 {/* {onEdit && (
//                   <TouchableOpacity
//                     onPress={handleEdit}
//                     style={styles.editButton}
//                   >
//                     <Icon name="edit" size={20} color={Colors.primaryblue} />
//                   </TouchableOpacity>
//                 )} */}
//                 <TouchableOpacity onPress={() => setModalVisible(false)}>
//                   <Icon name="close" size={22} color={Colors.grey} />
//                 </TouchableOpacity>
//               </View>
//             </View>

//             <ValidText text={`Name: ${shop.name}`} style={styles.modalText} />
//             <ValidText text={`Owner: ${shop.owner}`} style={styles.modalText} />
//             <ValidText
//               text={`Address: ${shop.address}`}
//               style={styles.modalText}
//             />
//             <ValidText
//               text={`Phone: ${shop.phone ?? '-'}`}
//               style={styles.modalText}
//             />
//             <ValidText
//               text={`Status: ${shop.status}`}
//               style={styles.modalText}
//             />
//             {shop.lastVisited && (
//               <ValidText
//                 text={`Last Visited: ${shop.lastVisited}`}
//                 style={styles.modalText}
//               />
//             )}

//               <View style={{ flexDirection: 'row', gap: 8 }}>
//                 <Button
//                   text="Close"
//                   onPress={() => setModalVisible(false)}
//                   backgroundColor={visited ? '#f3faf5' : '#faf3ff'}
//                   color={visited ? Colors.green : Colors.primaryblue}
//                   width="100%"
//                   height={42}
//                   borderRadius={10}
//                   fontSize={FontSize.Button}
//                 />
//                 {/* Edit button - only enabled when onEdit is provided */}
//                 {/* {typeof onEdit === 'function' && (
//                   <Button
//                     text="Edit"
//                     onPress={() => {
//                       setModalVisible(false);
//                       onEdit(shop.id);
//                     }}
//                     backgroundColor={Colors.primaryblue}
//                     color={Colors.white}
//                     width="48%"
//                     height={42}
//                     borderRadius={10}
//                     fontSize={FontSize.Button}
//                   />
//                 )} */}
//               </View>
//           </View>
//         </View>
//       </Modal>
//     </>
//   );
// };

// const styles = StyleSheet.create({
//   card: {
//     flex:1,
//     borderRadius: 14,
//     elevation: 3,
//     backgroundColor: Colors.white,
//     shadowColor: '#000',
//     shadowOffset: { width: 0, height: 2 },
//     shadowOpacity: 0.08,
//     shadowRadius: 4,
//     marginBottom: 12,
//   },
//   visited: {
//     borderLeftWidth: 6,
//     borderLeftColor: Colors.green,
//     backgroundColor: '#f3faf5',
//   },
//   pending: {
//     borderLeftWidth: 6,
//     borderLeftColor: Colors.primaryblue,
//     backgroundColor: '#f7faff',
//   },
//   header: {
//     flexDirection: 'row',
//     justifyContent: 'space-between',
//     marginBottom: 10,
//     alignItems: 'center',
//   },
//   shopName: {
//     fontSize: FontSize.Subhead,
//     fontWeight: '700',
//     color: Colors.black,
//     flex: 1,
//     marginRight: 10,
//   },
//   statusPill: {
//     paddingHorizontal: 10,
//     paddingVertical: 4,
//     borderRadius: 20,
//     elevation: 1,
//   },
//   visitedPill: { backgroundColor: '#e0f5e8' },
//   pendingPill: { backgroundColor: '#e7f0ff' },
//   statusText: { fontSize: FontSize.Caption, fontWeight: '700' },
//   shopDetail: {
//     fontSize: FontSize.Body,
//     color: Colors.grey,
//     marginBottom: 4,
//   },
//   visitedText: {
//     fontSize: FontSize.Caption,
//     color: Colors.green,
//     marginTop: 4,
//   },
//   footer: {
//     flexDirection: 'row',
//     justifyContent: 'space-between',
//     marginTop: 14,
//   },
//   modalOverlay: {
//     flex: 1,
//     backgroundColor: 'rgba(0,0,0,0.5)',
//     justifyContent: 'center',
//     alignItems: 'center',
//     padding: 20,
//   },
//   modalCard: {
//     borderRadius: 14,
//     padding: 20,
//     width: '100%',
//     elevation: 5,
//   },
//   modalHeader: {
//     flexDirection: 'row',
//     justifyContent: 'space-between',
//     alignItems: 'center',
//     marginBottom: 16,
//   },
//   modalHeaderActions: {
//     flexDirection: 'row',
//     alignItems: 'center',
//     gap: 12,
//   },
//   editButton: {
//     padding: 4,
//     borderRadius: 20,
//     backgroundColor: 'rgba(33, 150, 243, 0.1)',
//   },
//   modalTitle: {
//     fontSize: FontSize.H3,
//     fontWeight: '700',
//     color: Colors.black,
//     textAlign: 'center',
//     flex: 1,
//   },
//   modalText: {
//     fontSize: FontSize.Body,
//     color: Colors.black,
//     marginBottom: 8,
//   },
// });

// export default ShopCard;
import React, { useState } from 'react';
import {
  StyleSheet,
  View,
  ViewStyle,
  Modal,
  TouchableOpacity,
  ScrollView,
  Text,
} from 'react-native';
import Button from '../Abstracts/Button';
import ValidText from '../Abstracts/ValidText';
import Container from '../Abstracts/Container';
import { Colors, FontSize } from '../Theme';
import { Shop } from '../types/shop';
import Icon from 'react-native-vector-icons/MaterialIcons';

interface ShopCardProps {
  shop: Shop;
  onMarkVisited?: (shopId: string) => void;
  onNewOrder?: (shopId: string) => void;
  style?: ViewStyle;
  alwaysShowNewOrder?: boolean;
}

// Helper function to format days array to readable string
const formatDays = (assignedDaysJson: string): string => {
  try {
    const days = JSON.parse(assignedDaysJson);
    console.log('[formatDays] assignedDaysJson :', assignedDaysJson)
    console.log('[formatDays] days :', days)
    if (!Array.isArray(days) || days.length === 0) return 'No days';
    
    // API uses 0-6 format: 0=Sunday, 1=Monday, ..., 6=Saturday
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    return days.map((d: number) => dayNames[d] || d).join(', ');
  } catch (e) {
    return 'N/A';
  }
};

const ShopCard: React.FC<ShopCardProps> = ({
  shop,
  onMarkVisited,
  onNewOrder,
  style,
  alwaysShowNewOrder,
}) => {
  const [modalVisible, setModalVisible] = useState(false);
  const [ordersModalVisible, setOrdersModalVisible] = useState(false);
  const visited = shop.status === 'Visited';
  const hasOrders = shop.orders && shop.orders.length > 0;
  
  console.log(`[ShopCard] ${shop.name}: visited=${visited}, hasOrders=${hasOrders}, orderCount=${shop.orders?.length || 0}`);

  const handleMarkVisited = () => {
    if (onMarkVisited) onMarkVisited(String(shop.id));
  };

  const handleNewOrder = () => {
    if (onNewOrder) onNewOrder(String(shop.id));
    setModalVisible(false);
  };

  return (
    <>
      <Container
        style={[styles.card, visited ? styles.visited : styles.pending, style]}
        paddingHorizontal={16}
        paddingVertical={16}
      >
        {' '}
        <View style={styles.header}>
          {' '}
          <ValidText text={shop.name} style={styles.shopName} />
          {/* <View
            style={[
              styles.statusPill,
              visited ? styles.visitedPill : styles.pendingPill,
            ]}
          >
            <ValidText
              text={visited ? 'Visited' : 'Pending'}
              style={[
                styles.statusText,
                { color: visited ? Colors.green : Colors.primaryblue },
              ]}
            />{' '}
          </View>{' '} */}
        </View>
        <View style={styles.header}>
          {' '}
          <ValidText text={shop.address || ''} style={styles.shopDetail} />
        </View>
        
        {/* Frequency and Days Info */}
        {shop.frequency && (
          <View style={styles.scheduleInfo}>
            <Icon name="schedule" size={16} color={Colors.primaryblue} />
            <ValidText 
              text={`${shop.frequency.charAt(0).toUpperCase() + shop.frequency.slice(1)}${shop.frequency === 'weekly' && shop.assignedDays ? ` - Days: ${formatDays(shop.assignedDays)}` : ''}`}
              style={styles.scheduleText} 
            />
          </View>
        )}
        {/* <ValidText text={`Owner: ${shop.owner}`} style={styles.shopDetail} /> */}
        <View style={styles.footer}>
          {/* Details opens modal */}
          <Button
            text="Details"
            onPress={() => setModalVisible(true)}
            backgroundColor={visited ? '#f3faf5' : '#faf3ff'}
            color={visited ? Colors.green : Colors.primaryblue}
            width="48%"
            height={42}
            borderRadius={10}
            elevation={2}
            fontSize={FontSize.Button}
          />

          {/* When not visited -> Mark Visit (keeps original logic) */}
          {!visited && onMarkVisited && !alwaysShowNewOrder && (
            <Button
              text="Mark Visit"
              onPress={handleMarkVisited}
              backgroundColor={Colors.primaryblue}
              color={Colors.white}
              width="48%"
              height={42}
              borderRadius={10}
              elevation={2}
              fontSize={FontSize.Button}
            />
          )}

          {/* When visited (or forced) -> show New Order button ONLY if no orders exist */}
          {/* {(visited || alwaysShowNewOrder) && onNewOrder && !hasOrders && (
            <Button
              text="New Order"
              onPress={() => handleNewOrder()}
              backgroundColor={Colors.primaryblue}
              color={Colors.white}
              width="48%"
              height={42}
              borderRadius={10}
              elevation={2}
              fontSize={FontSize.Button}
            />
          )} */}

          {/* Show "View Orders" button if orders already exist */}
          {/* {hasOrders && (
            <Button
              text="View Orders"
              onPress={() => setOrdersModalVisible(true)}
              backgroundColor="#e8f5e9"
              color={Colors.green}
              width="48%"
              height={42}
              borderRadius={10}
              elevation={2}
              fontSize={FontSize.Button}
            />
          )} */}

          {/* Fallback visited disabled button if no onNewOrder provided */}
          {visited && !onNewOrder && !hasOrders && (
            <Button
              text="Visited"
              onPress={() => {}}
              backgroundColor="#f0f0f0"
              color={Colors.grey}
              width="48%"
              height={42}
              borderRadius={10}
              elevation={2}
              fontSize={FontSize.Button}
              disabled={true}
            />
          )}
        </View>
      </Container>

      {/* Modal: shop details */}
      <Modal
        visible={modalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View
            style={[
              styles.modalCard,
              visited ? styles.visited : styles.pending,
            ]}
          >
            <View style={styles.modalHeader}>
              <ValidText text="Shop Details" style={styles.modalTitle} />
              <TouchableOpacity
                onPress={() => setModalVisible(false)}
                style={styles.closeIcon}
              >
                <Icon name="close" size={22} color={Colors.grey} />
              </TouchableOpacity>
            </View>

            <ValidText text={`Name: ${shop.name}`} style={styles.modalText} />
            {/* <ValidText text={`Owner: ${shop.owner}`} style={styles.modalText} /> */}
            <ValidText
              text={`Address: ${shop.address}`}
              style={styles.modalText}
            />
            <ValidText
              text={`Phone: ${shop.phone ?? '-'}`}
              style={styles.modalText}
            />
            <ValidText
              text={`Status: ${shop.status}`}
              style={styles.modalText}
            />
            {shop.frequency && (
              <ValidText
                text={`Frequency: ${shop.frequency.charAt(0).toUpperCase() + shop.frequency.slice(1)}`}
                style={styles.modalText}
              />
            )}
            {shop.frequency === 'weekly' && shop.assignedDays && (
              <ValidText
                text={`Assigned Days: ${formatDays(shop.assignedDays)}`}
                style={styles.modalText}
              />
            )}
            {shop.lastVisited && (
              <ValidText
                text={`Last Visited: ${shop.lastVisited}`}
                style={styles.modalText}
              />
            )}

            {/* Modal actions: Close (full width) + Edit if available */}
            <View style={styles.modalActionsRow}>
              <Button
                text="Close"
                onPress={() => setModalVisible(false)}
                backgroundColor={visited ? '#f3faf5' : '#faf3ff'}
                color={visited ? Colors.green : Colors.primaryblue}
                width="100%"
                height={42}
                borderRadius={10}
                fontSize={FontSize.Button}
              />
              {/* Show Edit button inside modal only if onEdit exists */}
              {/* {onEdit && (
            <Button
              text="Edit"
              onPress={handleEdit}
              backgroundColor={Colors.primaryblue}
              color={Colors.white}
              width="100%"
              height={42}
              borderRadius={10}
              fontSize={FontSize.Button}
              style={{ marginTop: 8 }}
            />
          )} */}
            </View>
          </View>
        </View>
      </Modal>

      {/* Orders Modal */}
      <Modal
        visible={ordersModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setOrdersModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            {/* Modal Header */}
            <View style={styles.modalHeader}>
              <View style={{ flex: 1 }}>
                <ValidText text={shop.name} style={styles.modalTitle} />
                <Text style={styles.modalSubtitle}>
                  {shop.lastVisited || 'Recent Visit'}
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => setOrdersModalVisible(false)}
                style={styles.closeIcon}
              >
                <Icon name="close" size={22} color={Colors.grey} />
              </TouchableOpacity>
            </View>

            {/* Modal Content */}
            <ScrollView
              style={styles.modalContent}
              contentContainerStyle={{ paddingBottom: 20 }}
              showsVerticalScrollIndicator={false}
            >
              {/* Shop Address */}
              <View style={styles.modalSection}>
                <Icon name="location-on" size={18} color={Colors.primaryblue} />
                <Text style={styles.modalSectionText}>
                  {shop.address || 'No address'}
                </Text>
              </View>

              {/* Orders List */}
              <View style={styles.ordersSection}>
                <Text style={styles.sectionTitle}>
                  Orders ({shop.orders?.length || 0})
                </Text>

                {shop.orders && shop.orders.length > 0 ? (
                  shop.orders.map((order: any, idx: number) => (
                    <View
                      key={order._id || order.id || idx}
                      style={styles.orderItem}
                    >
                      <View style={styles.orderHeader}>
                        <Text style={styles.orderName}>{order.name}</Text>
                        <Text style={styles.orderQuantity}>
                          Qty: {order.quantity}
                        </Text>
                      </View>

                      <View style={styles.orderPriceRow}>
                        <View style={styles.priceItem}>
                          <Text style={styles.priceLabel}>Current Price:</Text>
                          <Text style={styles.priceValue}>
                            Rs. {order.price}
                          </Text>
                        </View>
                        <View style={styles.priceItem}>
                          <Text style={styles.priceLabel}>New Price:</Text>
                          <Text
                            style={[
                              styles.priceValue,
                              order.newPrice !== order.price &&
                                styles.highlightPrice,
                            ]}
                          >
                            Rs. {order.newPrice}
                          </Text>
                        </View>
                      </View>

                      <View style={styles.orderTotal}>
                        <Text style={styles.totalLabel}>Total:</Text>
                        <Text style={styles.totalValue}>
                          Rs. {(order.newPrice * order.quantity).toFixed(2)}
                        </Text>
                      </View>
                    </View>
                  ))
                ) : (
                  <View style={styles.emptyOrders}>
                    <Icon name="shopping-cart" size={48} color={Colors.grey} />
                    <Text style={styles.emptyOrdersText}>No orders placed</Text>
                  </View>
                )}
              </View>

              {/* Notes Section */}
              {shop.notes && (
                <View style={styles.notesSection}>
                  <Text style={styles.sectionTitle}>Notes</Text>
                  <Text style={styles.notesText}>{shop.notes}</Text>
                </View>
              )}

              {/* Grand Total */}
              {shop.orders && shop.orders.length > 0 && (
                <View style={styles.grandTotalSection}>
                  <Text style={styles.grandTotalLabel}>Grand Total</Text>
                  <Text style={styles.grandTotalValue}>
                    Rs.{' '}
                    {shop.orders
                      .reduce(
                        (sum: number, order: any) =>
                          sum + order.newPrice * order.quantity,
                        0,
                      )
                      .toFixed(2)}
                  </Text>
                </View>
              )}
            </ScrollView>

            {/* Modal Footer */}
            <View style={styles.modalActionsRow}>
              <Button
                text="Close"
                onPress={() => setOrdersModalVisible(false)}
                backgroundColor="#faf3ff"
                color={Colors.primaryblue}
                width="100%"
                height={42}
                borderRadius={10}
                fontSize={FontSize.Button}
              />
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
};

const styles = StyleSheet.create({
  card: {
    flex: 1,
    borderRadius: 14,
    elevation: 3,
    backgroundColor: Colors.white,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    marginBottom: 12,
  },
  visited: {
    borderLeftWidth: 6,
    borderLeftColor: Colors.green,
    backgroundColor: '#f3faf5',
  },
  pending: {
    borderLeftWidth: 6,
    borderLeftColor: Colors.primaryblue,
    backgroundColor: '#f7faff',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
    alignItems: 'center',
  },
  shopName: {
    fontSize: FontSize.Subhead,
    fontWeight: '700',
    color: Colors.black,
    flex: 1,
    marginRight: 10,
  },
  statusPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    elevation: 1,
  },
  visitedPill: { backgroundColor: '#e0f5e8' },
  pendingPill: { backgroundColor: '#e7f0ff' },
  statusText: { fontSize: FontSize.Caption, fontWeight: '700' },
  shopDetail: {
    fontSize: FontSize.Body,
    color: Colors.grey,
    marginBottom: 4,
  },
  scheduleInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    paddingHorizontal: 8,
    paddingVertical: 6,
    backgroundColor: '#f0f7ff',
    borderRadius: 8,
  },
  scheduleText: {
    fontSize: FontSize.Caption,
    color: Colors.primaryblue,
    marginLeft: 6,
    fontWeight: '600',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 14,
  },

  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalCard: {
    borderRadius: 14,
    padding: 20,
    width: '100%',
    elevation: 5,
    backgroundColor: Colors.white,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  closeIcon: {
    marginLeft: 'auto',
  },
  modalTitle: {
    fontSize: FontSize.H3,
    fontWeight: '700',
    color: Colors.black,
  },
  modalText: {
    fontSize: FontSize.Body,
    color: Colors.black,
    marginBottom: 8,
  },
  modalActionsRow: {
    marginTop: 12,
  },
  modalSubtitle: {
    fontSize: FontSize.Caption,
    color: Colors.grey,
    marginTop: 4,
  },
  modalContent: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    maxHeight: 400,
  },
  modalSection: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  modalSectionText: {
    fontSize: FontSize.Body,
    color: Colors.grey,
    marginLeft: 8,
    flex: 1,
  },
  ordersSection: {
    marginTop: 16,
  },
  sectionTitle: {
    fontSize: FontSize.H3,
    fontWeight: '700',
    color: Colors.black,
    marginBottom: 12,
  },
  orderItem: {
    backgroundColor: '#f7faff',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    borderLeftWidth: 4,
    borderLeftColor: Colors.primaryblue,
  },
  orderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  orderName: {
    fontSize: FontSize.Body,
    fontWeight: '700',
    color: Colors.black,
    flex: 1,
  },
  orderQuantity: {
    fontSize: FontSize.Body,
    fontWeight: '600',
    color: Colors.primaryblue,
    backgroundColor: Colors.white,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  orderPriceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  priceItem: {
    flex: 1,
  },
  priceLabel: {
    fontSize: FontSize.Caption,
    color: Colors.grey,
    marginBottom: 2,
  },
  priceValue: {
    fontSize: FontSize.Body,
    fontWeight: '600',
    color: Colors.black,
  },
  highlightPrice: {
    color: Colors.green,
  },
  orderTotal: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  totalLabel: {
    fontSize: FontSize.Body,
    fontWeight: '600',
    color: Colors.grey,
  },
  totalValue: {
    fontSize: FontSize.H3,
    fontWeight: '700',
    color: Colors.primaryblue,
  },
  emptyOrders: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  emptyOrdersText: {
    fontSize: FontSize.Body,
    color: Colors.grey,
    marginTop: 12,
  },
  notesSection: {
    marginTop: 16,
    backgroundColor: '#fffbf0',
    padding: 12,
    borderRadius: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#ffa500',
  },
  notesText: {
    fontSize: FontSize.Body,
    color: Colors.grey,
    lineHeight: 20,
  },
  grandTotalSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 16,
    backgroundColor: Colors.primaryblue,
    padding: 16,
    borderRadius: 12,
  },
  grandTotalLabel: {
    fontSize: FontSize.H3,
    fontWeight: '700',
    color: Colors.white,
  },
  grandTotalValue: {
    fontSize: FontSize.H2,
    fontWeight: '700',
    color: Colors.white,
  },
});

export default ShopCard;
