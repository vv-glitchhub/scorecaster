import { ScrollView } from "react-native";
import { styles } from "../ui";
import MissionControlV13Panel from "./MissionControlV13Panel";

export default function MissionControlV13Screen() {
  return <ScrollView contentContainerStyle={styles.screen}><MissionControlV13Panel /></ScrollView>;
}
