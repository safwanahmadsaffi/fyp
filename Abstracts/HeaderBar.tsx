// Abstracts/HeaderBar.tsx
import React from "react";
import { View, Text, TouchableOpacity, StyleSheet, StatusBar, SafeAreaView } from "react-native";
import Icon from "react-native-vector-icons/MaterialIcons";
import { useNavigation } from "@react-navigation/native";

type Props = {
  title: string;
  showBack?: boolean;
};

const HeaderBar: React.FC<Props> = ({ title, showBack = true }) => {
  const navigation = useNavigation();

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar
        backgroundColor="transparent"
        barStyle="dark-content"
        translucent={true}
      />
      <View style={styles.container}>
        {showBack ? (
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.icon}>
            <Icon name="arrow-back" size={24} color="#000" />
          </TouchableOpacity>
        ) : (
          <View style={styles.iconPlaceholder} />
        )}
        <Text style={styles.title}>{title}</Text>
        <View style={styles.iconPlaceholder} />
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    backgroundColor: 'transparent',
    zIndex: 100,
  },
  container: {
    flexDirection: "row",
    alignItems: "center",
    alignContent:'center',
    justifyContent: "space-between",
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
  },
  icon: {
    width: 40,
    left:'5%',
    justifyContent: "center",
    alignItems: "flex-start",
  },
  iconPlaceholder: {
    width: 40,
  },
  title: {
    flex: 1,
    fontSize: 20,
    fontWeight: "600",
    color: "#000",
    textAlign: "center",
  },
});

export default HeaderBar;
