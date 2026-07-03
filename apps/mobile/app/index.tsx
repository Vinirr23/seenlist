import { View, Text, StyleSheet } from "react-native";
import { colors } from "@seenlist/config";

export default function RootScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.text}>
        SeenList — base do projeto pronta (TASK-001). Nenhuma tela de produto
        foi criada aqui de propósito.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 32,
    backgroundColor: colors.background,
  },
  text: {
    color: colors.muted,
    fontSize: 13,
    textAlign: "center",
  },
});
