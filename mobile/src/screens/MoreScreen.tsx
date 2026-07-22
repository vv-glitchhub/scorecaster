import { Pressable, ScrollView, Text, View } from "react-native";
import { useLanguage } from "../i18n";
import type { Tab } from "../types";
import { Card, styles } from "../ui";

type MoreScreenProps = {
  onNavigate: (tab: Tab) => void;
};

export default function MoreScreen({ onNavigate }: MoreScreenProps) {
  const { tr } = useLanguage();

  const items: Array<{
    tab: Tab;
    eyebrow: string;
    title: string;
    description: string;
    badge?: string;
  }> = [
    {
      tab: "watchlist",
      eyebrow: tr({ fi: "SEURANTA", en: "TRACKING", es: "SEGUIMIENTO" }),
      title: tr({ fi: "Seurantalista ja hälytykset", en: "Watchlist and alerts", es: "Seguimiento y alertas" }),
      description: tr({ fi: "Seuraa hinnan ja päätöksen muutoksia varmennetuissa otteluissa.", en: "Track price and decision changes in verified events.", es: "Sigue cambios de cuota y decisión en eventos verificados." }),
      badge: "V2"
    },
    {
      tab: "analytics",
      eyebrow: tr({ fi: "SUORITUSKYKY", en: "PERFORMANCE", es: "RENDIMIENTO" }),
      title: tr({ fi: "Tulokset ja kalibrointi", en: "Results and calibration", es: "Resultados y calibración" }),
      description: tr({ fi: "Tarkista ROI, CLV, osumatarkkuus ja ratkaistun otoksen koko.", en: "Review ROI, CLV, hit rate and settled sample size.", es: "Revisa ROI, CLV, acierto y tamaño de muestra." }),
      badge: "V11"
    },
    {
      tab: "settings",
      eyebrow: tr({ fi: "TILI", en: "ACCOUNT", es: "CUENTA" }),
      title: tr({ fi: "Profiili ja asetukset", en: "Profile and settings", es: "Perfil y ajustes" }),
      description: tr({ fi: "Kieli, pilvitili, tietosuoja, vienti ja tilin poistaminen.", en: "Language, cloud account, privacy, export and account deletion.", es: "Idioma, cuenta, privacidad, exportación y eliminación." })
    }
  ];

  return (
    <ScrollView contentContainerStyle={styles.screen}>
      <View style={styles.mobileHero}>
        <Text style={styles.kicker}>{tr({ fi: "SCORECASTER MOBILE", en: "SCORECASTER MOBILE", es: "SCORECASTER MOBILE" })}</Text>
        <Text style={styles.title}>{tr({ fi: "Lisää työkalut ilman ahdasta alapalkkia", en: "More tools without a crowded tab bar", es: "Más herramientas sin una barra saturada" })}</Text>
        <Text style={styles.subtitle}>{tr({ fi: "Päivittäiset päätoiminnot pysyvät alapalkissa. Seuranta, analytiikka ja profiili löytyvät tästä keskuksesta.", en: "Daily primary actions stay in the tab bar. Tracking, analytics and profile live in this hub.", es: "Las acciones diarias quedan en la barra. Seguimiento, analítica y perfil están aquí." })}</Text>
      </View>

      {items.map((item) => (
        <Pressable
          accessibilityLabel={item.title}
          accessibilityRole="button"
          key={item.tab}
          onPress={() => onNavigate(item.tab)}
          style={({ pressed }) => [pressed && styles.cardPressed]}
        >
          <Card>
            <View style={styles.rowBetween}>
              <Text style={styles.kicker}>{item.eyebrow}</Text>
              {item.badge ? <View style={styles.badge}><Text style={styles.badgeText}>{item.badge}</Text></View> : null}
            </View>
            <Text style={styles.cardTitle}>{item.title}</Text>
            <Text style={styles.muted}>{item.description}</Text>
            <Text style={styles.openLabel}>{tr({ fi: "Avaa", en: "Open", es: "Abrir" })} →</Text>
          </Card>
        </Pressable>
      ))}

      <Card>
        <Text style={styles.cardTitle}>{tr({ fi: "Paperitila säilyy kaikkialla", en: "Paper mode stays everywhere", es: "El modo simulado permanece" })}</Text>
        <Text style={styles.muted}>{tr({ fi: "Mobiilisovellus ei käsittele talletuksia, vedonvälittäjätilejä tai oikean rahan vetoja.", en: "The mobile app does not handle deposits, bookmaker accounts or real-money bets.", es: "La app no gestiona depósitos, cuentas de apuestas ni apuestas con dinero real." })}</Text>
      </Card>
    </ScrollView>
  );
}
